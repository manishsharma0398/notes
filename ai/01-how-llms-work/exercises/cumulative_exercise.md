# Cumulative Exercise — Chapter 1 Only

**Covers:** Tokenization · token costs · autoregressive generation · context windows · model weights  
**Estimated time:** 1–2 hours  
**Rules:** Write all code yourself. Do not use AI to generate the solution.

---

## Project: LLM Cost Calculator CLI

Build a command-line cost calculator that a team could actually use before deploying
an LLM feature. It should answer the real questions engineers ask: "How much will this
cost? Is our prompt too long? Which model should we use?"

---

## What You're Building

```
$ python llm_cost_calc.py

LLM Cost Calculator
===================
Enter your system prompt (or press Enter to skip):
> You are a helpful assistant that extracts structured data from text.

Enter your user message:
> Please analyze the following customer review and extract: sentiment, key topics,
  and action items. Review: "The product arrived damaged and customer service was
  unhelpful. I've been waiting 3 weeks for a refund."

Expected max output tokens: 300

──────────────────────────────────────────
TOKEN BREAKDOWN
──────────────────────────────────────────
System prompt:    18 tokens
User message:     62 tokens
─────────────────
Total input:      80 tokens
Max output:       300 tokens
Grand total:      380 tokens (worst case)

──────────────────────────────────────────
CONTEXT WINDOW CHECK
──────────────────────────────────────────
gpt-4o        (128K): ✅ Fits  — 127,620 tokens remaining
gpt-4o-mini   (128K): ✅ Fits  — 127,620 tokens remaining
claude-3-haiku (200K): ✅ Fits  — 199,620 tokens remaining

──────────────────────────────────────────
COST ESTIMATE (per request)
──────────────────────────────────────────
Model             Input cost    Output cost   Total/request
─────────────────────────────────────────────────────────
gpt-4o            $0.000400     $0.003600     $0.004000
gpt-4o-mini       $0.000012     $0.000108     $0.000120
claude-3-haiku    $0.000020     $0.003750     $0.003770

──────────────────────────────────────────
DAILY COST PROJECTION
──────────────────────────────────────────
Requests/day: 1000

Model             Daily cost    Monthly cost
────────────────────────────────────────────
gpt-4o            $4.00         $120.00
gpt-4o-mini       $0.12         $3.60
claude-3-haiku    $3.77         $113.10

💡 Recommendation: gpt-4o-mini saves $3.88/day vs gpt-4o (97% cheaper)
```

---

## Phases

### Phase 1 — Token counting and breakdown

- [ ] Accept system prompt and user message (via `input()` prompts)
- [ ] Count tokens for each separately using `tiktoken` with `cl100k_base`
- [ ] Accept `max_output_tokens` from the user
- [ ] Display the token breakdown table (system prompt + user message + total + grand total)

### Phase 2 — Context window check

Define a model registry (hardcoded dict) with at least these models and their context windows:

```python
MODELS = {
    "gpt-4o":          {"context_window": 128_000, ...},
    "gpt-4o-mini":     {"context_window": 128_000, ...},
    "claude-3-haiku":  {"context_window": 200_000, ...},
}
```

- [ ] For each model, check if total tokens fit in the context window
- [ ] Display ✅ Fits or ❌ Exceeds with the margin
- [ ] If a model can't fit the prompt, display by how many tokens it's over

### Phase 3 — Cost estimation

Extend your model registry with pricing (research current pricing yourself — this is intentional):

```python
MODELS = {
    "gpt-4o": {
        "context_window": 128_000,
        "input_cost_per_1m":  ...,  # Look up current pricing
        "output_cost_per_1m": ...,
    },
    ...
}
```

- [ ] Calculate per-request cost: input tokens × input rate + output tokens × output rate
- [ ] Display the cost table with per-request totals
- [ ] Skip models that exceed the context window from cost calculation

### Phase 4 — Daily projection and recommendation

- [ ] Ask the user for expected requests per day
- [ ] Calculate daily and monthly costs for each model
- [ ] Identify the cheapest model that fits the context window
- [ ] Print a recommendation: "Model X saves $Y/day vs Model Z (N% cheaper)"

---

## Success Criteria

Run it with this input and verify your output makes sense:

**System prompt:** `"You are a JSON extraction assistant. Return only valid JSON."`  
**User message:** `"Extract the name and age from: My name is Alice and I am 30 years old."`  
**Max output tokens:** `100`  
**Requests/day:** `5000`

Check:
- [ ] Token counts are in the right ballpark (use the tiktoken REPL to verify manually)
- [ ] gpt-4o-mini should be dramatically cheaper than gpt-4o
- [ ] All three models should fit within their context windows for this short prompt
- [ ] Monthly cost for gpt-4o at 5000 req/day should be in the tens of dollars

**Edge case:** Set a very large user message (paste a 5000-word article). Verify:
- [ ] Token count jumps significantly
- [ ] Models with smaller context windows show ❌ if you add enough text
- [ ] Cost estimate scales correctly

---

## Stretch Goals

- [ ] Add `--json` flag that outputs the full analysis as JSON (useful for CI/CD pipelines)
- [ ] Add a `--file` flag that reads the user message from a text file instead of `input()`
- [ ] Add a "break-even analysis": at what daily request volume does `gpt-4o-mini` save >$100/month vs `gpt-4o`?
- [ ] Color-code the output: green for fits, red for exceeds, yellow for warning (within 20% of limit)

---

## Skills Demonstrated

| Skill | Where it shows |
|-------|----------------|
| Token awareness (Ch1) | tiktoken integration, token counting |
| Cost model (Ch1) | input vs output token pricing |
| Context window engineering (Ch1) | hard limit checking, margin calculation |
| Autoregressive understanding (Ch1) | knowing why input + output = total budget |
