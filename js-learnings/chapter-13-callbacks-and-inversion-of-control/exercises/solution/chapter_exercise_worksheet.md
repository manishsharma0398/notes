# Chapter 13 Worksheet — Callbacks and Inversion of Control

Fill this in **before running anything**. Every program from `chapter_exercise.md` is duplicated
here so you never have to switch files.

Rules: predict first, run second, and if you were wrong, write the *mechanism* on the correction
line — not the corrected output.

---

## Part A — Predictions

### A1

```javascript
function A(cb) { cb(1); }
console.log("start");
A((v) => console.log("cb", v));
console.log("end");
```

Prediction:

```
```

Why:

Actual:

```
```

Correction (mechanism, if wrong):

---

### A2

```javascript
const out = [];
[1, 2, 3].forEach(async (n) => {
  out.push(n);
  await null;
  out.push(n * 10);
});
console.log(out.join(","));
setTimeout(() => console.log("later:", out.join(",")), 0);
```

Prediction (both lines):

```
```

What did `forEach` do with the three promises it received?

Actual:

```
```

Correction:

---

### A3

```javascript
function C(cb) {
  try { cb(); }
  catch (e) { console.log("C caught:", e.message); cb(); }
}
let n = 0;
C(() => { n++; if (n === 1) throw new Error("x"); });
console.log("n =", n);
```

Prediction:

```
```

How many times did the callback run? Whose fault:

Actual:

```
```

Correction:

---

### A4

```javascript
function D(cb) {
  if (Math.random() < 2) return;
  cb();
}
let called = false;
D(() => { called = true; });
console.log("called:", called);
```

Prediction:

```
```

Everything that would report this in production (be exhaustive):

Actual:

```
```

Correction:

---

### A5

```javascript
const obj = { v: 41, get() { return this.v; } };
const run = (f) => f();
console.log(run(obj.get));
```

Prediction (sloppy mode):

Prediction under `"use strict"`:

Which is worse, and why:

Actual:

```
```

Correction:

---

### A6

```javascript
try {
  setTimeout(() => { throw new Error("boom"); }, 0);
} catch (e) {
  console.log("caught");
}
console.log("after");
```

Prediction:

```
```

Where the error ends up, in one sentence:

Actual:

```
```

Correction:

---

### A7

```javascript
function syncChain(n, k) { if (n === 0) return k(); syncChain(n - 1, k); }
function asyncChain(n, k) { if (n === 0) return k(); setImmediate(() => asyncChain(n - 1, k)); }
```

Which of `syncChain(50000, f)` / `asyncChain(50000, f)` completes:

The reason:

The second consequence of that same reason (the one A6 is about):

Actual:

```
```

Correction:

---

### A8

```javascript
const p = new Promise((resolve, reject) => {
  resolve("a");
  reject(new Error("b"));
  resolve("c");
});
p.then((v) => console.log("then", v)).catch((e) => console.log("catch", e.message));
```

Prediction:

```
```

Which callback failure mode this prevents:

Actual:

```
```

Correction:

---

### A9

```javascript
function readish(key, cb) {
  if (key === "") return cb(new Error("empty key"));
  setTimeout(() => cb(null, `value:${key}`), 0);
}

readish("a", (err, v) => { console.log("1:", err ? err.message : v); });
readish("",  (err, v) => { console.log("2:", err ? err.message : v); });
console.log("3: sync end");
```

Prediction (order):

```
```

The defect in `readish`:

The one-line fix:

Actual:

```
```

Correction:

---

### A10

```javascript
const results = [];
function fetchOne(id, cb) { setTimeout(() => cb(null, id), 10 - id); }

[1, 2, 3].forEach((id) => {
  fetchOne(id, (err, row) => {
    results.push(row);
    if (results.length === 3) console.log(results.join(","));
  });
});
```

Prediction:

```
```

One change so it always prints `1,2,3` (no promises, no touching `fetchOne`):

