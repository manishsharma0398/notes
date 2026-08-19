# Resume Roadmap — turning the AI notes into two portfolio projects

**Goal:** two deep, defensible projects with measured numbers — not six tutorial repos.

- **P1 — DocuMind:** production RAG service (`07-rag-pipelines/exercises/solutions/DocuMind`)
- **P2 — Code Review Agent:** Chapter 9 cumulative exercise (not started)

**Standing rule:** every future chapter *deepens these two projects*. Never start project #3.

Total effort: ~5–6 focused days (3 weekends).

---

## Phase 0 — Corpus, baseline & hygiene (3–4 hrs)

Measure **before** improving. Without a baseline, the Chapter 8 work produces no numbers,
and numbers are the whole point of the resume bullets.

### 0a. Fix the corpus first — this is blocking

DocuMind's `docs/` is 6 real files / 39 chunks. At `top_k=5` that retrieves 13% of the
whole index per query, so hit@5 sits at ~100% before any work is done. Chapter 8 would
then measure **zero improvement** — not because hybrid search and reranking don't work,
but because there is no headroom above the ceiling.

- [ ] Delete the scratch files: `bijay.md`, `manish.md`, `man.txt`, and the nested `docs/docs/`
      (a duplicate doc silently eats a context slot and skews hit@k)
- [ ] Point ingestion at the notes repo itself: `~/code/personal/learnings/notes`
      — 410 markdown files, ~484k words, 14 technical domains, ~$0.013 to embed.
      This is also DocuMind's stated use case: index your own notes.
- [ ] Watch what breaks at ~8–10k chunks vs 39: `EMBED_BATCH_SIZE`, the delete-by-filter
      re-index path, ingest wall time. Untested above 39 chunks — a finding either way.

### 0b. Golden question set (25–30 questions)

Schema: `{question, expected_sources[], expected_answer_contains, type}`

| Type | Purpose | Share |
|---|---|---|
| `factual` | one doc clearly answers it | ~1/3 |
| `ambiguous-term` | uses a term spanning many domains — **the Chapter 8 discriminator** | ~1/3 |
| `multi-hop` | needs two docs from different areas | ~1/5 |
| `absent` | not in the corpus — measures refusal accuracy | ~5 questions |

Terms that span domains in this corpus (use these for `ambiguous-term`):

| Term | Appears in |
|---|---|
| caching | ai, aws, docker, js, nginx, node, python, sql, terraform |
| retry | ai, aws, ci-cd, js, node, sql, terraform |
| health check | ai, aws, k8s, nginx, node, terraform |
| connection pool | ai, aws, nginx, node |
| rate limit | ai, aws, js, nginx, node, terraform |

Dense-only retrieval blurs exactly these. That is where reranking and hybrid search show a
visible delta — and a corpus without them shows nothing.

### 0c. Eval harness & baseline

- [ ] `evals/run_eval.py` reporting: hit@k, MRR, faithfulness, refusal accuracy, p95 latency, $/query
- [ ] Score **faithfulness** (is the answer supported by retrieved context?) separately from
      **correctness**. A RAG system can be perfectly faithful to bad retrieval; conflating the
      two hides which half is broken.
- [ ] Save `evals/results/00-baseline.json` and **freeze it** — never regenerate it against a
      changed corpus, or every later delta becomes meaningless
- [ ] Project-level `.gitignore` + `.env.example`; untrack the committed `.pyc`

**Done when:** `uv run python -m evals.run_eval` prints a metrics table you trust, against a
corpus with enough headroom for Phase 1 to move the numbers.

---

## Phase 1 — Chapter 8 → DocuMind retrieval upgrade (weekend 1)

Solve `08-advanced-rag/exercises/` first, then port each technique into DocuMind
**one at a time, re-running the eval after each**. The per-technique deltas are
interview gold — most candidates can only say "I added reranking," you'll say what it bought.

- [ ] Chapter 8 `chapter_exercise.md` + `cumulative_exercise.md`
- [ ] **Query rewriting** (the stretch goal deferred in Chapter 7) — multi-query or HyDE
      → `evals/results/01-query-rewrite.json`
- [ ] **Hybrid search** — Qdrant sparse (BM25/SPLADE) + dense, fused with RRF
      → `evals/results/02-hybrid.json`
- [ ] **Reranking** — retrieve top-20, cross-encoder rerank, keep top-5
      → `evals/results/03-rerank.json`
- [ ] Record a before/after table in the README; note *cost and latency* paid for each gain

