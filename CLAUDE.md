# CLAUDE.md — personal learning notes repo

## What this is

Manish's personal technical learning notes, across `ai`, `js-learnings`, `node-learnings`,
`ts-learnings`, `terraform`, `sql`, `react`, `nginx`, `python`, `aws`, plus two practice banks
(`js-machine-round`, `hands-on-builds`) and five empty tracks that have prompts but no content
(`docker`, `k8s`, `linux`, `ci-cd-pipelines`, `scripting`).

**`js-learnings` and `node-learnings` are complete.** See the track table below before starting
anything new.

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

## Learning tracks — state, and what "continue" means

**`BACKLOG.md` at the repo root is the index of every idea raised, where it landed, and how to
resume it** — including the things deliberately rejected and why. Read it when asked "what
happened to X?" or when a topic comes up that may already have been decided. `HISTORY.md` records
what was done and why; `BACKLOG.md` records what was asked for and where it went.


**Every track has a `prompt.md` that is its contract and its resume point.** If asked to
"continue" a track, read that file first — each one opens with a `## To continue this track`
section (or a "Covered / Remaining" list) stating exactly what is done and what is next. Do not
infer the next step from the directory listing.

If asked to "continue" with no track named, ask which one — there are four active.

| Track | State | `continue` = |
|---|---|---|
| `js-learnings/` | **complete, 22 chapters** | nothing. Exercises are the open work (see below) |
| `node-learnings/` | **complete, 25 chapters** | nothing. Its exercises are underspecified — upgrading them is known debt |
| `ai/` | 10 chapters; roadmap Phase 0 | see "Current state — `ai/` track" below |
| `ts-learnings/` | **0 chapters**, contract written | Chapter 1 — structural typing and erasure |
| `redis/` | **0 chapters**, contract written | Chapter 1 — the single-threaded in-memory model |
| `js-machine-round/` | category 01 of 8 ready | category 02 — function polyfills |
| `hands-on-builds/` | build 01 of 11 specified | build 02 — a Promise implementation |
| `react/` | 2 chapters, **stalled** under the old contract | needs `mock.md` + exercises before new chapters |
| `docker/` `k8s/` `linux/` `ci-cd-pipelines/` `scripting/` | prompt only, **no content** | not started |

**Every chapter track uses one structure**, standardised 2026-09-05 and written into all 16
`prompt.md` files. A chapter is seven pieces and is not finished until all exist: `README.md`,
`notes.md`, `interview.md`, `mock.md`, `examples/`, `exercises/chapter_exercise.md`,
`exercises/cumulative_exercise.md`, plus a blank `exercises/solution/chapter_exercise_worksheet.md`.
It came from what `js-learnings` converged on over 22 chapters.

**It applies from each track's *next* chapter onward.** Tracks with chapters written under the
older contract — `node-learnings` (25), `terraform` (20), `sql` (14), `ai` (10), `aws` (7),
`nginx`/`react` (2), `python` (1) — keep those as they are. The depth in them is real; it is just
not optimised for a timed round. Retrofitting is separate optional work; **do not silently rewrite
old chapters while adding a new one.**

**The two practice banks are deliberately exempt** — `js-machine-round/` and `hands-on-builds/`
are not chapter tracks and must not be given `notes.md`/`mock.md`. Their shape is
`problems.md`/`spec.md` + executable tests + an empty `solution/`.

**The three practice artifacts have distinct jobs** — pick the right one rather than adding to
whichever is open:

- `js-machine-round/` — one function, 4–10 minutes, timed. Interview drill.
- `hands-on-builds/` — one program, 1–4 hours. Applying a chapter.
- each chapter's own `cumulative_exercise.md` — that chapter's theory, right after reading it.

**Before writing a new exercise or build anywhere, check whether one already exists.** All 25
`node-learnings` chapters carry "Practice Exercises" sections (~60 total) and `js-learnings`
chapters each have two. `hands-on-builds/README.md` is an index over them for exactly this
reason; adding a pointer there beats writing a duplicate.

**The unattempted-exercise backlog is the real open work**, not more chapters: `js-learnings`
Ch13's worksheet is partly done, Ch14/Ch17 and everything from Ch18 on are open, and `ai/`
Ch8–Ch10 are open. A chapter that was read is not a chapter that can be answered under pressure.

