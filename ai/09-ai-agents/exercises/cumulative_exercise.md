# Cumulative Exercise: AI-Powered Code Review Agent

**Time estimate:** 2–4 hours  
**Chapters integrated:** 1–9 (LLM fundamentals, prompt engineering, APIs, Python patterns, LangChain, vector DBs, RAG, Advanced RAG, Agents)

---

## Project Brief

You will build a **Code Review Agent** — a tool that a developer can point at a Python file (or small project) and get a structured, actionable code review back.

This is a realistic tool you'd actually want. It integrates everything you've learned:
- **LLM fundamentals** (context window management, token cost awareness)
- **Prompt engineering** (system prompts, structured output, few-shot examples)
- **LLM APIs** (streaming, retry handling)
- **RAG** (index a codebase's own documentation/README to give the agent context about the project's patterns)
- **Agents** (the reviewer doesn't just read one file — it decides which files to look at, what to analyze, and in what order)
- **Structured output** (Pydantic models for the review result)

---

## What It Does

```
Developer runs:
  python review_agent.py --path ./my_project/

Agent:
  1. Lists files in the project
  2. Decides which files to review (based on size, type, importance)
  3. Reads each file
  4. (Optional) Queries a pre-built vector index of the project README/docs
     to understand the project's own conventions
  5. Produces a structured review:
     - Overall assessment (score 1-10)
     - Per-file issues (severity: critical/warning/info)
     - Specific line-level suggestions
     - 3 top recommendations

Output: a review.json file + a human-readable review.md
```

---

## Phases

### Phase 1: File System Tools (30–45 min)

Build the agent's file-reading tools:

```python
@tool
def list_project_files(directory: str, extensions: list[str]) -> dict:
    """Return files with size, filtered by extension. Cap at 30 files."""
    ...

@tool
def read_file(file_path: str, max_lines: int = 200) -> dict:
    """Read a file's content. Truncate at max_lines."""
    ...

@tool
def get_file_stats(file_path: str) -> dict:
    """Return: line count, function count, import count, TODO count."""
    ...
```

**Success criteria:**
- [ ] `list_project_files` returns files sorted by size (largest first)
- [ ] `read_file` truncates long files with a note showing what was cut
- [ ] `get_file_stats` uses regex to count `def `, `import `, `# TODO`

---

### Phase 2: Structured Review Output (30 min)

Define the Pydantic models for the review result:

```python
from pydantic import BaseModel
from enum import Enum

class Severity(str, Enum):
    CRITICAL = "critical"   # bugs, security issues, broken logic
    WARNING = "warning"     # performance, maintainability problems
    INFO = "info"           # style, minor improvements

class Issue(BaseModel):
    file: str
    line_hint: str          # e.g. "line 42" or "function get_user"
    severity: Severity
    title: str
    description: str
    suggestion: str

class CodeReview(BaseModel):
    overall_score: int      # 1-10
    summary: str            # 2-3 sentences
    issues: list[Issue]
    top_recommendations: list[str]  # exactly 3
    files_reviewed: list[str]
```

Then use structured output (via `response_format`) or function calling to force the LLM to return a valid `CodeReview` object.

**Success criteria:**
- [ ] Agent always returns a parseable `CodeReview` object
- [ ] `overall_score` is always an integer 1–10
- [ ] At least one issue per file reviewed

---

### Phase 3: The Review Agent (45–60 min)

Build the agent loop that orchestrates the review:

```python
def run_review_agent(project_path: str, max_iterations: int = 15) -> CodeReview:
    """
    The agent should:
    1. Call list_project_files to see what's there
    2. Prioritize which files to read (large files, files with many TODOs)
    3. Call read_file for each priority file
    4. Call get_file_stats for quantitative metrics
    5. When it has enough context, produce a structured CodeReview
    """
    ...
```

The system prompt should instruct the agent to:
- Focus on correctness, then performance, then style
- Only review Python files
- Not review `__pycache__`, `.venv`, or test files unless explicitly asked
- Flag: missing error handling, broad except clauses, hardcoded credentials, N+1 patterns

**Success criteria:**
- [ ] Agent reviews at least 2 files before producing output
- [ ] Agent stops reviewing when it hits 10 files (context budget)
- [ ] Token usage printed at end
- [ ] Review written to `review.md` and `review.json`

---

### Phase 4: RAG Context (45–60 min) *(Optional but recommended)*

Before running the agent, build a small vector index of the project's README and any docs:

```python
def build_project_context_index(project_path: str) -> VectorStore:
    """
    Load README.md, CONTRIBUTING.md, docs/*.md
    Chunk them, embed them, store in a local Chroma or FAISS index.
    """
    ...

@tool
def query_project_conventions(question: str) -> str:
    """
    Query the project's own documentation to understand its patterns.
    Use for: 'What error handling patterns does this project use?',
             'What coding style does this project follow?'
    """
    # Uses the pre-built vector index
    ...
```

Give the agent this tool. Now it can ask its own knowledge base about the project before reviewing code.

**Success criteria:**
- [ ] Index built from at least one documentation file
- [ ] Agent calls `query_project_conventions` at least once during a review
- [ ] The review reflects project-specific context (not just generic Python advice)

---

### Phase 5: Output & Polish (30 min)

Write the `review.md` file using the structured output:

```
# Code Review: my_project/
Generated: 2025-01-15 | Score: 7/10

## Summary
The codebase is generally well-structured but has several areas...

## Issues

### 🔴 CRITICAL — main.py (line 42: get_user)
**Missing input validation**
The function accepts raw user input without sanitization...
Suggestion: Add a Pydantic model to validate...

### 🟡 WARNING — utils.py (function process_data)
...

## Top 3 Recommendations
1. Add error handling to all database calls...
2. Replace hardcoded configuration with environment variables...
3. Add type annotations to public functions...
```

**Success criteria:**
- [ ] Markdown renders correctly with severity emoji (🔴/🟡/🔵)
- [ ] Issues sorted by severity (critical first)
- [ ] `review.json` is valid JSON matching the `CodeReview` Pydantic model

---

## Success Criteria (All Phases)

- [ ] Can review your own project from Chapter 7 or 8 exercises
- [ ] Handles projects with 0 reviewable Python files gracefully
- [ ] Never crashes on file read errors (permissions, encoding, binary files)
- [ ] Token budget respected: agent stops after 10 files or 15 iterations, whichever comes first
- [ ] review.md is something you'd actually share with a teammate

---

## Stretch Goals

If you finish phases 1–5 and want more:

1. **Streaming output:** Stream the agent's reasoning to the terminal as it works (show which file it's reading)
2. **Comparison mode:** Run the agent before and after a refactor, diff the two reviews
3. **GitHub integration:** Accept a GitHub repo URL instead of a local path (use the GitHub API to fetch files)
4. **Evaluation:** After you've run the agent on 5 different projects, can you write a test that checks whether the issues it finds are actually valid? (Intro to AI evals — Chapter 19)

---

## Notes

- Start with Phase 1 and test it before moving to Phase 2
- Use `gpt-4o-mini` to keep costs low during development; upgrade to `gpt-4o` for better review quality
- Point it at the code you wrote for Chapter 7 or 8 — you know that code well enough to judge the review quality
- This is portfolio-worthy work. Clean it up and put it on GitHub.
