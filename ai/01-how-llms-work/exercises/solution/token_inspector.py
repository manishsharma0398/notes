import tiktoken
import time

MODEL_COST_PER_1M: dict[str, int | float] = {
    "gpt-4o": 5,
    "gpt-4o-mini": 0.15,
}

input_samples = [
    "Hello, world!",
    "The transformer architecture uses self-attention mechanisms.",
    "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)",
    "こんにちは世界",  # Japanese: tests non-English token efficiency
    "",
]
CONTEXT_WINDOW = 128_000
OUTPUT_RESERVATION = 2_000


def tokenize_prompt(prompt: str) -> list[int]:
    encoder = tiktoken.get_encoding("cl100k_base")
    return encoder.encode(prompt)


def count_token(tokens: list[int] = []) -> int:
    return len(tokens)


def count_words(prompt: str) -> int:
    return len(prompt.split())


def calculate_token_efficiency(word_count: int, token_count: int):
    if word_count == 0:
        return 0
    return token_count / word_count


def calculate_estimate_cost(model: str, token_count: int):
    cost_per_million = MODEL_COST_PER_1M[model]
    estimated_cost_of_tokens = cost_per_million / 1000000 * token_count
    return estimated_cost_of_tokens


def check_context_window(token_count: int) -> tuple[bool, int]:
    usable_budget = CONTEXT_WINDOW - OUTPUT_RESERVATION  # 126,000
    margin = usable_budget - token_count
    return margin >= 0, margin


def simulate_token_stream(tokens):
    for token in tokens:
        print(token, end="", flush=True)
        time.sleep(0.05)


def simulate_token_decode_stream(tokens):
    encoder = tiktoken.get_encoding("cl100k_base")
    for token in tokens:
        token_bytes = encoder.decode_single_token_bytes(token)
        token_str = token_bytes.decode("utf-8", errors="replace")
        print(token_str, end="", flush=True)
        time.sleep(0.05)


def inspect_prompt():
    print()
    user_inputs = input("Please enter the prompt: ")

    prompts = [user_inputs] if user_inputs else input_samples

    for user_input in prompts:

        print("\n")

        word_count = count_words(user_input)
        print(f"No of words: {word_count}")

        tokens = tokenize_prompt(user_input)
        token_count = count_token(tokens)
        print(f"No of tokens: {token_count}")

        token_efficiency = calculate_token_efficiency(word_count, token_count)
        print(f"Token efficiency rate: {token_efficiency:.2f}")

        for model in MODEL_COST_PER_1M:
            estimated_cost = calculate_estimate_cost(model, token_count)
            print(f"Estimated cost for {model}: {estimated_cost:.6f}")

        fits, margin = check_context_window(token_count)
        if fits:
            print(f"Budget remaining: {margin} tokens")
        else:
            print(f"Exceeds the context window by {abs(margin)} tokens")

        print(f"Tokens: ", end="")
        simulate_token_stream(tokens)
        print()

        print(f"Actual prompt: ", end="")
        simulate_token_decode_stream(tokens)


inspect_prompt()
