# Chapter 16 — Chapter Exercise: Error Handling Semantics

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer,
name the **rule** — "completion replaced", "captured before finally", "different turn, empty
stack", "non-enumerable", "await re-raises".

Run on **Node**.

---

## Program 1 — The completion tracer

### A · plain finally

```javascript
function a() {
  try { return "try"; }
  finally { console.log("A-finally"); }
}
console.log(a());
```

*Output, in order? Which completion is in flight when `finally` runs?*

### B · finally returns

```javascript
function b() {
  try { return "try"; }
  finally { return "finally"; }
}
console.log(b());
```

*Output? What happened to the first completion?*

### C · finally returns over a throw

```javascript
function c() {
  try { throw new Error("C-boom"); }
  finally { return "finally"; }
}
console.log(c());
```

*Output? Where did the Error go — caught, logged, or somewhere else?*

### D · the mutated variable

```javascript
function d() {
  let x = "before";
  try { return x; }
  finally { x = "after"; }
}
console.log(d());
```

*Output? Explain why this is **not** inconsistent with B.*

### E · continue in finally

```javascript
function e() {
  const seen = [];
  for (const i of [1, 2, 3]) {
    try {
      if (i === 2) throw new Error("E-boom");
      seen.push(i);
    } finally {
      if (i === 2) continue;
    }
  }
  return seen;
}
console.log(e());
```

*Output? Name the completion that wins on `i === 2`.*

### F · cleanup that throws

```javascript
function f() {
  try { throw new Error("F-original"); }
  finally { throw new Error("F-from-cleanup"); }
}
try { f(); } catch (err) { console.log(err.message); }
```

*Which error reaches the caller? What happened to the other one, and does it appear anywhere?*

---

## Program 2 — The async boundary

### G · async throw

```javascript
async function boom() { throw new Error("G-boom"); }

try {
  boom();
  console.log("G1");
} catch {
  console.log("G2");
}
console.log("G3");
```

*Output? Why does the `catch` not run?*

### H · return vs return await

```javascript
async function boom() { throw new Error("H-boom"); }

async function h1() { try { return boom(); }       catch { return "caught"; } }
async function h2() { try { return await boom(); } catch { return "caught"; } }

h1().then(v => console.log("h1:", v), e => console.log("h1 rejected:", e.message));
h2().then(v => console.log("h2:", v), e => console.log("h2 rejected:", e.message));
```

*Output? State the rule in one sentence.*

### I · the scheduled throw

```javascript
try {
  setTimeout(() => { throw new Error("I-boom"); }, 0);
  console.log("I1");
} catch {
  console.log("I2");
}
console.log("I3");
```

*Output, and what happens to the process afterwards? Why can nothing catch it?*

### J · executor timing

```javascript
new Promise((resolve) => {
  resolve("J-resolved");
  throw new Error("J-thrown");
}).then(
  (v) => console.log("J fulfilled:", v),
  (e) => console.log("J rejected:", e.message),
);
```

*Output? Now move the `throw` **above** the `resolve` and predict again.*

---

## Program 3 — Error anatomy

### K · what survives serialisation

```javascript
class AppError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

const plain  = new Error("K-plain");
const custom = new AppError("K-custom", "E_K");

console.log(JSON.stringify(plain));
console.log(JSON.stringify(custom));
console.log(custom.name);
console.log(Object.keys(custom), Object.getOwnPropertyNames(custom));
```

*Predict all four lines. Two things are wrong with `AppError` — name them.*

### L · identity

```javascript
const vm = require("node:vm");
const foreign = vm.runInNewContext("new Error('L-foreign')");
const shaped  = Object.create(Error.prototype);

console.log(foreign instanceof Error, Object.prototype.toString.call(foreign));
console.log(shaped  instanceof Error, shaped.stack);
```

*Predict. Which of the two objects is a real error, and which check tells you correctly?*

---

## True / false — with the mechanism

Answer T/F **and give the rule**. A bare T/F scores zero.

