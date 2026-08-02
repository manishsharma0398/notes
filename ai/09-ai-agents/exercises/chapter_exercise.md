# Chapter 9 Exercise: Build a Raw Agent Loop from Scratch

**Time estimate:** 45–75 minutes  
**Concepts tested:** Function calling wire format, agent loop control flow, Pydantic validation, tool design, error handling

---

## Problem Statement

You will build a **file system assistant agent** — a simple but realistic agent that can answer questions about files in a directory by calling tools. You will implement the full agent loop from scratch using only the raw OpenAI API (no LangChain, no abstractions).

The agent should be able to handle queries like:
- "How many Python files are in this directory?"
- "What is the total size in KB of all JSON files?"
- "List all files larger than 10KB and show their sizes."
- "Does a file named `config.py` exist in this directory?"
- "What is the combined line count of all `.md` files?"

---

## Acceptance Criteria

- [ ] Agent loop correctly handles `finish_reason == "tool_calls"` vs `"stop"`
- [ ] At least 3 tools: `list_files`, `get_file_info`, `read_file_head`
- [ ] Tool arguments validated with Pydantic before execution
- [ ] Tool errors returned to LLM as observations (not crashes)
- [ ] Hard limit of 8 iterations maximum
- [ ] Token usage printed at the end of each run
- [ ] Agent correctly answers all 5 example queries above

---

## Starter Code

```python
"""
chapter_exercise_solution.py
File System Assistant Agent — implement the TODOs to complete this exercise.
"""

import json
import os
from pathlib import Path
from pydantic import BaseModel, Field
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ─────────────────────────────────────────────────────────────
# SECTION 1: Pydantic arg models (validate what the LLM sends)
# ─────────────────────────────────────────────────────────────

class ListFilesArgs(BaseModel):
    # TODO: Define fields for listing files in a directory
    # Fields needed: directory path, optional extension filter (e.g. ".py")
    pass


class GetFileInfoArgs(BaseModel):
    # TODO: Define fields for getting info about a specific file
    # Fields needed: file path
    pass


class ReadFileHeadArgs(BaseModel):
    # TODO: Define fields for reading the first N lines of a file
    # Fields needed: file path, number of lines (default 10, max 50)
    pass


# ─────────────────────────────────────────────────────────────
# SECTION 2: Tool implementations
# ─────────────────────────────────────────────────────────────

def list_files(directory: str, extension: str = None) -> dict:
    """
    TODO: List files in the given directory.
    - Return: list of {"name": str, "size_bytes": int, "is_file": bool}
    - If extension is provided (e.g. ".py"), filter to only those files
    - Handle FileNotFoundError and PermissionError gracefully
    - Return at most 20 files to keep context small
    """
    pass


def get_file_info(file_path: str) -> dict:
    """
    TODO: Get metadata about a specific file.
    - Return: {"exists": bool, "size_bytes": int, "size_kb": float, "line_count": int}
    - line_count should only be populated for text files (skip binary)
    - Handle errors gracefully
    """
    pass


def read_file_head(file_path: str, num_lines: int = 10) -> dict:
    """
    TODO: Read the first num_lines of a file.
    - Return: {"file": str, "lines": list[str], "total_shown": int}
    - Cap num_lines at 50 (don't let the LLM read unlimited lines)
    - Handle encoding errors (use errors='replace')
    """
    pass


# ─────────────────────────────────────────────────────────────
# SECTION 3: Tool definitions (JSON schemas sent to the API)
# ─────────────────────────────────────────────────────────────

# TODO: Define TOOL_DEFINITIONS list with all 3 tools
# Each entry should have "type": "function" and the function schema
# Write descriptions that clearly distinguish when to use each tool
TOOL_DEFINITIONS = [
    # TODO: list_files schema
    # TODO: get_file_info schema
    # TODO: read_file_head schema
]

# ─────────────────────────────────────────────────────────────
# SECTION 4: Tool dispatch with validation
# ─────────────────────────────────────────────────────────────

TOOL_MAP = {
    "list_files": (ListFilesArgs, list_files),
    "get_file_info": (GetFileInfoArgs, get_file_info),
    "read_file_head": (ReadFileHeadArgs, read_file_head),
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

    # TODO: implement dispatch here
    pass


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
    
    messages = [
        # TODO: system message
        # TODO: user message with query
    ]
    
    for iteration in range(MAX_ITERATIONS):
        # TODO: call API
        # TODO: check finish_reason
        # TODO: handle tool calls
        # TODO: handle stop
        pass
    
    return f"Agent timed out after {MAX_ITERATIONS} iterations. Tokens used: {total_tokens}"


# ─────────────────────────────────────────────────────────────
# SECTION 6: Test it
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Test against the current directory (or change to any directory you have)
    test_dir = "."  # or "/path/to/your/project"
    
    queries = [
        f"How many Python files are in {test_dir}?",
        f"What is the total size in KB of all files in {test_dir}?",
        f"List all files larger than 1KB in {test_dir} and show their sizes.",
    ]
    
    for q in queries:
        print(f"\n{'='*60}")
        result = run_agent(q, working_directory=test_dir)
        print(f"FINAL: {result}")
```

---

## Hints

<details>
<summary>Hint 1: Pydantic arg models</summary>

For `ListFilesArgs`, the LLM will pass `directory` (string) and optionally `extension` (string like `.py`). Use `Optional[str] = None` for the optional field.

For `ReadFileHeadArgs`, use `Field(default=10, ge=1, le=50)` to enforce the line count constraint at the validation level.

</details>

<details>
<summary>Hint 2: list_files implementation</summary>

```python
path = Path(directory)
files = []
for item in path.iterdir():
    if item.is_file():
        if extension is None or item.suffix == extension:
            files.append({"name": item.name, "size_bytes": item.stat().st_size})
return {"files": files[:20], "total_shown": min(len(files), 20)}
```

</details>

<details>
<summary>Hint 3: dispatch_tool error handling pattern</summary>

```python
try:
    validated = arg_model(**json.loads(raw_args))
except (json.JSONDecodeError, Exception) as e:
    return json.dumps({"error": f"Invalid args: {e}"})

try:
    result = func(**validated.model_dump())
    return json.dumps(result)
except Exception as e:
    return json.dumps({"error": str(e)})
```

</details>

<details>
<summary>Hint 4: Message structure for tool results</summary>

After running a tool call, you need to append TWO messages:
```python
# 1. The assistant message (contains the tool_calls)
messages.append(response.choices[0].message)  # the OpenAI message object works directly

# 2. The tool result
messages.append({
    "role": "tool",
    "tool_call_id": tool_call.id,  # must match the call ID
    "content": result_str          # JSON string
})
```

If a single response has multiple tool calls, append all their results before calling the API again.

</details>

---

## What to Verify

- [ ] Run with `"How many Python files are in this directory?"` — does it use `list_files` with `extension=".py"`?
- [ ] Run with a file size query — does the agent use `get_file_info` for specific files?
- [ ] Deliberately pass an invalid directory (e.g. `/nonexistent`) — does the agent handle it gracefully and tell you, rather than crashing?
- [ ] Check the printed token count — does it increase with each iteration?
- [ ] Add a `print(json.dumps(messages, indent=2, default=str))` at the start of each iteration to see the full message history growing — does it make sense?
- [ ] Count the number of API calls for a multi-step query — does it match the number of tool calls + 1?
