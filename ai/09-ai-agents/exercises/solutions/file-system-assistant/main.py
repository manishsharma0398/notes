from collections.abc import Callable
from pathlib import Path
from typing import Any
from pydantic import BaseModel, ValidationError
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionToolUnionParam
import json
from dotenv import load_dotenv

load_dotenv()

SKIP_DIRS = [".venv", "node_modules", ".git", "__pycache__"]

openai_client = OpenAI()

# ─────────────────────────────────────────────────────────────
# SECTION 1: Pydantic arg models (validate what the LLM sends)
# ─────────────────────────────────────────────────────────────


class ListFileArgs(BaseModel):
    directory: str
    extensions: list[str] = ["*"]
    recursive: bool = False


class FileInfo(BaseModel):
    name: str
    size_bytes: int
    is_file: bool


class GetFileInfoArgs(BaseModel):
    file_path: str


class FileMetadata(BaseModel):
    exists: bool = False
    size_bytes: int = 0
    size_kb: float = 0
    line_count: int = 0


# ─────────────────────────────────────────────────────────────
# SECTION 2: Tool implementations
# ─────────────────────────────────────────────────────────────


def list_files(
    directory: str,
    extensions: list[str] = ["*"],
    recursive: bool = False,
) -> list[dict] | dict:
    """
    - Return: list of {"name": str, "size_bytes": int, "is_file": bool}
    - If extension is provided (e.g. ".py"), filter to only those files
    - Handle FileNotFoundError and PermissionError gracefully
    - Return at most 20 files to keep context small
    """
    dir = Path(directory)
    results: list[Path] = []
    try:
        if recursive:
            for root, dirs, filenames in dir.walk():
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for file in filenames:
                    path = Path(root) / file
                    if "*" in extensions or any(
                        file.endswith(ext) for ext in extensions
                    ):
                        results.append(path)
        else:
            for f in dir.glob("*"):
                if f.is_file() and (
                    "*" in extensions or any(f.name.endswith(ext) for ext in extensions)
                ):
                    results.append(f)
    except (FileNotFoundError, PermissionError) as e:
        return {"error": str(e)}

    # Return at most 20 files
    if len(results) > 20:
        results = results[:20]

    # Convert to the desired format — model_dump() so the result is JSON-serializable
    return [
        FileInfo(
            name=path.name,
            size_bytes=path.stat().st_size if path.is_file() else 0,
            is_file=path.is_file(),
        ).model_dump()
        for path in results
    ]


def get_file_info(file_path: str) -> dict:
    """
    - Return: {"exists": bool, "size_bytes": int, "size_kb": float, "line_count": int}
    - line_count should only be populated for text files (skip binary)
    - Handle errors gracefully
    """
    file = Path(file_path)
    result = FileMetadata()
    try:
        if file.exists():
            result.exists = True
            size_in_bytes = file.stat().st_size
            result.size_bytes = size_in_bytes
            result.size_kb = size_in_bytes / 1024
            try:
                result.line_count = len(file.read_text(encoding="utf-8").splitlines())
            except UnicodeDecodeError:
                result.line_count = 0  # binary file — skip
        return result.model_dump()
    except PermissionError as e:
        print("error", str(e))
        return result.model_dump()


# ─────────────────────────────────────────────────────────────
# SECTION 3: Tool definitions (JSON schemas sent to the API)
# ─────────────────────────────────────────────────────────────

# TODO: Define TOOL_DEFINITIONS list with all 3 tools
# Each entry should have "type": "function" and the function schema
# Write descriptions that clearly distinguish when to use each tool
TOOL_DEFINITIONS: list[ChatCompletionToolUnionParam] = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files in a directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory to list files (e.g ./docs, ./files)",
                    },
                    "extensions": {
                        "type": "array",
                        "description": """list of extensions to filter out, list all files by default (e.g. [".py"], ["*"], [".txt", ".py", ".js"])""",
                        "default": ["*"],
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Whether to recursively search in the directory (e.g. False, True)",
                        "default": False,
                    },
                },
                "required": ["directory"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_info",
            "description": ("Get info of provided file"),
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "path of the file (e.g. ./docs/python.py)",
                    }
                },
                "required": ["file_path"],
            },
        },
    },
    # TODO: read_file_head schema
]

# ─────────────────────────────────────────────────────────────
# SECTION 4: Tool dispatch with validation
# ─────────────────────────────────────────────────────────────

