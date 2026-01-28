# Native Addons: Revision Notes (Conceptual)

## Core Concepts

### What Native Addons Are
- **Shared libraries** (`.node` binaries) that expose native code (C/C++/Rust, etc.) to Node.js
- Loaded via `require('./addon.node')` like any other module
- Provide **JS-callable functions** that execute native code
- Used to:
  - Wrap existing native libraries
  - Implement performance-critical operations
  - Access OS / hardware features not exposed by Node core

### Node-API (N-API)
- **Stable C ABI** between Node.js and addons
- Insulates addons from V8 changes and Node internals
- Allows **prebuilt binaries** to work across multiple Node versions
- Preferred way to write addons today

### Direct V8 / Internal APIs (Legacy)
- Talk directly to **V8 C++ API** and Node internals
- Tightly coupled to specific Node/V8 versions
- Breaks frequently on Node upgrades
- Used mainly by Node core and very specialized addons

## Key Insights

### API vs ABI
- **API**: The functions/types you program against (Node-API, V8 API)
- **ABI**: Binary-level compatibility (function signatures, calling conventions, layouts)
- Node-API is designed as a **stable ABI**:
  - Node can change its internals & V8 version
  - The Node-API surface remains stable for addons

### Two Heaps, Two Lifecycles
- **JS heap (V8)**:
  - GC-managed, objects move/compact
  - No explicit `free()`; GC decides
- **Native heap (C/C++)**:
  - Manual `malloc/new` and `free/delete`
  - No GC

**Implication**: Any native resource referenced from JS must have:
- A **clear ownership model**
- A **finalizer** or equivalent to free native resources when JS objects are collected

### Execution Context
- Native functions usually execute on:
  - The **main thread** (same as JS) for synchronous APIs
  - **libuv thread pool / custom threads** for async work
- Blocking native code on the main thread **blocks the event loop** just like blocking JS

## When to Use Native Addons

### Good Reasons
- **CPU-bound hot paths**:
  - Tight numeric loops, crypto, compression, codecs
  - Algorithms where JS/V8 can't be optimized enough
- **Wrapping existing native libraries**:
  - Database engines, image/video libraries, OS APIs
- **Hardware / OS integration**:
  - Custom drivers, sensors, kernel APIs

### Poor Reasons
- “JS feels slow” without profiling
- I/O-bound workloads (DB, HTTP, disk) – native code doesn’t fix network latency
- General web API business logic

## Common Misconceptions

1. **“Native addons are always faster”**:
   - False. Many apps are I/O-bound; moving logic to C++ doesn’t help
   - JS↔native boundary and marshalling add overhead

2. **“Node will catch native crashes”**:
   - False. Segfaults and memory corruption terminate the process
   - No `try/catch` can recover

3. **“Direct V8 is the right abstraction”**:
   - False for most cases. Ties you to a specific Node/V8 version
   - Node-API is the long-term stable surface

4. **“Addons share JS memory directly”**:
   - False. JS heap is managed by GC; you see it only via handles
   - You cannot hold raw pointers into JS objects safely

## What Cannot Be Done (Safely)

1. **Assume JS objects don’t move**:
   - GC can move/compact them at any time
   - You can’t store raw addresses and reuse them later

2. **Recover from arbitrary native memory corruption**:
   - Once memory is corrupted, the process is unreliable

3. **Avoid rebuilds without Node-API**:
   - Direct V8 / internal addons generally need rebuild for new Node versions

4. **Skip proper lifetime management**:
   - Leaks, double frees, and use-after-free are common without careful design

## Failure Modes

### ABI / Version Mismatch
- **Symptom**: `Module did not self-register`, `NODE_MODULE_VERSION` mismatch, load failure
- **Cause**: Addon compiled for different Node/ABI version
- **Mitigation**:
  - Use Node-API
  - Ship prebuilt binaries per Node-API version

### Crashes (Segfaults, Illegal Instructions)
- **Symptom**: Process exits with native crash
- **Cause**: Use-after-free, buffer overruns, invalid pointers
- **Mitigation**:
  - Strict memory ownership rules
  - Tools: ASan/UBSan, valgrind, Address Sanitizer

### Memory Leaks
- **Symptom**: Process RSS grows over time, not visible in JS heap snapshots
- **Cause**: Native allocations not freed, finalizers not firing or missing
- **Mitigation**:
  - Instrument native allocations
  - Ensure all JS wrappers have finalizers that free native resources

### Event Loop Stalls from Native Code
- **Symptom**: Long pauses, high CPU, but JS stack looks fine
- **Cause**: Synchronous native code running on main thread
- **Mitigation**:
  - Offload to background threads / async work queues
  - Keep main-thread native sections short

## Best Practices (Conceptual)

1. **Prefer Node-API** over direct V8 / Node internals
2. **Design clear ownership and lifetimes** for native resources
3. **Offload heavy work** to background threads (don’t block main thread)
4. **Test across Node versions** you claim to support
5. **Use prebuilt binaries** if your audience shouldn’t need a toolchain
6. **Have a profiling story**:
   - Prove JS is the bottleneck before reaching for native
7. **Instrument and monitor**:
   - Memory, CPU, crash rates
8. **Treat addon code as security-sensitive**:
   - Code review, fuzzing, static analysis

## Key Takeaways

1. **Native addons exist to bridge JS and native code**, not as a generic “make it faster” button.
2. **Node-API is the modern, stable way** to write addons that survive Node upgrades.
3. **Memory and lifetime management are the hardest parts**: two heaps, different rules.
4. **Native crashes are process-wide**: one bug can take down your entire Node service.
5. **Always consider alternatives** (pure JS, worker threads, WASM, sidecar services) before committing to native addons.

