"""
Example 3: Production-Grade Agent Loop with Pydantic Validation, Logging,
           Error Handling, and Token Budget Tracking
==========================================================================
This is how an agent should look in a real production service — not just
the happy path, but with all the safety rails you need at scale.

Run:
    pip install openai pydantic python-dotenv
    OPENAI_API_KEY=your_key python 03_production_agent.py

What this teaches:
  - Pydantic validation of tool arguments before execution (prevents hallucinated args)
  - Graceful error handling (tool errors go back to LLM as observations, not crashes)
  - Token budget tracking across the loop
  - Structured logging of every tool call and result
  - How to truncate tool outputs to prevent context explosion
"""

import json
import math
import os
import time
import logging
from dataclasses import dataclass, field
from typing import Any
from pydantic import BaseModel, Field, field_validator
from openai import OpenAI

# ─────────────────────────────────────────────────────────────
# Structured logging — every tool call and result is logged
# In production, send this to your observability stack
# ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agent")

# ─────────────────────────────────────────────────────────────
# Pydantic models for tool argument validation
# These are your defense against hallucinated arguments
# ─────────────────────────────────────────────────────────────

class CalculateArgs(BaseModel):
    expression: str = Field(..., min_length=1, max_length=200)

    @field_validator("expression")
    @classmethod
    def no_dangerous_ops(cls, v):
        # Prevent code injection through the expression field
        forbidden = ["import", "exec", "eval", "open", "os", "sys", "__"]
        if any(f in v for f in forbidden):
            raise ValueError(f"Expression contains forbidden operations")
        return v


class UnitConversionArgs(BaseModel):
    value: float = Field(..., ge=-1e9, le=1e9)  # reasonable numeric bounds
    from_unit: str = Field(..., min_length=1, max_length=20)
    to_unit: str = Field(..., min_length=1, max_length=20)


class SearchArgs(BaseModel):
    query: str = Field(..., min_length=3, max_length=100)


# ─────────────────────────────────────────────────────────────
# Token budget tracker
# ─────────────────────────────────────────────────────────────

@dataclass
class TokenBudget:
    max_tokens: int = 50_000
    used: int = 0
    api_calls: int = 0
    tool_calls: int = 0
    start_time: float = field(default_factory=time.time)

    def record_usage(self, usage):
        self.used += usage.total_tokens
        self.api_calls += 1

    def check(self):
        if self.used > self.max_tokens:
            raise RuntimeError(
                f"Token budget exceeded: used {self.used} / {self.max_tokens}. "
                f"API calls: {self.api_calls}"
            )

    def summary(self) -> str:
        elapsed = time.time() - self.start_time
        return (
            f"Tokens: {self.used:,} / {self.max_tokens:,} | "
            f"API calls: {self.api_calls} | "
            f"Tool calls: {self.tool_calls} | "
            f"Time: {elapsed:.2f}s"
        )


# ─────────────────────────────────────────────────────────────
# Actual tool implementations
# ─────────────────────────────────────────────────────────────

def _calculate(expression: str) -> dict:
    allowed = {"sqrt": math.sqrt, "round": round, "abs": abs, "pow": pow, "pi": math.pi}
    result = eval(expression, {"__builtins__": {}}, allowed)
    return {"result": result}


def _convert_units(value: float, from_unit: str, to_unit: str) -> dict:
    rates = {
        ("km", "miles"): 0.621371, ("miles", "km"): 1.60934,
        ("kg", "lbs"): 2.20462, ("lbs", "kg"): 0.453592,
        ("celsius", "fahrenheit"): lambda x: x * 9/5 + 32,
        ("fahrenheit", "celsius"): lambda x: (x - 32) * 5/9,
        ("meters", "feet"): 3.28084, ("feet", "meters"): 0.3048,
    }
    key = (from_unit.lower(), to_unit.lower())
    if key not in rates:
        raise ValueError(f"No conversion for {from_unit} → {to_unit}")
    c = rates[key]
    result = c(value) if callable(c) else value * c
    return {"result": round(result, 6), "from": f"{value} {from_unit}", "to": f"{result:.4f} {to_unit}"}


def _search(query: str) -> dict:
    # Simulated search — in production, call Tavily, SerpAPI, Bing, etc.
    # We simulate here so the example runs without external API keys
    MOCK_RESULTS = {
        "python": {"result": "Python is a high-level, general-purpose programming language created by Guido van Rossum in 1991."},
        "langchain": {"result": "LangChain is an open-source framework for building LLM-powered applications, focused on chains and agents."},
    }
    for key, val in MOCK_RESULTS.items():
        if key in query.lower():
            return val
    return {"result": f"[Simulated] No results found for: {query}. In production, this would call a real search API."}


# ─────────────────────────────────────────────────────────────
# Tool registry with Pydantic validation
# ─────────────────────────────────────────────────────────────

