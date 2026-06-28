# Chapter 5 — Revision Notes
## LangChain Fundamentals: Senior Engineer's Cheat Sheet

---

### The Core Mental Model

```
LangChain = pipe operator (|) for AI operations

prompt | llm | parser
  is equivalent to:
parser(llm(prompt.format_messages(input)))

But you also get: batching, streaming, tracing, async — uniformly.
```

**Rule of thumb:** Use LangChain when composition complexity justifies the abstraction overhead. Skip it for simple API calls.

---

### The Runnable Protocol (Every LCEL Component)

```
.invoke(input)           -> output          # Single, sync
.batch(inputs)           -> list[output]    # Multi, concurrent, sync
.stream(input)           -> Iterator        # Token-by-token, sync
.ainvoke(input)          -> output          # Single, async
.abatch(inputs)          -> list[output]    # Multi, concurrent, async
.astream(input)          -> AsyncIterator   # Token-by-token, async
```

**Everything in LCEL implements this interface.** If you build a custom step, make it a `Runnable` too.

---

### Chain Anatomy

```
chain = prompt | llm | parser
         ^       ^      ^
         |       |      |
ChatPromptTemplate  ChatOpenAI  StrOutputParser
         |
         produces ChatPromptValue (list of BaseMessage)
                 |
                 produces AIMessage (with .content, .usage_metadata)
                          |
                          produces str (or dict or Pydantic model)
```

---

### Prompt Template Quick Reference

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are {role}."),
    ("human", "{question}"),
])

# Inspect expected inputs before calling invoke:
print(prompt.input_variables)  # ["role", "question"]

# Validate what you're building:
formatted = prompt.invoke({"role": "engineer", "question": "..."})
print(formatted.messages)   # list of BaseMessage
```

---

### Output Parser Decision Matrix

| Parser | Output type | Streams? | Validates schema? | Use when |
|--------|------------|----------|------------------|----------|
| `StrOutputParser` | `str` | Yes | No | Raw text output |
| `JsonOutputParser` | `dict` | Partial | No (just JSON) | Flexible JSON |
| `PydanticOutputParser` | Pydantic model | No (buffers all) | Yes | Strict typed output |

**PydanticOutputParser cannot stream** — it needs the full output to validate. If you need streaming + structure, use `JsonOutputParser` + manual Pydantic validation.

---

### Parallel Execution

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough

parallel = RunnableParallel(
    result_a=chain_a,
    result_b=chain_b,
)
# Output: {"result_a": ..., "result_b": ...}
# Runs concurrently under the hood (ThreadPoolExecutor sync / asyncio.gather async)

# Pass original input through unchanged:
chain = RunnableParallel(
    context=retriever,
    question=RunnablePassthrough(),
) | final_chain
```

---

### Batch with Concurrency Control

```python
# Default max_concurrency = 5
results = chain.batch(inputs)

# Explicit concurrency control:
results = chain.batch(inputs, config={"max_concurrency": 2})

# Async (preferred in FastAPI):
results = await chain.abatch(inputs, config={"max_concurrency": 3})
```

**Warning:** `.batch()` does not retry failures. Handle exceptions yourself.

---

### Per-Request Tracing (The Right Way)

```python
from langchain_core.runnables import RunnableConfig

result = await chain.ainvoke(
    {"question": "..."},
    config=RunnableConfig(
        run_name="my_chain",
        tags=["prod", "v2"],
        metadata={"user_id": user_id, "request_id": request_id},
        callbacks=[my_tracer],   # per-request, NOT global
    )
)
```

**Never register callbacks globally in a FastAPI app** — they bleed across concurrent requests.

---

### LangSmith Setup

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls-..."
os.environ["LANGCHAIN_PROJECT"] = "my-app"
# Every chain.invoke() is now traced automatically
```

Free tier: 5k traces/month. After that: paid. At scale, consider OpenTelemetry instead.

---

### Package Split (Always Pin These Together)

```
langchain-core       # Runnable, prompts, output parsers, base types
langchain-openai     # ChatOpenAI, OpenAIEmbeddings
langchain-community  # Third-party integrations (use cautiously, check maintenance)
langchain            # Meta-package that ties the above together
langgraph            # Stateful agent framework (separate package)
```

---

### When NOT to Use LangChain

| Situation | Use instead |
|-----------|------------|
| Single LLM call | `AsyncOpenAI` directly |
| Full provider API control (`logprobs`, `seed`) | Raw SDK |
| Debugging a production failure | Raw SDK — clearer stack traces |
| Simple RAG (one retriever) | f-string + raw SDK |
| High-performance batch processing | Direct `asyncio.gather()` |

---

### When TO Use LangChain

| Situation | Why LangChain helps |
|-----------|---------------------|
| 3+ stage pipelines with branching | LCEL composition is cleaner than nested function calls |
| Multi-model portability | Change one string to switch providers |
| Production tracing | LangSmith first-class integration |
| Document loaders / text splitters | Mature community components |
| Stateful agents | LangGraph (built on LCEL) |

---

### Common Mistakes Cheat Sheet

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| `chain.invoke({"wrong_key": ...})` | Runtime KeyError | Check `chain.input_schema.schema()` first |
| Sync `.invoke()` in async handler | Event loop blocked | Use `.ainvoke()` |
| Global callbacks in FastAPI | Callback bleed across requests | Use per-invocation `config={"callbacks": []}` |
| `PydanticOutputParser` in streaming chain | No actual streaming | Use `JsonOutputParser` + manual validation |
| LangChain's retry + your retry | Double backoff, slow failure path | Pick one retry strategy |
| Not pinning langchain-* versions | Breaking changes between minor versions | Pin all langchain-* together in requirements.txt |

---

### Chain Inspection Commands

```python
chain.input_schema.schema()     # What inputs the chain expects
chain.output_schema.schema()    # What the chain returns
chain.steps                     # List of Runnable components (RunnableSequence)
type(chain).__name__            # "RunnableSequence" or "RunnableParallel"
```

---

### Streaming — What Actually Streams

```
Stage           Streams?   Notes
-----------     --------   ----------------------------------------
Prompt          No         Must format fully before passing to LLM
LLM             Yes        Yields AIMessageChunk per token
StrOutputParser Yes        Yields str fragment per chunk
JsonOutputParser Partial   Yields progressively complete dict
PydanticOutputParser No    Must buffer all output to validate schema
```
