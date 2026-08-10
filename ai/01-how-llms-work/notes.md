# Chapter 1 — Revision Notes

## How LLMs Work: GPT Architecture & Next-Token Prediction

---

### Core Facts (no fluff)

- **LLM** = Large Language Model. Trained to understand + generate natural language.
- **GPT** = Generative Pre-trained Transformer. Generic term — Gemini, Claude, Mistral are all GPTs.
  - **G** = Generative (creates output, doesn't retrieve)
  - **P** = Pre-trained (weights frozen at inference; training ≠ runtime)
  - **T** = Transformer (the architecture from Google's "Attention Is All You Need", 2017)
- **LLM vs Transformer**: They are the same thing at different stages.
  - Transformer = the neural network architecture (design blueprint)
  - LLM = that transformer after being trained on language data
  - **"LLM" is the transformer's job title after it graduates from language training"**
- **Not all transformers are LLMs**: ViT (images), Whisper (audio), AlphaFold (biology) are all transformers but not LLMs

---

### The One Sentence That Explains Everything

> An LLM is a function that takes a sequence of tokens and returns the probability distribution over the next token.

That's it. Run it in a loop. You get a response.

---

### Autoregressive Loop (memorize this)

```
input_tokens = tokenize("hey there")
while not done:
    next_token = model(input_tokens)   # ONE forward pass
    input_tokens.append(next_token)
    if next_token == EOS: done = True
```

---

### Key Terms

| Term               | Definition                                                             |
| ------------------ | ---------------------------------------------------------------------- |
| **Token**          | Sub-word unit. ~0.75 words on average (English). Billed unit for APIs. |
| **Embedding**      | Dense float vector representing a token (e.g., 768 or 4096 dims)       |
| **Context Window** | Max total tokens (input + output) the model can process at once        |
| **Temperature**    | Controls randomness of token sampling (0=deterministic, 1=default)     |
| **Autoregressive** | Each output token is fed back as input for next prediction             |
| **EOS**            | End-of-Sequence token — signals model to stop generating               |

---

### Transformer Pipeline (simplified)

```
Text → Tokenize → Embed → Positional Encode
     → Attention Layers (×N)
     → FFN Layers (×N)
     → Project to vocab
     → Softmax → Sample → Token
```

---

### Production Gotchas

1. **Every API call sends full conversation history** — context grows, cost grows
2. **Tokens ≠ words** — code/non-English is less efficient
3. **Temperature=0 ≠ correct** — deterministic, but still hallucinates
4. **Model weights are frozen** — no real-time learning from your chats
5. **Output tokens cost more than input tokens** (on most providers)
6. **LLM IS the transformer** — not a separate system; same architecture, post-training
7. **Transformer runs LIVE at inference** — not a lookup table; active GPU computation per token
8. **Training data is NOT stored in the model** — only the weights (billions of floats) are stored
9. **Weights are just files** (`.safetensors`, `.bin`, `.gguf`) loaded into GPU VRAM at startup
10. **Open-source models** (Llama, Mistral) = download weight files + run locally (Ollama does this)

---

### Model Weight Sizes (for calibration)

| Model        | Parameters | Storage |
| ------------ | ---------- | ------- |
| GPT-2        | 117M       | 548 MB  |
| Llama 3 8B   | 8B         | ~16 GB  |
| Llama 3 70B  | 70B        | ~140 GB |
| GPT-4 (est.) | ~1.7T      | ~1.7 TB |

### Key Terms (additions)

| Term                     | Definition                                                                 |
| ------------------------ | -------------------------------------------------------------------------- |
| **Weights / Parameters** | The numbers inside a neural network that encode learned patterns           |
| **Inference**            | Running the model on new input (the transformer forward pass, live on GPU) |
| **Training**             | The process of adjusting weights using gradient descent on training data   |
| **`.safetensors`**       | Common file format for storing model weights                               |
| **Ollama**               | Tool to download open-source weight files and run them locally             |
| **HuggingFace**          | Hub where open-source model weights are published and downloaded           |
