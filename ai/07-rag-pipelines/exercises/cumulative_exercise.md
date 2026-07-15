# Cumulative Exercise — DocuMind: Personal Knowledge Base Assistant

## Project Brief

You are building **DocuMind** — a command-line knowledge base assistant that
lets a user index their own collection of notes and documents, then query them
conversationally with a full RAG pipeline.

This is a realistic mini-project you could add to your portfolio. It integrates
**every concept from Chapters 1–7**:

| Chapter | Concept applied |
|---------|----------------|
| 1 | Tokenization awareness (chunking at token boundaries) |
| 2 | Prompt engineering (system prompt, few-shot examples for citation style) |
| 3 | LLM API usage (rate limits, retries, streaming, temperature=0) |
| 4 | Async Python (async ingestion pipeline, async query) |
| 5 | LangChain LCEL (chain composition, retriever interface) |
| 6 | Vector store (Qdrant, embeddings, chunking strategies) |
| 7 | RAG pipeline (context assembly, score filtering, citation) |

---

## What You're Building

```
$ python documind.py ingest ~/notes
[documind] Scanning for .md, .txt files...
[documind] Found 47 files (312 chunks)
[documind] Embedding in batches of 500...
[documind] Done. Index saved.

$ python documind.py chat
DocuMind > What did I write about async context propagation?
Assistant: Your notes on async context propagation (async_notes.md) describe...
[Source: async_notes.md, chunk 3]

DocuMind > When did I last update my Docker notes?
Assistant: I don't have metadata about file modification dates in my index...

DocuMind > exit
```

---

## Phases

### Phase 1 — Ingestion Pipeline (1–2 hours)
Build a robust ingestion module:

**Requirements:**
- Scan a directory recursively for `.md` and `.txt` files
- Chunk using recursive character splitting (implement yourself, or use LangChain's splitter)
- Add metadata to every chunk: `source` (relative path), `filename`, `extension`, `chunk_index`
- Embed in batches of up to 500 chunks per API call
- Upsert to Qdrant with idempotency (delete-by-source before re-inserting)
- Save an `index_manifest.json` alongside the Qdrant collection:
  ```json
  {
    "collection": "documind",
    "model": "text-embedding-3-small",
    "indexed_at": "2024-01-15T10:30:00Z",
    "file_count": 47,
    "chunk_count": 312
  }
  ```
- Print progress: file count, chunk count, batch count, and a cost estimate

**Success criteria:**
- [ ] Running ingest on a folder of 10+ files produces no errors
- [ ] Running ingest twice produces the same chunk count (idempotent)
- [ ] `index_manifest.json` is created/updated after ingestion
- [ ] Cost estimate is printed: `Estimated embedding cost: $X.XXXX`

---

### Phase 2 — Query + Answer (1–2 hours)
Build the RAG query pipeline:

**Requirements:**
- `retrieve(query, top_k=5)` → embed query, search Qdrant, return chunks with scores
- Score filter: drop chunks below `threshold` (configurable, default 0.55)
- Apply "lost in the middle" ordering
- Context assembly with numbered source labels
- System prompt that:
  - Instructs LLM to use ONLY the context
  - Asks it to cite sources using `[Source: filename.md]` inline
  - Handles the "no information" case gracefully
- Generation with `gpt-4o-mini`, `temperature=0`
- Single-query mode: `python documind.py query --question "..."`

**Success criteria:**
- [ ] Query about content in your notes returns a grounded answer with a source citation
- [ ] Query about something not in your notes returns a polite "not found" message
- [ ] Chunks below 0.55 similarity are never sent to the LLM

---

### Phase 3 — Conversational Chat Mode (1–2 hours)
Add an interactive chat loop with multi-turn awareness:

**Requirements:**
- `python documind.py chat` enters a REPL loop
- Maintain a conversation history list: `[{"role": "user", "content": "..."}, ...]`
- On each turn: retrieve fresh context, inject into system prompt, pass full history to LLM
- Keep last N turns in memory (configurable, default 5)
- Commands: `exit`, `clear` (reset history), `sources` (show last query's retrieved chunks)
- Stream LLM output token-by-token

**Success criteria:**
- [ ] Follow-up questions ("what else did I write about that?") use prior context
- [ ] `clear` resets the conversation without re-indexing
- [ ] `sources` prints the chunks that were used in the last answer
- [ ] Streaming: tokens appear one-by-one, not all at once

---

### Phase 4 — Evaluation (optional, 1 hour)
Write a RAGAS evaluation harness for your own index:

**Requirements:**
- Create `eval_set.json`: 10 questions about your actual notes, with known correct answers
- Run your pipeline on all 10 questions
- Score with RAGAS: context_recall, context_precision, faithfulness
- Print a report: per-question scores + average

**Success criteria:**
- [ ] Average faithfulness > 0.85 (LLM stays grounded in your notes)
- [ ] Average context_recall > 0.80 (retriever finds the right chunks)
- [ ] You can identify which question has the lowest recall and explain why

---

## File Structure

```
documind/
├── documind.py          # CLI entrypoint (argparse)
├── ingestion.py         # load, chunk, embed, upsert
├── retrieval.py         # retrieve, score filter
├── generation.py        # assemble context, call LLM
├── chat.py              # interactive REPL loop
├── config.py            # constants: model names, thresholds, chunk size
└── eval/
    ├── eval_set.json    # your test questions
    └── run_eval.py      # RAGAS evaluation script
```

---

## Constraints

- Do NOT use LangChain's built-in RAG chain for the core pipeline — build it yourself.
  You may use LangChain's text splitter and Qdrant wrapper.
- All embedding calls must be batched
- No hardcoded API keys — use `os.environ`
- The CLI must handle keyboard interrupt (`Ctrl+C`) gracefully in chat mode

---

## What Makes a Strong Solution

- **Idempotent ingestion** — re-running doesn't corrupt the index
- **Score transparency** — print retrieval scores in verbose/debug mode
- **Graceful degradation** — if Qdrant is unreachable, give a clear error message
- **Cost awareness** — estimate and print embedding cost during ingestion
- **Streaming** — use `astream()` in chat mode for real-time output

---

## Stretch Goals (if you finish early)

- Add `--reindex` flag that only re-embeds files whose `mtime` has changed
- Add support for PDF files using `pypdf`
- Add a `--stats` command that shows: total chunks, file breakdown, collection size
- Implement a simple BM25 keyword search alongside vector search (preview of Chapter 8 hybrid search)
