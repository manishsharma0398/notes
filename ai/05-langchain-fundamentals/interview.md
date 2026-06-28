# Chapter 5 — Interview Questions
## LangChain Fundamentals: Senior-Level Interview Preparation

---

## Section 1: Conceptual Understanding

### Q1: What is LCEL and why did LangChain introduce it?

**What the interviewer is really asking:** Do you understand the evolution from "magic Chain objects" to a composable interface, and can you articulate why it matters?

**Strong answer:**

LCEL (LangChain Expression Language) is a declarative composition system introduced in LangChain v0.1 to replace the old imperative Chain class hierarchy (LLMChain, SequentialChain, etc.). 

The old chains were black boxes — each had its own input/output contract, and composing them required knowing implementation details. LCEL introduces the `Runnable` protocol: a single interface that every component implements, giving you `.invoke()`, `.batch()`, `.stream()`, and their async equivalents uniformly across prompts, LLMs, parsers, and retrievers.

The key benefit isn't just cleaner syntax — it's that streaming, batching, async, and tracing all work transparently across any LCEL chain without per-component implementation.

**Trap to avoid:** Don't say "it makes things easier." That's vague. Be specific about the abstraction and what it enables.

---

### Q2: When would you NOT use LangChain?

**What the interviewer is really asking:** Can you make pragmatic architectural decisions, or do you reach for LangChain as a hammer?

**Strong answer:**

I would not use LangChain for:
1. **Single LLM calls** — The raw `AsyncOpenAI` SDK is simpler, has better stack traces, and exposes all provider-specific parameters.
2. **Debugging production issues** — LangChain's 5-layer call stacks make it genuinely hard to identify where a failure occurred. The raw SDK fails loudly and clearly.
3. **Performance-critical batch processing** — LangChain's sync `.batch()` uses `ThreadPoolExecutor` internally, which adds overhead. Direct `asyncio.gather()` with `Semaphore` is more predictable.
4. **Situations requiring full API control** — `logprobs`, `seed`, `parallel_tool_calls`, provider-specific headers — LangChain wrappers don't expose all of these.

I would use LangChain for: multi-step pipelines with branching, multi-model portability, LangSmith tracing, community document loaders, and LangGraph-based agent workflows.

---

### Q3: Explain the difference between `RunnableParallel` and `asyncio.gather()`.

**Strong answer:**

Both execute tasks concurrently, but at different abstraction levels:

`asyncio.gather()` is Python's native async primitive. It takes coroutines, runs them concurrently on the event loop, and returns results. It's transparent, gives you full control over error handling, and has zero framework overhead.

`RunnableParallel` is a LangChain abstraction that wraps branches in either `ThreadPoolExecutor` (for sync Runnables) or `asyncio.gather()` (for async Runnables). It merges results into a named dict. The advantage is that it integrates with LangChain's callback system (LangSmith tracing), handles the input routing automatically, and is composable in an LCEL chain.

The tradeoff: `RunnableParallel` is more convenient when working within LCEL, but `asyncio.gather()` is faster to write, easier to debug, and has no abstraction overhead when you're working with raw async code.

---

## Section 2: System Design

### Q4: Design a document Q&A API in production using LangChain. What does the architecture look like? What breaks at 10,000 requests/day?

**What to cover:**

**Architecture:**
```
FastAPI (async) 
  -> Input validation (Pydantic)
  -> AsyncOpenAI client (singleton via @lru_cache)
  -> LCEL chain: prompt | ChatOpenAI | StrOutputParser
  -> StreamingResponse for client
  -> LangSmith tracing (per-request config, not global)
```

**At 10,000 req/day (~7 req/min, low load):**
- Not a scaling problem yet, but watch for:
  - OpenAI rate limits (RPM/TPM) — add a semaphore + retry
  - LangSmith free tier exhaustion (5k traces/month) — either upgrade or switch to OpenTelemetry
  - Cold start latency if running on a serverless platform — the `ChatOpenAI` client initialization adds ~100ms

**At 100,000 req/day:**
- Move to a queue-backed architecture (Celery + Redis) for non-realtime requests
- Add LLM response caching (Redis + exact match or semantic cache)
- Distribute across multiple FastAPI instances — ensure LangChain callbacks are per-request

---

### Q5: A PydanticOutputParser in your chain is occasionally raising `OutputParserException` in production. What is your remediation strategy?

**Strong answer — three-layer approach:**

**Layer 1: Improve the prompt.** The most common cause is the model not following the JSON schema instructions. Inject `pydantic_parser.get_format_instructions()` explicitly. Add a concrete example of valid output. Use `temperature=0.0`.

**Layer 2: Robust error handling at the chain level.** Wrap the chain call in a try/except, catch `OutputParserException` and `json.JSONDecodeError` separately, log the raw LLM output with the error (critical for debugging), and return a typed error response — never let it surface as a 500.

**Layer 3: Consider the cost of auto-repair.** LangChain's `OutputFixingParser` makes a second LLM call to fix the output. That doubles cost and latency on the failure path. In production, it's often better to log failures, trigger an async retry job, and return a partial result with an error flag rather than blocking the request for a fix attempt.

