from pathlib import Path
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────
# SECTION 1: Pydantic arg models (validate what the LLM sends)
# ─────────────────────────────────────────────────────────────


class ListFilesArgs(BaseModel):
    dir_path: Path
    file_extension: str | None
    recursive: bool = False
    verbose: bool = False


# ─────────────────────────────────────────────────────────────
# SECTION 2: Tool implementations
# ─────────────────────────────────────────────────────────────


def list_files(
    directory: str,
    extension: str = "*",
    recursive: bool = False,
):
    """
    TODO: List files in the given directory.
    - Return: list of {"name": str, "size_bytes": int, "is_file": bool}
    - If extension is provided (e.g. ".py"), filter to only those files
    - Handle FileNotFoundError and PermissionError gracefully
    - Return at most 20 files to keep context small
    """
    dir = Path(directory)
    if recursive:
        files = [f.name for f in dir.rglob(extension) if f.is_file()]
    else:
        files = [f.name for f in dir.glob(extension) if f.is_file()]
    print(files)


def main():
    print("Hello from file-system-assistant!")


if __name__ == "__main__":
    list_files("./", "*.py")

# Not with rglob itself — glob patterns can't express negation, and there's no exclude parameter. You have two real options, and the difference between them matters.

# Filter after — simplest, and fine for small trees:


# SKIP = {".venv", "node_modules", ".git", "__pycache__"}
# files = [f for f in dir.rglob(pattern)
#          if f.is_file() and not (SKIP & set(f.relative_to(dir).parts))]
# The catch: rglob has already descended into .venv by the time you filter. You pay the full walk — every stat, every directory — and only then throw the results away. On the tree you just ran that's ~120 wasted entries; on a node_modules it's tens of thousands.

# Prune during — actually skips the subtree. You're on 3.13, so Path.walk() (3.12+) does this:


# for root, dirs, filenames in dir.walk():
#     dirs[:] = [d for d in dirs if d not in SKIP]   # in-place slice assignment
#     ...
# The dirs[:] = ... is the whole trick, and it has to be the in-place slice — dirs = [...] rebinds a local and the walker never sees it. Mutating the list tells the walker which subdirectories to descend into, so .venv is never opened at all. (os.walk behaves identically if you prefer strings.)

# Since you're already matching an extension, you'd combine that with fnmatch.fnmatch(name, pattern) on the filenames inside the loop, which also gets you the early-exit for your 20-file cap — you can return the moment you have 20 instead of walking the entire tree first. rglob can't do that for you either, though it is a generator, so itertools.islice over it gets you the same laziness if you stay with the filter-after approach.

# For a file-system agent tool I'd lean toward Path.walk() with pruning: the skip-list is something you want to state explicitly anyway, since an LLM pointing this tool at a repo root is the normal case, not the edge case.
