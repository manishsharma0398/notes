from pathlib import Path
from .models import FileInfo, FileMetadata

SKIP_DIRS = [".venv", "node_modules", ".git", "__pycache__"]


# ─────────────────────────────────────────────────────────────
# SECTION 1: Pydantic arg models (validate what the LLM sends)
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
