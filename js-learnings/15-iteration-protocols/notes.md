# Chapter 15 Notes

## Iteration Protocol

**Iterable:** Has `[Symbol.iterator]()` method  
**Iterator:** Has `next()` returning `{value, done}`

## Generators

`function*` creates generator that yields values lazily.

```javascript
function* gen() { yield 1; yield 2; }
```

## Key Concepts

- `yield` pauses execution
- `yield*` delegates to iterable
- Generators are lazy (on-demand)
- Work with for...of, spread, destructuring

## One-Sentence Summary

JavaScript's iteration protocols define how objects become iterable via `Symbol.iterator` returning an iterator with a `next()` method, with generator functions providing syntactic sugar using `function*` and `yield` for creating iterators that produce values lazily.
