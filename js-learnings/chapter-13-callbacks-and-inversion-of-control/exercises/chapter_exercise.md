# Chapter 13 — Chapter Exercise: Callbacks and Inversion of Control

**Time:** 30–60 minutes. **Scope:** this chapter only.

Work in a scratch file. **Predict before running** — a prediction you check afterwards is worth
ten you read the answer to. Write the prediction down; the point is to be *wrong on paper*, where
it costs nothing.

A worksheet with every program and question duplicated inline, with blank `Answer:` blocks, is at
`exercises/solution/chapter_exercise_worksheet.md`.

---

## Part A — Predictions

For each: what does it print, **in what order**, and *why*. "Why" means naming the mechanism, not
describing the output.

### A1

```javascript
function A(cb) { cb(1); }
console.log("start");
A((v) => console.log("cb", v));
console.log("end");
```

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

*Both lines. And say what `forEach` did with the three promises.*

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

*How many times did the callback run, and whose fault is that?*

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

*Now: what would report this failure in production? Be exhaustive — the list is short.*

### A5

```javascript
const obj = { v: 41, get() { return this.v; } };
const run = (f) => f();
console.log(run(obj.get));
```

*Predict the value. Then predict what changes under `"use strict"`, and why the sloppy-mode
result is worse than the strict-mode one.*

### A6

```javascript
try {
  setTimeout(() => { throw new Error("boom"); }, 0);
} catch (e) {
  console.log("caught");
}
console.log("after");
```

*Where does the error end up, and what is the one-sentence reason?*

### A7

```javascript
function syncChain(n, k) { if (n === 0) return k(); syncChain(n - 1, k); }
function asyncChain(n, k) { if (n === 0) return k(); setImmediate(() => asyncChain(n - 1, k)); }
```

*Which of `syncChain(50000, f)` and `asyncChain(50000, f)` completes? Give the reason, then state
the second consequence of that same reason — the one A6 is about.*

### A8

```javascript
const p = new Promise((resolve, reject) => {
  resolve("a");
  reject(new Error("b"));
  resolve("c");
});
p.then((v) => console.log("then", v)).catch((e) => console.log("catch", e.message));
```

*Which one wins, and which callback failure mode does that behaviour exist to prevent?*

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

*Order. Then: name the defect in `readish` and the one-line fix.*

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

*Predict the printed order. Then change one thing so it always prints `1,2,3` — without changing
`fetchOne` and without using promises.*

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

*What prints? Then find the bug in `guard` that a second call to `flaky` would expose.*

### A12

```javascript
const wrapped = new Promise((resolve) => {
  (function neverCalls(cb) { return; })(resolve);
});
wrapped.then(() => console.log("settled"));
console.log("end of script");
```

*What prints, what is the process exit code, and why is that the worst possible behaviour?*

---

## Part B — True or false, **with the mechanism**

A bare true/false scores nothing. One sentence naming the mechanism.

1. A function that takes a callback runs it asynchronously.
2. `try`/`catch` cannot catch anything thrown inside any callback.
3. Flattening nested callbacks into named functions fixes callback hell.
4. The error-first convention is enforced by the runtime for Node core APIs.
5. `if (err)` without a `return` is a style issue, not a bug.
6. A promise handler never runs synchronously, even if the promise is already settled.
7. Promises made "callback called twice" impossible.
8. Promises made "callback never called" impossible.
9. `Promise.race([work, timeout])` stops `work` when the timeout wins.
10. `promisify` needs a flag to protect against an API that calls back twice.
11. An arrow function is always a safe choice for a callback.
12. Deep asynchronous recursion can overflow the stack.

---

## Part C — Build these

Plain callbacks unless a task says otherwise. No libraries. Write a test for each — a handful of
`console.assert` lines is enough.

### 1. `once(fn)`

Returns a wrapper that invokes `fn` at most once; later calls are silent no-ops. Return the first
call's return value on every subsequent call.

```javascript
function once(fn) {
  // your code
}
```

