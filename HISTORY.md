# History

A running record of what changed and why. Newest first. **Update this with every
meaningful change** — it is the thing that makes it possible to walk away for a
few months and pick the project back up without archaeology.

This file is private to the notes repo. The portfolio projects present themselves as
independent work and must not reference the roadmap, the chapters, or this record.

---

## 2026-08-23 — A failed ingest that reported success

*Shipped as **v0.6.2**.*

### The money record was the thing being lost

The ingest loop had no error handling at all, which was half deliberate: the client
propagates, and partial writes were already safe, since a source that dies mid-run fails the
`chunk_total` vs point-count check and rebuilds next time. Nothing corrupts.

What was lost was the accounting. `billed`, `counted` and `batches` accumulate inside the
loop and the summary log sits *after* it, so a run that died at batch 12 had spent real money
on eleven batches and said nothing about it. Not a correctness bug — an operability one. You
cannot decide whether to re-run something when you do not know what the last attempt cost.

Subtler, and found only while writing the fix: the counters were incremented *after* the
upsert. So a **Qdrant** failure dropped that batch's token count entirely, even though the
embedding call had already succeeded and already been charged. A `finally` layered on top of
that ordering would have faithfully reported a wrong number.

The split that fixes it is by what each counter asserts. `billed`, `counted`, `batches` are
facts about money, true the moment the API answered — they increment before the upsert.
`chunk_count` is a fact about the index — it increments after. On a partial run
`embedded > indexed` is then the expected shape rather than a discrepancy.

### `return` inside `finally` swallows the exception

The first attempt put the `return` in the `finally`. Python discards an in-flight exception
when the `finally` returns, so a dead run stopped reaching the handlers and came back as
**HTTP 200** with plausible partial numbers. Strictly worse than the no-handling version,
which at least produced a 503.

Nothing in the toolchain caught it. flake8 without bugbear has no such check and pyright
reports zero errors — it is a control-flow bug, not a type error. The only thing that flagged
anything was `F841` on the now-unused `completed` flag, which pointed at the omission
sideways.

So: `finally` holds **logging only**. The `return` and the drift check sit below the whole
block, where an exception simply never reaches them. `try`/`finally` with a `completed` flag
rather than `except`/re-raise, because a bare `except Exception` misses `CancelledError` —
which is what a client disconnect mid-ingest raises, and the case where silence is least
affordable.

The failure line is `warning`, not `error`: the app-level handler already logs what broke
with a stack trace and OpenAI's `request_id`. The loop's line answers a different question —
what it cost — and says outright that the in-flight documents rebuild next run, so nobody has
to reason about `chunk_total` at 2am.

### openai 3.x is built on `httpx2`, not `httpx`

The flat `OPENAI_TIMEOUT = 500` had no reasoning behind it. A 256-chunk batch returns in
single-digit seconds; at 500s one hung socket stalls the run for eight minutes before the
first of five retries. Replaced with a granular `Timeout(connect=10, read=60, write=30,
pool=10)` — a dead host now fails in ten seconds instead of waiting on a read that will never
come.

Writing `httpx.Timeout` for that is wrong, and wrong in a way nothing but a type checker sees:

```
"httpx._config.Timeout" is not assignable to "httpx2._config.Timeout"
```

openai 3.3.1 depends on `httpx2` 2.12. The two classes are structurally identical and
identically named, so the failure would have surfaced at runtime inside client construction.
Fourth type error pyright has caught past black/isort/flake8/bandit, and probably beyond mypy
too — it needs the installed distribution's own stubs to see that two same-named classes come
from different packages.

`httpx2` is now a declared dependency, since it is imported directly rather than reached
through openai.

### Open

`flake8-bugbear`'s **B012** is exactly the return-in-`finally` check, and it comes back clean
against the current `src/`, so it is a one-line addition to the `lint` group. Deliberately
left to its own change rather than folded into a fix.

---

## 2026-08-22 (later) — Logging that can be read, and a type checker

*Shipped as **v0.6.0**, alongside corpus exclusions.*

### The logs were unreadable, for a boring reason