# name -> (Pydantic model that validates the LLM's arguments, function to run)
TOOL_MAP: dict[str, tuple[type[BaseModel], Callable[..., Any]]] = {
    "list_files": (ListFileArgs, list_files),
    "get_file_info": (GetFileInfoArgs, get_file_info),
    # "read_file_head": (ReadFileHeadArgs, read_file_head),
}


def dispatch_tool(tool_call) -> str:
    """
    TODO: Implement tool dispatch with Pydantic validation.
    Steps:
    1. Get tool name and parse raw JSON arguments
    2. Look up the arg model and function in TOOL_MAP
    3. Validate arguments with Pydantic (catch ValidationError)
    4. Call the function with validated args
    5. Catch any execution exceptions and return as error dict
    6. Return result as JSON string

    Important: NEVER let this function raise — all errors must be returned
    as JSON strings so the LLM can reason about them.
    """
    name = tool_call.function.name
    raw_args = tool_call.function.arguments

    print(f"\n  [TOOL CALL] {name}({raw_args})")

    if name not in TOOL_MAP:
        result = {"error": f"Unknown tool: {name}"}
    else:
        arg_model, func = TOOL_MAP[name]
        try:
            validated = arg_model.model_validate_json(raw_args)
        except ValidationError as e:
            return json.dumps({"error": "invalid arguments", "details": e.errors()})

        try:
            result = func(**validated.model_dump())
        except Exception as e:
            return json.dumps({"error": f"{type(e).__name__}: {e}"})

    print(f"  [TOOL RESULT] {result}")

    # Last line of defence: a non-serializable return value must not kill the loop.
    try:
        return json.dumps(result)
    except TypeError as e:
        return json.dumps({"error": f"Tool result was not serializable: {e}"})


# ─────────────────────────────────────────────────────────────
# SECTION 5: The agent loop
# ─────────────────────────────────────────────────────────────


def run_agent(query: str, working_directory: str = ".") -> str:
    """
    TODO: Implement the agent loop.

    The system prompt should tell the agent:
    - It's a file system assistant
    - The working directory it should operate on
    - To always use tools for file operations, not guess

    The loop should:
    1. Call the API with current messages and tool definitions
    2. If finish_reason == "stop": return the final answer
    3. If finish_reason == "tool_calls": dispatch each tool, append results, loop
    4. Stop after MAX_ITERATIONS (set to 8) and return a timeout message
    5. Print token usage after each API call
    """
    MAX_ITERATIONS = 8
    total_tokens = 0

    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": "You are a helpful file system assistant\n"
            f"Use tools to perform file and directories operations in directory:{working_directory}\n"
            "If asked any other thing except file system, file and directory info meta, operations just answer I can't do it",
        },
        {"role": "user", "content": query},
    ]

    print(f"\n{'='*60}")
    print(f"USER: {query}")
    print(f"{'='*60}")

    for iteration in range(MAX_ITERATIONS):
        print(
            f"\n[Iteration {iteration + 1}] Calling LLM with {len(messages)} messages..."
        )
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0,
            max_completion_tokens=500,
        )
        res = response.choices[0].message
        answer = res.content
        finish_reason = response.choices[0].finish_reason
        token_used = response.usage.total_tokens if response.usage else 0
        total_tokens += token_used

        print(f"Token used in this iteration: {token_used}")
        print(f"  finish_reason: {finish_reason}")

        if finish_reason == "stop":
            print(f"\nASSISTANT: {answer}")
            return answer or ""

        if finish_reason == "tool_calls":
            # Dump the assistant message back to a plain dict — the API accepts the
            # model object at runtime, but the typed param is a TypedDict.
            messages.append(res.model_dump(exclude_none=True))  # type: ignore[arg-type]

            for tool_call in res.tool_calls or []:
                result_str = dispatch_tool(tool_call)

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str,
                    }
                )

            continue

    return f"Agent timed out after {MAX_ITERATIONS} iterations. Tokens used: {total_tokens}"


if __name__ == "__main__":
    test_dir = "./"  # or "/path/to/your/project"

    queries = [
        f"How many Python files are in {test_dir}?",
        f"What is the total size in KB of all files in {test_dir}?",
        f"List all files larger than 1KB in {test_dir} and show their sizes.",
    ]

    for q in queries:
        print(f"\n{'='*60}")
        result = run_agent(q, working_directory=test_dir)
        print(f"FINAL: {result}")