1. `throw` requires its operand to be an `Error`.
2. A `finally` block always overrides the value returned from `try`.
3. `return x` in `try` followed by `x = "other"` in `finally` returns `"other"`.
4. A `break` inside `finally` can discard an exception that was travelling.
5. `try { asyncFn(); } catch (e) {}` catches a rejection from `asyncFn`.
6. `return await p` inside a `try` is redundant and should be simplified to `return p`.
7. `JSON.stringify(new Error("x"))` produces `{"message":"x"}`.
8. `class MyError extends Error {}` sets `name` to `"MyError"`.
9. `instanceof Error` returns `true` for every real `Error` object.
10. An `unhandledRejection` and an `uncaughtException` are the same event.
11. A `try`/`catch` in the function that called `setTimeout` can catch a throw from the callback.
12. You can catch a syntax error in the file that contains it.

---

## Build these

Small, self-contained, no libraries. Each has a stated contract — write to the contract, not to
whatever passes.

### 1. `serialiseError(err)`

Turn any thrown value into a plain object safe for a JSON logger.

```javascript
function serialiseError(err) {
  // TODO
}
```

**Contract**

- For an `Error`: return `{ name, message, stack }`, plus `cause` **recursively serialised** if
  present.
- For a non-`Error` (a string, a number, `null`): do not crash. Return something that makes the
  original value recoverable from a log.
- Must not recurse forever on `const a = new Error("a"); a.cause = a;`.
- Must not lose custom enumerable fields like `code`.

### 2. `isError(value)`

A check that survives a realm boundary.

```javascript
function isError(value) {
  // TODO
}
```

**Contract**

- `true` for an `Error` created in another realm (`vm.runInNewContext`).
- `false` for `Object.create(Error.prototype)`.
- `false` for `{ name: "Error", message: "x" }`.

### 3. `attempt(fn)`

Convert a throwing call into a value, so a caller can branch instead of catching.

```javascript
function attempt(fn) {
  // TODO — returns [error, value]
}
```

**Contract**

- Returns `[null, value]` on success, `[error, null]` on failure.
- Works for a sync `fn`. Decide deliberately what it does when `fn` is async, and write your
  decision down — this is the design question, not the code.
- Never lets a `finally` in `fn` change the outcome (it can't — say why in one line).

### 4. `AppError` hierarchy

```javascript
class AppError extends Error { /* TODO */ }
class NotFound extends AppError { /* TODO */ }
class Upstream extends AppError { /* TODO */ }
```

**Contract**

- Every instance has a correct `name` matching its class.
- Every instance has a stable `code` string suitable for cross-boundary branching.
- `new Upstream("gateway down", { cause: original })` keeps `cause`.
- A `toJSON()` so `JSON.stringify` on one of these is actually useful.
- `new NotFound("x") instanceof AppError` is `true`.

---

## Hints

<details>
<summary>Program 1</summary>

Track exactly one thing: **which completion is currently in flight**, and whether `finally`
produces a new one. For D, ask what `return x` puts into the completion record — the variable or
its value. For F, note that a `finally` can complete abruptly *by throwing* as well as by
returning.
</details>

<details>
<summary>Program 2</summary>

For G and H, the question is always "is there an `await` between the rejection and the `catch`?"
For I, ask what is on the stack at the moment the callback runs. For J, Chapter 14's state
machine settles the question — is the promise already settled when the `throw` happens?
</details>

<details>
<summary>Program 3</summary>

For K, `Object.keys` vs `getOwnPropertyNames` is the whole answer to line 1. For L, ask what
`instanceof` actually walks.
</details>

<details>
<summary>Build 1</summary>

The recursion guard wants a `WeakSet` of errors already seen. Non-`Error` inputs are the case
most implementations forget; decide what a thrown `null` should look like in a log before you
write the branch.
</details>

<details>
<summary>Build 3</summary>

The async decision has three defensible answers: reject async input, always return a promise, or
detect a thenable and adopt it. Pick one and justify it — an interviewer will ask which you chose
and why, not which is "right".
</details>

---

## What to verify

- [ ] Every Program 1 answer names which completion won, not just the output.
- [ ] You can state in one sentence why D is not inconsistent with B.
- [ ] For F you can say where the original error went and whether anything records it.
- [ ] Your G/H/I answers all reduce to the same one-line rule.
- [ ] You ran Program 2 and watched what the process does *after* the last line prints.
- [ ] For every true/false you wrote a rule, not a verdict.
- [ ] `serialiseError` survives a `cause` cycle and a thrown string.
- [ ] `isError` gives the right answer for all three cases in its contract.
- [ ] You wrote down your `attempt` async decision and can defend it out loud.
- [ ] `JSON.stringify(new NotFound("x"))` contains the message.
