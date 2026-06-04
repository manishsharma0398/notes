# Chapter 1 Exercise — How LLMs Work

**Scope:** Tokenization · token costs · autoregressive generation · context windows  
**Estimated time:** 30–45 minutes  
**Rules:** Write all code yourself. Do not use AI to generate the solution.

---

## Problem: Token Budget Inspector

Build a command-line tool that analyzes any text input and reports everything an
engineer needs to know before sending it to an LLM API.

### Why This Matters

Before every production LLM call you should know: how many tokens is this? What will
it cost? Will it fit in the context window? The tool you build here is the foundation
of every cost-aware AI system.

---

## Acceptance Criteria

- [ ] Accepts a text string (hardcoded or via `input()` — your choice)
- [ ] Reports the **token count** using `tiktoken` with `cl100k_base` encoding (used by GPT-4)
- [ ] Reports the **estimated cost** for sending this text as input to both:
  - `gpt-4o` at $5.00 per 1M input tokens
  - `gpt-4o-mini` at $0.15 per 1M input tokens
- [ ] Reports the **token efficiency ratio**: tokens ÷ words (words = `len(text.split())`)
- [ ] Checks whether the text fits in a 128K context window with a 2K output reservation
  - If it fits: report remaining budget
  - If it doesn't: report by how many tokens it exceeds the limit
- [ ] Simulates the **autoregressive loop** for a short phrase (≤10 words) by printing each token one at a time with a 0.05s delay — mimicking how streaming works

---

## Starter Skeleton

Save as `exercises/solution/token_inspector.py`:

```python
import time
# TODO: import tiktoken

GPT4O_INPUT_COST_PER_1M = 5.00
GPT4O_MINI_INPUT_COST_PER_1M = 0.15
CONTEXT_WINDOW = 128_000
OUTPUT_RESERVATION = 2_000


def count_tokens(text: str) -> list[int]:
    """Return list of token IDs for the given text using cl100k_base."""
    # TODO: get the encoding and encode the text
    pass


def calculate_cost(token_count: int, cost_per_1m: float) -> float:
    """Return cost in USD for the given token count."""
    # TODO: implement
    pass


def check_context_window(token_count: int) -> tuple[bool, int]:
    """
    Return (fits: bool, margin: int).
    margin is positive if it fits (remaining budget), negative if it doesn't.
    """
    # TODO: implement
    # Usable input budget = CONTEXT_WINDOW - OUTPUT_RESERVATION
    pass


def simulate_streaming(text: str) -> None:
    """
    Tokenize the text and print each token's decoded string one at a time
    with a 0.05s delay, simulating autoregressive generation.
    """
    # TODO: implement
    # Hint: enc.decode_single_token_bytes(token_id).decode("utf-8", errors="replace")
    pass


def analyze(text: str) -> None:
    tokens = count_tokens(text)
    token_count = len(tokens)
    word_count = len(text.split())

    print(f"\n{'='*50}")
    print(f"TOKEN BUDGET REPORT")
    print(f"{'='*50}")

    # TODO: print all required stats:
    # - token count and word count
    # - token efficiency ratio (tokens/words, 2 decimal places)
    # - cost for gpt-4o and gpt-4o-mini (6 decimal places, USD)
    # - context window status (fits or exceeds, with margin)

    print(f"\n{'='*50}")
    print("STREAMING SIMULATION")
    print(f"{'='*50}")
    simulate_streaming(text)


if __name__ == "__main__":
    samples = [
        "Hello, world!",
        "The transformer architecture uses self-attention mechanisms.",
        "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)",
        "こんにちは世界",  # Japanese: tests non-English token efficiency
    ]

    for sample in samples:
        analyze(sample)
        print()
```

---

## What to Verify (Self-Assessment Checklist)

Run `python token_inspector.py` and check:

- [ ] "Hello, world!" → approximately 4 tokens (it's `Hello`, `,`, ` world`, `!`)
- [ ] The Japanese text has a **worse** token efficiency ratio than English (more tokens per "word") — this is the non-English cost trap
- [ ] The Python code snippet has a worse ratio than plain prose — code tokenizes less efficiently
- [ ] For a 130K-token text (you'll need to generate one), the context check shows it EXCEEDS the budget
- [ ] The streaming simulation prints tokens character-by-character with visible delay

**Prediction exercise:** Before running, guess: which sample will have the worst token efficiency ratio (highest tokens-per-word)? Why?

---

## Hints

<details>
<summary>Hint 1 — Getting tiktoken encoding</summary>

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
token_ids = enc.encode(text)
```

</details>

<details>
<summary>Hint 2 — Decoding a single token</summary>

```python
token_bytes = enc.decode_single_token_bytes(token_id)
token_str = token_bytes.decode("utf-8", errors="replace")
print(token_str, end="", flush=True)
```

The `flush=True` is important — otherwise Python buffers the output and it won't appear character by character.

</details>

<details>
<summary>Hint 3 — Cost calculation</summary>

```python
cost = (token_count / 1_000_000) * cost_per_1m
```

</details>