`logging.getLogger()` with no name returns the *root* logger, and a handler there formats
whatever any library emits as if the service had said it. One ingest produced ~90 lines of
httpx request logs and watchfiles change notifications around the four lines that were ours.

Named logger, `propagate = False`, and the noisy libraries pinned to WARNING. Root keeps its
own handler at WARNING, though — without it a library error falls through to
`logging.lastResort`, which prints bare text with no request id, and that is exactly the
line worth having in production.

### Correlation ids without threading a parameter

A `ContextVar` set by middleware and read by a `logging.Filter`, so every record picks it up
— including ones from `filesystem.py` and `qdrant.py`, which know nothing about HTTP. Task
local, so concurrent requests cannot see each other's. Echoed as `x-request-id`, and an
upstream one is honoured only if it matches `[A-Za-z0-9._-]{1,64}`: a header that lands in a
log is otherwise a log-injection vector.

Two lines per request rather than one, because a minute-long ingest is otherwise silent
until it finishes.

The logs immediately paid for themselves: they made a config failure diagnosable that had
resisted a restart and a corrected `.env`. `INGEST_ROOT=.` was exported in the shell, and
environment variables beat `.env` in pydantic-settings — the file was right, a fresh
`Settings()` read it right, and the process still disagreed. Only `/proc/<pid>/environ`
showed it.

### pyright, because the linters were blind to a whole class of bug

Three type errors in one week got past black, isort, flake8 and bandit: `APIStatusError`
passed to a parameter typed `APIConnectionError` (siblings, not subclasses), a NamedTuple
field named `count` shadowing `tuple.count`, and an override with a renamed parameter after
python-json-logger 4.0 renamed it upstream. None break at runtime; none show up in tests.

Tested mypy first — it catches two of the three, missing the override. Pyright catches all
three, and being Pylance's engine it agrees with the editor rather than offering a second
opinion.

### A style correction worth keeping

The comments had grown into design documents — 37% of `logger.py`, one 16-line block. On a
portfolio repo that reads as machine-written regardless of whether it is right. Cut to 1-3
lines each, docstrings added where they were missing (`get_files_from_folder` had none at 85
lines), and the archaeology removed: comments whose only content was a bug already fixed are
working notes, not something a reader needs. Losing the protective ones is fine now that
pyright enforces what they were asking a reader to remember.

Same rule applies to commit messages and PR bodies in that repo. This file is the place for
depth.

### Also

A `gh pr merge` returned 504 and half-succeeded: the squash commit landed on master, the PR
stayed open, the branch survived, and no push event fired, so no workflow ran. Nothing was
lost — release-please computes from history since the last tag — but `release-please.yml`
has only an `on: push` trigger, so a missed release cannot be kicked off manually. Adding
`workflow_dispatch:` is two lines and still outstanding.

Branch protection has `strict_required_status_checks_policy`, so parallel PRs merge
serially: each one goes `BEHIND` when master moves and needs a rebase and a re-run.

---

## 2026-08-22 — Ingestion runs against the real corpus, and four things only that could show

*Shipped: embed/upsert loop, re-ingest skip, corpus exclusions.*

### The numbers

406 documents, 5,453 chunks, 22 batches, 942,719 tokens, **$0.019**, 60 seconds through
`POST /ingest`. Re-running: **0 documents, 406 skipped, 0.2 seconds.** Editing a file
rebuilds only that file; touching its mtime rebuilds nothing; reverting an edit is detected
as a change. Point count holds steady across rebuilds, so delete and upsert agree.

### A hash cannot tell you the write finished

The re-ingest skip recorded a hash per source and skipped when it matched. The reasoning
for tolerating *sets* of hashes assumed an interrupted run leaves some chunks at the old
hash and some at the new — but old points are deleted **before** new ones are written, so a
crash mid-file leaves the survivors all carrying the **new** hash. Indistinguishable from
success, and every later run skips it: the document stays indexed, truncated, retrievable
and plausible. 20 of 406 files are large enough to straddle two embed batches.

Fixed by recording `chunk_total` per chunk and requiring the payload's claim to match the
actual point count. `entry.totals == {entry.point_count}` — what the writer said should
exist, against what does.

The general shape: **a hash proves content, a count proves completion.** No amount of
hashing substitutes for the second.

