# Cumulative Exercise — Chapters 1–2

**Covers:** LLM internals · token costs · prompt engineering techniques  
**Estimated time:** 1.5–2.5 hours  
**Rules:** Write all code yourself. No AI-generated solutions.

---

## Project: Prompt Optimizer — Find the Cheapest Prompt That Still Works

You will build a tool that systematically tests different prompt strategies for the
same task and finds the **optimal tradeoff between cost and output quality**.

This is a real engineering problem: teams often use CoT everywhere when zero-shot
would be 50x cheaper and equally accurate for simple tasks.

---

## What You're Building

```
$ python prompt_optimizer.py

PROMPT OPTIMIZER
Task: Classify customer support ticket severity (low/medium/high/critical)
Input: 10 test tickets
──────────────────────────────────────────────────────────────────────────

Strategy         Input tokens  Output tokens  Total tokens  Cost/req    Valid %
─────────────────────────────────────────────────────────────────────────────────
zero-shot        45            3              48            $0.0000072   80%
few-shot-3       112           5              117           $0.0000176   100%
few-shot-5       178           5              183           $0.0000275   100%
chain-of-thought 45            87             132           $0.0000248   100%
structured       45            28             73            $0.0000110   100%

──────────────────────────────────────────────────────────────────────────
RECOMMENDATION
──────────────────────────────────────────────────────────────────────────
Most cost-efficient with 100% validity: few-shot-3
Savings vs chain-of-thought: 39% cheaper per request
At 10,000 req/day: $1.76/day vs $2.48/day (saves $216/year)
```

---

## Phases

### Phase 1 — Define test cases and strategies

Define 10 test tickets (write them yourself — make them realistic):

- Mix of clearly low/medium/high/critical cases
- Include at least 2 ambiguous ones that could be argued either way
- At least one that's clearly `critical` (system outage, data breach, etc.)

Define 5 prompting strategies for severity classification:
1. `zero-shot` — task only
2. `few-shot-3` — 3 examples
3. `few-shot-5` — 5 examples
4. `chain-of-thought` — reasoning before answer
5. `structured` — JSON output with `response_format`

### Phase 2 — Build the measurement harness

For each strategy × each ticket:
- [ ] Call the LLM and capture the full response
- [ ] Count input tokens and output tokens (use `tiktoken` for pre-call estimate AND the `usage` field in the API response for post-call actuals)
- [ ] Validate whether the response contains a valid category (`low`, `medium`, `high`, `critical`)
- [ ] Store results in a list of dicts for aggregation

### Phase 3 — Aggregation and cost calculation

- [ ] Calculate average input/output tokens per strategy
- [ ] Calculate cost per request using gpt-4o-mini pricing
- [ ] Calculate validity percentage (% of responses with a valid category)
- [ ] Print the comparison table

### Phase 4 — Recommendation engine

- [ ] Identify all strategies with 100% validity (or the highest validity rate)
- [ ] Among those, pick the cheapest
- [ ] Print the recommendation with:
  - Savings vs. most expensive strategy (%)
  - Daily cost at 10,000 requests
  - Annual savings

---

## Success Criteria

- [ ] All 5 strategies produce results for all 10 test tickets
- [ ] Token counts from `tiktoken` (pre-call) vs `usage` (post-call) are tracked — note the difference
- [ ] The cost table is sorted by cost ascending
- [ ] The recommendation is always the cheapest strategy with the highest validity rate
- [ ] Chain-of-thought should show significantly more output tokens than other strategies

**Key insight to observe:** Does CoT give better classifications for your ambiguous tickets?
Is the accuracy improvement worth the cost increase?

---

## Stretch Goals

- [ ] Add a `--model` flag to compare the same strategies across `gpt-4o` vs `gpt-4o-mini`
- [ ] Export results to `results.json` for later analysis
- [ ] Add a "consistency test": run each ticket 3 times with zero-shot and check if the category is stable (temperature=0 should give 100% consistency; what happens at temperature=0.5?)
- [ ] Calculate the "break-even point": at what daily request volume does the cost difference between zero-shot and few-shot-3 exceed $100/month?

---

## Skills Demonstrated

| Skill | Where it shows |
|-------|----------------|
| Token counting (Ch1) | tiktoken pre-call + API usage post-call |
| Cost modeling (Ch1) | per-strategy cost calculation |
| Context window awareness (Ch1) | verifying no strategy exceeds limits |
| Zero-shot prompting (Ch2) | designing effective zero-shot system prompt |
| Few-shot prompting (Ch2) | selecting good examples that generalize |
| Chain-of-thought (Ch2) | adding step-by-step reasoning, extracting final answer |
| Structured output (Ch2) | JSON mode, output parsing |
| Prompt tradeoff reasoning (Ch1+2) | cost vs accuracy vs reliability |
