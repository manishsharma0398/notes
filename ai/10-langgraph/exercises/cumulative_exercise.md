# Chapter 10 Cumulative Exercise: DocuMind `/ask` as a Self-Correcting Graph

**Time estimate:** 2–3 hours (Phases 1–4), +1 hour for Phase 5
**Integrates:** Ch3 (API reliability, cost), Ch4 (Pydantic, async, FastAPI), Ch6
(embeddings), Ch7 (RAG, context assembly, citations), Ch8 (query rewriting — the *idea*,
not the full port), Ch9 (structured LLM output), Ch10 (graph, state, checkpointing, HITL,
streaming)

> This lands in the standalone DocuMind repo, not here. Standing rule: every chapter
> deepens the two projects. There is no project #3.

---

## Brief

`/retrieve` is done and its quality is a measured, frozen number:

```
hit@1 0.750   hit@5 0.857   hit@10 0.929   MRR 0.800
```

`/ask` does not exist. The naive version — retrieve top-5, stuff, generate — is twenty
lines and would be wrong for a reason the baseline already proved: **no similarity floor
separates a correct answer from an absent one.** An out-of-corpus question scored 0.504,
higher than a third of the correct answers. A cutoff that refuses reliably throws away 89%
of the real answers.

So `/ask` cannot trust the retriever's scores. It has to *judge the retrieved text* and act
on that judgement: answer, try once more with a better query, or say it doesn't know.

That is a branch, a bounded cycle and a grading step — a graph.

```
              ┌──────────┐
   question ─►│ retrieve │◄──────────────┐
              └────┬─────┘               │
                   ▼                     │
              ┌──────────┐        ┌──────┴──────┐
              │  grade   │──weak─►│   rewrite   │
              └────┬─────┘        └─────────────┘
              good │      (attempts == N → refuse)
                   ▼
              ┌──────────┐
              │ generate │─► answer + citations (streamed)
              └──────────┘
```

**What this exercise is not.** It does not make retrieval better — reranking does, and that
is Chapter 8's job. Do not claim a hit@5 gain from a control-flow change. This buys
*confident refusal* and *one bounded second chance*, and it is measured on different axes.

---

## Constraints (carried forward — do not relitigate)

- **`/retrieve` and `/ask` stay separate endpoints.** The retrieval eval runs 33 questions
  and must not pay for a completion each. `/ask` calls the same retrieval function.
- **Every new behaviour is a per-request flag, default off.** Ship grading, rewriting and
  the refusal path as independent switches or the delta is unattributable.
- **Nothing large goes in graph state.** Chunk text is re-serialised on every super-step.
- **Clients propagate, never catch.** Only the node that owns the decision handles failure.
- Missing collection is still a 503, not an empty 200.
- Repo workflow: branch → push → `gh pr create --fill` → green → squash merge. Conventional
  commit titles, since the squash message comes from the PR title.

---

## Phase 1 — The graph, with retrieval and generation only

Build `src/graph/ask.py`. No grading, no rewriting yet: `retrieve → generate → END`.

- State: `question`, `chunks` (references, not blobs — decide what "reference" means here),
  `answer`, `citations`, `attempts`, plus a token/cost accumulator with a reducer.
- The retrieve node calls the **existing** retrieval function. Do not fork it.
- The generate node assembles context and produces a grounded answer with citations back to
  `source` + section breadcrumb.
- `POST /ask` returns `{answer, citations[], chunks_used, attempts, usage}`.

**Success:** three real questions from `evals/golden_set.yaml` return grounded answers whose
citations you can verify by opening the file. `/retrieve`'s response shape is unchanged.

**Think about before you code:** context assembly order. Ch7's lost-in-the-middle result says
rank order is not the best presentation order. Whatever you choose, it is a decision to
defend in the README, and it belongs behind a flag if you want to measure it.

---

## Phase 2 — Grading and the bounded rewrite loop

Add `grade` and `rewrite` nodes plus a conditional edge.

- Grading returns **structured output** (Pydantic, Ch9): is the retrieved context sufficient
  to answer this question — yes/no plus a one-line reason. Grade the *text*, not the scores;
  scores are what the baseline proved untrustworthy.
- Rewriting produces a better query for the same information need, then loops to `retrieve`.
- `attempts` lives in state with a hard cap. Exceeding it routes to a `refuse` node.
  `recursion_limit` is a backstop, not your budget.

**Success:** an `absent` question from the golden set (`absent-webpack-01` is the obvious
one) refuses instead of hallucinating. A `factual` question still answers in one pass — check
that grading did not become a tax on the happy path.

**Measure while you are here:** how many questions trigger a rewrite? Each one doubles
retrieval cost and adds a full LLM round trip. If it fires on 40% of queries, the grader is
too strict and you have made p95 latency much worse for a small correctness gain.

---

## Phase 3 — Streaming and checkpointing

- Stream the response over SSE using `stream_mode=["updates", "messages"]`. `updates` drives
  status ("retrieving…", "checking sources…", "rephrasing…"); `messages` streams the answer
  tokens **filtered to the generate node only**.
- Add an async checkpointer. `thread_id` comes from the request; a caller reusing another
  caller's id must not be able to read its state — write down what stops that.
