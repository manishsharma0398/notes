# Chapter 2 Exercise — Prompt Engineering

**Scope:** Zero-shot · few-shot · chain-of-thought · structured output · system prompts  
**Estimated time:** 45–60 minutes  
**Rules:** Write all code yourself. Do not use AI to generate the solution. The challenge is in *designing the prompts*, not the Python scaffolding.

---

## Problem: Prompt Comparison Harness

Build a script that runs the same classification task with four different prompting
strategies and measures how each performs — so you can *see* the difference between
techniques, not just read about it.

### The Task

Classify customer support messages into one of these categories:
`billing`, `technical`, `shipping`, `account`, `other`

---

## Acceptance Criteria

- [ ] Runs the same 5 test messages through all four strategies
- [ ] Strategies: zero-shot, few-shot (3 examples), chain-of-thought, structured output
- [ ] Prints the output for each strategy side-by-side
- [ ] For structured output: validates the response is in the correct category (not just any JSON)
- [ ] Counts how many responses per strategy are valid (correct format + valid category)
- [ ] Prints a summary table at the end

---

## Test Messages (use these exactly)

```python
TEST_MESSAGES = [
    "My invoice shows $49.99 but I was told $29.99 during signup",
    "The app crashes every time I try to upload a file larger than 10MB",
    "My order hasn't arrived and it's been 3 weeks",
    "I need to reset my password but I'm not receiving the email",
    "Do you have a student discount?",  # Edge case — could be billing or other
]
```

---

## Starter Skeleton

Save as `exercises/solution/prompt_comparison.py`:

```python
import asyncio
import json
from openai import AsyncOpenAI

client = AsyncOpenAI()
VALID_CATEGORIES = {"billing", "technical", "shipping", "account", "other"}

# ── Strategy 1: Zero-Shot ─────────────────────────────────────────────────────
ZERO_SHOT_SYSTEM = """..."""  # TODO: Write a zero-shot system prompt

async def classify_zero_shot(message: str) -> str:
    """Returns raw LLM output — no parsing."""
    # TODO: call the LLM and return response text
    pass

# ── Strategy 2: Few-Shot ──────────────────────────────────────────────────────
FEW_SHOT_SYSTEM = """..."""  # TODO: Write a system prompt with 3 examples embedded

async def classify_few_shot(message: str) -> str:
    """Returns raw LLM output."""
    # TODO
    pass

# ── Strategy 3: Chain-of-Thought ─────────────────────────────────────────────
COT_SYSTEM = """..."""  # TODO: Add CoT instruction to your system prompt

async def classify_cot(message: str) -> str:
    """Returns full CoT response — reasoning + final answer."""
    # TODO
    pass

# ── Strategy 4: Structured Output ────────────────────────────────────────────
# TODO: Import and use Pydantic

async def classify_structured(message: str) -> dict | None:
    """
    Returns a dict with 'category' key, or None if parsing failed.
    Must use response_format to enforce JSON.
    """
    # TODO
    pass

# ── Validation ────────────────────────────────────────────────────────────────
def extract_category(text: str) -> str | None:
    """
    Try to extract a valid category from free-text output.
    Check if any VALID_CATEGORIES word appears in the text (case-insensitive).
    Return the matched category or None if nothing valid found.
    """
    # TODO
    pass

# ── Runner ────────────────────────────────────────────────────────────────────
async def run_comparison():
    print(f"{'Message':<45} {'Zero-Shot':<12} {'Few-Shot':<12} {'CoT':<12} {'Structured':<12}")
    print("─" * 95)

    scores = {"zero_shot": 0, "few_shot": 0, "cot": 0, "structured": 0}

    for msg in TEST_MESSAGES:
        z = await classify_zero_shot(msg)
        f = await classify_few_shot(msg)
        c = await classify_cot(msg)
        s = await classify_structured(msg)

        z_cat = extract_category(z) or "INVALID"
        f_cat = extract_category(f) or "INVALID"
        c_cat = extract_category(c) or "INVALID"
        s_cat = s.get("category", "INVALID") if s else "INVALID"

        if z_cat in VALID_CATEGORIES: scores["zero_shot"] += 1
        if f_cat in VALID_CATEGORIES: scores["few_shot"] += 1
        if c_cat in VALID_CATEGORIES: scores["cot"] += 1
        if s_cat in VALID_CATEGORIES: scores["structured"] += 1

        print(f"{msg[:44]:<45} {z_cat:<12} {f_cat:<12} {c_cat:<12} {s_cat:<12}")

    print("\n" + "─" * 95)
    print("VALID RESPONSES (out of 5):")
    for strategy, score in scores.items():
        print(f"  {strategy:<15}: {score}/5")

if __name__ == "__main__":
    asyncio.run(run_comparison())
```

---

## The Real Challenge: Prompt Design

The Python code above is scaffolding. The real work is writing four prompts that
actually behave differently. Before writing any code, draft your prompts on paper:

**Zero-shot prompt:** Just the task description. No examples.

**Few-shot prompt:** Include 3 example input→output pairs inside the system prompt.
Pick examples that cover different categories. Think about which categories you *don't*
cover — will the model generalize?

**Chain-of-thought prompt:** Add an instruction like "Think step by step before giving
your final answer." How do you separate the reasoning from the final category label
so you can extract the answer reliably?

**Structured output prompt:** Use `response_format={"type": "json_object"}` or a
Pydantic model. Your system prompt should specify exactly what JSON format to return.

---

## What to Verify

- [ ] Zero-shot and few-shot return a single word/category (or do they write a paragraph?)
- [ ] CoT returns visible reasoning — multiple sentences before the final category
- [ ] Structured output returns parseable JSON every time (0 parsing failures across 5 messages)
- [ ] The student discount message — which strategies correctly classify it as `"other"`? Which say `"billing"`?

**Key question to answer after running:** Does few-shot perform better than zero-shot for your test messages? Why or why not?

---

## Hints

<details>
<summary>Hint 1 — Making zero-shot and few-shot return just the category</summary>

Be explicit: `"Respond with ONLY one word: billing, technical, shipping, account, or other. No explanation."`

</details>

<details>
<summary>Hint 2 — Extracting the final answer from a CoT response</summary>

Tell the model to end with a specific marker: `"End your response with: CATEGORY: [your answer]"`
Then extract with `re.search(r"CATEGORY:\s*(\w+)", text, re.IGNORECASE)`.

</details>

<details>
<summary>Hint 3 — Structured output with json_object mode</summary>

```python
response = await client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[...],
    response_format={"type": "json_object"},
    max_tokens=100,
)
data = json.loads(response.choices[0].message.content)
```

Your system prompt must tell the model what JSON to return, e.g.:
`"Return JSON with a single key 'category' set to one of: billing, technical, shipping, account, other"`

</details>