**Done when:** you can say "hybrid + rerank took hit@5 from X% to Y% at +Nms p95 and +$C/1k queries."

---

## Phase 2 — Make it a service, not a script (weekend 2, day 1)

Fold `06-.../docbot`'s FastAPI layer into DocuMind, then retire docbot.

- [ ] `POST /ingest` (background task), `POST /query` (SSE stream), `GET /health`, `GET /sources`
- [ ] `docker-compose.yml`: app + Qdrant → whole thing runs with one command
- [ ] Tracing (Langfuse or LangSmith) — gives real latency data *and* a README screenshot
- [ ] Cache layer on repeated query embeddings; report cache hit rate
- [ ] Tests (~10 is enough to change the signal):
      `chunk_docs` token boundaries + overlap, `lost_in_the_middle_reorder`,
      `assemble_context` citation format, score-threshold filtering,
      one API integration test with a mocked OpenAI client
- [ ] Rewrite the README: problem → architecture ASCII diagram → eval table →
      tradeoffs → run instructions. (The README *is* the project for anyone who won't clone it.)

**Done when:** `docker compose up` and a curl gets a streamed, cited answer.

---

## Phase 3 — Code Review Agent (weekend 2 day 2 → weekend 3)

- [ ] Close out `09-ai-agents/.../file-system-assistant`: the `read_file_head` TODO,
      the third tool schema, the empty `test.py` (~1 hr)
- [ ] Build the Chapter 9 cumulative agent per its brief — it reuses
      the tool loop (ch9) + LCEL/structured output (`code-review-ai`, ch5) + RAG (ch7)
- [ ] Details that separate it from a demo:
      bounded iterations **and** a token budget; Pydantic-validated tool args;
      retry-on-malformed-structured-output; emits `review.json` + `review.md`
- [ ] Run it against your own JS/Node repos, paste real output in the README

**Done when:** `python review_agent.py --path ./some_project/` produces a review you'd act on.

---

## Phase 4 — Package & publish (1 day)

- [ ] Extract two standalone public repos: `documind`, `code-review-agent`
      (paths like `exercises/solution/...` read as homework, however good the code is)
- [ ] Keep this notes repo as the learning journal and link it from both READMEs —
      nine chapters of engineering notes is itself a differentiator
- [ ] Each repo: LICENSE, `.gitignore`, `.env.example`, compose file,
      GitHub Actions running ruff + pytest
- [ ] Write the resume bullets with the real numbers from `evals/results/`
- [ ] Optional, high ROI: one short blog post per project — becomes your interview script

---

## Phase 5 — Continue the curriculum, deepening the same two projects

| Chapter | Upgrade | Which project |
|---|---|---|
| LangGraph | rewrite the agent loop as a stateful graph + checkpointing + human-in-the-loop approval | P2 |
| Memory systems | conversational long-term memory across sessions | P1 |
| MCP | expose DocuMind as an MCP server — very current, strong signal | P1 |
| Scaling | async workers + queue for ingestion of large corpora | P1 |
| Observability / evals | wire the eval suite into CI, regression-gate retrieval quality | both |
| AI security | prompt-injection tests (poisoned document in the corpus) | both |
| Deployment | containerized deploy + CI/CD | both |

---

## Resume bullet templates (fill brackets from `evals/results/`)

**DocuMind — Production RAG Service** · Python, FastAPI, Qdrant, LangChain, OpenAI
- Async document Q&A service with token-boundary chunking, cost-tracked batched embedding,
  and idempotent re-indexing via payload-filtered deletes — re-ingesting an unchanged corpus is a no-op.
- Raised retrieval hit@5 from [X]% to [Y]% with hybrid BM25 + dense retrieval, RRF fusion,
  and cross-encoder reranking; validated on a 30-question golden set including negative cases.
- Cut hallucinated answers via a similarity score floor, context-only prompting, and inline
  source citations — [Z]% refusal accuracy on out-of-corpus questions.
- Held p95 latency at [N]ms and cost at $[C]/1k queries through streaming, embedding batch
  sizing, and query caching ([H]% hit rate).

**Code Review Agent** · Python, OpenAI function calling, LangChain, Pydantic
- Tool-using agent that plans which files to review, reads them, and emits a structured
  Pydantic review — schema-validated tool arguments and a dispatch layer that converts every
  failure into model-readable JSON instead of raising.
- Bounded cost and runaway risk with an iteration cap plus per-run token budget; recovers from
  malformed model output with a normalize-and-retry path.
