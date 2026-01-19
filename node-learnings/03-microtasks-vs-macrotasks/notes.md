# Revision Notes: Microtasks vs Macrotasks

## The Three Queues (Priority Order)

1. **process.nextTick** (Node.js-specific, highest priority)
2. **Microtasks** (Promise, queueMicrotask - V8/ECMAScript)
3. **Event Loop Phases** (setTimeout, I/O, setImmediate - libuv)

## Execution Model

```
Synchronous code
  ↓
nextTick queue (to completion)
  ↓
Microtask queue (to completion)
  ↓
Event Loop Phase
  ↓
nextTick queue (if any)
  ↓
Microtask queue (if any)
  ↓
Next Event Loop Phase
```

## Key Takeaways

- `process.nextTick` is **not** a microtask - it's a separate, higher-priority queue
- Microtasks (Promise, queueMicrotask) use the **same queue** and run in insertion order
- Both `nextTick` and microtasks run **to completion** before the next event loop phase
- `nextTick` recursion **starves** the event loop; `setImmediate` recursion is safe
- Microtask loops can hang the application (queue never empties)

## What Goes Where

| Operation | Queue | Priority | Runs When |
|-----------|-------|----------|-----------|
| `process.nextTick` | nextTick | Highest | Before microtasks, before phases |
| `Promise.then()` | Microtask | High | After nextTick, between phases |
| `queueMicrotask()` | Microtask | High | After nextTick, between phases |
| `setTimeout` | Event Loop (Timers) | Low | After nextTick/microtasks |
| `setImmediate` | Event Loop (Check) | Low | After nextTick/microtasks |
| I/O callbacks | Event Loop (Poll) | Low | After nextTick/microtasks |

## Critical Rules

1. **nextTick runs before microtasks** - always
2. **Both queues run to completion** - all items processed before next phase
3. **Recursive nextTick starves** - event loop phases never run
4. **Recursive microtasks hang** - event loop phases never run
5. **setImmediate recursion is safe** - yields to event loop

## Common Mistakes

- ❌ Thinking `process.nextTick` is a microtask
- ❌ Using recursive `process.nextTick` (causes starvation)
- ❌ Creating infinite Promise chains (hangs application)
- ❌ Blocking in microtasks (blocks entire event loop)
- ❌ Expecting microtasks to run after macrotasks

## Node.js vs Browser

| Aspect | Node.js | Browser |
|--------|---------|---------|
| **Microtask timing** | Between every phase | After each task |
| **setTimeout + Promise** | Promise runs first | setTimeout runs first |
| **process.nextTick** | ✅ Exists | ❌ Doesn't exist |
| **queueMicrotask** | ✅ Exists | ✅ Exists |

## Memory Aid

**N**extTick → **M**icrotasks → **E**vent Loop

**N**ever **M**iss **E**xecution

Or: **N**ode **M**icrotasks **E**xecute