### Empty files could never converge

Six 0-byte `README.md` scaffolds from `uv init` were re-processed on every single ingest.
An empty file produces no chunks, so no points, so the next run finds no hash for that
source and rebuilds it — producing no chunks again. Every run reported six documents
ingested while writing nothing.

Only visible because the full-corpus run was actually performed. At two files it never
appeared.

### Reading the index cost the size of the index

`indexed_sources` scrolled every payload in the collection to use a fraction of them, while
the delete twenty lines below already filtered on `source` — the same field, carrying a
payload index created for exactly that purpose. The asymmetry was the tell. Scoped, the cost
is the size of the request and stays there as the collection grows.

### Streaming, measured

`batch_embed` now takes an iterable, so `chunk_docs` is no longer materialised at its only
call site: **24MB peak against 87MB accumulating**, same 5,453 chunks. The ratio matters
less than the shape — streaming is flat in chunk count, accumulating is linear.

`iter()` is what makes it work, and not obviously: it converts an iterable into something
with a *position*, so successive `islice` calls resume rather than restart. Without it, on a
list, the loop re-slices the first batch forever.

### Corpus exclusions are the caller's business

`IngestRequest.exclude` takes globs matched against `source`. Deliberately not `SKIP_NAMES`:
that is the service's list of things no corpus should hold, and it ships in a public repo,
where a hardcoded `CLAUDE.md` would be both wrong generically and a small disclosure. Four
planning documents and nine support-fiction files take the corpus to 393.

### Two traps worth not repeating

**Config precedence.** The server kept rejecting the corpus path after `.env` was corrected
and the process restarted. `INGEST_ROOT=.` was exported in the shell, and environment
variables beat `.env` in pydantic-settings. The file was right, a fresh `Settings()` read it
right, and the running process still disagreed — with nothing anywhere reporting the
conflict. Only `/proc/<pid>/environ` showed it.

**A merge can half-succeed.** `gh pr merge` returned a 504: the squash commit landed on
master, the PR stayed open, the branch survived, and no push event was dispatched, so no
workflow ran at all. Checking `gh run list` after a merge is what caught it.

### Where retrieval starts from

Ingestion is done and exercised end to end. Still absent: retrieval, answer generation
(a second OpenAI path, with its own prompt and refusal behaviour), the golden set,
`evals/run_eval.py`, and any tests at all — `tests/` is still a `.gitkeep`, while a dozen
verification scenarios built today live only in scratch files.

---

## 2026-08-21 — Chunking, the OpenAI client, and bugs that only measurement found

*Shipped as **v0.4.0** (chunking) and **v0.5.0** (client and error mapping).*

### The OpenAI client, and where errors are allowed to be caught

Mirrors the qdrant client: an `AsyncOpenAI` singleton built from settings, opened and closed
in the app lifespan, with `OPENAI_API_KEY` required rather than optional so a missing key
fails at startup instead of at the first embed call.

`embed()` deliberately does not catch. The client cannot decide what a failure *means* —
only the ingest loop knows whether to skip a batch, abort, or record it and carry on.
A first attempt caught `APIConnectionError` and `pass`ed, which returns `None` to a caller
expecting a response and resurfaces as an `AttributeError` a long way from the cause.

A second dead end worth remembering: subclassing the SDK's exceptions in order to catch
them. `class APIConnectionError(openai.APIConnectionError)` creates a *new* class the SDK
never raises. Inheritance runs the wrong way — catching a parent catches its children, never
the reverse. To intercept a library's errors you register on the library's own classes.

Two handlers cover all eight SDK exception types because Starlette dispatches on the MRO.
Transport failures and their 5xx map to 503; 429 to 503 logged as a *warning*, since it is
only reached after the client exhausted its own retries; 401/403 to 500 logged at *error*,
because they are not transient and every request fails until the key is fixed; other 4xx to
500, because we sent something malformed.

One hierarchy difference bit: the qdrant handlers delegate to their own 503 case and it
type-checks because `UnexpectedResponse` subclasses `ApiException`. `APIStatusError` is a
**sibling** of `APIConnectionError`, not a subclass, so the shared handler needs their common
parent. Pylance caught it; every runtime test passed, because annotations are not enforced.

