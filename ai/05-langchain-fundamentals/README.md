# Chapter 5 — LangChain Fundamentals
## Chains, Runnables, LCEL, and When NOT to Use LangChain

---

## The Mental Model

Before writing a single line of LangChain code, you need a correct mental model of what it is — because most engineers get this wrong.

**What engineers assume:** LangChain is a library of pre-built AI components that makes building AI apps easier.

**What it actually is:** LangChain is a **composition framework**. Its core job is to give you a standard interface (`Runnable`) so you can connect LLM calls, prompts, parsers, retrievers, and tools into a directed computation graph — and then run, stream, batch, or trace that graph uniformly.

The danger is this: LangChain has so many pre-built components that you can build something that *appears* to work, without understanding what's happening underneath. When it breaks — and it will break in production — you have no idea where to look.

**The right mental model:**

```
LangChain is a pipe operator (|) for AI operations.

prompt | llm | parser

is the same as:

parser(llm(prompt.format_messages(input)))

...except LangChain gives you batching, streaming, tracing,
and a unified interface for every component, for free.
```

Use LangChain when composition complexity is high enough to justify the abstraction overhead. Do NOT use it for simple API wrapper tasks.

---

## Part 1: What is LCEL (LangChain Expression Language)?

LCEL is the core abstraction introduced in LangChain v0.1. It replaces the old "Chain" classes (LLMChain, SequentialChain, etc.) with a composable interface based on the `Runnable` protocol.

### The Runnable Protocol

Every LCEL component — prompts, LLMs, parsers, retrievers — implements a single interface:

```python
class Runnable:
    def invoke(self, input) -> output         # Single call
    def batch(self, inputs) -> list[output]   # Multiple inputs in parallel
    def stream(self, input) -> Iterator       # Token-by-token streaming
    async def ainvoke(self, input) -> output  # Async single call
    async def abatch(self, inputs) -> ...     # Async batch
    async def astream(self, input) -> ...     # Async streaming
```

This means **every component you plug in must be a Runnable**. When you write:

```python
chain = prompt | llm | parser
```

Python's `|` operator calls `__or__` on the left-hand side, which returns a `RunnableSequence`. At runtime, `chain.invoke(input)` passes the input through each component left to right, with the output of one becoming the input of the next.

### What Happens When You Call `.invoke()`

```
chain.invoke({"question": "What is a transformer?"})

Step 1: prompt.invoke({"question": "..."})
        -> ChatPromptValue([SystemMessage(...), HumanMessage("What is a transformer?")])

Step 2: llm.invoke(ChatPromptValue(...))
        -> AIMessage(content="A transformer is...")

Step 3: parser.invoke(AIMessage(...))
        -> "A transformer is..."   (extracted .content string)
```

The chain is not magic. It's a sequential function composition with a uniform interface.

---

## Part 2: Building Blocks — Step by Step

### 2.1 Prompt Templates

```python
from langchain_core.prompts import ChatPromptTemplate

# This creates a template object — NOT a string
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a senior software engineer. Be concise."),
    ("human", "{question}"),
])

# Calling .invoke() returns a ChatPromptValue (list of messages)
formatted = prompt.invoke({"question": "What is attention in transformers?"})
print(formatted.messages)
# [SystemMessage(...), HumanMessage(content="What is attention...")]
```

**Under the hood:** The template stores message templates as a list of tuples. `.invoke()` formats them with the provided variables and returns a `ChatPromptValue` — which is what the LLM expects as input.

**Engineering tradeoff:** Templates are validated at invocation time, not at definition time. If you have a typo in a variable name (`{questoin}`), you won't know until `.invoke()` is called. Use `prompt.input_variables` to inspect what variables the template expects.

### 2.2 LLM Wrappers

```python
from langchain_openai import ChatOpenAI

# This does NOT make an API call — it just configures the client
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,
    max_tokens=512,
)

# This makes the API call
response = llm.invoke([HumanMessage(content="Hello")])
# Returns: AIMessage(content="Hello! How can I help you today?", ...)
```

**What LangChain's LLM wrapper adds over raw `openai.ChatCompletion`:**
1. Automatic retry with exponential backoff (configurable)
2. Token counting via `.get_num_tokens()`
3. Streaming support via `.stream()` returning an iterator of `AIMessageChunk`
4. Callback hooks for tracing/logging

**What it does NOT add:** Any intelligence. It's a thin wrapper. If you need full control over headers, request IDs, or provider-specific params, the raw SDK is better.

### 2.3 Output Parsers

The LLM returns an `AIMessage`. Your application code needs a string, a dict, or a Pydantic model. Output parsers bridge this gap.