```javascript
```

Actual:

```
```

Correction:

---

### A11

```javascript
let settled = false;
function guard(cb) {
  return (...args) => {
    if (settled) return;
    settled = true;
    cb(...args);
  };
}
function flaky(cb) { cb(null, "a"); cb(null, "b"); }
flaky(guard((err, v) => console.log("got", v)));
```

Prediction:

```
```

The bug a second call to `flaky` would expose:

Actual:

```
```

Correction:

---

### A12

```javascript
const wrapped = new Promise((resolve) => {
  (function neverCalls(cb) { return; })(resolve);
});
wrapped.then(() => console.log("settled"));
console.log("end of script");
```

Prediction:

```
```

Process exit code:

Why this is the worst possible behaviour:

Actual:

```
```

Correction:

---

## Part B — True or false, with the mechanism

One sentence each. A bare T/F scores nothing.

**B1.** A function that takes a callback runs it asynchronously.

Answer:

**B2.** `try`/`catch` cannot catch anything thrown inside any callback.

Answer:

**B3.** Flattening nested callbacks into named functions fixes callback hell.

Answer:

**B4.** The error-first convention is enforced by the runtime for Node core APIs.

Answer:

**B5.** `if (err)` without a `return` is a style issue, not a bug.

Answer:

**B6.** A promise handler never runs synchronously, even if the promise is already settled.

Answer:

**B7.** Promises made "callback called twice" impossible.

Answer:

**B8.** Promises made "callback never called" impossible.

Answer:

**B9.** `Promise.race([work, timeout])` stops `work` when the timeout wins.

Answer:

**B10.** `promisify` needs a flag to protect against an API that calls back twice.

Answer:

**B11.** An arrow function is always a safe choice for a callback.

Answer:

**B12.** Deep asynchronous recursion can overflow the stack.

Answer:

> B7 and B8 must have different answers. If yours match, re-read Part 7 of the README.

---

## Part C — Build these

Paste your implementation and its test output.

### 1. `once(fn)`

```javascript
function once(fn) {

}
```

Test output:

```
```

- [ ] per-wrapper, not global
- [ ] forwards `this` and all arguments
- [ ] returns the first result on later calls

---

### 2. `alwaysAsync(fn)`

```javascript
function alwaysAsync(fn) {

}
```

Did you defer the **call** or the **callback**? Why is the other wrong:

`queueMicrotask` vs `setTimeout` — the difference in *when*:

Test output:

```
```

---

### 3. `withTimeout(fn, ms)`

```javascript
function withTimeout(fn, ms) {

}
```

What this has **not** done (one sentence):

Test output:

```
```

- [ ] late arrival cannot call back a second time
- [ ] timer cleared on success — the test exits promptly

---

### 4. `promisify(fn)`

```javascript
function promisify(fn) {

}
```

Why no `settled` flag is needed:

Test output (including `fs.readFile` and a double-calling API):

```
```

- [ ] preserves `this`
- [ ] forwards all arguments

---

### 5. `parallel(tasks, cb)`

```javascript
function parallel(tasks, cb) {

}
```

The promise version, on one line:

```javascript
```

Character count — callbacks: ______  promises: ______

Test output:

```
```

- [ ] results in input order
- [ ] first error calls back once
- [ ] `parallel([])` → `[]`
- [ ] a task calling back twice doesn't corrupt the count
- [ ] a synchronous task doesn't break the counter

---

## Final checklist

- [ ] All A predictions written **before** running
- [ ] Every wrong prediction has a *mechanism* on its correction line
- [ ] A4's production-reporting list written out (and it is empty)
- [ ] A5 answered for both modes, with which is worse
- [ ] A7 stated as one reason with two consequences
- [ ] B7 and B8 answered **differently**
- [ ] All five Part C builds pass their own tests
- [ ] `mock.md` "Drill it" Q1–Q7 said out loud, under time, no notes