**Logs carry OpenAI's `request_id` as a structured field** — it is what their support asks
for and nothing else identifies the failed call. The batch is never logged: for embeddings
the request body *is* the corpus, so a failed batch in the log store is document text in the
log store.

`EMBEDDING_DIMENSIONS` and `DEFAULT_TOP_K` moved from settings to constants. Both define the
index rather than the deployment — changing either means re-embedding everything, which is
not something to expose as an env var.

### The handlers do not cover ingest

FastAPI exception handlers only run during request handling. Once `/ingest` is a background
task, an embedding failure happens after the response has been sent and the handler never
fires. The ingest loop needs its own error handling recording failure into job state. That
is the answer to "where does try/except belong": not in the client, not only in `app.py`,
but in the loop that owns the job.


### Header-aware chunking with breadcrumbs

Markdown header split first so chunks follow the document's structure, then a token split
because a section can be far larger than the budget. Every chunk is prefixed with a
breadcrumb — folder path plus the deepest two headings — so that "caching" under
`terraform` is distinguishable from "caching" under `sql`, which is the whole discriminator
the ambiguous-term queries rest on.

The non-obvious part: the breadcrumb is applied **after** the token split, never before.
Header-splitting alone leaves chunks 2..n of a section orphaned, because the heading only
survives in chunk 1. Prefixing every chunk re-anchors them.

### Three bugs, none visible by reading the code

Chunking was reviewed by running it over the real 411-document corpus and looking at the
distribution. Nothing here would have been caught by eye or by the linter.

**TOKEN_SIZE was not a ceiling.** The breadcrumb was prepended after the splitter had
already spent its whole budget, so stored chunks ran to 467 tokens against a nominal 400,
with 4.6% over. The split now reserves the breadcrumb first, per section, because each
section has a different breadcrumb and so a different budget. Max is now 399 with nothing
over, at a cost of 120 extra chunks.

**Headings were duplicated.** `strip_headers=False` kept the heading in the body while the
breadcrumb prepended it again — 73% of chunks restated their own heading, sections nested
two deep restated both, costing 6% of all tokens. Stripping is safe because a section's
body always begins with its deepest heading and the breadcrumb always keeps the deepest, so
what is removed is always the redundant copy.

**`token_count` drifted to measuring the bare chunk** rather than the stored text,
understating every chunk by ~29 tokens. Since batch sizing, cost and retrieval context
budget all derive from it, that would have been a systematic drift toward OpenAI's 300k
request cap showing up only as an occasional 400.

A fourth was caught before it shipped: `content_tokens` was briefly `len(chunk)` — the
*character* count under a field named tokens. It would not have crashed, and a content
floor of "10 tokens" would silently have meant 10 characters.

### Deferring the near-empty chunks properly

Some chunks carry almost no content — a heading and a horizontal rule, or a heading and the
lead-in sentence to content that lives in the next chunk. They matter because their
embedding is dominated by the breadcrumb, so they match breadcrumb-shaped queries strongly
while containing nothing. That is exactly the ambiguous-term query shape.

Rather than dropping them at ingest, `content_tokens` is stored alongside `total_tokens`
so a floor can be applied as a **query-time filter**. That converts a frozen ingest decision
into a retrieval variable that can be swept during evaluation without re-ingesting. When
retrieval exists it needs a Qdrant payload index on the field, and the floor must be ANDed
with any caller-supplied filter rather than replacing it.

`chunk_docs` also became a generator. Holding every chunk is survivable; holding every
*embedded* chunk at 1536 floats each is not, and the consumer can only stream if this end
does.

### Corpus after chunking

411 documents, 5,435 chunks, 938k tokens, about $0.019 to embed. Breadcrumb overhead is 17%
of the corpus. `MIN_CHUNK_TOKENS` never engages — the longest breadcrumb is 141 tokens
against a 300 threshold — so it is insurance, not a working part.

Still not wired: the corpus-scope exclusions. `CLAUDE.md`, `HISTORY.md`, `ai/prompt.md`,
`ai/resume-roadmap.md` and nine support-fiction files under the old in-repo DocuMind are all
still ingested. That has to be fixed before any baseline is frozen.

