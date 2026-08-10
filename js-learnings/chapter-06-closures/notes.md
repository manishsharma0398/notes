# Chapter 6 — Closures: Revision Notes

## Definition
A closure = a **function** + a **live reference to its birth environment (ER)**.
Not a value copy. A live reference. Mutations are visible through the closure.

---

## Why ERs Survive
- Every function stores `[[Environment]]` → pointer to the ER where it was **defined**
- As long as the function object is reachable, its `[[Environment]]` pointer keeps the ER alive
- GC cannot collect an ER that has at least one live reference

---

## Key Behaviours

### Live Reference, Not Snapshot
```javascript
function make() {
  let x = 1;
  const get = () => x;
  const set = (v) => { x = v; };
  return { get, set };
}
const m = make();
m.set(99);
m.get(); // 99 — not 1, because get reads the live ER
```

### Shared ER
Multiple closures from the same function share **one** ER:
```javascript
// setLow and check share the same ER — mutations from one are visible in the other
```

### Loop Bug
```javascript
// var → one shared binding → all closures see final value
for (var i = 0; i < 3; i++) { setTimeout(() => console.log(i), 0); }
// → 3, 3, 3

// let → fresh binding per iteration → each closure has its own i
for (let i = 0; i < 3; i++) { setTimeout(() => console.log(i), 0); }
// → 0, 1, 2
```

---

## Priority Rules (nothing new — same scope chain from Chapter 3)
1. Arrow functions close over `this` AND variables — no own `this`, but still a closure
2. Closures read/write at **call time**, not at **creation time**
3. TDZ applies at call time — a closed-over `let`/`const` is in TDZ until its declaration line runs

---

## Memory
- Closures keep **entire ERs** alive, not just referenced variables
- Some engines optimize away unreferenced bindings — don't rely on this
- To release large data: `bigData = null` inside the function before returning the closure

---

## Common Patterns

| Pattern | What it does |
|---|---|
| Factory function | Each call = fresh ER = independent state per returned function |
| Module pattern (IIFE) | Private state — one ER, methods expose only what's needed |
| Memoization | `cache` lives in closure's ER, persists across calls |
| Partial application | `bind` is syntactic sugar for a closure that pre-fills arguments |

---

## Interview Quick-Fire

- **"What is a closure?"** → Function + live reference to its lexical environment (ER)
- **"Are all functions closures?"** → Yes. Even top-level ones close over the global ER
- **"Why does the loop bug happen with `var`?"** → `var` is function-scoped — one binding shared by all closures
- **"Does the closure capture the value or the variable?"** → The variable (live reference to ER)
- **"Can a closure outlive its outer function?"** → Yes — that's the entire point of the ER survival mechanism
