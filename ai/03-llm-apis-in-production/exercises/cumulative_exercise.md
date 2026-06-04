# Cumulative Exercise — Chapters 1–3

**Covers:** Token budgeting · prompt engineering · retry logic · streaming · cost optimization  
**Estimated time:** 2–3 hours  
**Rules:** Write all code yourself. No AI-generated solutions.

---

## Project: AI Article Summarizer — Production Pipeline

Build a command-line tool that takes a long article (text file or URL content), summarizes it
using the cheapest effective prompt strategy, and produces a cost report.

This is a realistic pipeline: content ingestion → token budgeting → prompt selection →
resilient LLM call → output + cost report.

---

## What You're Building

```
$ python summarizer.py article.txt

AI ARTICLE SUMMARIZER
══════════════════════════════════════════════
Source: article.txt
Article: 4,312 words | 5,847 tokens

TOKEN BUDGET CHECK
──────────────────
Model: gpt-4o-mini (context: 128K)
Input tokens:   5,921  (article + system prompt)
Output budget:  1,000  (your max_tokens setting)
Total:          6,921
Remaining:      121,079  ✅ Fits

PROMPT STRATEGY SELECTION
──────────────────────────
Article length: 5,847 tokens
→ Selected: few-shot (article is medium length, CoT would be too expensive)
→ Strategy cost estimate: $0.000889

GENERATING SUMMARY (streaming)
───────────────────────────────
The article discusses the recent advances in transformer architectures...
[streams here token by token]

...with particular emphasis on the efficiency improvements introduced in 2024.

SUMMARY COMPLETE
──────────────────────────────────────────────
Compression: 5,847 → 312 tokens (94.7% reduction)
Actual input tokens:   5,921 (API reported)
Actual output tokens:  312   (API reported)
Actual cost:          $0.000935
Latency:              2,847ms
Retries:              0
```

---

## Phases

### Phase 1 — Article ingestion and token budgeting (Ch1)

- [ ] Accept a filename as a command-line argument (`sys.argv[1]`)
- [ ] Read the file and count its tokens with `tiktoken`
- [ ] Count words with `len(text.split())`
- [ ] Determine if the article fits in the context window with a 1000-token output reservation
- [ ] If it doesn't fit: **truncate** the article to the safe limit and log a warning
  - Do NOT crash — graceful truncation is a production requirement
- [ ] Display the token budget report

### Phase 2 — Prompt strategy selection (Ch2)

Implement automatic strategy selection based on article length:

```
< 500 tokens  → zero-shot  (article is short, no examples needed)
500–3000 tokens → few-shot-3 (medium article, examples help consistency)  
> 3000 tokens → structured output  (long article, JSON forces concise output)
```

- [ ] Define a system prompt for each strategy
  - Zero-shot: direct summarization instruction
  - Few-shot: 3 example (title → summary) pairs embedded in the prompt
  - Structured: ask for JSON with `summary` (string) and `key_points` (list of 3–5 strings)
- [ ] Print which strategy was selected and why
- [ ] Calculate pre-call cost estimate using `tiktoken` token count + gpt-4o-mini pricing

### Phase 3 — Resilient LLM call with streaming (Ch3)

- [ ] Use `AsyncOpenAI` (async client)
- [ ] Implement retry logic: max 3 retries, exponential backoff + jitter, 429/5xx only
- [ ] Call with `max_tokens=1000`
- [ ] **Stream the response** — print tokens as they arrive to stdout
- [ ] Track retry count
- [ ] After streaming completes, capture actual token usage from `stream.usage`

### Phase 4 — Post-call cost report (Ch1 + Ch3)

- [ ] Display compression ratio: article tokens → summary tokens
- [ ] Display actual vs estimated token counts (how close was `tiktoken` to API's count?)
- [ ] Calculate actual cost from API-reported token usage
- [ ] Display: latency_ms, retry count, strategy used
- [ ] If the article was truncated in Phase 1, show a `⚠️ TRUNCATED` warning in the report

---

## Success Criteria

Test with three articles of different lengths:

**Short** (~200 words): Paste any short news paragraph into `short.txt`
- [ ] Strategy selected: zero-shot
- [ ] No truncation

**Medium** (~1500 words): Paste any blog post into `medium.txt`
- [ ] Strategy selected: few-shot
- [ ] Summary appears on screen while streaming

**Long** (~8000 words): Paste a Wikipedia article into `long.txt`
- [ ] Strategy selected: structured output
- [ ] Output is valid JSON with `summary` and `key_points`
- [ ] No context window exceeded error

**Edge case** — Very long article (20,000+ words):
- [ ] Article is truncated to the safe limit with a warning
- [ ] Tool still runs and produces a summary (does not crash)

---

## Constraints

- Use `gpt-4o-mini` only (cost efficiency is part of the exercise)
- Do not hardcode the `OPENAI_API_KEY` — read from environment
- The tool must be runnable as `python summarizer.py <filename>` (no interactive prompts after startup)
- A missing file should print a clear error and `sys.exit(1)` — not a Python traceback

---

## Stretch Goals

- [ ] Add `--model` flag to override the model (and recalculate cost with correct pricing)
- [ ] Add `--strategy` flag to force a specific strategy (override automatic selection)
- [ ] Save the summary to `<filename>.summary.txt` alongside the source
- [ ] Add `--batch` mode: accept a directory, summarize all `.txt` files, print a combined cost report at the end
- [ ] Show a progress bar for batch mode using `tqdm`

---

## Skills Demonstrated

| Skill | Where it shows |
|-------|----------------|
| Token counting (Ch1) | tiktoken for budget check and pre-call estimate |
| Cost calculation (Ch1) | pre-call estimate + post-call actual comparison |
| Context window guard (Ch1) | graceful truncation before API call |
| Zero-shot prompting (Ch2) | strategy for short articles |
| Few-shot prompting (Ch2) | strategy for medium articles |
| Structured output (Ch2) | strategy for long articles, JSON parsing |
| Retry logic (Ch3) | tenacity with 429/5xx handling |
| Streaming (Ch3) | live token output to terminal |
| Async client (Ch3) | AsyncOpenAI in asyncio.run() |
| Token usage tracking (Ch3) | API-reported vs tiktoken-estimated counts |