- Multi-turn: a second question on the same `thread_id` sees the earlier exchange.

**Success:** `curl -N` shows status events before the first answer token. Two calls on one
`thread_id` resolve a follow-up like "what about the second one?".

**Then answer honestly:** with conversation history in state, what is the token cost of turn
10 versus turn 1, and at which turn does this break? You do not have to fix it (that is
Ch11) — you have to know the number.

---

## Phase 4 — Human-in-the-loop where it actually belongs

Resist putting an approval gate on answering; nobody approves a chat reply. Pick a place
where a human decision is genuinely load-bearing. Two candidates:

- **`/ingest` with `exclude` globs** — pause after the walk, show the human the file count,
  the estimated token cost and the first 20 paths, and let them approve or amend the globs
  before a cent is spent. This one is real: the corpus exclusion list was arrived at by
  iterating, and each iteration was a paid re-embed.
- **Answer escalation** — when the graph is about to refuse, offer the question to a human
  to answer and store.

Implement one, with the interrupt payload rich enough to decide from alone.

**Success:** the ingest (or escalation) run pauses, the process exits, and a **separate**
process resumes it with `Command(resume=...)` and completes. No embedding is paid for before
the human answers, and nothing runs twice on resume.

---

## Phase 5 — Measure, and only then write it down

New axes, because hit@k does not describe an answer:

| Metric | Definition | Why separate |
|---|---|---|
| faithfulness | is every claim in the answer supported by the retrieved chunks? | a system can be perfectly faithful to bad retrieval |
| answer correctness | does it contain `expected_answer_contains`? | fails differently from faithfulness |
| refusal accuracy | refuses the `absent` questions, answers the rest | the metric this whole chapter exists for |
| p95 latency | end-to-end, and time-to-first-token | streaming changes perceived latency, not total |
| $ / query | including rewrites and grading calls | the loop can double the bill invisibly |

- Keep the runner/reporter split: `run_eval.py` **records** raw per-question output,
  `report.py` **scores** it. Trying a different faithfulness prompt must not cost another run.
- Save `evals/results/04-ask-graph.json`. Pin `corpus_commit` — the notes repo keeps growing.
- Report retrieval metrics **unchanged** from the frozen baseline. If hit@5 moved, something
  is wrong with your harness, not good about your graph.

**Done when** you can say, with numbers: *"grading + a bounded rewrite took refusal accuracy
from X to Y, at +Nms p95 and +$C per 1k queries, with hit@5 unchanged at 0.857."*

That sentence — a gain, its price, and what did **not** change — is the whole point of the
exercise.

---

## What to Verify

- [ ] `/retrieve` response shape, latency and eval scores are untouched
- [ ] Every new behaviour has a per-request flag, defaulting to off
- [ ] No unbounded loop exists: a cap in state, a give-up branch, and a per-request token ceiling
- [ ] No node has a side effect before an `interrupt()`
- [ ] Graph state holds no chunk text you could hold by reference instead — check the size of
      one serialised checkpoint and multiply by super-steps
- [ ] A refusal is a normal 200 response with `answer: null` (or equivalent), not an error —
      "I don't know" is a correct outcome
- [ ] Async checkpointer under FastAPI; nothing blocking in the event loop
- [ ] README metric cells stay empty until `evals/results/` produces the number
- [ ] Nothing in the repo references the notes, the chapters, or a roadmap

---

<details>
<summary><b>Hints</b> — read only when stuck</summary>

**State design is the whole exercise.** Start by listing every field, and for each: who
writes it, do two nodes write it in the same super-step, and how big is it. `chunks` is the
interesting one — the generate node needs the text, but that text is re-serialised at every
checkpoint. Options: keep ids and re-fetch in generate, keep text but trim to the top-k you
will actually use, or accept the cost and prove it is small. Any of the three is defensible;
"I didn't think about it" is not.

**Grading is a classifier, not a chat.** Structured output, temperature 0, and a prompt that
gets the question and the chunk text — not the scores. Consider grading chunks individually
(fan out with `Send`, reduce into a list, keep the ones that pass) versus grading the whole
context at once: one is more precise and N times the calls. Measure before choosing.

**Where the loop budget lives.** In state, incremented by the rewrite node, read by the
router. Two attempts is usually right: the third rarely helps and the cost is linear.

**Refusal wording matters more than you think.** "I don't know" and "the corpus has nothing
on X" are different claims. Only the second one is true, and only when grading has actually
seen the retrieved text.

**Streaming filter.** Every LLM in the graph emits into `stream_mode="messages"`, grader
included. Filter on `metadata["langgraph_node"]` or you will stream your own scratch work to
the user.

**Faithfulness scoring.** The cheap version is an LLM judge that sees the answer and the
chunks and returns supported/unsupported per claim. It is a model grading a model — note the
correlation risk in the README rather than pretending the number is ground truth. And keep
the judge's model pinned in `config.yaml` alongside the embedding model, for the same reason.

**Do not let the system define its own ground truth.** Same rule as the golden set: never
score faithfulness against context the same call selected without an independent check on a
sample you read yourself.

</details>
