# Chapter 17 Notes
**Macrotasks:** setTimeout, setInterval  
**Microtasks:** Promises, queueMicrotask

**Order:** Current task → All microtasks → Render → Next macrotask

## One-Sentence
JavaScript's event loop processes microtasks (promises) with higher priority than macrotasks (setTimeout), draining the entire microtask queue after each task and before the next macrotask.
