# History

A running record of what changed and why. Newest first. **Update this with every
meaningful change** — it is the thing that makes it possible to walk away for a
few months and pick the project back up without archaeology.

This file is private to the notes repo. The portfolio projects present themselves as
independent work and must not reference the roadmap, the chapters, or this record.

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
