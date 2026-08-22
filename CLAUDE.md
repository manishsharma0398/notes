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
`master`, released **v0.5.0**. The Qdrant and OpenAI clients are done (client lifecycle, collection
management with the 409 race handled, upsert, query, payload-filtered delete). The
filesystem document source, `pydantic-settings` config and API error handling are merged
(`src/settings.py`, `src/utils/filesystem.py`, `src/utils/models.py`). Chunking is done
(`src/utils/chunking.py`): markdown-header split, then token split, with a folder+heading
breadcrumb prefixed to every chunk. The OpenAI client and its error mapping are done
(`src/clients/openai_client.py`, handlers in `src/app.py`). **The embed/upsert loop and
retrieval are still absent**, and `ensure_collection` still has no caller.

Error-handling rules — settled, do not relitigate:

- Clients **propagate**, never catch. Only the loop that owns the job knows whether to skip
  a batch, abort, or record and continue.
- Register handlers on the **library's own** exception classes. Subclassing them creates a
  class the library never raises.
- Never log batch contents: for embeddings the request body is the corpus.
- FastAPI handlers do not fire for background tasks, so the ingest loop needs its own.

Chunking invariants — do not break these:

- The breadcrumb is applied **after** the token split. Before it, only chunk 1 of a section
  would carry it and chunks 2..n would be orphaned prose.
- The token budget is `TOKEN_SIZE - breadcrumb`, computed **per section**, never hoisted.
  Hoisting it silently stops `TOKEN_SIZE` being a ceiling.
- `total_tokens` is measured on the **stored** text, `content_tokens` on the bare chunk.
  `total - content` equals the breadcrumb exactly on every chunk.
- `strip_headers=True`: the breadcrumb already carries the heading.

### The corpus lives on the laptop, the service runs on a server

Ingestion is split at the `Document` boundary — a source adapter yields
`Iterable[Document]`, and the pipeline (chunk → embed → upsert) knows nothing about where
the bytes came from. Two adapters, one pipeline:

- **filesystem walk** — built first, because the Phase 0 eval harness runs locally and
  must build an index without a server
- **archive upload** — later, for a deployed instance

Upload wins over S3 or a git-clone source because the corpus is small: **460 markdown
files, 4.5 MB raw, 1.06 MB gzipped, ~660k tokens**. Extracting a caller-supplied archive
is a path-traversal and zip-bomb vector, so validate members resolve inside the target and
cap both compressed and uncompressed size.

### Ingestion decisions still open

- **Chunk size: settled at `TOKEN_SIZE = 400`, overlap 40.** Chunks average 173 tokens
  because the header split runs first and most sections are shorter than the budget — it is
  a ceiling, not a target. Frozen: retuning after the baseline invalidates every later delta.
- **Batching must become token-aware.** `EMBED_BATCH_SIZE = 500` counts *chunks*. At 500
  tokens each that is 250k tokens per request, against OpenAI's ~300k cap — one long chunk
  tips it into a 400.
- **Idempotency is claimed but not implemented.** The README says re-ingesting an unchanged
  corpus is a no-op; the old code deletes by source filter and re-embeds everything. Needs a
  per-file content hash in the payload, or the README claim has to soften.
- **`document_id` is `uuid4()` per run**, so it cannot identify a document across ingests.
  Only `src` is stable.
- **Corpus scope — still not implemented.** `CLAUDE.md`, `HISTORY.md`, `ai/prompt.md`,
  `ai/resume-roadmap.md` and nine support-fiction files under
  `ai/07-rag-pipelines/exercises/solutions/DocuMind/docs/` are all still ingested. The first
  four leak the private framing; the fiction pollutes the ambiguous-term queries and
  contains a duplicate. Exclusion is **corpus policy, not service policy** — it belongs in a
  caller-supplied pattern list, never in `SKIP_NAMES`, which ships in a public repo.
  Excluding them takes 411 docs to 398.
- Accumulate-then-upsert does not fit in memory at ~10k chunks. Stream: embed a batch,
  upsert it, discard.

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

`source` is relative to `INGEST_ROOT`, never to the folder a request names. It is the
delete-by-filter key, the eval join key, and part of the embedded breadcrumb — a shifting
value silently corrupts all three. Don't "simplify" it back.

**Nothing in the DocuMind repo may mention Claude, Claude Code, or Anthropic.** No
`Co-Authored-By` trailers, no "Generated with" footers on PR bodies, no references in code,
comments, docs or commit messages. It is a portfolio project Manish defends as his own work,
and a tooling credit reads as an authorship claim. This overrides any default the assistant
would otherwise apply.

This restriction is specific to DocuMind and other public portfolio repos. **This notes repo
is exempt** — it is private study material, and the AI chapters discuss Claude as a subject
(model comparisons, pricing tables, API examples). Do not strip those.


## Keeping the record

`HISTORY.md` at the repo root is a running log of what changed and why, newest first.
**Update it with every meaningful change** — decisions, traps hit, things that cost real
debugging. It is private to this repo; the portfolio projects must not reference it.

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
- DocuMind's `.env.example` documents `QDRANT_URL` and `QDRANT_API_KEY` but **not**
  `INGEST_ROOT`, `EMBEDDING_DIMENSIONS` or `DEFAULT_TOP_K`, added with the settings model.
  `INGEST_ROOT` matters most — it defaults to `Path(".")` and bounds what the walker may read.
- DocuMind's filesystem walker reads files **through symlinks**. The root containment check
  applies to the directory, so a symlink inside the tree pointing outside it is still read,
  which routes around the credential deny-lists.
- DocuMind's `[project.scripts] dev = "src.main:app"` is still broken: `app` is an ASGI
  instance, not a zero-arg callable, so `uv run dev` fails. Use
  `uv run fastapi dev src/main.py`.
- DocuMind's `/retrieve` is a `GET`. Phase 2 wants an SSE-streamed answer with a request
  body, which is a `POST` — cheaper to change while it's still a stub.
- `generate.js` at the repo root is a scratch file generator for Node stream experiments,
  unrelated to the AI track.