**Planned next, agreed but not started:** a `system-design/` track, which is where
payments-as-idempotency, caching *strategy* and WebSocket *scaling* belong — those are
distributed-systems questions rather than technologies. **Redis is not among them: it has its own
track** (`redis/`), on the same argument that gives `sql/` one.

Express is deliberately **not** a track: its deep material is already in `node-learnings`, and
`hands-on-builds` build 11 covers it by having you write a minimal Express.

## Current state — `ai/` track

- **Chapters 1–10 complete** (LLM internals → prompt engineering → APIs → Python for AI →
  LangChain → vector DBs → RAG → advanced RAG → agents → LangGraph)
- **Chapter 8 (`08-advanced-rag`) exercises are NOT yet solved** — no `solution/` dir.
  Hybrid search, query rewriting, reranking are the next work.
- **Chapter 9 cumulative** (Code Review Agent) not started.
- **Chapter 10 (`10-langgraph`) exercises are NOT yet solved.** Chapter exercise ports the
  Ch9 file-system agent to a checkpointed graph with an approval gate; the cumulative is
  DocuMind's `/ask` as `retrieve → grade → (rewrite ⟲ | generate)`. Written ahead of
  Chapter 8's exercises deliberately — both sets are open.
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
`master`, released **v0.8.0**. The Qdrant and OpenAI clients are done (client lifecycle, collection
management with the 409 race handled, upsert, query, payload-filtered delete). The
filesystem document source, `pydantic-settings` config and API error handling are merged
(`src/settings.py`, `src/utils/filesystem.py`, `src/utils/models.py`). Chunking is done
(`src/utils/chunking.py`): markdown-header split, then token split, with a folder+heading
breadcrumb prefixed to every chunk. **Ingestion is complete and exercised against the real
corpus**: 373 documents into 5,154 chunks in ~77s for $0.018, and a re-run skips everything
in 0.2s. **Search is done** — `POST /retrieve` embeds the question, queries Qdrant and
returns ranked chunks with scores, sources and section breadcrumbs. **`/ask` is not built**:
context assembly and grounded generation are the next piece.

Retrieval decisions worth keeping:

- **`/retrieve` and `/ask` are separate endpoints.** The eval scores hit@5 over the golden
  set and must not pay for a completion per question; retrieval quality and answer quality
  also fail differently, and one endpoint makes them unattributable. `/ask` calls the same
  retrieval function.
- **Query rewrite, hybrid search and reranking belong to `/retrieve`,** because their gain
  *is* a retrieval metric. Conversational rewrite is the exception — it needs history
  `/retrieve` does not have. They should be per-request flags so the eval can attribute the
  gain to each rather than to all three together.
- The response is its **own model**, not a subclass of the storage `Chunk`. Subclassing
  leaks `file_hash`, `chunk_total` and the per-run `document_id`, and silently publishes any
  field added to `Chunk` later. Only the four payload fields it returns are fetched from
  Qdrant, ~30% less over the wire.
- **Effective `top_k` and score floor are echoed in the response.** Both fall back to
  settings, so a bare result list cannot say what a baseline measured against. `MAX_TOP_K`
  bounds the request field *and* the settings default, so a config value cannot walk past
  the documented API limit — an out-of-range `DEFAULT_TOP_K` fails at startup.
- `default_score_threshold` is **0 on purpose** until the golden set picks a floor: a
  baseline needs the whole score distribution, not a pre-filtered slice.
- Resolve optional numeric knobs with `is None`, never `or`. A caller sending `0.0` means
  "no floor" — exactly what you send while debugging — and `or` silently overrides it.
- A missing collection is a **503 `index does not exist`**, not a 500 and not an empty 200.
  Returning 200 makes "the corpus has nothing on X" indistinguishable from "there is no
  corpus", and the eval would score it as a retrieval miss.

Two things ingestion proved that only a full run could:

- A hash proves content, a **count** proves the write finished. Old points are deleted
  before new ones are written, so a run that dies mid-file leaves survivors carrying the
  *new* hash — indistinguishable from success. `chunk_total` plus the indexed point count
  is what closes it.
- Empty files could never converge: no chunks means no points means no hash, so they were
  rebuilt on every run forever. The walker skips them now.

