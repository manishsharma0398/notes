# Chapter 1: How LLMs Actually Work
## GPT Architecture, Tokenization & Next-Token Prediction

---

## Mental Model (How to Think About This as an Engineer)

Stop thinking of an LLM as a "smart answering machine."

Think of it as a **very sophisticated next-token prediction engine** — one that has been trained on so much text that its predictions happen to look like understanding.

That's the whole game:

> **Given all the tokens so far, what is the single most probable next token?**

Everything else — the "reasoning", the "knowledge", the "conversation" — is an emergent consequence of doing this one thing, billions of times, over trillions of examples.

---

## What is an LLM?

**LLM = Large Language Model**

- A system trained to **understand and generate human language**
- "Large" = billions of parameters (weights) in the neural network
- Trained on massive corpora: internet text, books, code, etc.
- Not a search engine — it **generates** text, it does not retrieve it

Key distinction engineers often miss:

| Search Engine (Google) | LLM (GPT/Gemini/Claude) |
|---|---|
| Indexes existing content | Generates new content on-the-fly |
| Returns links | Returns synthesized text |
| Keyword matching | Semantic / probabilistic |
| Deterministic | Non-deterministic (by default) |

---

## Unpacking "GPT" — The Name Is The Architecture

**GPT = Generative Pre-trained Transformer**

Every LLM you use today — GPT-4, Gemini, Claude, Mistral, Llama — is a GPT under the hood. OpenAI just had the audacity to trademark the generic name.

### Breaking it down:

```
G — Generative
    Output is generated, not retrieved.
    The model creates new sequences it has never "seen" before.

P — Pre-trained
    The model was trained on massive data BEFORE you ever talk to it.
    Your conversation does NOT update its weights (by default).
    It is read-only at inference time.

T — Transformer
    The neural network architecture underneath.
    From Google's 2017 paper: "Attention Is All You Need".
    All major LLMs today are transformer-based.
```

---

## LLM vs Transformer — What's the Difference?

This is the most common conceptual confusion. The answer:

> **LLM is not separate from the transformer. LLM IS the transformer after it has been trained on language data.**

Think of it like a car and its engine:

```
Transformer architecture  +  Trained on language data  =  LLM
      (the engine)               (the training process)     (the car)
```

| | Transformer | LLM |
|---|---|---|
| **What it is** | Neural network architecture (design blueprint) | A transformer trained specifically on language |
| **Introduced by** | Google, 2017 ("Attention Is All You Need") | Built on top of transformer |
| **Original use** | Sequence-to-sequence (e.g. translation) | Text understanding + generation |
| **Is it trained?** | No — just a design | Yes — trained on trillions of tokens |
| **Examples** | The architecture diagram | GPT-4, Gemini, Claude, Llama |

### Not all transformers are LLMs

The transformer architecture is used across many domains — LLMs are just one application:

| Domain | Use | Example |
|--------|-----|---------|
| Language | Text generation | GPT-4, Claude ← **these are LLMs** |
| Vision | Image understanding | ViT (Vision Transformer) |
| Audio | Speech recognition | Whisper |
| Biology | Protein folding | AlphaFold 2 |

### The timeline

```
BEFORE TRAINING:
  Transformer with random weights → outputs garbage

─────── TRAINING HAPPENS ─────── (weeks, on thousands of GPUs)

AFTER TRAINING:
  Same transformer architecture
  Weights now tuned to predict language
  → You now call this an LLM
  → GPT-4, Gemini, Claude are the result of this
```

**"LLM" is the transformer's job title after it graduates from language training.**

---

## The Transformer: How Google Changed Everything

The transformer architecture was introduced in Google's landmark 2017 paper **"Attention Is All You Need"**. It was originally used for Google Translate (sequence-in → sequence-out).

OpenAI took the **decoder** part of that architecture, trained it autoregressively on text, and created GPT.

```
                 ┌─────────────────────────────┐
                 │      TRANSFORMER MODEL      │
                 │                             │
  Input Tokens   │   ┌─────────────────────┐   │   Output Token
 ──────────────► │   │  Input Embeddings   │   │ ─────────────►
  ["hey", "there"] │   │  Positional Encoding│   │  (next token)
                 │   │  Multi-Head Attention│   │
                 │   │  Feed Forward Layers │   │
                 │   │  Layer Normalization │   │
                 │   └─────────────────────┘   │
                 └─────────────────────────────┘
```

At inference time: **one pass → one predicted token**. That's it.

### Encoder-Decoder vs Decoder-only

```
            TRANSFORMER ARCHITECTURE
                       │
          ┌────────────┴──────────────┐
          │                           │
  Encoder-Decoder                 Decoder-only
  (original design)               (GPT style)
          │                           │
    Google Translate            GPT-4, Gemini,
    BERT, T5                    Claude, Llama
          │                           │
  (not used for generation)    ← These are LLMs
```

