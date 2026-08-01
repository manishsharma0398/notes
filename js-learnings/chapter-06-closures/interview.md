# Chapter 6 — Closures: Interview Questions

## Core Concept Questions

### Q1: What is a closure? Give a precise definition.

**What interviewers want to hear:**
> A closure is a function that retains a live reference to the lexical environment (Environment Record) in which it was created. This reference persists even after the outer function has returned and its Execution Context has been popped from the call stack. Any variables in that captured environment remain in memory and are accessible (and mutable) through the closure.

**What most candidates say (insufficient):**
> "A closure is when a function remembers variables from its outer scope."
(True, but explains nothing about mechanism, memory, or mutability.)

**Follow-up:** "Is a top-level function a closure?"
> Yes. Every function closes over its surrounding environment. The distinction matters when the closed-over environment is a *function's* ER — one that would otherwise be garbage collected.

---

### Q2: What is the difference between capturing a value and capturing a variable?

**Answer:**
JavaScript closures capture the *variable binding in the ER* — not the value at the time of creation. The value is read from the ER at **call time**, not at **creation time**.

```javascript
function make() {
  let x = 1;
  const fn = () => x; // captures the ER, not the value 1
  x = 99;
  return fn;
}

make()(); // 99 — reads x at call time, not when fn was created
```

**Why it matters:** This is the root cause of the classic loop bug with `var`.

---

### Q3: Explain the `var` loop bug and two ways to fix it.

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 3, 3, 3
```

**Root cause:** `var` is function-scoped — there is one `i` binding in the enclosing ER. All three closures reference the same `i`. By the time the callbacks fire, the loop is done and `i = 3`.

**Fix 1 — `let` (creates a fresh binding per iteration):**
```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

**Fix 2 — IIFE (creates a new ER per iteration):**
```javascript
for (var i = 0; i < 3; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 0); // 0, 1, 2
  })(i);
}
```

---

### Q4: "Why does JavaScript behave this way?" — Why do closures capture references, not values?

**Answer:**
Closures are not a design decision in isolation — they are a consequence of how lexical scoping and the scope chain work in JavaScript. The scope chain is built from *references* to Environment Records (via `[[OuterEnv]]`). There is no mechanism to "snapshot" a variable value at function creation time — the function simply holds a pointer to the ER. This design makes closures naturally reactive (mutations are visible) and enables shared mutable state between closures. Snapshotting would require a fundamentally different memory model.

---

### Q5: Can closures cause memory leaks? When and how?

**Answer:**
Yes. A closure prevents GC of the entire ER it closes over, not just the specific variables it references. If an ER holds large data and a closure references only a small piece of it, the large data stays in memory.

```javascript
function load() {
  const bigData = new Array(1_000_000).fill("x"); // 8+ MB

  return function getId() {
    return bigData[0]; // references bigData → entire ER stays alive
  };
}

const getId = load();
// bigData is now in memory for the lifetime of `getId`
```

**Fix:** Nullify the large reference inside the function before returning:
```javascript
function load() {
  const bigData = new Array(1_000_000).fill("x");
  const id = bigData[0]; // extract only what's needed
  // bigData = null; // optional — explicitly release
  return function getId() { return id; }; // id is a primitive, cheap
}
```

---

### Q6: What breaks if closures captured values instead of variable references?

**Answer:**
1. Shared mutable state between closures (the counter, module pattern) would be impossible — each closure would have its own frozen snapshot, and `setLow(5)` would not affect `check(7)`.
2. Closures would have to be defined *after* all variables are assigned, since creation-time snapshots would miss any later updates.
3. The module pattern's private state model collapses — each method would see state frozen at module creation time.

---

### Q7: Predict the output — closure + async trap

```javascript
const funcs = [];

for (let i = 0; i < 3; i++) {
  funcs.push(function() { return i; });
}

console.log(funcs[0]()); // ?
console.log(funcs[1]()); // ?
console.log(funcs[2]()); // ?
```

**Answer:** `0`, `1`, `2`

`let` creates a fresh `i` binding per iteration. Each pushed function closes over its own ER.

---

### Q8: What is the relationship between closures and the module pattern?

**Answer:**
The module pattern is an application of closures to achieve information hiding. An IIFE creates an ER with private bindings. The returned object exposes methods that close over that ER. From outside, the private bindings are completely inaccessible — you can only interact with them through the exposed interface.

This predates ES Modules and was the standard way to write encapsulated JavaScript before `import`/`export`.

---

### Q9: Trap question — does this create a closure?

```javascript
function outer() {
  const x = 1;
  function inner() {
    return 42; // doesn't reference x
  }
  return inner;
}
```

**Answer:** Yes, `inner` is still a closure. Its `[[Environment]]` points to `outer`'s ER. Whether the ER actually stays in memory depends on the JS engine's optimization — modern engines may GC unreferenced bindings within an ER. But structurally, `inner` is a closure.

---

### Q10: Trap question — what does this print and why?

```javascript
function makeAdder(x) {
  return function(y) {
    return x + y;
  };
}

const add5 = makeAdder(5);
const add10 = makeAdder(10);

console.log(add5(3));   // ?
console.log(add10(3));  // ?
console.log(add5(3));   // ?
```

**Answer:** `8`, `13`, `8`

Each call to `makeAdder` creates an independent ER with its own `x`. `add5` and `add10` close over separate ERs. They do not share state. Repeated calls to `add5` always see `x = 5`.
