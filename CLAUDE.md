# CLAUDE.md — personal learning notes repo

## What this is

Manish's personal technical learning notes: 410 markdown files, ~484k words, across
14 domains (`ai`, `aws`, `node-learnings`, `js-learnings`, `terraform`, `sql`, `nginx`,
`docker`, `k8s`, `python`, `react`, `linux`, `ci-cd-pipelines`, `scripting`).

Context: full-stack JS/Node engineer, ~3.5 years, currently going deep on
Generative AI engineering. Strong on backend, APIs, distributed systems, deployment.
Reads Python fluently but is not from an ML/data-science background.

## The teaching contract — read this before writing any code

The `ai/` track follows a mentor prompt (`ai/prompt.md`) with one rule that overrides
normal helpfulness:

> **Do not solve the exercises.** Chapter and cumulative exercises in
> `ai/*/exercises/` are for Manish to solve himself.

Your job is to explain, review submitted solutions, design specs, and unblock —
**not** to write the implementation. If asked to "help with" an exercise, that means
hints, mental models, and review. Ask before writing code into any `solution/` or
`solutions/` directory.

Deferred stretch goals are deliberate, not oversights. Don't quietly complete them.

## Chapter structure

Each `ai/NN-topic/` folder follows the same shape:

```
README.md    explanation, mental model, ASCII architecture diagrams
notes.md     concise revision notes
interview.md senior-level questions, system-design traps
examples/    runnable teaching examples (written by the mentor)
exercises/   chapter_exercise.md + cumulative_exercise.md + solution(s)/  <- Manish's work
```

## Current state

- **Chapters 1–9 complete** (LLM internals → prompt engineering → APIs → Python for AI →
  LangChain → vector DBs → RAG → advanced RAG → agents)
- **Chapter 8 (`08-advanced-rag`) exercises are NOT yet solved** — no `solution/` dir.
  Hybrid search, query rewriting, reranking are the next work.
- **Chapter 9 cumulative** (Code Review Agent) not started.
  `09-.../file-system-assistant/main.py` has open `# TODO`s: `read_file_head`,
  its tool schema, and an empty `test.py`.

## Active plan

`ai/resume-roadmap.md` — turning the notes into two portfolio projects.
**Currently on Phase 0.**

The two projects:

| | Path |
|---|---|
| **DocuMind** — RAG service (flagship) | `ai/07-rag-pipelines/exercises/solutions/DocuMind/` |
| **Code Review Agent** — Chapter 9 cumulative | not started |

**Standing rule: every future chapter deepens these two projects. Never start project #3.**
LangGraph, memory, MCP, security, deployment all land as upgrades to DocuMind or the agent.

Superseded, kept for history — do not extend: `docbot`, `smart-doc`, `semantic-search`,
`support-bot-rag-pipeline`, `code-review-ai`. `docbot`'s FastAPI layer gets folded into
DocuMind in Phase 2, then retired.

## Phase 0 in progress

Building an eval baseline for DocuMind. Key decision already made: the old `docs/` corpus
(6 files / 39 chunks) has no headroom — hit@5 is ~100% before any work, so Chapter 8 would
measure zero gain. **The corpus is being swapped to this notes repo itself.** Full spec,
golden-set schema, and metric definitions are in `ai/resume-roadmap.md`.

## Conventions

- Python 3.13, `uv` for dependency management (`uv run python -m src.main`)
- Pydantic models for all LLM-facing boundaries; async clients throughout
- Qdrant runs in Docker on `localhost:6333`
- `.env` per project, loaded with `python-dotenv`
- Prose in notes is engineering-first: mechanism, tradeoffs, and where it breaks in
  production. No motivational filler. Cost, latency, and reliability get called out.

## Gotchas

- `.venv/`, `qdrant_storage/`, `*.pyc`, `.env` are gitignored — but one `.pyc` under
  `ai/01-how-llms-work/exercises/solution/__pycache__/` was committed **before** the ignore
  rule existed. Fix with `git rm --cached`, not a `.gitignore` edit.
- No tests, Dockerfiles, or `.env.example` exist in any project yet. Phase 2 adds them.
- `generate.js` at the repo root is a scratch file generator for Node stream experiments,
  unrelated to the AI track.
