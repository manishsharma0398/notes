import tiktoken

MODELS_CONFIGS = {
    "gpt-4o": {
        "context_window": 128_000,
        "input_cost_per_1m": 5,
        "output_cost_per_1m": 7,
        "rate_per_cycle": 0,
    },
    "gpt-4o-mini": {
        "context_window": 128_000,
        "input_cost_per_1m": 1,
        "output_cost_per_1m": 2,
        "rate_per_cycle": 0,
    },
    "claude-3-haiku": {
        "context_window": 200_000,
        "input_cost_per_1m": 8,
        "output_cost_per_1m": 15,
        "rate_per_cycle": 0,
    },
    "test": {
        "context_window": 50,
        "input_cost_per_1m": 0.5,
        "output_cost_per_1m": 1,
        "rate_per_cycle": 0,
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


def calculate_cost(model, input_tokens, max_output_token, total_tokens):
    context_window = MODELS_CONFIGS.get(model, {})

    input_cost = context_window.get("input_cost_per_1m", 0) / 1000000 * input_tokens
    output_cost = (
        context_window.get("output_cost_per_1m", 0) / 1000000 * max_output_token
    )
    total = input_cost + output_cost
    return (input_cost, output_cost, total)


def calculate_cost_projection(req_per_day: int, rate: int | float):
    return req_per_day * rate, req_per_day * rate * 30


def main():
    system_prompt = input("Please enter system prompt: ")
    user_prompt = input("\nPlease enter user prompt/message: ")
    max_output_token = int(input("\nPlease enter max output token: ") or 0)
    req_per_day = int(input("\nEstimated request per day(defaults to 1000): ") or 1000)

    system_tokens, user_tokens, input_tokens, total_tokens = token_calc(
        system_prompt, user_prompt, max_output_token
    )

    print(f"""
    ─────────────────────────────────────────────────────────
    TOKEN BREAKDOWN
    ─────────────────────────────────────────────────────────
    System prompt:    {system_tokens} tokens
    User message:     {user_tokens} tokens
    ─────────────────
    Total input:      {input_tokens} tokens
    Max output:       {max_output_token} tokens
    Grand total:      {total_tokens} tokens (worst case)
    """)

    print("""
    ─────────────────────────────────────────────────────────
    CONTEXT WINDOW CHECK
    ─────────────────────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        context_window, fits, final_budget = calculate_context_window(
            model,
            input_tokens,
        )
        print(f"    {model:<15} ({context_window:<4}): {fits:<15}  {final_budget}")

    print("""
    ─────────────────────────────────────────────────────────
    COST ESTIMATE (per request)
    ─────────────────────────────────────────────────────────
    Model             Input cost    Output cost   Total/request
    ─────────────────────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        input_cost, output_cost, total_cost = calculate_cost(
            model, input_tokens, max_output_token, total_tokens
        )
        MODELS_CONFIGS[model]["rate_per_cycle"] = total_cost
        print(
            f"    {model:<15}   ${input_cost:<12.6f} ${output_cost:<12.6f} ${total_cost:.6f}"
        )

    print(f"""
    ─────────────────────────────────────────────────────────
    DAILY COST PROJECTION
    ─────────────────────────────────────────────────────────
    Requests/day: {req_per_day}

    Model             Daily cost    Monthly cost
    ─────────────────────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        daily_cost, monthly_cost = calculate_cost_projection(
            req_per_day, MODELS_CONFIGS.get(model, "").get("rate_per_cycle", 0)
        )
        print(f"    {model:<15}   ${daily_cost:<12.2f} ${monthly_cost:<12.2f}")


main()
