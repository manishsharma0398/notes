# Chapter 2 — Revision Notes
## Prompt Engineering: Senior Engineer's Cheat Sheet

---

### The One Sentence That Explains Everything

> Prompting is constructing the input token sequence so that the desired output becomes statistically the most likely continuation.

You are not asking. You are engineering probability.

---

### Four Core Techniques (Know When to Use Each)

| Technique | What It Does | Use When | Avoid When |
|-----------|-------------|----------|------------|
| **Zero-Shot** | Task only, no examples | Simple, well-understood tasks | Unusual formats, edge cases |
| **Few-Shot** | 3-5 examples before query | Consistent format needed, pattern-based tasks | You have <2 good examples |
| **Chain-of-Thought** | "Think step by step" | Multi-step reasoning, logic, complex code | Simple tasks (expensive, wastes tokens) |
| **Structured Output** | JSON mode / schema | Any data extracted for downstream use | Free-text generation |

---

### System Prompt Rules

1. Put critical instructions **early** (attention degrades mid-context)
2. Be **behavioral**, not motivational ("Return JSON only" vs. "Think carefully")
3. Specify **output format explicitly** in the system prompt
4. Keep system prompts **static** → enables prompt caching (90% cost reduction on that portion)
5. Never put secrets in system prompts (trivially extractable)

---

### Few-Shot: What's Actually Happening

- **No learning occurs.** Weights don't change. Zero gradient update.
- It's **in-context pattern matching via attention**: model attends to example pairs → probability narrows to the pattern
- 3–5 examples is the sweet spot. More = wasted tokens.
- Examples must appear **before** the actual query (generation is left-to-right)
- Include edge cases in your examples — the model generalizes from them

---

### Chain-of-Thought: The Real Mechanism

```
WITHOUT CoT:  [question] → answer token  (model compresses all reasoning into one token)
WITH CoT:     [question] → step1 → step2 → ... → answer  (each step is context for the next)
```

The intermediate reasoning tokens act as **scratchpad memory**. The model is not smarter — it has more context available when it generates the final answer token.

Cost: 50x–100x more output tokens on complex problems. Use CoT selectively.

---

### JSON Enforcement: The Reliability Hierarchy

```
WORST: "Respond only with JSON" (prompt-only)  → ~20% failure rate
BETTER: response_format={"type": "json_object"}  → valid JSON guaranteed, schema not guaranteed
BEST: response_format=SentimentResult (Pydantic)  → exact schema guaranteed
```

**Constrained decoding** = the inference engine filters the token sampler to only allow tokens valid in the current JSON context. Schema violations become impossible.

---

### Production Pitfalls (High-Signal)

1. **Prompt injection** — users can often extract system prompts or override instructions
2. **Lost in the middle** — instructions buried in long prompts get lower attention weight
3. **CoT cost** — reasoning tokens are output tokens, billed at output rates
4. **Prompt-only JSON** — don't do it in production, use `response_format`
5. **Prompt caching ignored** — static system prompts should always be cached (save 90% on that cost)
6. **No edge cases in few-shot** — model generalizes from your examples; include hard cases

---

### Key Terms

| Term | Definition |
|------|-----------|
| **Zero-shot** | Task given with no examples; relies on model's trained knowledge |
| **Few-shot** | 2–5 input/output examples in prompt; pattern matching via attention |
| **Chain-of-Thought** | Step-by-step reasoning in output; uses output tokens as scratchpad |
| **Structured output** | Constrained decoding to enforce JSON schema |
| **Constrained decoding** | Inference-level filtering of token candidates to valid schema tokens |
| **Prompt caching** | Provider-side caching of static prompt prefixes (~90% cost reduction) |
| **In-context learning** | Model adapts to examples in the prompt without weight updates |
| **"Lost in the middle"** | Attention degrades for tokens in the middle of very long contexts |

---

### Decision Tree: Which Technique?

```
Is output fed into code/API?
  YES → Use structured output (JSON mode or Pydantic schema)
  NO  → continue...

Is the task multi-step reasoning or complex?
  YES → Add CoT ("Let's think step by step")
  NO  → continue...

Do you need consistent format/style?
  YES → Use few-shot (3-5 examples)
  NO  → Use zero-shot

Is cost/latency critical?
  YES → Avoid CoT; minimize few-shot examples; cache system prompt
  NO  → Use whatever produces the best output
```
