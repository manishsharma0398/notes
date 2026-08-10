"""
Example 1: Raw OpenAI Function Calling — Wire-Level Agent Loop
==============================================================
This shows exactly what goes over the wire when using function calling.
No abstractions. No LangChain. Just the OpenAI API and your own loop.

Run:
    pip install openai python-dotenv
    OPENAI_API_KEY=your_key python 01_raw_function_calling.py

What this teaches:
  - The exact JSON structure sent to and received from the API
  - How finish_reason drives the loop
  - How tool results are appended back to the message history
  - That the model NEVER executes tools — your code does
"""

import json
import math
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ─────────────────────────────────────────────────────────────
# 1. Define your actual Python functions (the real tools)
# ─────────────────────────────────────────────────────────────

def calculate(expression: str) -> dict:
    """
    Safely evaluate a math expression.
    Supports: +, -, *, /, **, sqrt, round
    """
    try:
        # Restrict to safe math operations
        allowed = {"sqrt": math.sqrt, "round": round, "abs": abs, "pow": pow}
        result = eval(expression, {"__builtins__": {}}, allowed)
        return {"result": result, "expression": expression}
    except Exception as e:
        return {"error": str(e), "expression": expression}


def get_unit_conversion(value: float, from_unit: str, to_unit: str) -> dict:
    """Convert between common units."""
    conversions = {
        ("km", "miles"): 0.621371,
        ("miles", "km"): 1.60934,
        ("kg", "lbs"): 2.20462,
        ("lbs", "kg"): 0.453592,
        ("celsius", "fahrenheit"): lambda x: x * 9/5 + 32,
        ("fahrenheit", "celsius"): lambda x: (x - 32) * 5/9,
    }
    key = (from_unit.lower(), to_unit.lower())
    if key not in conversions:
        return {"error": f"Unknown conversion: {from_unit} to {to_unit}"}
    converter = conversions[key]
    result = converter(value) if callable(converter) else value * converter
    return {"result": round(result, 4), "from": f"{value} {from_unit}", "to": f"{result:.4f} {to_unit}"}


# ─────────────────────────────────────────────────────────────
# 2. Define tool schemas (what you send to the API)
# ─────────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": (
                "Evaluate a mathematical expression. Use for arithmetic, algebra, "
                "square roots, or any numeric computation. "
                "Do NOT use for unit conversions — use get_unit_conversion instead."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "A Python-evaluable math expression, e.g. '2 ** 10' or 'sqrt(144)'",
                    }
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_unit_conversion",
            "description": (
                "Convert a value from one unit to another. "
                "Supports: km/miles, kg/lbs, celsius/fahrenheit."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "value": {"type": "number", "description": "The numeric value to convert"},
                    "from_unit": {"type": "string", "description": "Source unit (e.g. 'km', 'kg', 'celsius')"},
                    "to_unit": {"type": "string", "description": "Target unit (e.g. 'miles', 'lbs', 'fahrenheit')"},
                },
                "required": ["value", "from_unit", "to_unit"],
            },
        },
    },
]

# ─────────────────────────────────────────────────────────────
# 3. Dispatch: route tool calls to actual Python functions
# ─────────────────────────────────────────────────────────────

TOOL_MAP = {
    "calculate": calculate,
    "get_unit_conversion": get_unit_conversion,
}


def dispatch_tool_call(tool_call) -> str:
    """
    Parse a tool call from the LLM, run the real function, return result as string.
    In production: add Pydantic validation here before calling the function.
    """
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    print(f"\n  [TOOL CALL] {name}({args})")

    if name not in TOOL_MAP:
        result = {"error": f"Unknown tool: {name}"}
    else:
        try:
            result = TOOL_MAP[name](**args)
        except TypeError as e:
            result = {"error": f"Invalid arguments: {e}"}

    print(f"  [TOOL RESULT] {result}")
    return json.dumps(result)


# ─────────────────────────────────────────────────────────────
# 4. The agent loop — the core of every agent
# ─────────────────────────────────────────────────────────────

def run_agent(user_query: str, max_iterations: int = 10) -> str:
    """
    The agent loop. Runs until the LLM says stop or max_iterations is hit.

    Key observations:
    - messages grows with every iteration (full context re-sent each time)
    - Each iteration = one API call
    - finish_reason drives control flow ("tool_calls" vs "stop")
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful calculation assistant. "
                "Use tools to perform calculations and unit conversions. "
                "Always use tools for math — do not compute in your head."
            ),
        },
        {"role": "user", "content": user_query},
    ]

    print(f"\n{'='*60}")
    print(f"USER: {user_query}")
    print(f"{'='*60}")

    for iteration in range(max_iterations):
        print(f"\n[Iteration {iteration + 1}] Calling LLM with {len(messages)} messages...")

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",   # let the model decide: call a tool or respond directly
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        print(f"  finish_reason: {finish_reason}")

        # ── Case 1: Model is done — produce final answer ──
        if finish_reason == "stop":
            print(f"\nASSISTANT: {message.content}")
            return message.content

        # ── Case 2: Model wants to call tools ──
        if finish_reason == "tool_calls":
            # Append the assistant message (with tool_calls) to history
            # IMPORTANT: you must append this even though content is None
            messages.append(message)

            # Execute each tool call and append results
            for tool_call in message.tool_calls:
                result_str = dispatch_tool_call(tool_call)

                # Append the tool result as a "tool" role message
                # The tool_call_id links this result to the specific call
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result_str,
                })

            # Loop back — LLM will now see the tool results and decide next step
            continue

    # Fallback if max iterations hit
    return "Agent exceeded maximum iterations without producing an answer."


# ─────────────────────────────────────────────────────────────
# 5. Run examples
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Example 1: Single tool call
    run_agent("What is 2 to the power of 16?")

    # Example 2: Multi-step — model decides to call multiple tools
    run_agent(
        "If I run a 10km race, how many miles is that? "
        "And if my time was 45 minutes, what was my pace in miles per minute?"
    )

    # Example 3: Model handles the final answer itself without a tool
    run_agent("What is the capital of France?")


# ─────────────────────────────────────────────────────────────
# WHAT IS ACTUALLY HAPPENING (read this):
# ─────────────────────────────────────────────────────────────
#
# 1. You send: system_prompt + user_query + tool_definitions (JSON schemas)
# 2. If the model wants a tool: finish_reason="tool_calls", content=None
#    The model outputs JSON like: {"name": "calculate", "arguments": "{\"expression\": \"2**16\"}"}
# 3. YOUR code runs calculate("2**16") → 65536
# 4. You append both the assistant message AND the tool result to messages
# 5. You call the API again with the full updated message history
# 6. The model sees the result, decides if it needs more tools or can answer
# 7. If finish_reason="stop": you're done. Return message.content.
#
# Engineering tradeoffs:
# - Every iteration costs an API call (latency + money)
# - messages grows each iteration → token count grows → cost grows
# - The model may not always choose the right tool — descriptions matter
# - max_iterations is your safety net against runaway loops