---

## 2026-08-20 — Qdrant layer lands, and ingestion gets split at the Document boundary

*Shipped as **v0.2.0** (Qdrant layer) and **v0.3.0** (document source, settings, error handling).*

### v0.2.0: the connection and collection layer

`AsyncQdrantClient` as a module-level singleton opened in `lifespan` and closed on
shutdown, plus the operations the rest of the service builds on: `ensure_collection`
treating a 409 as success (two workers starting concurrently would otherwise race, and the
loser crashes on a collection that now exists), `upsert_collection`, `query_collection`
exposing `top_k` / `score_threshold` / payload filter, and `delete_collection_data` by
payload filter — the last of which is what makes re-indexing idempotent rather than
duplicating chunks.

The module is `src/clients/qdrant.py`, not `qdrant_client.py`. The latter shadows the
third-party package it imports from; it resolves correctly today, but breaks confusingly
the moment `src/clients/` lands on `sys.path`.

### The architectural problem: the corpus is local, the service is not

`ingest(docs_folder)` welded "walk a directory" to "chunk, embed, upsert", which is fine
for a CLI and meaningless once FastAPI runs on a server that cannot see the laptop's
filesystem.

Split at the `Document` boundary: a **source adapter** yields `Iterable[Document]`, and the
pipeline knows nothing about paths, requests or archives. Filesystem walk first — the
Phase 0 eval harness runs locally and has to build an index without a server — with archive
upload as a second adapter later.

Upload beats S3 or a git-clone source here purely on numbers: the corpus is **460 markdown
files, 4.5 MB raw, 1.06 MB gzipped, ~660k tokens**. A megabyte over multipart needs no
infrastructure. The cost is that extracting a caller-supplied archive is a path-traversal
and zip-bomb vector, which has to be handled deliberately.

Make it an iterable rather than a list. Streaming files costs nothing now and is the
difference at ten times the corpus.

### Reading a folder as if the path is hostile

The walker confines every request to `INGEST_ROOT`, refuses credentials by name and suffix
independently of the extensions requested (asking for `*` does not opt into reading
secrets), prunes vendor and cache directories during the walk rather than filtering after,
sniffs for NUL bytes instead of trusting extensions, and caps file count, per-file size and
total size.

Two gaps remain, both recorded in CLAUDE.md: files are still read **through symlinks**,
which routes around the deny-lists; and `.env.example` does not document `INGEST_ROOT`,
which is the setting that bounds all of this.

Configuration also moved from scattered `os.getenv` calls to `pydantic-settings`, so a
missing `QDRANT_URL` fails at startup rather than at the first request. A blank
`QDRANT_API_KEY=` normalises to `None` — the client otherwise reads `""` as a key being
present and warns about sending it over plain http.

### Decisions deferred, deliberately

Chunk size is the one that matters: the old 100 tokens / 10 overlap is too small for
technical prose with code blocks, and ~500/50 is the likely answer. But it is an **eval
variable** — pick it, freeze it, then measure, because tuning it after the baseline exists
invalidates every later delta.

Two consequences follow from raising it. `EMBED_BATCH_SIZE` counts *chunks*, so 500 × 500
tokens is 250k per request against OpenAI's ~300k cap — batching has to become token-aware.
And accumulate-then-upsert stops fitting in memory at ~10k chunks; the loop has to embed a
batch, upsert it, and discard.

Also still true and worth not forgetting: the README claims re-ingesting an unchanged corpus
is a no-op, and nothing implements that yet.

---

## 2026-08-19 — DocuMind leaves the notes repo, and gets a real release pipeline

### The project moved out, and Phase 4 came first

DocuMind now lives at `/home/manish/code/personal/documind`
(`github.com/manishsharma0398/documind`), not at
`ai/07-rag-pipelines/exercises/solutions/DocuMind/`. That pulls the roadmap's Phase 4
("extract two standalone public repos") to the very start.

The reason is presentational, not technical: a path containing `exercises/solutions/`
reads as homework to anyone browsing, however good the code underneath is. Starting
standalone also avoids a history rewrite later — extracting a subdirectory into its own
repo with history intact is filter-branch work nobody enjoys.

