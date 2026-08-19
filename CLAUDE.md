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

The same rule covers the standalone DocuMind repo — see "DocuMind is a standalone repo".

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
**Currently on Phase 0.** This file and the roadmap are the private plan; see
"Public framing" below for what the projects themselves are allowed to say.

The two projects:

| | Path |
|---|---|
| **DocuMind** — RAG service (flagship) | `/home/manish/code/personal/documind` (separate repo) |
| **Code Review Agent** — Chapter 9 cumulative | not started |

**Standing rule: every future chapter deepens these two projects. Never start project #3.**
LangGraph, memory, MCP, security, deployment all land as upgrades to DocuMind or the agent.

Superseded, kept for history — do not extend: `docbot`, `smart-doc`, `semantic-search`,
`support-bot-rag-pipeline`, `code-review-ai`, and the in-repo
`ai/07-rag-pipelines/exercises/solutions/DocuMind/`. That last one is the origin of the
standalone project; its ~521 lines (`src/main.py`, Qdrant + OpenAI clients, Pydantic models)
are still to be ported. Its `docs/` corpus is **not** ported — see Phase 0.

## DocuMind is a standalone repo

Since 2026-08-19 DocuMind lives at `/home/manish/code/personal/documind`, not under
`exercises/solutions/`. Phase 4's "extract standalone repos" was pulled forward to the
start, because `exercises/solutions/...` paths read as homework however good the code is.

**The teaching contract extends there.** Manish writes all DocuMind implementation himself,
including the mechanical port — it's a project he has to defend line by line, and code he
didn't write is code he can't defend. Config, tooling and docs are fine to write when asked.

Current state: `github.com/manishsharma0398/documind` — public, MIT, default branch
`master`, released **v0.1.2**. A FastAPI skeleton (app factory, `ingest`/`retrieve`
routers, JSON logger) with **ingestion and retrieval still stubs**. None of the ~521 lines
have been ported yet.

## DocuMind CI — how to work in that repo

**`master` is strictly protected and there is no bypass for anyone**, including the owner
(`bypass_actors: []`). A direct push is rejected with `GH013`. Every change goes:
branch → push → `gh pr create --fill` → wait for green → `gh pr merge --squash
--delete-branch`.

- **Quality gate** (`ci.yml`): runs the same pre-commit hooks as local, plus pytest.
  Required checks are `quality` and `version / version`. ~25s.
- **Versioning** (`version.yml`): branch builds get `X.Y.Z-<slug>.<n>` SemVer plus a PEP 440
  equivalent, where `n = git rev-list --count origin/master..HEAD`. Needs `fetch-depth: 0`.
  The base `X.Y.Z` is read from `pyproject.toml`, so a release automatically shifts all
  branch versions. CI validates both strings against the official specs.
- **Releases** (`release-please.yml`): Conventional Commits drive the bump. Enforced locally
  by a `commit-msg` hook — but the hook does **not** check PR titles, and the squash-merge
  message comes from the PR title, so PR titles must be conventional too.
- Lint/format config was adapted from `prasaarit/services/upload`, minus its monorepo
  `--project services/upload` flags.

Three traps found the hard way, all now fixed — do not reintroduce:

1. release-please's `python` release type does **not** understand PEP 621
   `[project] version`. It needs manifest mode with an explicit toml updater on
   `$.project.version` (`release-please-config.json`).
2. `uv.lock` records the project's own version, so a release desyncs it from
   `pyproject.toml` and `uv sync --locked` fails. `release-please.yml` regenerates and
   commits it onto the release branch.
3. Branch slugs must collapse runs of non-alphanumerics. Per-character substitution leaves
   `--`, which becomes `..` in the PEP 440 local label and is invalid.

**Standing annoyance:** every release PR needs one manual workflow approval click
(`approval_policy: first_time_contributors` treats `github-actions[bot]` as first-time
every time). Left as-is deliberately — it is what stops hostile fork PRs running workflows
on a public repo.

## Public framing — important

DocuMind's own README presents it as an **independent project**. It must not mention the
notes repo, the chapter curriculum, the roadmap, phases, or exercises. Design decisions get
stated as engineering rationale, never as steps in a plan someone set. Keep the roadmap
private to this repo.

Corollary: no unmeasured numbers in that README. Empty metric cells until
`evals/results/` actually produces them.

## Phase 0 in progress

Building an eval baseline for DocuMind. Key decision already made: the old `docs/` corpus
(6 files / 39 chunks) has no headroom — hit@5 is ~100% before any work, so Chapter 8 would
measure zero gain. **The corpus is this notes repo itself.** Full spec, golden-set schema,
and metric definitions are in `ai/resume-roadmap.md`.

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
- No tests or Dockerfiles exist in any project yet. Phase 2 adds them. DocuMind has a
  `tests/` dir containing only `.gitkeep`, so pytest resolves its `testpaths`; the CI step
  treats "no tests collected" (exit 5) as a pass until real tests exist.
- DocuMind's `.env.example` is still missing — `.gitignore` excludes `.env` but the template
  was never written, so a clone gives no signal about which keys are needed.
- DocuMind's `[project.scripts] dev = "src.main:app"` is still broken: `app` is an ASGI
  instance, not a zero-arg callable, so `uv run dev` fails. Use
  `uv run fastapi dev src/main.py`.
- DocuMind's `/retrieve` is a `GET`. Phase 2 wants an SSE-streamed answer with a request
  body, which is a `POST` — cheaper to change while it's still a stub.
- `generate.js` at the repo root is a scratch file generator for Node stream experiments,
  unrelated to the AI track.