---

### Q6: What is the global callback problem in LangChain and how does it manifest in a production FastAPI app?

**Strong answer:**

LangChain's callback system has a global registry. If you register a `LangSmithTracer` or custom `BaseCallbackHandler` at the `ChatOpenAI` constructor level or via `langchain.callbacks.manager`, those callbacks are triggered for ALL chain invocations — regardless of which request triggered them.

In a concurrent FastAPI server with multiple requests in flight, this means:
- Request A's tracing callback might receive tokens from Request B's LLM call
- Trace data in LangSmith is garbled — wrong tokens attributed to wrong traces
- Your custom logging callback might log Request A's data to Request B's log context

**Fix:** Always use per-invocation callbacks:
```python
result = await chain.ainvoke(
    input_data,
    config=RunnableConfig(callbacks=[tracer], metadata={"request_id": req_id})
)
```
Never pass callbacks at the `ChatOpenAI` constructor level in a concurrent server.

---

## Section 3: Traps and Gotchas

### Q7: A junior engineer defines this chain and says "it's not working":

```python
chain = prompt | llm | parser
result = chain.invoke({"q": "hello"})
```

What's the bug and why does it fail at invocation time rather than definition time?

**Answer:**

The bug is the wrong input key. The prompt template expects `{question}` (or whatever variable was defined in the template), but the invoke call passes `{"q": "hello"}`.

This fails at invocation time, not definition time, because LCEL chains are lazy — they're just descriptions of computation. No validation of input keys happens when you write `prompt | llm | parser`. The `prompt.invoke()` step is where the KeyError surfaces, deep inside the chain execution.

**Fix:** Use `chain.input_schema.schema()` to verify expected input variables, and add a Pydantic validation layer at the entry point of your FastAPI handler before passing inputs to the chain.

---

### Q8: Interview Trap — "Is PydanticOutputParser better than JsonOutputParser because it validates the schema?"

**The trap:** Yes/no answer misses the streaming and architecture implications.

**Strong answer:**

It depends on your requirements. `PydanticOutputParser` does validate the schema, which is valuable. But it has a critical constraint: it cannot stream. It must buffer the entire LLM output before parsing, which eliminates streaming as an option.

`JsonOutputParser` can stream partial dicts as the model generates them, but gives you an unvalidated `dict`. You can pair it with a manual Pydantic validation step after gathering the full result — giving you streaming + validation, at the cost of one more line of code.

For production:
- If streaming is required: `JsonOutputParser` + manual `.model_validate()` after stream ends
- If streaming is not required and schema enforcement is critical: `PydanticOutputParser`
- If using OpenAI specifically: OpenAI's `beta.chat.completions.parse()` with Pydantic is the best option — constrained decoding guarantees valid JSON, no retry needed

---

### Q9: What does `chain.steps` return and why is it useful?

**Answer:**

`chain.steps` returns the list of `Runnable` components in a `RunnableSequence`. For:
```python
chain = prompt | llm | parser
chain.steps  # [ChatPromptTemplate, ChatOpenAI, StrOutputParser]
```

It's useful for:
1. **Debugging** — Inspecting which components are in the chain
2. **Dynamic chain modification** — You can replace individual steps programmatically
3. **Testing** — You can mock individual steps by replacing them

It also works differently for `RunnableParallel`, which has a `.steps` dict of named branches instead of a list.

---

## Section 4: Prediction Exercises

### Prediction Q1: What happens if you call `chain.batch([])` with an empty list?

Think before reading: Does it error? Return an empty list? Make an API call?

**Answer:** It returns an empty list `[]`. No API calls are made. The `.batch()` implementation maps over the input list, so an empty list produces an empty result.

---

### Prediction Q2: You have this chain:

```python
parallel = RunnableParallel(
    summary=summary_chain,
    keywords=keywords_chain,
) | final_chain
```

The `summary_chain` fails with an exception. What happens to `keywords_chain` and `final_chain`?

**Answer:** `keywords_chain` still completes (it's running concurrently and independently). But `RunnableParallel` raises the exception from `summary_chain`, so `final_chain` never executes. The result is an exception propagated from the parallel step.

To handle this gracefully, you need to wrap individual branches in error-catching `RunnableLambda` components that catch exceptions and return a fallback value instead of raising.

---

### Prediction Q3: You enable LangSmith tracing globally. Your FastAPI server handles 50 concurrent requests. What happens to trace quality?

**Answer:** If you registered callbacks globally (at the `ChatOpenAI` constructor level), traces will be garbled — tokens from different requests mixed into the same trace, because the global handler receives events from all concurrent chains.

If you used per-invocation `RunnableConfig(callbacks=[...])` correctly, each request's trace is isolated. But there's still overhead: each trace event is an async HTTP call to LangSmith's API. At 50 concurrent requests, this can add noticeable tail latency.

**Production recommendation:** Batch trace events (LangSmith supports this), or use asynchronous trace submission with a local buffer to avoid adding to the request's critical path.
