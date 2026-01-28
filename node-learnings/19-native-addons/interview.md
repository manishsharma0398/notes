# Native Addons: Interview Questions (Conceptual)

## Question 1: Why Do Native Addons Exist if Node.js Is “Just JavaScript”?

**Q**: What problems do native addons solve that pure JavaScript and the standard library cannot? Why do we need them at all?

**Expected Answer (Core Points)**:
- **Access to existing native libraries**:
  - Databases (LevelDB, RocksDB), codecs (FFmpeg), crypto libraries, OS APIs
  - Reuse decades of C/C++ investment instead of rewriting everything in JS
- **Performance for CPU-bound hot paths**:
  - Some algorithms benefit from low-level control, SIMD, specialized instructions
  - JS is great, but not ideal for all workloads (e.g., tight numeric kernels)
- **Access to OS / hardware features**:
  - Device drivers, sensors, kernel interfaces not exposed via standard Node APIs
- **Better integration with non-JS ecosystems**:
  - Bindings to C/C++/Rust libraries are often the lingua franca across languages

**Key Insight**: Native addons are about **capabilities and integration**, not just “C++ is faster than JS”.

---

## Question 2: What Is Node-API (N-API) and Why Is It Important?

**Q**: Explain Node-API. What problem does it solve compared to addons that talk directly to V8 or Node internals?

**Expected Answer (Core Points)**:
- **Problem**:
  - Direct V8 / Node internal APIs are tightly coupled to specific Node versions
  - Each Node/V8 upgrade can break ABI → compiled addons must be rebuilt
  - Historically caused many production issues on Node upgrades
- **Node-API (N-API)**:
  - A **stable C ABI** layer between Node and addons
  - Hides V8 and internal implementation details behind a stable surface
  - Addons target **Node-API version** instead of Node/V8 version
- **Benefits**:
  - **Binary compatibility** across multiple Node versions
  - Easier to ship **prebuilt binaries** (fewer builds to publish)
  - Node core handles V8 churn; addons stay stable

**Key Insight**: Node-API decouples addons from V8 internals, making them **forward-compatible** across Node releases.

---

## Question 3: How Does Memory Management Differ Between JS and Native Code in an Addon?

**Q**: When a JS object wraps a native resource (e.g., a pointer to a C++ object), how do you think about memory management and lifetimes across the JS and native heaps?

**Expected Answer (Core Points)**:
- **Two separate heaps**:
  - JS heap (V8): GC-managed, objects move/compact, no explicit free
  - Native heap: Manual allocation/free, no GC
- **Wrapper pattern**:
  - JS object (wrapper) holds a reference to a native resource (pointer/handle)
  - Native resource is allocated when JS object is created
  - A **finalizer/destructor** is attached so that when JS object is GC’d:
    - Finalizer runs
    - Native resource is freed
- **Failure modes**:
  - **Leak**: Forget to free native resources in finalizer
  - **Use-after-free**: Free native resource too early, JS still calls into it
  - **Double free**: Manual free + finalizer both freeing same resource

**Key Insight**: You must design clear ownership rules: **who allocates, who frees, and when**, across both heaps.

---

## Question 4: When Would You Choose a Native Addon vs Worker Threads vs WebAssembly vs an External Service?

**Q**: You have a performance-sensitive feature. How would you choose between:
- A native addon
- Worker threads with pure JS
- WebAssembly
- An external service / sidecar (e.g., gRPC to a Rust/Go service)?

**Expected Answer (Comparison)**:

**Worker Threads (Pure JS)**:
- Use when:
  - Bottleneck is CPU-bound but can be expressed in JS
  - You want to avoid native toolchains and deployment complexity
- Pros:
  - No ABI issues, no native crashes
  - Easier to debug with JS tooling

**WebAssembly**:
- Use when:
  - You can compile C/C++/Rust to WASM
  - You want portability across environments (Node, browser)
- Pros:
  - Single binary across platforms
  - Runs inside V8 sandbox, safer than native
- Cons:
  - FFI overhead, more limited access to OS / Node internals

**Native Addon**:
- Use when:
  - You must integrate with existing native libs or OS/hardware APIs
  - You have a proven, profiling-backed CPU bottleneck
  - You are comfortable owning C/C++ code and build pipelines
