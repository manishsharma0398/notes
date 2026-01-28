# Revision Notes: Event Loop Phases

## Event Loop Phases (Order)

1. **Timers**: `setTimeout`, `setInterval`
2. **Pending Callbacks**: Deferred I/O callbacks (rare)
3. **Idle/Prepare**: Internal libuv use
4. **Poll**: Most I/O callbacks, can block
5. **Check**: `setImmediate`
6. **Close**: Close event callbacks

## Priority Order (Highest to Lowest)

1. **process.nextTick** (runs before microtasks, between phases)
2. **Microtasks** (Promise, queueMicrotask) - between every phase
3. **Event Loop Phases** (Timers → Pending → Idle → Poll → Check → Close)

## Key Takeaways

- Event loop has 6 distinct phases, each with specific purposes
- Microtasks run **between every phase**
- `setTimeout` → Timers phase, `setImmediate` → Check phase
- Poll phase is where most I/O happens and where Node.js blocks
- Inside I/O callbacks, `setImmediate` runs before `setTimeout`
- `process.nextTick` has highest priority (runs before microtasks)

## Phase Details

| Phase | Processes | Key Characteristics |
|-------|-----------|---------------------|
| **Timers** | `setTimeout`, `setInterval` | Min-heap by expiration time |
| **Pending** | Deferred I/O errors | Rare, exceptional cases |
| **Idle/Prepare** | Internal libuv | Not accessible from JS |
| **Poll** | Most I/O callbacks | Can block, waits for I/O |
| **Check** | `setImmediate` | Runs after Poll |
| **Close** | Close events | Cleanup callbacks |

## Critical Rules

1. **Microtasks run between every phase**
2. **Poll phase blocks** waiting for I/O (or until next timer)
3. **Timers execute by expiration time**, not insertion order
4. **setImmediate vs setTimeout**:
   - Main module: Non-deterministic
   - Inside I/O callback: `setImmediate` always first
5. **Phases run in order**, but empty phases are skipped quickly

## Common Mistakes

- ❌ Assuming `setTimeout(fn, 0)` runs immediately
- ❌ Thinking `setTimeout` and `setImmediate` are the same
- ❌ Not understanding Poll phase blocking behavior
- ❌ Expecting exact timer precision
- ❌ Confusing phase order in I/O callbacks

## Memory Aid

**T**imers → **P**ending → **I**dle → **P**oll → **C**heck → **C**lose

**T**he **P**oll **I**s **P**robably **C**ritical **C**oncept
