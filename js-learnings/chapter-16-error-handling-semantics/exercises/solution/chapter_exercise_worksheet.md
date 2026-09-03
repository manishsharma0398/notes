# Chapter 16 Worksheet — Error Handling Semantics

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "completion replaced", "captured before finally",
"different turn, empty stack", "non-enumerable", "await re-raises", "settled, so the throw
vanishes".

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

```
A (both lines, in order):

which completion is in flight when finally runs:

rule:
```

---

### B · finally returns

```javascript
function b() {
  try { return "try"; }
  finally { return "finally"; }
}
console.log(b());
```

```
B:

what happened to the first completion:

rule:
```

---

### C · finally returns over a throw

```javascript
function c() {
  try { throw new Error("C-boom"); }
  finally { return "finally"; }
}
console.log(c());
```

```
C:

where did the Error go (caught / logged / other):

rule:
```

---

### D · the mutated variable

```javascript
function d() {
  let x = "before";
  try { return x; }
  finally { x = "after"; }
}
console.log(d());
```

```
D:

why this is NOT inconsistent with B (one sentence):
```

---

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

```
E:

which completion wins on i === 2:

rule:
```

---

### F · cleanup that throws

```javascript
function f() {
  try { throw new Error("F-original"); }
  finally { throw new Error("F-from-cleanup"); }
}
try { f(); } catch (err) { console.log(err.message); }
```

```
F:

what happened to the other error, and does it appear anywhere:

rule:
```

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

```
G (all lines that print, in order):

why the catch does not run:
```

---

### H · return vs return await

```javascript
async function boom() { throw new Error("H-boom"); }

async function h1() { try { return boom(); }       catch { return "caught"; } }
async function h2() { try { return await boom(); } catch { return "caught"; } }

h1().then(v => console.log("h1:", v), e => console.log("h1 rejected:", e.message));
h2().then(v => console.log("h2:", v), e => console.log("h2 rejected:", e.message));
```

```
H (both lines):

the rule, in one sentence:
```

---

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

```
I (what prints):

what happens to the process afterwards:

why nothing can catch it:
```

---

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

```
J as written:

J with the throw moved ABOVE the resolve:

rule:
```

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

```
line 1:

line 2:

line 3:

line 4:

the two things wrong with AppError:
```

---

### L · identity

```javascript
const vm = require("node:vm");
const foreign = vm.runInNewContext("new Error('L-foreign')");
const shaped  = Object.create(Error.prototype);

console.log(foreign instanceof Error, Object.prototype.toString.call(foreign));
console.log(shaped  instanceof Error, shaped.stack);
```

```
line 1:

line 2:

which object is a real error, and which check says so correctly:
```

---

## True / false — with the mechanism

A bare T/F scores zero. Write the rule.

```
1.  throw requires its operand to be an Error.
    T/F:        rule:

2.  A finally block always overrides the value returned from try.
    T/F:        rule:

3.  return x in try, then x = "other" in finally, returns "other".
    T/F:        rule:

4.  A break inside finally can discard a travelling exception.
    T/F:        rule:

5.  try { asyncFn(); } catch (e) {} catches a rejection from asyncFn.
    T/F:        rule:

6.  return await p inside a try is redundant; simplify to return p.
    T/F:        rule:

7.  JSON.stringify(new Error("x")) produces {"message":"x"}.
    T/F:        rule:

8.  class MyError extends Error {} sets name to "MyError".
    T/F:        rule:

9.  instanceof Error returns true for every real Error object.
    T/F:        rule:

10. unhandledRejection and uncaughtException are the same event.
    T/F:        rule:

11. A try/catch around setTimeout can catch a throw from the callback.
    T/F:        rule:

12. You can catch a syntax error in the file that contains it.
    T/F:        rule:
```

---

## Build these

### 1. `serialiseError(err)`

Contract: `Error` → `{ name, message, stack }` + recursive `cause`; non-`Error` recoverable from
the log; terminates on a `cause` cycle; keeps custom enumerable fields.

```javascript
function serialiseError(err) {
  // your code
}
```

```
how you stopped the cycle:

what a thrown null produces, and why you chose that:
```

---

### 2. `isError(value)`

Contract: `true` cross-realm; `false` for `Object.create(Error.prototype)`; `false` for a
plain lookalike.

```javascript
function isError(value) {
  // your code
}
```

```
why instanceof fails the first case:

what your check actually inspects:
```

---

### 3. `attempt(fn)` → `[error, value]`

```javascript
function attempt(fn) {
  // your code
}
```

```
your decision for async fn (reject / always promise / adopt thenable):

why you chose it:

why a finally inside fn cannot change what attempt returns:
```

---

### 4. `AppError` hierarchy

Contract: correct `name` per class; stable `code`; `cause` forwarded; useful `toJSON()`;
`instanceof` works up the chain.

```javascript
class AppError extends Error {
  // your code
}
class NotFound extends AppError {
  // your code
}
class Upstream extends AppError {
  // your code
}
```

```
JSON.stringify(new NotFound("x")) prints:

why you set name the way you did:

why code exists when instanceof already works:
```

---

## What to verify

```
[ ] every Program 1 answer names which completion won, not just the output
[ ] one sentence on why D is not inconsistent with B
[ ] F: where the original error went, and whether anything records it
[ ] G/H/I all reduce to the same one-line rule — write that rule here:

[ ] you ran Program 2 and watched what the process did AFTER the last line
[ ] every true/false has a rule, not a verdict
[ ] serialiseError survives a cause cycle and a thrown string
[ ] isError correct on all three contract cases
[ ] your attempt async decision is written down and defensible out loud
[ ] JSON.stringify(new NotFound("x")) contains the message
```
