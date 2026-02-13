# Chapter 15 Interview

## Q1: Iteration Protocols
**Q:** Explain iterable and iterator protocols.  
**A:** Iterable has `[Symbol.iterator]()` returning iterator. Iterator has `next()` returning `{value, done}`.

## Q2: Generators
**Q:** What are generators?  
**A:** Functions with `*` that use `yield` to produce values lazily.

## Q3: yield vs return
**Q:** Difference?  
**A:** `yield` pauses and resumes, `return` ends execution.

## Q4: yield*
**Q:** What does yield* do?  
**A:** Delegates to another iterable.

## Q5: Lazy Evaluation
**Q:** Why use generators?  
**A:** Lazy evaluation - compute values on demand, memory efficient.
