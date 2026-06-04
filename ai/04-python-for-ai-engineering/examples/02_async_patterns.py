"""
Example 2: Async/Await Patterns for LLM Services

Demonstrates:
  1. Sequential vs concurrent LLM calls (the core difference)
  2. Bounded concurrency with Semaphore
  3. gather() with return_exceptions (production-safe)
  4. asyncio.run_in_executor for blocking library calls
  5. The event loop blocking trap and how to detect it

Run:
  pip install openai
  export OPENAI_API_KEY=your_key
  python 02_async_patterns.py
"""

import asyncio
import time
import hashlib
import logging

from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

client = AsyncOpenAI()


# ─── Pattern 1: Sequential vs Concurrent ──────────────────────────────────────


QUESTIONS = [
    "What is a transformer architecture? Answer in one sentence.",
    "What is attention mechanism? Answer in one sentence.",
    "What is a token in NLP? Answer in one sentence.",
    "What is temperature in LLM sampling? Answer in one sentence.",
    "What is RAG (Retrieval-Augmented Generation)? Answer in one sentence.",
]


async def ask_question(question: str) -> tuple[str, float]:
    """Single LLM call. Returns (answer, latency_seconds)."""
    start = time.perf_counter()
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": question}],
        max_tokens=64,
        temperature=0.0,
    )
    latency = time.perf_counter() - start
    return response.choices[0].message.content.strip(), latency


async def sequential_calls():
    """Sequential: each call waits for the previous to finish."""
    print("\n[Pattern 1a] Sequential calls")
    start = time.perf_counter()

    results = []
    for q in QUESTIONS:
        answer, latency = await ask_question(q)
        results.append(answer)
        print(f"  [{latency:.2f}s] {q[:40]}... → {answer[:50]}...")

    total = time.perf_counter() - start
    print(f"  Total: {total:.2f}s")
    return results


async def concurrent_calls():
    """Concurrent: all calls start immediately, I/O waits overlap."""
    print("\n[Pattern 1b] Concurrent calls (asyncio.gather)")
    start = time.perf_counter()

    # All tasks start at t=0. While one awaits the API, others run.
    tasks = [ask_question(q) for q in QUESTIONS]
    results_with_latency = await asyncio.gather(*tasks)

    total = time.perf_counter() - start
    for i, (answer, latency) in enumerate(results_with_latency):
        print(f"  [{latency:.2f}s] {QUESTIONS[i][:40]}... → {answer[:50]}...")

    print(f"  Total: {total:.2f}s (≈ max individual latency, not sum)")
    return [r[0] for r in results_with_latency]


# ─── Pattern 2: Bounded Concurrency ───────────────────────────────────────────


async def process_with_semaphore(
    semaphore: asyncio.Semaphore,
    item: str,
    index: int,
) -> tuple[int, str]:
    """
    Semaphore ensures at most N tasks run this block simultaneously.

    Without semaphore: 1000 items → 1000 concurrent API requests → rate limit 429
    With semaphore(10): max 10 concurrent → respects rate limits
    """
    async with semaphore:
        logger.info(f"  Processing item {index} (slot acquired)")
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": f"Summarize in 5 words: {item}"}],
            max_tokens=20,
            temperature=0.0,
        )
        return index, response.choices[0].message.content.strip()


async def bounded_concurrent_batch(items: list[str], max_concurrent: int = 3):
    """
    Process a batch with bounded concurrency.

    How to choose max_concurrent:
      - At 60 RPM, calls average 3s → safe concurrent = 60/20 = 3 req/s ≈ 10 concurrent
      - Conservative: start at 5, monitor 429 rate, increase if zero errors
    """
    print(f"\n[Pattern 2] Bounded concurrency (max_concurrent={max_concurrent})")
    semaphore = asyncio.Semaphore(max_concurrent)
    start = time.perf_counter()

    tasks = [
        process_with_semaphore(semaphore, item, i)
        for i, item in enumerate(items)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    total = time.perf_counter() - start
    success, failed = 0, 0

    for result in results:
        if isinstance(result, Exception):
            logger.error(f"  Task failed: {result}")
            failed += 1
        else:
            index, answer = result
            print(f"  [{index}] {items[index][:30]}... → {answer}")
            success += 1

    print(f"  Done in {total:.2f}s | {success} succeeded, {failed} failed")


# ─── Pattern 3: return_exceptions for resilient batch processing ───────────────


async def flaky_llm_call(prompt: str, should_fail: bool = False) -> str:
    """Simulates an LLM call that sometimes fails."""
    if should_fail:
        raise RuntimeError("Simulated API error (e.g., 500 from provider)")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=32,
    )
    return response.choices[0].message.content


