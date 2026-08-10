# Chapter 9: Interview Questions — AI Agents

---

## Q1: "How does function calling actually work at the API level? Walk me through what happens wire-by-wire."

**What they're testing:** Whether you understand that the LLM doesn't execute tools — it outputs structured text that your code acts on.

**Strong answer:**
1. You send the API request with a `tools` array containing JSON schemas for each tool
2. If the model decides to call a tool, it returns `finish_reason: "tool_calls"` with `content: null` and a `tool_calls` array containing `{name, arguments}` — arguments as a JSON string
3. Your code parses `arguments`, validates them, and calls the actual Python function
4. You append two messages to the history: the assistant message (with `tool_calls`), and a `role: "tool"` message with the result and the `tool_call_id`
5. You call the API again with the updated message history
6. The model now sees the result and either calls another tool or returns `finish_reason: "stop"` with a text answer

**The trap:** Many candidates say "the model calls the function." It does not. It outputs JSON; you execute it.

---

## Q2: "You've built an agent that works in testing but in production it sometimes loops for 50+ iterations, costing $5 per query. How do you fix this?"

**What they're testing:** Production engineering instincts — not just code knowledge.

**Strong answer:**

Root causes to investigate:
- No `max_iterations` set (or set too high)
- Tool returning ambiguous/empty results — model thinks it needs to try again
- Overlapping tool descriptions causing wrong tool selection, then retry
- Context growing so large the model loses track of what it already tried

Fixes (in order of priority):
1. **Immediate:** Set hard `max_iterations=10` (or fewer) with a cost circuit breaker
2. **Tool output quality:** Ensure every tool returns structured, unambiguous results — including helpful error messages so the LLM can reason about failures rather than retrying blindly
3. **Token budget:** Track cumulative token spend per agent run; abort early if budget exceeded
4. **Trace logging:** Log every tool call + result to understand *why* the loop continued
5. **Tool descriptions:** Tighten descriptions with explicit "Do NOT use for X" clauses
6. **Reduce tool count:** Each added tool increases the chance of wrong selection + looping

---

## Q3: "How would you design a production agent system that handles 10,000 queries per day reliably?"

**What they're testing:** System design, not just agent code.

**Strong answer (key points):**

```
Architecture concerns:
  1. COST: 10k/day × avg 5 iterations × $0.002 = ~$100/day minimum
     → Need cost monitoring and per-query budgets
     → Consider caching: if query is similar to past ones, replay cached result

  2. LATENCY: Agents are slow (5–30s per query)
     → Use async queues (Celery/Redis) — don't serve agent calls synchronously in HTTP
     → Stream partial results back to UI while agent runs
     → Set user expectation: "Researching... (step 2 of N)"

  3. RELIABILITY:
     → Tool failures must not crash the agent — return error strings to LLM
     → API rate limits: implement exponential backoff + retry with jitter
     → Idempotency: agent runs should be resumable from last checkpoint

  4. OBSERVABILITY:
     → Log every tool call, args, result, and token count (LangSmith, LangFuse, Arize)
     → Alert on: avg iterations > 5, cost > $X per run, tool error rate > Y%
     → Without traces, debugging agent behavior is impossible

  5. SECURITY:
     → Sanitize all tool outputs before feeding back to LLM (prompt injection)
     → Use principle of least privilege — each agent has only the tools it needs
     → Validate tool args with Pydantic before execution

  6. SCALABILITY:
     → Stateless agent workers (state stored externally if needed)
     → Horizontal scaling via queue consumers
     → Separate slow tools (web search) from fast tools (calculations) — async tool execution
```

---

## Q4: "What's the difference between a chain and an agent? When would you use each?"

**What they're testing:** Architectural decision-making.

**Strong answer:**

- **Chain:** Fixed sequence of steps, determined at design time. Input → A → B → C → Output. Predictable, fast, debuggable.
- **Agent:** Dynamic sequence of steps, determined at runtime by the LLM based on intermediate results. Uses tools in whatever order and combination the task requires.

**When to use chain:**
- Summarization, translation, extraction — steps are always the same
- Any pipeline where you know the exact steps before seeing the input
- Anywhere latency and cost are critical

**When to use agent:**
- Research tasks where you don't know in advance which sources to query
- Debugging tasks that require "try → observe → try again"
- Tasks where the number of steps depends on what intermediate results contain

**Rule:** If you can hardcode the steps, use a chain. Agents are for when the steps genuinely cannot be hardcoded.

---

## Q5: "Why should you use low temperature for tool-calling agents?"

**What they're testing:** Understanding of temperature's effect on structured output.

**Strong answer:**

Tool calls require the model to output valid JSON with specific field names and types. Higher temperature increases the probability of the model outputting:
- Slightly malformed JSON (missing quotes, wrong field names)
- Hallucinated argument values that don't match the schema
- Inconsistent tool selection across identical inputs

At `temperature=0` (greedy decoding), the model picks the highest-probability token at each step — which for structured output tasks produces more reliable, consistent JSON.

However: even at `temperature=0`, tool argument hallucination can still happen. Temperature reduces it; Pydantic validation catches what gets through.

**Contrast with creative tasks:** For text generation where variety is desirable, higher temperature is appropriate. For tool-calling, the "creativity" is in reasoning (Thought steps), not in JSON structure.

---

## System Design Trap: "Just add more tools to make the agent smarter"

**The mistake:** A developer adds 15 tools to their agent because more capability = better.

**What actually happens:**
- With 15 tools, the model's tool selection becomes unreliable — descriptions start to overlap semantically
- The model wastes iterations calling the wrong tool, observing a poor result, trying another
- Cost and latency multiply
- The agent appears to "understand less" despite having more capability

**The fix:**
- Keep ≤7 tools per agent
- For broad capability: route to specialized sub-agents (multi-agent architecture — Chapter 12)
- Use "Do NOT use for X" in tool descriptions to reduce ambiguity

---

## Prediction Exercise

Before running example 01, predict:

**If you set `tool_choice="required"` instead of `"auto"`, what happens when the user asks a question that doesn't require any tool — like "What is 2+2?"**

Think about it. Then try it and observe `finish_reason` and whether the model loops.

*(Answer: with `tool_choice="required"`, the model MUST call a tool on every turn — even when it doesn't need to. It will call `calculate("2+2")` instead of just answering directly. This can cause unnecessary loops and waste tokens. Use `"auto"` unless you want to force tool use for specific reasons.)*