TOOLS: dict[str, tuple[Any, Any]] = {
    # name: (arg_model, function)
    "calculate":       (CalculateArgs,     _calculate),
    "convert_units":   (UnitConversionArgs, _convert_units),
    "search":          (SearchArgs,        _search),
}

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate a math expression. Supports: +,-,*,/,**, sqrt, abs, round, pi. For unit conversions use convert_units.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Python math expression, e.g. 'sqrt(2) * 100'", "maxLength": 200}
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "convert_units",
            "description": "Convert between units: km/miles, kg/lbs, celsius/fahrenheit, meters/feet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "value": {"type": "number"},
                    "from_unit": {"type": "string"},
                    "to_unit": {"type": "string"},
                },
                "required": ["value", "from_unit", "to_unit"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search for factual information. Use for: technology concepts, general knowledge. Do NOT use for: calculations or unit conversions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Specific search query, 3–100 characters", "maxLength": 100}
                },
                "required": ["query"],
            },
        },
    },
]

# ─────────────────────────────────────────────────────────────
# Production agent loop
# ─────────────────────────────────────────────────────────────

MAX_TOOL_OUTPUT_CHARS = 500  # truncate tool outputs to prevent context explosion

def truncate_output(text: str, max_chars: int = MAX_TOOL_OUTPUT_CHARS) -> str:
    """Prevent runaway context growth from large tool outputs."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n... [truncated, {len(text) - max_chars} chars omitted]"


def dispatch_tool(tool_call, budget: TokenBudget) -> str:
    """
    Validate args with Pydantic, run the tool, return result as JSON string.
    On error: return error as string so the LLM can reason about it.
    """
    name = tool_call.function.name
    raw_args = tool_call.function.arguments

    log.info("TOOL_CALL | tool=%s | args=%s", name, raw_args[:200])
    budget.tool_calls += 1

    # ── Unknown tool ──
    if name not in TOOLS:
        error = f"Unknown tool: '{name}'. Available: {list(TOOLS.keys())}"
        log.warning("TOOL_ERROR | %s", error)
        return json.dumps({"error": error})

    arg_model, func = TOOLS[name]

    # ── Validate arguments with Pydantic ──
    try:
        parsed_args = json.loads(raw_args)
        validated = arg_model(**parsed_args)
    except (json.JSONDecodeError, ValueError) as e:
        error = f"Invalid arguments for {name}: {e}"
        log.warning("TOOL_VALIDATION_ERROR | %s", error)
        return json.dumps({"error": error})

    # ── Execute the actual tool ──
    try:
        result = func(**validated.model_dump())
        result_str = truncate_output(json.dumps(result))
        log.info("TOOL_RESULT | tool=%s | result=%s", name, result_str[:100])
        return result_str
    except Exception as e:
        error = f"Tool '{name}' execution failed: {str(e)}"
        log.error("TOOL_EXECUTION_ERROR | %s", error)
        # Return error as string — LLM can reason about this
        return json.dumps({"error": error})


def run_production_agent(user_query: str, max_iterations: int = 10) -> str:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    budget = TokenBudget(max_tokens=20_000)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a precise calculation and research assistant. "
                "Always use tools for math and factual lookups. "
                "If a tool returns an error, acknowledge it and try an alternative approach."
            ),
        },
        {"role": "user", "content": user_query},
    ]

    log.info("AGENT_START | query=%s", user_query[:100])

    for iteration in range(max_iterations):
        # ── Check token budget before each API call ──
        budget.check()

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            max_tokens=500,  # cap output tokens per call
        )

        budget.record_usage(response.usage)
        log.info(
            "API_CALL | iteration=%d | tokens_this_call=%d | total_tokens=%d",
            iteration + 1, response.usage.total_tokens, budget.used
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        # ── Final answer ──
        if finish_reason == "stop":
            log.info("AGENT_DONE | %s", budget.summary())
            return message.content

        # ── Tool calls ──
        if finish_reason == "tool_calls":
            messages.append(message)  # append assistant message with tool_calls

            for tool_call in message.tool_calls:
                result_str = dispatch_tool(tool_call, budget)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result_str,
                })
            continue

    # Max iterations hit
    log.warning("AGENT_TIMEOUT | max_iterations=%d | %s", max_iterations, budget.summary())
    return f"Agent stopped after {max_iterations} iterations. Last budget: {budget.summary()}"


# ─────────────────────────────────────────────────────────────
# Run examples
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PRODUCTION AGENT DEMO")
    print("="*60)

    # Multi-step with validation
    result = run_production_agent(
        "What is 15% of 2500, and what is that amount in euros if 1 USD = 0.92 EUR? "
        "Also, what is the square root of the original 2500?"
    )
    print(f"\nFINAL: {result}")

    # Error handling demo — bad expression
    result = run_production_agent(
        "Calculate the result of import os; os.system('ls') in Python"
    )
    print(f"\nFINAL (security test): {result}")