- Must be **per-wrapper**, not global (this is A11's bug).
- Must forward `this` and all arguments.
- Test: two calls → one invocation; two independent wrappers don't interfere.

### 2. `alwaysAsync(fn)`

Takes a callback-style function that might call back synchronously, and returns one that
**never** does — the Zalgo fix.

```javascript
function alwaysAsync(fn) {
  // your code: same signature, but the callback is always deferred
}
```

- Which do you defer, the whole call or just the callback? Justify it in a comment — they are not
  the same thing and only one is correct.
- `queueMicrotask` or `setTimeout`? Write one line on the difference in *when*, and note that
  Chapter 15 is where that difference gets a name.
- Test: the A9/Zalgo program must print in a stable order regardless of the cache-hit path.

### 3. `withTimeout(fn, ms)`

Callback-style. Wraps a callback API so that if it hasn't called back within `ms`, your callback
is invoked with a timeout `Error` instead.

```javascript
function withTimeout(fn, ms) {
  // your code
}
```

- The late arrival must **not** call your callback a second time. Reuse task 1.
- Clear the timer on success, or you keep the process alive for `ms`. Prove it: your test should
  exit promptly, not after the timeout.
- Write a comment on what you have *not* done — because you haven't stopped the underlying work.

### 4. `promisify(fn)`

Error-first callback API → promise-returning function.

```javascript
function promisify(fn) {
  // your code
}
```

- Must preserve `this`: `promisify(obj.method).call(obj, …)` works.
- Must forward all arguments.
- Test with `fs.readFile`, then with a deliberately double-calling API — and write down why you
  did **not** need a `settled` flag.

### 5. `parallel(tasks, cb)`

Callbacks only — this is `Promise.all` by hand, and the point is to feel what it costs.

```javascript
function parallel(tasks, cb) {
  // tasks: array of fn(cb) taking an error-first callback
  // cb: called once with (err) on first failure, or (null, resultsInInputOrder)
}
```

Must handle all five:

- results in **input** order, not completion order
- first error calls back **once**, and later errors are ignored
- an **empty** `tasks` array calls back immediately with `[]`
- a task that calls back twice must not corrupt the count
- a synchronous task must not break the counter

Then write the promise version on the next line and count the characters in each.

---

## Hints

<details>
<summary>Open only after a real attempt</summary>

- **A2** — `forEach` is synchronous and discards return values. The `await` splits each callback
  into two turns; the pushes before it all happen during the `forEach`.
- **A3** — count the invocations, not the throws. The library's `catch` is trying to be helpful.
- **A5** — sloppy-mode `this` in a plain call is `globalThis`. Nothing throws. Ask what
  `globalThis.v` is.
- **A7** — the answer to "which completes" and the answer to A6 are the same sentence read in two
  directions.
- **A10** — you need somewhere to put a result that isn't "the end of the array".
- **A11** — where does `settled` live?
- **A12** — what does the event loop consider "work"?
- **C1** — you need one closure variable per wrapper, plus somewhere to keep the first result.
- **C2** — deferring the *call* changes when the work starts; deferring the *callback* changes
  only when you're told. Only one preserves the API's semantics.
- **C3** — two things race: their callback and your timer. Exactly one may win, which is what
  `once` is for.
- **C4** — `fn.call(this, ...args, callback)` inside a `function`, not an arrow.
- **C5** — a `remaining` counter, not `results.length`; write with `results[i] = v`. Decrement
  *after* storing. Handle `tasks.length === 0` before you start the loop.

</details>

---

## What to verify

- [ ] Every A prediction written down **before** running
- [ ] For each wrong one: the mechanism named, not just the output corrected
- [ ] A4's list of things that would report a never-called callback (it should be empty)
- [ ] A5 answered for both sloppy and strict mode, with which is worse and why
- [ ] A7 stated as one reason with two consequences
- [ ] B answers each name a mechanism in one sentence
- [ ] B7 and B8 answered differently — knowing why is the point of the chapter
- [ ] `once` is per-wrapper and forwards `this`
- [ ] `alwaysAsync` has the comment justifying *what* is deferred
- [ ] `withTimeout` exits promptly and cannot double-call
- [ ] `promisify` passes with `obj.method`, and you wrote down why no `settled` flag
- [ ] `parallel` passes all five cases, including the empty array
- [ ] You can say Q1–Q7 from `mock.md`'s "Drill it" out loud, under time, without notes