async def resilient_gather():
    """
    asyncio.gather WITHOUT return_exceptions:
      → First exception propagates, other results are LOST.

    asyncio.gather WITH return_exceptions=True:
      → All tasks complete, exceptions are returned as values, you handle them.
    """
    print("\n[Pattern 3] gather() with return_exceptions=True")

    tasks = [
        flaky_llm_call("What is Python?", should_fail=False),
        flaky_llm_call("What is async?", should_fail=True),   # This will fail
        flaky_llm_call("What is Pydantic?", should_fail=False),
    ]

    print("  Running 3 tasks where task 2 will fail...")
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"  Task {i}: ❌ Failed — {type(result).__name__}: {result}")
        else:
            print(f"  Task {i}: ✅ {result[:60]}...")

    print("  → All 3 tasks completed. Failure in task 2 didn't lose tasks 1 and 3.")
    print("  Production: log each failure individually, return partial results to client.")


# ─── Pattern 4: run_in_executor for blocking calls ─────────────────────────────


def load_document_from_disk(path: str) -> str:
    """
    Simulates a blocking I/O operation — e.g., reading a large file,
    or using a sync library that can't be made async.
    """
    time.sleep(0.1)  # Simulates disk I/O
    return f"Contents of {path}: [large document content here...]"


async def process_document_async(path: str) -> str:
    """
    Correct pattern for mixing sync blocking I/O with async code.

    run_in_executor offloads the blocking call to a thread pool.
    The event loop is NOT blocked — other coroutines continue running.
    """
    print(f"\n[Pattern 4] run_in_executor for blocking I/O")
    print(f"  Loading document from: {path}")

    loop = asyncio.get_event_loop()

    # Offload blocking disk I/O to thread pool
    content = await loop.run_in_executor(None, load_document_from_disk, path)
    print(f"  Document loaded: {content[:50]}...")

    # Now make async LLM call
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Summarize the document in one sentence."},
            {"role": "user", "content": content},
        ],
        max_tokens=64,
    )
    return response.choices[0].message.content


# ─── Pattern 5: Detecting Event Loop Blocking ──────────────────────────────────


async def check_event_loop_health():
    """
    Practical way to detect if something is blocking the event loop.

    A healthy event loop wakes up promptly after asyncio.sleep(0).
    If the loop is blocked, this sleep will return significantly late.
    """
    print("\n[Pattern 5] Event loop health check")

    async def loop_monitor():
        """Monitors event loop responsiveness."""
        while True:
            start = time.perf_counter()
            await asyncio.sleep(0.1)
            actual = time.perf_counter() - start
            delay = actual - 0.1
            if delay > 0.05:  # >50ms late = something is blocking
                print(f"  ⚠️  Event loop blocked! Expected 100ms, got {actual*1000:.0f}ms")
            else:
                print(f"  ✅ Event loop healthy (delay: {delay*1000:.1f}ms)")
            break  # Just one check for this demo

    await asyncio.gather(
        loop_monitor(),
        asyncio.sleep(0.05),  # Simulate other concurrent work
    )


# ─── Latency Comparison Utility ────────────────────────────────────────────────


async def compare_approaches():
    """
    Direct comparison: sequential vs concurrent for 5 LLM calls.
    Shows the wall-clock time difference.
    """
    print("\n" + "=" * 60)
    print("Sequential vs Concurrent — Direct Comparison")
    print("=" * 60)

    # Warm up (first call is always slower)
    await ask_question("Hello")

    # Sequential
    seq_start = time.perf_counter()
    for q in QUESTIONS[:3]:
        await ask_question(q)
    seq_time = time.perf_counter() - seq_start

    # Concurrent
    con_start = time.perf_counter()
    await asyncio.gather(*[ask_question(q) for q in QUESTIONS[:3]])
    con_time = time.perf_counter() - con_start

    print(f"\n  Sequential (3 calls): {seq_time:.2f}s")
    print(f"  Concurrent (3 calls): {con_time:.2f}s")
    print(f"  Speedup:              {seq_time/con_time:.1f}x")
    print(f"\n  Rule: Use asyncio.gather() for any batch of independent LLM calls.")
    print(f"  Rule: Use Semaphore to cap concurrency and avoid rate limits.")


# ─── Main ─────────────────────────────────────────────────────────────────────


async def main():
    print("=" * 60)
    print("Async/Await Patterns for LLM Services")
    print("=" * 60)

    # Run comparison
    await compare_approaches()

    # Bounded concurrency
    topics = [
        "Python async programming",
        "Transformer architecture",
        "Vector databases",
        "Prompt engineering",
        "LangChain framework",
        "FastAPI web framework",
    ]
    await bounded_concurrent_batch(topics, max_concurrent=3)

    # Resilient gather
    await resilient_gather()

    # run_in_executor
    summary = await process_document_async("/data/reports/annual_report.pdf")
    print(f"  LLM summary: {summary}")

    # Event loop health
    await check_event_loop_health()

    print("\n" + "=" * 60)
    print("Key Takeaways:")
    print("  1. Use AsyncOpenAI, not OpenAI (sync client blocks event loop)")
    print("  2. asyncio.gather() for concurrent calls → N× speedup")
    print("  3. asyncio.Semaphore(N) to bound concurrency under rate limits")
    print("  4. gather(return_exceptions=True) for batch resilience")
    print("  5. run_in_executor for any blocking I/O in async context")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