Known gaps, deliberately unbuilt: deleted files are never pruned (nothing scans for sources
that vanished, and re-ingest cannot see them); point ids are `uuid4()` per run, which is why
the delete exists at all; `/ingest` is synchronous.

Error-handling rules — settled, do not relitigate:

- Clients **propagate**, never catch. Only the loop that owns the job knows whether to skip
  a batch, abort, or record and continue.
- Register handlers on the **library's own** exception classes. Subclassing them creates a
  class the library never raises.
- Never log batch contents: for embeddings the request body is the corpus.
- FastAPI handlers do not fire for background tasks, so the ingest loop needs its own.
- **Never `return` inside a `finally`.** Python discards the in-flight exception, so a dead
  run comes back as a 200 with plausible partial numbers. `finally` holds logging only; the
  `return` sits below the whole block. Pyright cannot see it — control flow, not types — so
  bugbear's B012 is the only thing guarding it.
- Use `try`/`finally` with a `completed` flag, not `except`/re-raise: a bare
  `except Exception` misses `CancelledError`, which is what a client disconnect raises.
- Split counters by what they assert. Money facts (`billed`, `counted`, `batches`) increment
  **before** the upsert — the embedding was charged the moment the API answered, so a Qdrant
  failure must not erase it. Index facts (`chunk_count`) increment after. `embedded > indexed`
  on a partial run is correct, not a discrepancy.
- The loop's failure line is `warning`; the app handler already logs the error with a trace
  and OpenAI's `request_id`. Two error-level lines for one event is noise.

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
- **Corpus scope — implemented.** `IngestRequest.exclude` takes globs matched against
  `source` with `PurePosixPath.full_match`. Exclusion is **corpus policy, not service
  policy**: it belongs on the request, never in `SKIP_NAMES`, which ships in a public repo.
  The list to pass — planning docs, the support fiction, and every mentor prompt:

  ```
  CLAUDE.md
  HISTORY.md
  **/prompt.md
  ai/resume-roadmap.md
  ai/07-rag-pipelines/exercises/solutions/DocuMind/docs/**
  ```

  `**/prompt.md` covers all 21 mentor prompts, not just `ai/`. They are instructions
  ("Act as a principal AWS security engineer..."), not knowledge, and they *win* generic
  queries because they are short and topic-dense. Dropping them took the corpus from 393
  documents to 373, and "what is AWS" fell from 0.567 to 0.499 while real-content queries
  did not move — a wider, more separable gap.

  It must be pinned in the eval config, since it defines the corpus a baseline is frozen
  against. Adding it does **not** remove already-indexed files — they become orphans, so a
  clean baseline needs the collection dropped and rebuilt (60s, ~$0.02).
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
  `--project services/upload` flags. **pyright** was added on top: four type errors got
  past black/isort/flake8/bandit, and mypy catches only two of them. Pyright is Pylance's
  engine, so the hook agrees with the editor.
- **`flake8-bugbear` is in the `lint` group** for its B012, the return-in-`finally` check —
  added after that exact bug passed every other hook. The flake8 hook runs via
  `uv run --group lint`, so it picked the checks up with no hook change.
- **Style rules for that repo, non-negotiable:** comments and docstrings 1-3 lines, commit
  messages and PR bodies short and conversational. No archaeology comments recording a bug
  already fixed. Depth belongs in this repo's `HISTORY.md`, not in the public one.

Three traps found the hard way, all now fixed — do not reintroduce:

1. release-please's `python` release type does **not** understand PEP 621
   `[project] version`. It needs manifest mode with an explicit toml updater on
   `$.project.version` (`release-please-config.json`).
2. `uv.lock` records the project's own version, so a release desyncs it from
   `pyproject.toml` and `uv sync --locked` fails. `release-please.yml` regenerates and
   commits it onto the release branch.
3. Branch slugs must collapse runs of non-alphanumerics. Per-character substitution leaves
   `--`, which becomes `..` in the PEP 440 local label and is invalid.

**A merge can half-succeed.** `gh pr merge` hit a 504 on PR #23: the squash commit landed
on master, but the PR stayed open, the branch survived, and **no push event was dispatched**
— so `ci`, `version` and `release-please` never ran. `gh run list` after a merge is the
check that catches it. Nothing is lost, since release-please computes from history since the
last tag, but `release-please.yml` has only an `on: push` trigger, so there is no way to
kick a missed release manually. Adding `workflow_dispatch:` is two lines and still to do.

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

