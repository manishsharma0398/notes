"""
Chapter 3, Example 2: Streaming API

What this demonstrates:
- How SSE streaming works at the protocol level
- Collecting a stream vs printing a stream
- Time-to-first-token measurement
- Why streaming doesn't change total latency (just perceived latency)
- The streaming + JSON problem (and how to handle it)

Run with:
    pip install openai
    export OPENAI_API_KEY=sk-...
    python 02_streaming.py
"""

import asyncio
import json
import time

import openai


# ─── Part 1: Non-streaming vs streaming (compare the experience) ──────────────

def demo_non_streaming(client: openai.OpenAI, prompt: str):
    """
    Standard blocking call. No output until the model is done.
    Measure time-to-first-byte vs total time.
    """
    start = time.perf_counter()

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )

    total_time = time.perf_counter() - start
    content = response.choices[0].message.content

    print(f"\n[Non-streaming] Total time: {total_time:.2f}s")
    print(f"Time-to-first-byte: {total_time:.2f}s (same as total — you wait for everything)")
    print(f"Output tokens: {response.usage.completion_tokens}")
    print(f"Content:\n{content}")
    return content


def demo_streaming(client: openai.OpenAI, prompt: str):
    """
    Streaming call. First token arrives in ~200ms.
    Total time is the SAME as non-streaming — but it FEELS faster.

    Under the hood:
    - HTTP connection stays open
    - Provider sends SSE events as tokens are generated
    - Each event: data: {"choices":[{"delta":{"content":"word"}}]}
    """
    start = time.perf_counter()
    first_token_time = None
    collected_text = []

    print(f"\n[Streaming] Output: ", end="", flush=True)

    with client.chat.completions.stream(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    ) as stream:
        for text_chunk in stream.text_stream:
            if first_token_time is None:
                first_token_time = time.perf_counter() - start
            print(text_chunk, end="", flush=True)
            collected_text.append(text_chunk)

        # Final completion stats (only available after stream ends)
        final = stream.get_final_completion()
        output_tokens = final.usage.completion_tokens

    total_time = time.perf_counter() - start
    print()  # newline

    print(f"\n[Streaming] Time-to-first-token: {first_token_time:.2f}s")
    print(f"[Streaming] Total time: {total_time:.2f}s")
    print(f"[Streaming] Output tokens: {output_tokens}")
    print(f"NOTE: Total time is similar to non-streaming.")
    print(f"      Perceived latency is better because text appeared immediately.")

    return "".join(collected_text)


# ─── Part 2: The streaming + JSON problem ────────────────────────────────────

def streaming_with_json_output(client: openai.OpenAI, text: str):
    """
    Streaming and JSON parsing are in tension.
    
    If you stream, you get partial JSON — which is invalid JSON and cannot be parsed.
    
    Options:
    1. Don't stream for JSON tasks (simplest, safest)
    2. Collect the full stream, THEN parse
    3. Use structured outputs (response_format) without streaming
    
    This demonstrates option 2 (collect then parse).
    """
    print("\n[Streaming + JSON] Collecting stream before parsing...")

    chunks = []
    start = time.perf_counter()

    with client.chat.completions.stream(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a sentiment analyzer. Respond with JSON only: "
                           "{\"sentiment\": \"POSITIVE|NEGATIVE|NEUTRAL\", \"confidence\": 0.0-1.0}",
            },
            {"role": "user", "content": text},
        ],
        max_tokens=50,
    ) as stream:
        for chunk in stream.text_stream:
            chunks.append(chunk)

    raw = "".join(chunks)
    total_time = time.perf_counter() - start

    try:
        parsed = json.loads(raw)
        print(f"Parsed: {parsed}")
        print(f"Sentiment: {parsed['sentiment']} (confidence: {parsed['confidence']:.2f})")
    except json.JSONDecodeError as e:
        print(f"Parse error: {e}")
        print(f"Raw output was: {raw!r}")
        print("TIP: For JSON tasks, disable streaming and use response_format={'type': 'json_object'}")

    print(f"Total time: {total_time:.2f}s")


# ─── Part 3: Async streaming (for FastAPI / async web servers) ────────────────

async def async_streaming_demo(prompt: str):
    """
    Async streaming using AsyncOpenAI.
    This is what you'd use in a FastAPI endpoint.

    In FastAPI, you'd wrap this in a StreamingResponse.
    """
    async_client = openai.AsyncOpenAI()

    print(f"\n[Async streaming] Output: ", end="", flush=True)

    async with async_client.chat.completions.stream(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    ) as stream:
        async for text_chunk in stream.text_stream:
            print(text_chunk, end="", flush=True)

    print()


# FastAPI endpoint example (shown as code, not run here)
FASTAPI_EXAMPLE = """
# In a real FastAPI app:

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import openai, json

app = FastAPI()
client = openai.AsyncOpenAI()

async def stream_generator(message: str):
    async with client.chat.completions.stream(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": message}],
    ) as stream:
        async for text in stream.text_stream:
            yield f"data: {json.dumps({'content': text})}\\n\\n"
    yield "data: [DONE]\\n\\n"

@app.get("/chat/stream")
async def chat_stream(message: str):
    return StreamingResponse(
        stream_generator(message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disables Nginx buffering — CRITICAL
        },
    )
"""


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Set OPENAI_API_KEY to run examples")
        exit(1)

    client = openai.OpenAI(api_key=api_key)
    prompt = "Explain what an async event loop is in 3 sentences."

    # Compare streaming vs non-streaming
    demo_non_streaming(client, prompt)
    print("\n" + "─" * 60)
    demo_streaming(client, prompt)

    # JSON + streaming
    print("\n" + "─" * 60)
    streaming_with_json_output(client, "The product arrived broken and customer support was unhelpful.")

    # Async streaming
    print("\n" + "─" * 60)
    asyncio.run(async_streaming_demo(prompt))

    print("\n" + "─" * 60)
    print("FastAPI endpoint example (not run here):")
    print(FASTAPI_EXAMPLE)
