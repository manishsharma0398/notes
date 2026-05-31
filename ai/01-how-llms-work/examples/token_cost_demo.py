"""
Chapter 1 — Example 2: Token Cost Awareness
============================================
As a full-stack engineer, you'll be calling LLM APIs in production.
Token counting directly maps to:
  - Cost (you're billed per token)
  - Latency (more tokens = slower response)
  - Context limits (you'll hit them in long conversations)

This example shows:
  1. How to count tokens BEFORE making an API call
  2. How cost scales with conversation length
  3. The difference between input and output token costs

Run: python token_cost_demo.py
Requires: pip install openai tiktoken
"""

import tiktoken

# GPT-4o-mini pricing (as of 2025, verify current prices)
# https://openai.com/pricing
PRICING = {
    "gpt-4o-mini": {
        "input": 0.15 / 1_000_000,   # $0.15 per 1M input tokens
        "output": 0.60 / 1_000_000,  # $0.60 per 1M output tokens
    },
    "gpt-4o": {
        "input": 2.50 / 1_000_000,   # $2.50 per 1M input tokens
        "output": 10.00 / 1_000_000, # $10.00 per 1M output tokens
    },
}


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """
    Count tokens BEFORE sending to the API.
    Use this to budget requests and avoid surprises.
    """
    # tiktoken is OpenAI's tokenizer library
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))


def estimate_cost(input_text: str, estimated_output_words: int, model: str = "gpt-4o-mini") -> dict:
    """
    Estimate cost of an LLM call before making it.
    estimated_output_words: rough estimate of how long the response will be
    """
    input_tokens = count_tokens(input_text, model)
    output_tokens = int(estimated_output_words / 0.75)  # ~0.75 words per token

    pricing = PRICING[model]
    input_cost = input_tokens * pricing["input"]
    output_cost = output_tokens * pricing["output"]

    return {
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens_estimate": output_tokens,
        "input_cost_usd": input_cost,
        "output_cost_usd": output_cost,
        "total_cost_usd": input_cost + output_cost,
    }


def simulate_conversation_cost(turns: int = 10, model: str = "gpt-4o-mini"):
    """
    Simulate how context window cost grows with conversation turns.
    THIS IS WHAT BREAKS NAIVE AI CHATBOT IMPLEMENTATIONS.
    """
    system_prompt = """You are a helpful AI assistant for an e-commerce platform.
    Help users with order tracking, returns, and product questions.
    Always be polite and professional."""

    user_messages = [
        "Hi, I need help with my order.",
        "My order number is #12345. Where is it?",
        "It says it was delivered but I never got it.",
        "Yes I've checked everywhere.",
        "My address is 123 Main St, is that correct?",
        "Can you file a claim for me?",
        "What information do you need?",
        "The order was placed last Tuesday.",
        "It was a laptop, worth $899.",
        "Yes please proceed with the claim.",
    ]

    print(f"Conversation Cost Scaling Analysis ({model})")
    print(f"{'Turn':<6} {'Input Tokens':<15} {'Cumulative $':<15} {'Cost This Turn'}")
    print("-" * 65)

    full_context = system_prompt
    cumulative_cost = 0.0

    for turn in range(min(turns, len(user_messages))):
        full_context += f"\nUser: {user_messages[turn]}\nAssistant: [response here]"
        result = estimate_cost(full_context, estimated_output_words=50, model=model)

        turn_cost = result["total_cost_usd"]
        cumulative_cost += turn_cost

        print(
            f"{turn + 1:<6} "
            f"{result['input_tokens']:<15} "
            f"${cumulative_cost:.6f}     "
            f"${turn_cost:.6f}"
        )

    print(f"\nTotal estimated cost for {turns}-turn conversation: ${cumulative_cost:.4f}")
    print("\nKey insight: Input token count GROWS every turn (full history re-sent).")
    print("This is O(n²) in the worst case. Design your chat system accordingly.")


def tokenization_examples():
    """
    Tokens are NOT words. Understanding this matters for cost estimation.
    """
    enc = tiktoken.get_encoding("cl100k_base")  # GPT-4 tokenizer

    examples = [
        "Hello",
        "Hello world",
        "tokenization",          # splits into sub-words
        "antidisestablishmentarianism",  # rare word = many tokens
        "def fibonacci(n):",     # code is efficient
        "नमस्ते",               # Hindi is less token-efficient than English
        "    " * 10,             # whitespace = tokens too
    ]

    print("Tokenization Examples (tokens ≠ words):")
    print(f"{'Text':<40} {'Tokens':<8} {'Token IDs'}")
    print("-" * 80)

    for text in examples:
        token_ids = enc.encode(text)
        print(f"{text!r:<40} {len(token_ids):<8} {token_ids[:8]}{'...' if len(token_ids) > 8 else ''}")


if __name__ == "__main__":
    print("=" * 65)
    print("PART 1: Tokenization — tokens are NOT words")
    print("=" * 65)
    tokenization_examples()

    print("\n" + "=" * 65)
    print("PART 2: Conversation Cost Scaling")
    print("=" * 65)
    simulate_conversation_cost(turns=10)
