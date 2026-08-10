"""
Example 2: LangChain Agent with Tools
======================================
Now that you understand the raw mechanics, see how LangChain wraps them.
LangChain's create_tool_calling_agent + AgentExecutor IS the same loop from
example 1 — just abstracted.

Knowing example 1 makes you able to debug this when it breaks.

Run:
    pip install langchain langchain-openai python-dotenv
    OPENAI_API_KEY=your_key python 02_langchain_agent.py

What this teaches:
  - How LangChain's @tool decorator maps to function JSON schemas
  - What AgentExecutor actually does (it's the loop from example 1)
  - How to add verbose=True to see the ReAct trace (Thought/Action/Observation)
  - Why LangChain's agent_scratchpad is just the message history in disguise
"""

import math
import os
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate

# ─────────────────────────────────────────────────────────────
# 1. Define tools using LangChain's @tool decorator
#
# The decorator:
#   - Uses the function name as the tool name
#   - Uses the docstring as the tool description (IMPORTANT — model reads this)
#   - Uses type annotations to build the JSON schema
#   This is identical to the TOOL_DEFINITIONS dict in example 1,
#   just with less boilerplate.
# ─────────────────────────────────────────────────────────────

@tool
def calculate(expression: str) -> str:
    """
    Evaluate a mathematical expression. Use for arithmetic, algebra,
    square roots, exponents, or any numeric computation.
    Do NOT use for unit conversions — use convert_units instead.
    Accepts Python-style expressions: '2**10', 'sqrt(144)', '(3+4)*2'.
    """
    try:
        allowed = {"sqrt": math.sqrt, "round": round, "abs": abs, "pow": pow}
        result = eval(expression, {"__builtins__": {}}, allowed)
        return f"{expression} = {result}"
    except Exception as e:
        return f"Error evaluating '{expression}': {e}"


@tool
def convert_units(value: float, from_unit: str, to_unit: str) -> str:
    """
    Convert a value between units.
    Supported conversions: km/miles, kg/lbs, celsius/fahrenheit.
    Example: value=100, from_unit='km', to_unit='miles'
    """
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
        return f"Unknown conversion: {from_unit} → {to_unit}"
    converter = conversions[key]
    result = converter(value) if callable(converter) else value * converter
    return f"{value} {from_unit} = {result:.4f} {to_unit}"


@tool
def get_compound_interest(principal: float, rate: float, years: int, n: int = 12) -> str:
    """
    Calculate compound interest.
    Args:
      principal: Initial investment amount in dollars
      rate: Annual interest rate as decimal (e.g. 0.05 for 5%)
      years: Number of years
      n: Compounding frequency per year (default: 12 = monthly)
    Returns the final amount and total interest earned.
    """
    amount = principal * (1 + rate / n) ** (n * years)
    interest = amount - principal
    return (
        f"Principal: ${principal:,.2f}\n"
        f"Rate: {rate*100:.1f}% per year\n"
        f"Years: {years}\n"
        f"Final amount: ${amount:,.2f}\n"
        f"Interest earned: ${interest:,.2f}"
    )


tools = [calculate, convert_units, get_compound_interest]

# ─────────────────────────────────────────────────────────────
# 2. Set up the LLM
# ─────────────────────────────────────────────────────────────

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,  # deterministic for tool-calling agents
    api_key=os.environ["OPENAI_API_KEY"],
)

# ─────────────────────────────────────────────────────────────
# 3. Build the prompt
#
# agent_scratchpad is where LangChain injects the
# intermediate tool call / tool result messages.
# This is the message history from example 1, encoded into the prompt.
# ─────────────────────────────────────────────────────────────

prompt = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a helpful financial and math assistant. "
        "Always use tools for calculations. Show your reasoning."
    )),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),  # <── tool call history injected here
])

# ─────────────────────────────────────────────────────────────
# 4. Create the agent and executor
#
# create_tool_calling_agent: binds tools to the LLM, creates the agent runnable
# AgentExecutor: IS THE LOOP from example 1
#   - It calls the LLM
#   - If finish_reason == "tool_calls": dispatches the tool, appends result
#   - Loops back until finish_reason == "stop"
#   - Enforces max_iterations (default 15 — override in production!)
# ─────────────────────────────────────────────────────────────

agent = create_tool_calling_agent(llm, tools, prompt)

executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,       # prints the ReAct trace: Thought/Action/Observation
    max_iterations=10,  # ALWAYS set this explicitly
    handle_parsing_errors=True,  # don't crash on malformed LLM output
)

# ─────────────────────────────────────────────────────────────
# 5. Run examples
# ─────────────────────────────────────────────────────────────

def run(query: str):
    print(f"\n{'='*60}")
    print(f"USER: {query}")
    print(f"{'='*60}")
    result = executor.invoke({"input": query})
    print(f"\nFINAL ANSWER: {result['output']}")


if __name__ == "__main__":
    # Example 1: Multi-step calculation
    run("What is the square root of 2048, rounded to 3 decimal places?")

    # Example 2: Chained tools — model decides order and combination
    run(
        "I want to invest $10,000 at 6% annual interest for 20 years, "
        "compounded monthly. How much will I have, and what is that in British pounds "
        "if 1 USD = 0.79 GBP? (calculate the GBP conversion yourself)"
    )

    # Example 3: Unit chain — model calls multiple tools
    run(
        "I have a 5kg bag of flour. How many pounds is that? "
        "And if I bake cookies that each need 150 grams, "
        "how many cookies can I make from the full bag?"
    )


# ─────────────────────────────────────────────────────────────
# WHAT LANGCHAIN IS ACTUALLY DOING:
# ─────────────────────────────────────────────────────────────
#
# AgentExecutor._call() runs this (simplified):
#
#   messages = [system, human_input]
#   for i in range(max_iterations):
#       output = agent.plan(messages)  # calls LLM
#       if isinstance(output, AgentFinish):
#           return output.return_values  # done
#       if isinstance(output, List[AgentAction]):
#           for action in output:
#               obs = tool_map[action.tool].run(action.tool_input)
#               messages.append(action + obs)  # append to scratchpad
#
# It's the same loop. LangChain gives you:
#   ✓ @tool decorator (less JSON boilerplate)
#   ✓ AgentExecutor (loop + max_iterations + error handling)
#   ✓ verbose output (reasoning traces for debugging)
#   ✗ Less control over exact message structure
#   ✗ More abstraction layers to debug through
#
# Rule of thumb:
#   Use raw API (example 1) when you need precise control or minimal dependencies.
#   Use LangChain (example 2) when you want rapid iteration and verbose tooling.