**The corpus is 9 domains, not 14.** Once `**/prompt.md` is excluded, `docker`, `k8s`,
`linux`, `ci-cd-pipelines` and `scripting` disappear entirely — a mentor prompt was their
only file. `aws` drops to 3 (SES only), which is why "what is AWS" and an S3 question both
returned nonsense: there is nothing to find. 400 of 423 content files sit in five domains —
`ai` 121, `node-learnings` 81, `terraform` 78, `js-learnings` 73, `sql` 47.

**Golden-set questions must come from those five.** Anything about AWS, Docker, K8s, Linux,
CI/CD or scripting measures the corpus's holes, not the retriever.

## The baseline is measured — `evals/`

33 golden questions in `evals/golden_set.yaml`, four types: `factual`, `ambiguous-term`,
`identifier`, `absent`. Dense-only baseline, frozen:

```
hit@1 0.750   hit@5 0.857   hit@10 0.929   MRR 0.800
ambiguous-term 0.900   identifier 1.000   factual 0.769
```

**The runner records, the reporter scores.** `run_eval.py` fetches the API maximum with no
floor and saves the raw hits; `report.py` derives every k and the whole threshold sweep from
that one file. Trying a different floor must never cost another run — the floor is chosen by
reading the distribution, not by guessing and re-testing.

**`config.yaml` pins the embedding model, the exclusion globs and `corpus_commit`.** Scores
compare only within one embedding model, and this notes repo keeps growing — without the
commit, a later run scores corpus growth as retrieval improvement.

Four things the baseline settled that guessing had got wrong:

- **The floor is ~0.45-0.50, not ~0.6.** At 0.60 refusal is perfect and 25 of 28 correct
  answers are thrown away. The old four-query ladder happened to sample easy questions;
  real answers routinely land at 0.42-0.51.
- **No floor separates cleanly.** `absent-webpack-01` scores 0.504, above a third of the
  correct answers. Dense cosine cannot do confident refusal on this corpus — which is the
  measurement that justifies reranking rather than an assumption about it.
- **Question phrasing is worth ~13 points of hit@5.** The same 28 questions phrased as
  problems rather than echoing chapter headings scored 0.826 against 0.957. Questions
  written after reading the corpus flatter the retriever; the honest number is the lower one.
- **BM25's case is already covered.** All five `identifier` questions return at rank 1, so
  the query class BM25 exists for is not currently failing. Its value here is unproven, not
  assumed — a more interesting result than shipping it because the roadmap said so.

**Recall is near-saturated; ranking is not.** hit@10 0.929 against hit@1 0.750 means correct
documents are found and mis-ordered — usually `chapter_exercise.md` outranking the README
that explains the thing. That points at **reranking before hybrid search**.

**A bad answer key is indistinguishable from a retrieval failure.** One `identifier` question
keyed to files that merely *name-dropped* the term read as a total miss; fixing the key moved
hit@1 from 0.714 to 0.750. Verify every `expected_sources` by reading, never by grep, and
never by asking `/retrieve` — letting the system under test define ground truth makes it
score itself 100% forever.

`content_tokens` is still unwired as a query filter. 6.9% of chunks are under 30 tokens and
they do rank. Wire it as a knob defaulting to 0 so the eval can sweep it; do not pick a value
by hand.

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
- **openai 3.x is built on `httpx2`, not `httpx`.** `httpx.Timeout` is a structurally
  identical, identically named class from a different distribution — assigning one where the
  other is expected fails at runtime and only pyright sees it. `httpx2` is a declared
  dependency now because it is imported directly.
- `payload` on a Qdrant `ScoredPoint` is `dict[str, Any] | None` — a plain dict, so
  attribute access fails, and pyright wants the `None` narrowed. `with_payload` naming
  fields means `Chunk.model_validate` no longer works: it requires the ingest bookkeeping
  you deliberately stopped fetching.
- Pydantic v2 does **not** expose fields as class attributes: `RetrieveResult.text` is an
  `AttributeError`. Use string literals for payload keys — they are storage keys that only
  happen to match the model's field names.
- `generate.js` at the repo root is a scratch file generator for Node stream experiments,
  unrelated to the AI track.
