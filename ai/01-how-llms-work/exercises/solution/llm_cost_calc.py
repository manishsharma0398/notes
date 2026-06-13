import tiktoken

MODELS_CONFIGS = {
    "gpt-4o": {
        "context_window": 128_000,
        "input_cost_per_1m": 5,
        "output_cost_per_1m": 7,
    },
    "gpt-4o-mini": {
        "context_window": 128_000,
        "input_cost_per_1m": 1,
        "output_cost_per_1m": 2,
    },
    "claude-3-haiku": {
        "context_window": 200_000,
        "input_cost_per_1m": 8,
        "output_cost_per_1m": 15,
    },
    "test": {
        "context_window": 50,
        "input_cost_per_1m": 0.5,
        "output_cost_per_1m": 1,
    },
}


def token_calc(system_prompt: str, user_prompt: str, max_output_token: int):
    user_tokens = len(tokenize(user_prompt))
    system_tokens = len(tokenize(system_prompt))
    input_tokens = user_tokens + system_tokens
    total_tokens = input_tokens + max_output_token

    return system_tokens, user_tokens, input_tokens, total_tokens


def tokenize(prompt: str = "") -> list[int]:
    encode = tiktoken.get_encoding("cl100k_base")
    return encode.encode(prompt)


def calculate_context_window(model: str, total_input_token: int):
    context_window = MODELS_CONFIGS.get(model, {}).get("context_window", 0)
    budget_remaining = context_window - total_input_token
    fits = budget_remaining > 0
    budget_status = "✅ Fits" if fits else "❌ Out of tokens"

    final_budget = (
        f"{budget_remaining:,} tokens remaining"
        if fits
        else f"{abs(budget_remaining):,} tokens exceeded"
    )

    return (f"{context_window // 1000}K", budget_status, final_budget)


def main():
    system_prompt = input("Please enter system prompt: ")
    user_prompt = input("\nPlease enter user prompt/message: ")
    max_output_token = int(input("\nPlease enter max output token: ") or 0)

    system_tokens, user_tokens, input_tokens, total_tokens = token_calc(
        system_prompt, user_prompt, max_output_token
    )

    print(f"""
    ──────────────────────────────────────────
    TOKEN BREAKDOWN
    ──────────────────────────────────────────
    System prompt:    {system_tokens} tokens
    User message:     {user_tokens} tokens
    ─────────────────
    Total input:      {input_tokens} tokens
    Max output:       {max_output_token} tokens
    Grand total:      {total_tokens} tokens (worst case)
    """)

    print("""
    ──────────────────────────────────────────
    CONTEXT WINDOW CHECK
    ──────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        context_window, fits, final_budget = calculate_context_window(
            model,
            input_tokens,
        )
        print(f"    {model:<15} ({context_window:<4}): {fits:<15}  {final_budget}")


main()
