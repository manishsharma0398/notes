# Chapter 9: AI Agents — Revision Notes

## The Core Model

- **Agent = loop**. LLM is the brain; the loop is the agent
- **LLMs do not execute tools**. They output JSON describing a tool call. Your code executes it.
- **Each loop iteration = one full API call** with the growing message history

## ReAct Pattern

```
Thought → Action → Observation → Thought → ...
```
- Thought: LLM reasons about what to do next
- Action: tool call (JSON from LLM → your code runs it)
- Observation: tool result (appended to messages as "tool" role)
- Repeat until finish_reason == "stop"

## Function Calling Wire Format

```
Request:  messages + tools=[{JSON schema}]
Response: finish_reason="tool_calls", content=null, tool_calls=[{name, args}]
Your code: run the function, append result as {"role":"tool","tool_call_id":...}
Next request: same messages + new tool result appended
Final response: finish_reason="stop", content="the actual answer"
```

## Chain vs Agent Decision Rule

| Use chain when... | Use agent when... |
|---|---|
| Steps are known at design time | Steps depend on what the input is |
| Determinism required | Dynamic tool selection needed |
| Latency is critical | Task requires iterative reasoning |

**Default to chains. Agents are a last resort.**

## Tool Design Rules

1. Description drives selection — be specific, not vague
2. Use `"Do NOT use for X"` in descriptions to prevent wrong tool use
3. Constrain parameter types and lengths (prevents hallucinated args)
4. Return structured JSON, not raw blobs
5. Keep tools idempotent where possible
6. Return helpful error strings (LLM reads them as observations)

## Production Safety Rails (Non-Negotiable)

```python
# 1. Always set max_iterations
AgentExecutor(max_iterations=10)

# 2. Always validate tool args with Pydantic before execution
validated = ArgModel(**json.loads(raw_args))

# 3. Always catch tool exceptions and return as observation
try:
    result = tool(**args)
except Exception as e:
    result = {"error": str(e)}  # LLM can reason about this

# 4. Truncate tool outputs to prevent context explosion
output = output[:500] + "..." if len(output) > 500 else output

# 5. Track token usage across the loop
```

## Production Failure Modes

| Failure | Root Cause | Fix |
|---|---|---|
| Infinite loop | LLM never decides to stop | `max_iterations` |
| Hallucinated args | LLM generates invalid argument values | Pydantic validation |
| Prompt injection | Tool fetches adversarial content | Sanitize tool output |
| Cost explosion | Context grows each iteration | Token budget + output truncation |
| Wrong tool selected | Overlapping/vague tool descriptions | Better descriptions, fewer tools |

## Cost Reality

```
5-step agent ≈ 5× the cost of a single call
10-step agent ≈ 15-20× (context grows each step)
```

## Key Numbers to Remember

- ≤7 tools per agent (beyond this, tool selection degrades)
- 10 max iterations (safe default)
- 500 chars max tool output (before truncation)

## What LLMs Cannot Do in Agents

- Guarantee they'll stop — always enforce `max_iterations`
- Execute code themselves — they output call descriptions
- Pick the right tool reliably with 10+ tools
- Maintain memory across runs — state is per-session only

## Interview Traps

- "The agent calls the tool" → **No, your code does**
- "Function calling = model execution" → **No, model outputs JSON; you execute**
- "More tools = better agent" → **Wrong; tool selection degrades with count**
- "Set temperature high for creative agents" → **Wrong; use low temp for tool-calling to get consistent JSON**