Consequence to remember: the in-repo copy is now **superseded**, same status as `docbot`,
`smart-doc`, `semantic-search`, `support-bot-rag-pipeline` and `code-review-ai`. Its ~521
lines (`src/main.py` at 370, the Qdrant and OpenAI clients, the Pydantic models) still need
porting by hand. Its `docs/` corpus does **not** move — that six-file corpus is precisely
the no-headroom problem Phase 0 exists to fix.

The teaching contract travels with it. Implementation in the new repo is still Manish's to
write, including the mechanical port, on the grounds that a resume project has to be
defensible line by line. Config, tooling and docs are fair game to write when asked.

### Versioning derived from git, not from a CI counter

GitLab hands you per-branch versioning almost free via `$CI_COMMIT_REF_SLUG.$CI_PIPELINE_IID`,
because it maintains a per-project incrementing pipeline counter. GitHub has no equivalent:
`github.run_number` is **global across all branches**, so two concurrent feature branches
would interleave 1, 2, 3, 4 between them.

The answer was to stop looking for a CI counter. `git rev-list --count origin/master..HEAD`
counts exactly the commits the branch adds, which is both what was wanted and better than
GitLab's IID in one respect — it is deterministic and recomputable from any clone, with no
build-server state behind it. The tradeoff is honest: it is *not* monotonic. Rebase or
squash and the number can go down. For feature-branch builds that is fine.

`fetch-depth: 0` on `actions/checkout` is mandatory. The default is a depth-1 shallow clone
where that count is always `1` — the single most likely cause of a version stuck at `.1`.

Two representations are emitted because they serve different consumers, and neither accepts
the other's format:

| | Branch build | Release |
|---|---|---|
| SemVer 2.0.0 | `0.1.2-hybrid-search.3` | `0.1.2` |
| PEP 440 | `0.1.2.dev3+hybrid.search` | `0.1.2` |

The originally-sketched scheme (`hybrid-search.3`) is valid under neither standard — no
`MAJOR.MINOR.PATCH` core for SemVer, and PEP 440 would reject it outright, which matters
because `uv_build` reads that field. Both standards already have a slot for this: SemVer's
pre-release identifier after a hyphen, PEP 440's dev release plus local version label. CI
validates both strings against the official SemVer regex and `packaging.Version`, and that
validator immediately earned its place (see below).

Nothing consumes these outputs downstream yet — there is no Dockerfile and no package
publish. They become load-bearing in Phase 2 when the image gets tagged.

### Three traps that only an end-to-end run exposed

None of these were visible from reading the config. All three were found by actually
cutting releases, and all are now fixed — do not reintroduce them.

**release-please does not understand PEP 621.** Its `python` release type looks for
`version.py`, `setup.py`, `setup.cfg` and Poetry-style pyproject files. This project uses
`[project] version` with the `uv_build` backend, so v0.1.0 shipped a changelog and a tag
while `pyproject.toml` sat untouched at `0.1.0`. Left alone, that drift compounds silently
across releases. Fixed by switching to manifest mode with an explicit toml updater on
`$.project.version`.

**`uv.lock` carries the project's own version.** Bumping `pyproject.toml` desyncs the two,
and `uv sync --locked` then fails on the release PR — correctly, which is the entire point
of `--locked`. release-please ships no updater for it, so `release-please.yml` now
regenerates and commits `uv.lock` onto the release branch.

**Slug sanitising must collapse runs of separators.** A per-character substitution leaves
`--` intact. SemVer tolerates that, but converting `-` to `.` for the PEP 440 local label
then yields `..`, which is invalid. The branch that caught it was release-please's own
`release-please--branches--master`. The conformance check in CI is what surfaced it rather
than a malformed tag appearing somewhere downstream weeks later.

### `master` is strictly protected, with no escape hatch

A ruleset with **`bypass_actors: []`** — the rules apply to everyone including the owner.
Verified: a direct push is rejected with `GH013`. PR required (0 approvals, so there is no
being blocked waiting for a reviewer), `quality` and `version / version` must pass, linear
history, no force-push, no deletion.

Chosen over adding a bypass actor deliberately: CI takes about 25 seconds, so an escape
hatch buys very little and costs the guarantee.

