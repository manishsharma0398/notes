# Chapter 19 Notes
**GC:** Mark-and-sweep algorithm  
**Reachability:** Keep if reachable from roots

## Leaks
- Globals
- Timers
- Event listeners
- Closures

**WeakMap/WeakSet:** Don't prevent GC

## One-Sentence
JavaScript uses automatic mark-and-sweep garbage collection to reclaim memory from unreachable objects, but memory leaks can occur from forgotten references in globals, timers, event listeners, and closures, with WeakMap and WeakSet providing memory-friendly alternatives for caching.