- Pros:
  - Full access to OS, best possible performance envelope
- Cons:
  - Crashes can kill the process, ABI risk, complex builds

**External Service / Sidecar**:
- Use when:
  - You want isolation and language freedom
  - The component is large/complex enough to justify its own lifecycle
- Pros:
  - Separate deploys, crashes don’t take down Node process
- Cons:
  - Network/IPC overhead, operational complexity

**Key Insight**: Native addons are a **last resort** when simpler options (worker threads, WASM, sidecars) can’t meet requirements.

---

## Question 5: What Can Go Wrong When Upgrading Node.js in a Project That Uses Native Addons?

**Q**: Your service depends on multiple third-party native addons. You upgrade Node from 18 to 22 and things start failing. What kinds of failures do you expect, and how would you reason about them?

**Expected Answer (Failure Modes)**:
- **Addon fails to load**:
  - Errors like `Module did not self-register`, `NODE_MODULE_VERSION mismatch`
  - Addon compiled against different ABI than the new Node version
- **Runtime crashes**:
  - Segfaults, illegal instructions shortly after loading or during calls
  - Due to subtle ABI/layout mismatches or undefined behavior
- **Subtle behavior changes**:
  - Logic seems to work but behaves differently under new V8/Node
  - UB in native code exposed by changed optimization strategies

**Reasoning / Mitigation**:
- Check whether addons use **Node-API**:
  - If yes, ensure Node-API version is still supported by new Node
  - If no, expect to **rebuild** for the new runtime
- Ensure all addons have been:
  - Recompiled with appropriate headers
  - Tested against new Node version
- For third-party addons:
  - Check upstream for **prebuilt binaries** for the new Node
  - If missing, build from source or delay upgrade

**Key Insight**: Node upgrades become **much riskier** when you depend on native addons that don’t use Node-API.

---

## Question 6: How Would You Debug a Crash That You Suspect Comes from a Native Addon?

**Q**: Your Node process occasionally segfaults under load. Heap snapshots look clean. How do you approach debugging, assuming a native addon might be responsible?

**Expected Answer (Approach)**:
- **Reproduce under controlled conditions**:
  - Run with the same workload in staging
  - Capture core dumps (enable `ulimit -c` on Linux)
- **Use native debugging tools**:
  - `gdb` / `lldb` / WinDbg to inspect core dump
  - Look at the stack trace: which `.node` / native library is on the stack?
- **Isolate the addon**:
  - Disable or stub out suspected addon
  - Replace calls with pure JS / mock and re-run
  - If crashes disappear → strong signal
- **Build with debug symbols**:
  - Rebuild addon with `-g` / debug configuration
  - Get file/line info in stack traces
- **Stress test addon in isolation**:
  - Write small repro that calls addon functions heavily
  - Use sanitizers (ASan/UBSan) or valgrind for memory issues

**Key Insight**: Once native code is involved, you must use **systems-level debugging tools**; JS-only tools (heap snapshots, console logs) are not enough.

---

## Question 7: “What Breaks If We Remove Node-API and Let Everyone Use V8 Directly?”

**Q**: Hypothetically, if Node removed Node-API and forced everyone back to direct V8/internal APIs, what would break or become impossible from an ecosystem and ops perspective?

**Expected Answer (Conceptual “Why It Exists” Question)**:
- **Ecosystem fragmentation**:
  - Addons compiled for Node 18 wouldn’t work on Node 20, 22, etc.
  - Every major Node/V8 bump becomes a massive rebuild event
- **Upgrade friction**:
  - People delay Node upgrades because their native dependencies lag
  - Security fixes and new features roll out slower across the ecosystem
- **Operational burden**:
  - Each consumer must maintain their own build pipeline per OS/arch/Node version
  - CI matrix explodes, especially for popular libraries
- **Publisher burden**:
  - Library authors must publish many more builds (Node-version-specific)
  - More chances for broken or missing artifacts

**Key Insight**: Node-API is critical **infrastructure** for the Node ecosystem:
- It makes Node upgrades practical for users who depend on native addons
- It reduces friction for both **addon authors** and **consumers**
- Removing it would make Node much less viable for serious native-integration workloads

