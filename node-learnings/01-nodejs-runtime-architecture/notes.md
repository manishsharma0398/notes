# Revision Notes: Node.js Runtime Architecture

## Architecture Layers

- **V8**: JavaScript execution, microtask queue, call stack
- **libuv**: Event loop, I/O operations, timer heap
- **C++ Bindings**: Bridge between JavaScript and native code

## Execution Order (Priority)

1. **Synchronous code** (call stack)
2. **process.nextTick** (Node.js-specific, highest priority)
3. **Microtasks** (Promise, queueMicrotask)
4. **Event loop phases** (Timers → Pending → Poll → Check → Close)
5. **Between each phase**: Microtasks run again

## Key Takeaways

- Node.js = V8 (JS) + libuv (I/O) + C++ bindings (bridge)
- Event loop is in libuv, not V8
- Microtasks (Promises) run between event loop phases
- Timers are scheduled in libuv's timer heap
- Blocking the call stack blocks the entire event loop

## What Goes Where

| Operation | Destination | When It Runs |
|-----------|-------------|--------------|
| `setTimeout` | libuv timer heap | Timer phase |
| `setImmediate` | libuv check queue | Check phase |
| `Promise.then()` | V8 microtask queue | Between phases |
| `process.nextTick` | Node.js nextTick queue | Before microtasks |
| `fs.readFile` | libuv thread pool → pending | Pending phase |
| Synchronous code | V8 call stack | Immediately |

## Critical Rules

1. **Call stack must empty** before event loop processes anything
2. **Microtasks run** between every event loop phase
3. **nextTick runs** before microtasks and between phases
4. **Blocking call stack** = event loop starvation
5. **Thread pool** (default 4) handles file I/O, DNS, crypto

## Common Mistakes

- ❌ Assuming `setTimeout(fn, 0)` runs immediately
- ❌ Thinking Promises and timers are equivalent
- ❌ Saying "Node.js is single-threaded" without qualification
- ❌ Blocking operations in main thread
- ❌ Recursive `process.nextTick` causing starvation

## Memory Aid

**S**ynchronous → **N**extTick → **M**icrotasks → **E**vent Loop

**S**tart → **N**ext → **M**icro → **E**vent
