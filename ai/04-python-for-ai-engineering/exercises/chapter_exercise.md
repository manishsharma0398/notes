# Chapter 4 Exercise — Python for AI Engineering

**Scope:** Pydantic output parsing · async/await · FastAPI patterns  
**Estimated time:** 30–60 minutes  
**Rules:** Write all code yourself. Do not use AI to generate the solution.

---

## Problem: Text Classification Microservice

You will build a small FastAPI service that accepts a list of customer support tickets
and classifies each one by urgency level using an LLM.

### Background

A support team receives free-text tickets. You need to:
1. Expose a REST endpoint that accepts up to 20 ticket texts
2. Call an LLM to classify each ticket concurrently (not sequentially)
3. Return structured, typed results with validation

---

## Acceptance Criteria

- [ ] `POST /classify` accepts a JSON body with up to 20 ticket strings
- [ ] All LLM calls are made **concurrently** (not one at a time)
- [ ] Concurrency is **bounded** (max 5 simultaneous LLM calls)
- [ ] LLM output is validated with a Pydantic model before returning
- [ ] If a single ticket's LLM call fails, the other results are still returned
- [ ] The endpoint returns a structured response with per-ticket results
- [ ] Malformed LLM JSON output is handled gracefully (not a 500 crash)
- [ ] The OpenAI client is a singleton (not re-created per request)

---

## Data Contracts

Define these Pydantic models yourself — the field names and types are up to you,
but the response must include at least:

**Request:**
- A list of ticket strings (1–20 items)

**Per-ticket result:**
- The original ticket text
- An urgency level: one of `"low"`, `"medium"`, `"high"`, `"critical"`
- A one-sentence reason for the classification
- A confidence score between 0.0 and 1.0
- A `success: bool` flag (False if the LLM call or parsing failed)
- An optional `error: str` if `success` is False

**Response:**
- A list of per-ticket results
- Total tickets processed
- Count of successes and failures
- Total wall-clock time in milliseconds

---

## Starter Skeleton

Save this as `exercises/solution/service.py` and fill in the `# TODO` sections:

```python
import asyncio
import json
import re
import time
from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, Depends
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

app = FastAPI(title="Ticket Classifier")


# TODO: Define your Pydantic models here
# TicketInput, TicketResult, ClassifyRequest, ClassifyResponse
# ...


# TODO: Implement the singleton client using @lru_cache
def get_client() -> AsyncOpenAI:
    pass


# TODO: Write the system prompt for ticket classification
SYSTEM_PROMPT = """..."""


# TODO: Implement classify_single_ticket()
# It should:
#   - Call the LLM with the ticket text
#   - Parse and validate the response with Pydantic
#   - Return a TicketResult with success=True on success
#   - Return a TicketResult with success=False and error message on any failure
#   - NEVER raise an exception — all errors must be caught
async def classify_single_ticket(
    ticket: str,
    semaphore: asyncio.Semaphore,
    client: AsyncOpenAI,
) -> "TicketResult":
    pass


# TODO: Implement the /classify endpoint
# It should:
#   - Create a semaphore with max 5 concurrent LLM calls
#   - Run all ticket classifications concurrently using asyncio.gather
#   - Measure total wall-clock time
#   - Return a ClassifyResponse
@app.post("/classify")  # add response_model=
async def classify_tickets(
    request: "ClassifyRequest",
    client: AsyncOpenAI = Depends(get_client),
):
    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## What to Verify (Self-Assessment Checklist)

Run your service with `uvicorn solution.service:app --reload` and test each:

```bash
# Test 1: Basic classification
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"tickets": [
    "My account is locked and I have a board presentation in 30 minutes",
    "How do I change my profile picture?",
    "The entire payment system is down across all regions"
  ]}'

# Expected: 3 results with different urgency levels
```

- [ ] Does `critical` get assigned to the system-wide outage ticket?
- [ ] Does the response include `total_ms` (wall-clock time)?
- [ ] Does `total_ms` prove the calls ran concurrently? (should be ~1 LLM call's time, not 3×)
- [ ] Try sending 1 ticket — does it still work?
- [ ] Try sending 21 tickets — does FastAPI return a 422 validation error?

```bash
# Test 2: Failure resilience
# Temporarily set OPENAI_API_KEY to an invalid value and test one ticket
# Expected: success=False, error message present, no 500 crash
```

- [ ] Does a bad API key return a result with `success=False` instead of crashing?

```bash
# Test 3: Verify concurrency
# Send 10 tickets and check total_ms
# Expected: total_ms ≈ single call latency (~2-4s), not 10× that
```

- [ ] Does the total time prove concurrent execution?

---

## Hints

<details>
<summary>Hint 1 — Structuring the LLM output prompt</summary>

Tell the model explicitly what JSON schema to follow. Include an example in the prompt.
Use `temperature=0.0` for deterministic classification.

</details>

<details>
<summary>Hint 2 — Handling malformed JSON from the LLM</summary>

Models sometimes wrap JSON in markdown fences. Write a `strip_fences(text)` helper
that uses `re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)` before calling
`json.loads()`. Catch `json.JSONDecodeError` and `ValidationError` separately.

</details>

<details>
<summary>Hint 3 — Semaphore placement</summary>

Create the `asyncio.Semaphore(5)` in the endpoint handler (once per request),
then pass it into each `classify_single_ticket()` call. Use `async with semaphore:`
inside the function body.

</details>

<details>
<summary>Hint 4 — Measuring wall-clock time</summary>

```python
start = time.perf_counter()
results = await asyncio.gather(...)
total_ms = round((time.perf_counter() - start) * 1000, 2)
```

</details>

<details>
<summary>Hint 5 — Enforcing max 20 tickets in Pydantic</summary>

```python
tickets: list[str] = Field(min_length=1, max_length=20)
```

</details>