---

## The Core Mechanism: Autoregressive Token Generation

This is the most important thing to understand. The loop that powers every LLM response:

```
Step 1:  Input: ["hey", "there"]
         Predict: "I"

Step 2:  Input: ["hey", "there", "I"]
         Predict: "am"

Step 3:  Input: ["hey", "there", "I", "am"]
         Predict: "good"

Step 4:  Input: ["hey", "there", "I", "am", "good"]
         Predict: "." (or <EOS> = End of Sequence)

Result:  "I am good."
```

**The model never sees the full response it will generate. It generates it one token at a time, feeding each output back as new input.**

This is called **autoregressive generation**.

```
┌──────────────────────────────────────────────────────────┐
│                 AUTOREGRESSIVE LOOP                       │
│                                                           │
│  tokens = tokenize(user_input)                            │
│                                                           │
│  while True:                                              │
│      next_token = transformer(tokens)  ← ONE forward pass │
│      tokens.append(next_token)                            │
│      if next_token == EOS: break                          │
│                                                           │
│  return detokenize(tokens[len(user_input):])              │
└──────────────────────────────────────────────────────────┘
```

---

## Does the Transformer Run at Inference Time?

**Yes. Every single time. For every single token.**

This is the most important thing to get right. When you send a message to ChatGPT:

```
YOU TYPE:  "What is the capital of France?"
            │
            ▼
    ┌─────────────────────────────────────────┐
    │   TRANSFORMER RUNS RIGHT NOW, LIVE      │
    │   on OpenAI's GPU servers               │
    │                                         │
    │   tokens → 96 transformer layers →      │
    │   next token predicted → repeat         │
    └─────────────────────────────────────────┘
            │
            ▼
     "Paris" streamed back to you
```

The transformer is **not a lookup table**. It is actively computing for every token it generates.

| What you might think | What actually happens |
|---|---|
| Answers are stored and looked up | No storage of answers — pure live computation |
| Training created a database of facts | Training adjusted billions of numerical weights |
| "Paris" is retrieved from memory | "Paris" is the *output of matrix multiplications* across 96 transformer layers, happening right now |

**Analogy:** A human expert giving an answer — they don't retrieve from a lookup table, they *think* using everything they've learned. The learning happened before (pre-training). The thinking happens now (inference).

---

## What Gets Stored After Training?

This surprises most engineers: **the training data is NOT stored in the model.**

What gets stored are the **weights** — billions of floating point numbers adjusted during training:

```
TRAINING DATA           TRAINING PROCESS           WHAT'S STORED
(terabytes of text)  ──────────────────►   weights.safetensors
                                              (numbers in a file)

 "The cat sat..."
 "Paris is the..."      gradient descent      [0.231, -0.847, 0.012,
 "def fibonacci..."  ──────────────────►      0.994, -0.103, 0.778,
 "2+2 equals..."         (billions of          0.441, -0.229, ...]
 ... trillions more      iterations)
                                           ← Training data is GONE.
                                             Only the weights remain.
```

### A neural network is physically just files of numbers

```
GPT-2 (small, open source):
  ├── config.json          ← architecture definition
  └── model.safetensors    ← THE WEIGHTS (548 MB of float32 numbers)

Llama 3 (8B parameters):
  ├── config.json
  ├── model-00001.safetensors   ┐
  ├── model-00002.safetensors   ├─ weights split across files (~16 GB)
  └── model-00003.safetensors   ┘

GPT-4 (estimated, not public):
  └── weights files             ← estimated ~1.7 TB
```

### Size reality check

| Model | Parameters | Storage | GPU VRAM needed |
|-------|-----------|---------|------------------|
| GPT-2 | 117M | 548 MB | < 1 GB |
| Llama 3 8B | 8B | ~16 GB | 16+ GB |
| Llama 3 70B | 70B | ~140 GB | 4× A100 GPUs |
| GPT-4 (est.) | ~1.7T | ~1.7 TB | Entire GPU cluster |

### What happens at inference

```
1. Server startup: load weights from disk → GPU VRAM (done once)

2. Your message arrives: "What is the capital of France?"

3. Run the math:
   embeddings = weights["embed"] @ your_tokens
   for each of 96 layers:
       attention = softmax(Q @ K.T) @ V   ← matrix multiply
       output    = weights["ffn"] @ attention
   logits    = weights["output"] @ final_hidden
   next_token = sample(softmax(logits))   ← "Paris"

4. Repeat step 3 for every output token
```

It's **just matrix multiplication** — extremely large, parallelized across thousands of GPU cores, but mathematically: `output = weights × input`.

### Open-source vs closed models

