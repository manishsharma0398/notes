import tiktoken
import time

MODEL_COST_PER_1M = {
    "gpt-4o": 5,
    "gpt-4o-mini": 0.15,
}

input_samples = [
    "Hello, world!",
    "The transformer architecture uses self-attention mechanisms.",
    "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)",
    "こんにちは世界",  # Japanese: tests non-English token efficiency
]

def tokenize_prompt(prompt: str, model:str) -> list[int]:
    encoder = tiktoken.encoding_for_model(model)
    return encoder.encode(prompt)
    
def count_token(tokens:list[int] = []) -> int:
    return len(tokens)

def count_words(prompt: str) -> int:
    return len(prompt.split()) 

def calculate_token_efficiency(prompt_count:str, token_count: int):
    return token_count / prompt_count

def calculate_estimate_cost(model: str, token_count:int):
    cost_per_million = MODEL_COST_PER_1M[model]
    estimated_cost_of_tokens = cost_per_million/1000000*token_count
    return estimated_cost_of_tokens

def simulate_token_stream(tokens):
    for token in tokens:
        print(token, sep=" as", )
        time.sleep(0.5)


def inspect_prompt():
    user_inputs = [input("Please enter the prompt: ")] or input_samples

    for user_input in user_inputs:
        print(user_input)
        tokens = tokenize_prompt(user_input, "gpt-4o")
        token_count = count_token(tokens)
        print(f"No of tokens: {token_count}")

        word_count = count_words(user_input)
        print(f"No of words: {word_count}")

        token_efficiency = calculate_token_efficiency(word_count, token_count)
        print(f"Token efficiency rate: {token_efficiency}")

        estimated_cost = calculate_estimate_cost("gpt-4o", token_count)
        print(f"Estimated cost: {estimated_cost}")

        simulate_token_stream(tokens)


inspect_prompt()
