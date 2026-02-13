# Chapter 19 Interview
## Q1: GC Algorithm
**Q:** How does JavaScript GC work?  
**A:** Mark-and-sweep: mark reachable, sweep unmarked

## Q2: Leaks
**Q:** Common memory leak causes?  
**A:** Globals, timers, event listeners, closures

## Q3: WeakMap
**Q:** Why use WeakMap?  
**A:** Entries don't prevent GC of keys