| | Open Source (Llama, Mistral) | Closed (GPT-4, Gemini) |
|---|---|---|
| Weights available? | ✅ Download from HuggingFace | ❌ Secret, API only |
| Run locally? | ✅ Yes (via Ollama, llama.cpp) | ❌ No |
| Cost per token | Your electricity + hardware | API pricing |

This is exactly what **Ollama** does — it downloads open-source weight files and runs the matrix math on your local machine.

---

## What Engineers Assume vs. What Actually Happens

| Assumption | Reality |
|---|---|
| "The LLM understands my question" | It predicts tokens based on learned statistical patterns |
| "It has a memory of our conversation" | The full conversation is re-sent as input every time |
| "It retrieves information from training data" | It generates text guided by compressed statistical patterns in weights |
| "It reasons through the problem" | It predicts the next token; multi-step reasoning is an emergent property |
| "Longer = better answer" | Token count = cost + latency; verbosity is a training artifact |

---

## Production Engineering Implications

### 1. Context Window = Working Memory
Every token in your conversation costs compute. The model has no persistent memory — you're sending the entire conversation history on every API call.

```
API Call 1:  [system_prompt + user_msg_1]                → response_1
API Call 2:  [system_prompt + user_msg_1 + response_1 + user_msg_2] → response_2
API Call 3:  [system_prompt + ... + user_msg_3]          → response_3
```

**Cost scales with every turn.** This is why context window management is a real engineering problem.

### 2. Non-Determinism by Default
The model doesn't always pick the highest-probability token. It samples from a distribution controlled by `temperature`:
- `temperature=0` → greedy, deterministic, boring
- `temperature=1` → default sampling, creative but inconsistent
- `temperature>1` → chaotic

For production systems where consistency matters (JSON extraction, classifications), set low temperature.

### 3. Tokens ≠ Words
You're billed per token, not per word. And tokens are not words:
- "tokenization" → `["token", "ization"]` (2 tokens)
- " " (space) → often its own token
- Code and non-English text are generally less token-efficient

**Rule of thumb:** 1 token ≈ 0.75 words (for English). Budget accordingly.

### 4. The "Streaming" Illusion
When ChatGPT types character by character — that's tokens being streamed as they're generated. Each token arrives from a separate forward pass of the transformer.

---

## ASCII Architecture Diagram

```
USER INPUT (text)
       │
       ▼
┌─────────────┐
│  TOKENIZER  │  "Hey there" → [15496, 612]  (integer IDs)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  EMBEDDINGS │  [15496] → [0.21, -0.83, 0.44, ...] (768-dim vector)
└──────┬──────┘  Each token → high-dimensional float vector
       │
       ▼
┌─────────────────────────┐
│  POSITIONAL ENCODING    │  Adds position info (token 1, token 2...)
└──────────┬──────────────┘  because transformer has no inherent order
           │
           ▼
┌─────────────────────────┐
│  MULTI-HEAD ATTENTION   │  "Which tokens matter most for predicting next?"
│  (×N layers)            │  Learns relationships between ALL token pairs
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  FEED FORWARD LAYERS    │  Per-token transformation (knowledge storage)
│  (×N layers)            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  OUTPUT PROJECTION      │  Vector → probability over entire vocabulary
│  + SOFTMAX              │  e.g., P("I")=0.72, P("you")=0.15, P("hi")=0.03...
└──────────┬──────────────┘
           │
           ▼
   SAMPLE from distribution
           │
           ▼
       NEXT TOKEN  ("I")
           │
           └──────────► append to input → repeat loop
```

---

## What LLMs Cannot Do (and Why)

| Cannot Do | Reason |
|---|---|
| Update their knowledge in real-time | Weights are frozen at inference; training is separate and expensive |
| Remember previous conversations (by default) | No persistent state; each API call is stateless |
| Count exactly or do precise arithmetic | They predict *plausible* token sequences, not compute |
| Be truly deterministic | Token sampling introduces randomness (unless `temp=0`) |
| Know they are wrong with certainty | Confidence is a function of training distribution, not truth |

---

## Common Misconceptions & Production Pitfalls

⚠️ **Pitfall 1: Assuming the model "knows" something**
It may have seen it in training. But it may also hallucinate confidently. Always validate factual outputs.

⚠️ **Pitfall 2: Ignoring context window limits**
At 128k tokens, a long conversation + long system prompt + documents = you'll hit limits. Design for context budgeting from the start.

⚠️ **Pitfall 3: Treating temperature=0 as "correct"**
Greedy decoding can get stuck in repetition loops. It's deterministic, not more accurate.

⚠️ **Pitfall 4: Not accounting for output token cost**
Input tokens and output tokens are often billed differently. A long system prompt is cheap; a long streamed response is expensive.
