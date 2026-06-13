import tiktoken
import json

MODELS_CONFIGS: dict[str, dict[str, int | float | bool]] = {
    "gpt-4o": {
        "context_window": 128_000,
        "input_cost_per_1m": 2.50,
        "output_cost_per_1m": 10.00,
        "rate_per_cycle": 0,
        "fits": False,
    },
    "gpt-4o-mini": {
        "context_window": 128_000,
        "input_cost_per_1m": 0.15,
        "output_cost_per_1m": 0.60,
        "rate_per_cycle": 0,
        "fits": False,
    },
    "claude-3-haiku": {
        "context_window": 200_000,
        "input_cost_per_1m": 0.8,
        "output_cost_per_1m": 4,
        "rate_per_cycle": 0,
        "fits": False,
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
    budget_status = "✅ Fits" if fits else "❌ Exceeds with the margin"

    final_budget = (
        f"{budget_remaining:,} tokens remaining"
        if fits
        else f"{abs(budget_remaining):,} tokens exceeded"
    )

    return (f"{context_window // 1000}K", budget_status, final_budget, fits)


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


def main(jsonOutput: bool):
    system_prompt = input("Please enter system prompt: ")
    user_prompt = input("\nPlease enter user prompt/message: ")
    max_output_token = int(input("\nPlease enter max output token: ") or 0)
    req_per_day = int(input("\nEstimated request per day(defaults to 1000): ") or 1000)

    system_tokens, user_tokens, input_tokens, total_tokens = token_calc(
        system_prompt, user_prompt, max_output_token
    )

    json_data = {"contextWindow": {}, "costEstimates": {}, "costProjection": {}}

    print(f"""
    ─────────────────────────────────────────────────────────
    TOKEN BREAKDOWN
    ─────────────────────────────────────────────────────────
    System prompt:    {system_tokens} tokens
    User message:     {user_tokens} tokens
    ─────────────────
    Total input:      {input_tokens} tokens
    Max output:       {max_output_token} tokens
    Grand total:      {total_tokens} tokens (worst case)""")

    print("""
    ─────────────────────────────────────────────────────────
    CONTEXT WINDOW CHECK
    ─────────────────────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        context_window, budget_status, final_budget, fits = calculate_context_window(
            model,
            total_tokens,
        )
        MODELS_CONFIGS[model]["fits"] = fits
        json_data["contextWindow"][model] = {
            "context_window": context_window,
            "budget_status": budget_status,
        }
        print(
            f"    {model:<15} ({context_window:<4}): {budget_status:<15}  {final_budget}"
        )

    print("""
    ─────────────────────────────────────────────────────────
    COST ESTIMATE (per request)
    ─────────────────────────────────────────────────────────
    Model             Input cost    Output cost   Total/request
    ─────────────────────────────────────────────────────────""")
    for model in MODELS_CONFIGS:
        if not MODELS_CONFIGS[model]["fits"]:
            continue
        input_cost, output_cost, total_cost = calculate_cost(
            model, input_tokens, max_output_token, total_tokens
        )
        MODELS_CONFIGS[model]["rate_per_cycle"] = total_cost
        json_data["costEstimates"][model] = {
            "input_cost": input_cost,
            "output_cost": output_cost,
            "rate_per_cycle": total_cost,
        }
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
    cheapest_model, cheapest_model_per_day_cost = "", float("inf")
    expensive_model, expensive_model_per_day_cost = "", 0

    for model in MODELS_CONFIGS:
        if not MODELS_CONFIGS[model]["fits"]:
            continue
        daily_cost, monthly_cost = calculate_cost_projection(
            req_per_day, MODELS_CONFIGS[model].get("rate_per_cycle", 0)
        )
        json_data["costProjection"][model] = {
            "daily_cost": daily_cost,
            "monthly_cost": monthly_cost,
        }
        if daily_cost < cheapest_model_per_day_cost:
            cheapest_model = model
            cheapest_model_per_day_cost = daily_cost
        if daily_cost > expensive_model_per_day_cost:
            expensive_model = model
            expensive_model_per_day_cost = daily_cost

        print(f"    {model:<15}   ${daily_cost:<12.2f} ${monthly_cost:<12.2f}")

    if (
        cheapest_model
        and expensive_model
        and cheapest_model != expensive_model
        and expensive_model_per_day_cost > 0
    ):
        difference = expensive_model_per_day_cost - cheapest_model_per_day_cost

        recommendation = f"{cheapest_model} saves ${difference:.2f}/day vs {expensive_model} ({(difference/expensive_model_per_day_cost*100):.0f}% cheaper)"

        json_data["costProjection"]["recommendation"] = recommendation
        json_data["costProjection"]["cheapest_model"] = cheapest_model
        json_data["costProjection"]["expensive_model"] = expensive_model

        print(f"\n    💡 Recommendation: {recommendation}")

    savings_per_req = (
        MODELS_CONFIGS["gpt-4o"]["rate_per_cycle"]
        - MODELS_CONFIGS["gpt-4o-mini"]["rate_per_cycle"]
    )

    if savings_per_req > 0:
        volume = 100 / (savings_per_req) / 30

        print(f"\n    Monthly token required to save $100: {volume:.0f}")

    with open("artifact.json", "w") as f:
        json.dump(json_data, f)


main(jsonOutput=False)