```python
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from pydantic import BaseModel

# 1. StrOutputParser — extracts .content from AIMessage
parser = StrOutputParser()
text = parser.invoke(AIMessage(content="Hello world"))
# -> "Hello world"

# 2. JsonOutputParser — parses .content as JSON
json_parser = JsonOutputParser()
result = json_parser.invoke(AIMessage(content='{"name": "Alice", "age": 30}'))
# -> {"name": "Alice", "age": 30}

# 3. PydanticOutputParser — parses AND validates
from langchain_core.output_parsers import PydanticOutputParser

class PersonInfo(BaseModel):
    name: str
    age: int

pydantic_parser = PydanticOutputParser(pydantic_object=PersonInfo)
# Also generates format instructions to inject into your prompt:
print(pydantic_parser.get_format_instructions())
```

**Production reality:** `PydanticOutputParser` will raise `OutputParserException` when the LLM output doesn't conform. You need to wrap it. LangChain provides `OutputFixingParser` and `RetryOutputParser` — but these make *another* LLM call to fix the output. This doubles your cost and latency on the failure path. Know this before using it.

---

## Part 3: LCEL Composition — The Pipe Operator

### The Simplest Chain

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)
parser = StrOutputParser()

prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer concisely in one sentence."),
    ("human", "{question}"),
])

# Chain composition via | operator
chain = prompt | llm | parser

# Run it
result = chain.invoke({"question": "What is gradient descent?"})
print(result)
# -> "Gradient descent is an optimization algorithm that..."
```

**What actually happens:**
1. `prompt.__or__(llm)` returns a `RunnableSequence([prompt, llm])`
2. `RunnableSequence.__or__(parser)` returns `RunnableSequence([prompt, llm, parser])`
3. `chain.invoke(...)` iterates through the sequence, feeding each output as input to the next

### Parallel Execution with RunnableParallel

Sometimes you need to run multiple chains on the same input and merge results:

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough

# Two separate chains on the same input
summary_chain = (
    ChatPromptTemplate.from_template("Summarize in one sentence: {text}")
    | llm
    | StrOutputParser()
)

keywords_chain = (
    ChatPromptTemplate.from_template("Extract 3 keywords as comma-separated list from: {text}")
    | llm
    | StrOutputParser()
)

# Run both chains in parallel on the same input
parallel_chain = RunnableParallel(
    summary=summary_chain,
    keywords=keywords_chain,
)

result = parallel_chain.invoke({"text": "LangChain is a framework for composing LLM pipelines."})
# -> {"summary": "LangChain is...", "keywords": "framework, LLM, pipeline"}
```

**Under the hood:** `RunnableParallel.invoke()` uses `ThreadPoolExecutor` to run branches concurrently (sync) or `asyncio.gather()` in the async path. Each branch runs independently and results are merged into a dict.

**Engineering trap:** The output of `RunnableParallel` is always a dict keyed by the branch names. If you pipe it to another runnable, that runnable must accept a dict as input. Plan your input/output contracts carefully.

### Passing Input Through With RunnablePassthrough

A very common need: pass the original input alongside a transformed version.

```python
from langchain_core.runnables import RunnablePassthrough

# This chain receives {"question": "..."} and passes it through unchanged
# while ALSO retrieving documents
retrieval_chain = RunnableParallel(
    context=retriever,               # retriever gets the full input
    question=RunnablePassthrough()   # passes through the original "question" key
)
# Output: {"context": [Document(...)], "question": "original question text"}
```

This pattern is the foundation of RAG chains (covered in Chapter 7).

---

## Part 4: Streaming

One of LCEL's best features: streaming works uniformly across the entire chain.

```python
# Streaming — tokens arrive as they're generated
for chunk in chain.stream({"question": "Explain neural networks"}):
    print(chunk, end="", flush=True)
```

**What actually happens during streaming:**

```
LLM generates token-by-token
  -> Each token becomes an AIMessageChunk
  -> StrOutputParser extracts .content from each chunk
  -> Your for-loop receives one string fragment at a time

The full pipeline:
  prompt.invoke()  -> complete message (no streaming at prompt stage)
  llm.stream()     -> yields AIMessageChunk objects
  parser.stream()  -> yields str fragments
```

**Critical engineering detail:** Only the LLM stage actually streams. Prompt templates and output parsers that do post-processing (like Pydantic validation) must buffer the *complete* output before they can validate it. This means:

- `chain = prompt | llm | StrOutputParser()` — true streaming
- `chain = prompt | llm | PydanticOutputParser()` — buffers everything, then parses
- `chain = prompt | llm | JsonOutputParser()` — partial streaming (yields partial dicts)