This required making the repo **public** — branch protection and rulesets are both gated
behind Pro for private repos. Before flipping it, every blob in every commit was scanned
for `sk-`, `ghp_`, `github_pat_`, `AKIA`, `xox*` and PEM private-key headers; 20 files ever
committed, nothing sensitive. That came down to `.gitignore` covering `.env` from the very
first commit.

**Standing annoyance:** every release PR needs one manual workflow-approval click.
`approval_policy: first_time_contributors` treats `github-actions[bot]` as a first-time
contributor every single time — approving once does not clear it. Left as-is on purpose,
since that setting is what stops hostile fork PRs running workflows on a public repo.

### Also worth knowing

Conventional Commits are enforced at commit time by a `commit-msg` hook, because a bad
message is only fixable by rewriting history once pushed. The hook does **not** check PR
titles — and since merges are squashes, the PR title *is* the commit message release-please
reads. A PR titled `updates` silently earns no version bump.

`default_install_hook_types: [pre-commit, commit-msg]` matters: without it, a plain
`pre-commit install` wires only the pre-commit stage and the commit-msg hook never runs.

Dependabot's first run immediately caught four action pins that were already stale
(`checkout` v4→v7, `cache` v4→v6, `setup-uv` v5→v7, `release-please-action` v4→v5). Action
updates are now grouped into a single weekly PR; Python dependencies are deliberately left
ungrouped, since a library bump that breaks something is far easier to bisect alone.

Released **v0.1.0 → v0.1.1 → v0.1.2** in the process of proving the pipeline works.

### Where this leaves the actual work

Nothing has been ported. Ingestion and retrieval in the new repo are stubs, and Phase 0 has
not started — no golden set, no `evals/`, no frozen baseline. The open design question
gating the port: the old `main.py` does ingest, chunk, embed, retrieve and answer in one
370-line file, but the eval harness needs to call retrieval *without* the answering step so
hit@k can be scored independently of faithfulness.

---

## 2026-08-10 — Four branches land on master

`feat/js-notes`, `feat/ai-notes`, `feat/nginx` and `feat/python-notes` merged via PRs #1–#4,
bringing master up to date after months of parallel branch work. The branches were deleted
upstream; stale local tracking refs lingered until pruned.

---

## 2026-06-01 → 2026-08-02 — The AI track, chapters 1 through 9

Nine chapters written at roughly one every two to four weeks, each following the same shape:
`README.md` for mental models and architecture diagrams, `notes.md` for revision,
`interview.md` for senior-level questions, `examples/` written by the mentor, `exercises/`
solved by Manish.

| Chapter | Started |
|---|---|
| 01 how LLMs work | 2026-06-01 |
| 02 prompt engineering | 2026-06-01 |
| 03 LLM APIs in production | 2026-06-02 |
| 04 Python for AI engineering | 2026-06-04 |
| 05 LangChain fundamentals | 2026-06-28 |
| 06 vector databases and embeddings | 2026-07-07 |
| 07 RAG pipelines | 2026-07-15 |
| 08 advanced RAG | 2026-07-26 |
| 09 AI agents | 2026-08-02 |

Still open: chapter 8's exercises have no `solution/` directory — hybrid search, query
rewriting and reranking are unsolved. Chapter 9's cumulative exercise (the Code Review
Agent) has not been started, and `09-.../file-system-assistant/main.py` still carries four
`# TODO`s with an empty `test.py`.

---

## 2026-01-19 → 2026-06-12 — Fourteen domains of notes

Started with Node on 2026-01-19. The bulk of the infrastructure and backend domains
(`js-learnings`, `aws`, `sql`, `docker`, `k8s`, `linux`, `ci-cd-pipelines`, `scripting`)
landed on 2026-01-29, `react` in February, `python` and `terraform` in March, `ai` in June
and `nginx` last on 2026-06-12.

Roughly 410 markdown files and 484k words. The size is what makes the corpus useful to
DocuMind: large enough that retrieval metrics have somewhere to move, with terms like
*caching*, *retry*, *health check*, *connection pool* and *rate limit* appearing across many
unrelated domains — exactly the queries dense-only retrieval blurs.
