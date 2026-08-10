# Chapter 1 — Interview Questions
## How LLMs Work: Senior-Level

---

### Q1: "An LLM gives me a different answer every time I ask the same question. Why? How would you make it consistent in production?"

**What they're testing:** Do you understand temperature / sampling vs. greedy decoding?

**Answer:**
LLMs sample from a probability distribution over the vocabulary at each step — controlled by `temperature`. At `temperature > 0`, the same input produces different outputs because sampling is stochastic.

To make it consistent:
- Set `temperature=0` for greedy (argmax) decoding — always picks the highest-probability token
- Use `seed` parameter where supported (OpenAI supports this)
- Structure your output format with JSON mode / function calling to constrain variance

**Trap:** `temperature=0` does NOT mean "correct". The model can still hallucinate at temp=0 — it just does so consistently.

---

### Q2: "Why does sending a long conversation history to an LLM API get expensive very fast? How would you architect around this?"

**What they're testing:** Do you understand statelessness + context window mechanics?

**Answer:**
LLM APIs are **stateless**. Every call includes the full conversation: system prompt + all prior messages + current message. Token count = input_tokens + output_tokens. Both are billed.

In a 10-turn conversation with a 1000-token system prompt:
- Turn 10 input alone might be 8,000+ tokens
- Cost grows O(n²) with conversation turns in the worst case

**Architectural mitigations:**
1. **Summarization**: Periodically compress older turns into a summary
2. **Sliding window**: Drop oldest messages when approaching context limit
3. **Selective context**: Only include relevant prior turns (retrieval-based)
4. **Cache**: If system prompt is static, use prompt caching (Anthropic, OpenAI support this)

---

### Q3: "What is the difference between a search engine and an LLM at a fundamental architectural level? Why can't you just use an LLM as a search engine?"

**What they're testing:** Generative vs. retrieval distinction. Understanding hallucination.

**Answer:**
A search engine **retrieves** — it indexes existing documents and returns ranked matches. It is grounded in real content.

An LLM **generates** — it predicts token sequences based on statistical patterns compressed into billions of weights. It has no live access to the internet (unless tool-enabled), and it cannot verify whether its generated output is factually true.

You can't use an LLM as a search engine because:
1. It **hallucates** — generates plausible but incorrect information confidently
2. Its training data has a **knowledge cutoff** date
3. It cannot point you to the **source** of information reliably
4. It may have **never seen** specific content (private data, recent news)

This is exactly why **RAG (Retrieval-Augmented Generation)** exists: combine a retrieval system (for factual grounding) with an LLM (for language generation).

---

### Q4: "What is the difference between a Transformer and an LLM? Are they the same thing?"

**What they're testing:** Conceptual clarity on architecture vs. trained model.

**Answer:**
They are the same thing at different stages:
- **Transformer** = the neural network *architecture* (decoder-only, from Google's 2017 "Attention Is All You Need" paper)
- **LLM** = that transformer *after being trained on massive language data*

An untrained transformer with random weights is useless. After training on trillions of tokens via gradient descent, the same architecture becomes an LLM. You call it an LLM because of *what it was trained to do*, not because it's a different system.

Not all transformers are LLMs — Vision Transformer (ViT) processes images, Whisper processes audio, AlphaFold processes protein sequences. All transformers, none of them LLMs.

**Trap:** Don't say "the LLM uses a transformer internally" — that implies two separate systems. The LLM *is* the transformer.

---

### Q5: "When a user sends a message to ChatGPT, what is physically happening on OpenAI's servers? Is the response looked up or computed?"

**What they're testing:** Do you understand inference vs. retrieval? Compute cost mental model?

**Answer:**
The response is **fully computed live**, not looked up. Here's what happens:

1. Weights (~1.7TB for GPT-4) are pre-loaded into GPU VRAM at server startup
2. User message is tokenized → token IDs
3. Token IDs are multiplied through the transformer layers (matrix multiplication on GPU)
4. Output layer produces a probability distribution over the vocabulary
5. One token is sampled → streamed back to user
6. Steps 3–5 repeat for every output token

The training data itself is **not stored** — only the weights are. The weights are billions of floating-point numbers that encode learned statistical patterns. The model doesn't "remember" Paris is the capital of France — it *computes* that "Paris" is the highest-probability next token given the context.

**Why this matters in production:** Every token = one transformer forward pass = GPU time = cost. More tokens → more compute. This is why token-based pricing exists and why context window management matters.

---

### Prediction Exercise 🎯

Before reading the answer — predict the output:

```python
import openai

client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is 2 + 2?"}],
    temperature=0,
    max_tokens=1
)
print(response.choices[0].message.content)
```

**What do you think happens if `max_tokens=1`?**

*(Answer: The model generates exactly 1 token. For "2 + 2", it will likely output "4" — since "4" is a single token and the highest-probability next token given the question and the constraint.)*