---

## Part 5: `.batch()` — Efficient Multi-Input Processing

```python
questions = [
    {"question": "What is RAG?"},
    {"question": "What is a transformer?"},
    {"question": "What is an embedding?"},
]

# Runs all three concurrently (default max_concurrency=5)
results = chain.batch(questions)
# -> ["RAG is...", "A transformer is...", "An embedding is..."]

# Control concurrency
results = chain.batch(questions, config={"max_concurrency": 2})
```

**Under the hood:** `.batch()` calls `.invoke()` for each input using a thread pool (sync path) or `asyncio.gather()` (async path). The `max_concurrency` parameter controls the pool size.

**Production trap:** `.batch()` does NOT automatically retry failed items. If one call fails, the error propagates and the entire batch result reflects that failure. Wrap with error handling if you need resilience.

---

## Part 6: When NOT to Use LangChain

This is the most important section in this chapter. LangChain has significant overhead and abstraction costs.

### Do NOT Use LangChain When:

**1. You're making a single LLM call**
```python
# Overkill with LangChain:
chain = prompt | llm | parser
result = chain.invoke({"q": "Hello"})

# Just do this:
client = AsyncOpenAI()
response = await client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}]
)
```

**2. You need full provider control**
LangChain wrappers don't expose every API parameter. If you need `logprobs`, `seed`, `parallel_tool_calls`, or provider-specific headers, you'll fight the abstraction layer.

**3. You're debugging a production issue**
LangChain's stack traces are several layers deep. Identifying whether a failure is in your prompt, the LLM, the parser, or LangChain's internals is genuinely hard. Raw SDK calls fail loudly and clearly.

**4. You need predictable performance**
LangChain's `.batch()` uses thread pools under the hood (not native async for sync chains). This adds overhead at scale.

**5. You're building a simple RAG with one retriever**
You don't need LCEL to concatenate a retrieved string into a prompt. `f"{retrieved_context}\n\nQuestion: {question}"` is faster to write, easier to debug, and has zero abstraction overhead.

### Use LangChain When:

**1. Complex multi-step pipelines** — 3+ stages with branching, parallel paths, and conditional routing

**2. You need built-in tracing** — LangSmith integration is first-class; you get call graphs, token counts, latency, and output diffs with minimal configuration

**3. Multi-model portability** — switching between OpenAI/Anthropic/Google by changing one string

**4. Community components** — document loaders, text splitters, retrievers for specific vector DBs — mature, well-tested, not worth reimplementing

**5. Agent frameworks** — LangGraph (Chapter 10) is built on LCEL and is the right tool for stateful agentic workflows

---

## Part 7: The Abstraction Leak Problem

LangChain hides complexity until it breaks. Here are the most common leaks:

### Leak 1: Input/Output Contract Mismatch

```python
chain = prompt | llm | parser

# This will fail at runtime, not at definition time:
chain.invoke({"wrong_key": "value"})
# KeyError: 'question'  <- from inside the template, deep in the stack
```

LangChain doesn't validate input keys at chain-definition time. You find out at runtime.

**Fix:** Call `chain.input_schema.schema()` to inspect expected inputs. Write a validation step at the entry point of your FastAPI handler.

### Leak 2: Thread Safety of LLM Clients

LangChain's sync `ChatOpenAI` is NOT thread-safe in its default configuration. Using `.batch()` on a high-load server can lead to connection pool contention.

**Fix:** Use `.abatch()` with proper async context, or ensure the underlying httpx client is configured with adequate connection pool limits.

### Leak 3: Callback Confusion

LangChain's callback system (used for tracing, logging) is global by default. Callbacks registered in one request can fire during another request's execution in a multi-threaded FastAPI server.

**Fix:** Pass callbacks per-invocation via `config={"callbacks": [...]}`, never via global callback managers.

### Leak 4: Version Instability

LangChain has historically moved fast and broken things:
- `LLMChain` — deprecated in v0.1
- `ConversationalRetrievalChain` — deprecated in v0.2
- `langchain` — split into `langchain-core`, `langchain-community`, `langchain-openai`

Always pin exact versions in `requirements.txt`. The correct package split today is:

```
langchain-core       # The Runnable protocol, prompts, output parsers
langchain-openai     # ChatOpenAI, OpenAIEmbeddings
langchain-community  # Document loaders, third-party integrations (use with caution)
langchain            # Meta-package, imports from above
langgraph            # Stateful agents (separate package)
```

---

## Part 8: Runnable Configuration and RunnableConfig

Every `.invoke()` call accepts an optional `config` parameter of type `RunnableConfig`:

```python
from langchain_core.runnables import RunnableConfig

result = chain.invoke(
    {"question": "What is LCEL?"},
    config=RunnableConfig(
        run_name="lcel_explainer",          # Shows in LangSmith traces
        tags=["chapter5", "test"],           # Filtering in LangSmith
        metadata={"user_id": "u123"},        # Custom metadata
        callbacks=[my_callback_handler],     # Per-invocation callbacks
        max_concurrency=3,                   # For .batch() calls
    )
)
```

This is the right way to pass tracing context per request in a production FastAPI app, rather than setting global callbacks.

---

## Part 9: LangSmith Tracing (Production Observability)

LangChain's tracing system is one of its strongest production arguments.

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls-..."
os.environ["LANGCHAIN_PROJECT"] = "my-production-app"

# Now every chain.invoke() call is automatically traced to LangSmith
result = chain.invoke({"question": "What is RAG?"})
```

What you get in LangSmith:
- Full call graph (every step, its input, output, latency, token count)
- Cost per run
- Error traces with full stack context
- Side-by-side comparison of prompts/outputs across runs

**Cost:** LangSmith has a free tier (5k traces/month). After that, it's paid. At scale, evaluate whether the tracing value justifies the cost vs. building your own structured logging with OpenTelemetry.

---

## Part 10: Full Runnable Example — Document Q&A Chain

See `examples/basic_qa_chain.py` for a complete, production-style example tying everything together.

---

## Architecture Diagram

```
LCEL Chain Execution Flow
===========================================================

 User Input (dict)
       |
       v
 +------------------+
 | ChatPromptTemplate|  -> formats variables into ChatPromptValue
 |   (Runnable)     |     (list of BaseMessage objects)
 +--------+---------+
          |  ChatPromptValue
          v
 +------------------+
 |   ChatOpenAI     |  -> sends messages to OpenAI API
 |   (Runnable)     |     receives AIMessage (with .content, .usage)
 +--------+---------+
          |  AIMessage
          v
 +------------------+
 |  OutputParser    |  -> extracts .content -> str
 |  (Runnable)      |     or -> dict (JsonOutputParser)
 +--------+---------+     or -> Pydantic model (PydanticOutputParser)
          |
          v
 Final Output (str / dict / Pydantic model)


RunnableParallel (branching):
          |
          +---> branch_a.invoke() ----------------------+
          +---> branch_b.invoke() --- (concurrent) -----+--> merge -> dict
          +---> branch_c.invoke() ----------------------+


Streaming flow (token-by-token):
  prompt.invoke()  -> complete (no tokens yet)
  llm.stream()     -> AIMessageChunk("A"), AIMessageChunk(" trans"), ...
  parser.stream()  -> "A", " trans", ...
  your loop        -> prints each fragment immediately
```

---

## Common Engineering Mistakes

1. **Using LangChain for everything** — Pulling in LangChain for a 3-line API call gives you 200MB of dependencies and 10 layers of stack trace when it fails.

2. **Forgetting LCEL chains are lazy** — Defining `chain = prompt | llm | parser` does NOT validate inputs or make any API calls. The chain is just a description until `.invoke()` is called.

3. **Using `.batch()` without error handling** — If any item raises, that exception propagates. Wrap individual calls or handle exceptions in the task.

4. **Global callback handlers in async FastAPI** — Callbacks registered globally can bleed across requests. Always pass `config={"callbacks": [...]}` per invocation.

5. **Mixing sync and async chains** — Calling a sync `.invoke()` inside an `async def` handler blocks the event loop. Use `.ainvoke()`, `.astream()`, `.abatch()` inside async code.

6. **Not pinning LangChain versions** — LangChain has a history of breaking changes between minor versions. Always pin all langchain-* packages together.

7. **Expecting PydanticOutputParser to stream** — It cannot. It needs the full output to validate. If you need streaming + structure, use `JsonOutputParser` which streams partial dicts.

---

## Production Pitfalls

- **LangChain's retry logic and your retry logic conflict** — If you add tenacity retries AND LangChain's built-in retry, a single failure can trigger exponential backoff at two levels. Choose one.
- **LangSmith in production adds latency** — Tracing is async but not zero-cost. Benchmark with and without tracing enabled.
- **`langchain-community` is a graveyard** — Integrations in `langchain-community` range from well-maintained to completely abandoned. Always check the last commit date before using a community integration in production.
- **Token counting is approximate** — `llm.get_num_tokens()` uses the model's tokenizer client-side but doesn't account for message overhead (role tokens, separators). Actual token counts from the API response are the ground truth.
