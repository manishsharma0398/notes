# Chapter 13 Worksheet — Promises as a Language Feature

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. Predict **before** running.

For every answer, name the **mechanism** — "the executor is synchronous", "settled once",
"adopted the thenable", "pass-through handler", "the work started at the call".

---

## Program 1 — Output Tracer

### A · the executor is synchronous

```javascript
"use strict";

console.log("A1");
const p = new Promise((resolve) => {
  console.log("A2");
  resolve("A3");
});
p.then((v) => console.log(v));
console.log("A4");
```

```
A (all four lines, in order):

mechanism:

which line is scheduled rather than executed:
```

---

### B · settling is once and permanent

```javascript
"use strict";

new Promise((resolve, reject) => {
  resolve("a");
  reject(new Error("b"));
  resolve("c");
}).then(
  (v) => console.log("B fulfilled:", v),
  (e) => console.log("B rejected:", e.message),
);
```

```
B:

mechanism:

what would happen if the executor threw AFTER resolve("a"):
```

---

### C · chain vs branch

```javascript
"use strict";

const base = Promise.resolve(1);
base.then((v) => v + 1).then((v) => console.log("C chain:", v));
base.then((v) => v + 1);
base.then((v) => console.log("C branch:", v));
```

```
C chain:
C branch:

what value does each handler RECEIVE, and why:
```

---

### D · the forgotten return

```javascript
"use strict";

Promise.resolve("user")
  .then((u) => { Promise.resolve(u + "-orders"); })
  .then((o) => console.log("D:", o));
```

```
D:

mechanism:

how many bugs are in this snippet, not one:
```

---

### E · a handler that isn't a function

```javascript
"use strict";

Promise.resolve("kept")
  .then(null)
  .then("not a function")
  .then((v) => console.log("E:", v));
```

```
E:

mechanism:

why does this make a typo'd handler name dangerous:
```

---

### F · catch recovers

```javascript
"use strict";

Promise.reject(new Error("boom"))
  .catch(() => "recovered")
  .then((v) => console.log("F:", v))
  .catch(() => console.log("F: never"));
```

```
F:

why the second .catch never runs:

how would you handle the error AND keep the chain failing:
```

---

### G · `.then(f, g)` vs `.then(f).catch(g)`

```javascript
"use strict";

Promise.resolve("ok")
  .then(
    () => { throw new Error("G-error"); },
    (e) => console.log("G: first"),
  )
  .catch((e) => console.log("G: second", e.message));
```

```
G:

mechanism (what is the relationship between f and g):
```

---

### H · `finally`

```javascript
"use strict";

Promise.resolve("H-value").finally(() => "H-ignored").then((v) => console.log("H:", v));
Promise.resolve("x").finally(() => { throw new Error("H-thrown"); }).catch((e) => console.log("H2:", e.message));
```

```
H:
H2:

mechanism:

what arguments does a finally handler receive:
```

---

### I · thenables are duck-typed

```javascript
"use strict";

Promise.resolve({ id: 1, then(resolve) { resolve("adopted"); } }).then((v) => console.log("I:", v));
Promise.resolve({ id: 2, then: 42 }).then((v) => console.log("I2:", v.id));
```

```
I:
I2:

what exactly makes something a thenable:

name a real-world object this would silently break:
```

---

### J · async functions never throw synchronously

```javascript
"use strict";

async function boom() { throw new Error("J-boom"); }

try {
  boom();
  console.log("J: the line after the call");
} catch (e) {
  console.log("J: caught", e.message);
}
```

```
J (which line prints):

J2 — now RUN it in Node. What ELSE happens, and why:

J3 — the fix:
```

---

### K · await always yields

```javascript
"use strict";

(async () => {
  const v = await 42;                                   // not a promise
  console.log("K:", v);
  const r = await Promise.resolve(1).then((n) => n + 1);
  console.log("K2:", r);
})();
console.log("K3: sync");
```

```
K:
K2:
K3:

the order, and why:

does `await 42` cost anything:
```

---

### L · what makes work concurrent

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

(async () => {
  const t = Date.now();
  const a = delay(100, "a");
  const b = delay(100, "b");
  await a;
  await b;
  console.log("L: ~" + (Date.now() - t) + "ms");
})();
```

```
L (~ms):

there are two awaits — why isn't it 200ms:
```

**C and L are the pair.** One is about *where the handler is attached*, the other about *when
the function was called*.

```
which is which:
```

---

### M · empty input

```javascript
"use strict";

Promise.all([]).then((v) => console.log("M1:", v));
Promise.any([]).catch((e) => console.log("M2:", e.constructor.name));
Promise.race([]).then(() => console.log("M3: settled"));
setTimeout(() => console.log("M3 check: did it settle?"), 200);
```

```
M1:
M2:
M3:

which of these hangs a "wait until the queue is empty" path:
```

---

### N · `Promise.all` ordering

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
Promise.all([delay(30, "x"), delay(10, "y")]).then((v) => console.log("N:", v));
```

```
N:

which order, and why:
```

---

### O · resolve identity

```javascript
"use strict";

const po = Promise.resolve(1);
console.log("O1:", Promise.resolve(po) === po);
console.log("O2:", new Promise((r) => r(po)) === po);
```

```
O1:
O2:

mechanism:
```

---

## Program 2 — True/False

One sentence of mechanism each.

```
1.  A promise starts the work it represents                          →

2.  p.then(f) returns p                                              →

3.  .catch(f) and .then(undefined, f) are the same thing             →

4.  .then(f, g) and .then(f).catch(g) are the same thing             →

5.  A handler on an already-fulfilled promise runs synchronously     →

6.  throw inside a .then handler crashes the program                 →

7.  An async function can throw synchronously                        →

8.  await on a non-promise returns immediately, without yielding     →

9.  A promise can be fulfilled with another promise                  →

10. Promise.all runs its inputs in parallel                          →

11. When Promise.all rejects, the remaining operations stop          →

12. Promise.race([]) fulfils with undefined                          →

13. You can read a fulfilled promise's value without a callback      →

14. Rejecting with a string works the same as rejecting with Error   →

15. finally's return value can change the outcome of the chain       →
```

---

## Program 3 — Build Four Primitives

### 1. `deferred()`

Resolve/reject pulled **out** of the executor — the escape hatch for bridging an event-based API.

```javascript
function deferred() {
  // TODO: return { promise, resolve, reject }
}
```

**Write here:**

```javascript

```

```
Why is it safe to assign `resolve` to an outer variable inside the executor:
```

---

### 2. `timeout(promise, ms)`

```javascript
function timeout(promise, ms, message = "timed out") {
  // TODO: reject with an Error after ms, otherwise pass the outcome through
}
```

**Write here:**

```javascript

```

```
Does this STOP the original work? Why not:

What leaks if the timer isn't cleared on the happy path:
```

---

### 3. `retry(thunk, times, delayMs)`

```javascript
function retry(thunk, times = 3, delayMs = 0) {
  // TODO: run thunk(); on rejection, wait and try again; rethrow the LAST error
}
```

**Write here:**

```javascript

```

```
Why must it take a thunk and not a promise:
```

**Then break it deliberately** — a version taking a promise:

```javascript
function retryBroken(promise, times) {

}
```

```
Result when run against flaky():

One-sentence explanation:
```

---

### 4. `promisify(fn)`

```javascript
function promisify(fn) {
  // TODO: (err, value) callback → promise
  //       `this` must pass through; a double callback must not double-settle
}
```

**Write here:**

```javascript

```

```
Where does `this` have to be forwarded, and what breaks if it isn't:

What stops a double callback from settling twice:
```

**Test results:**

```

```

---

## Program 4 — Find the Bugs

```javascript
async function importAll(ids) {
  const imported = [];

  ids.forEach(async (id) => {
    const row = await fetchRow(id);
    imported.push(row);
  });

  return { count: imported.length, imported };
}

function withRetry(id) {
  return fetchRow(id).catch(() => fetchRow(id));
}

async function main() {
  try {
    const result = importAll([1, 2, 3]);
    console.log(result.count);
  } catch (e) {
    console.error("import failed:", e.message);
  }
}
```

```
P: What does console.log(result.count) print, and why?

Q: fetchRow(2) rejects. Which line reports it? (Careful.)

R: What happens to the Node process, and at what point?

S: The two-word fix for main's try/catch:

T: withRetry's subtle flaw, and when it shows up:
```

**U — both rewrites of `importAll`:**

```javascript
// concurrent

// sequential

```

```
When each is the right one:
```

---

## Program 5 — Async Iteration

### V · what an async iterator returns

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

async function* g() { yield 1; yield 2; }
console.log("V:", g().next());
```

```
V (what exactly is logged — not the value, the thing itself):

mechanism:
```

---

### W, X · sequential vs already-started

```javascript
"use strict";

(async () => {
  const t = Date.now();
  async function* three() { for (let i = 1; i <= 3; i++) yield await delay(100, i); }
  const out = [];
  for await (const v of three()) out.push(v);
  console.log("W:", out, "~" + (Date.now() - t) + "ms");

  const t2 = Date.now();
  const out2 = [];
  for await (const v of [delay(100, "a"), delay(100, "b")]) out2.push(v);
  console.log("X:", out2, "~" + (Date.now() - t2) + "ms");
})();
```

```
W (~ms):
X (~ms):

why they differ, given both are 100ms operations:
```

---

### Y · laziness

```javascript
"use strict";

(async () => {
  async function* counted() {
    let i = 0;
    while (true) { console.log("producing", ++i); yield await delay(5, i); }
  }
  const out = [];
  for await (const v of counted()) { out.push(v); if (out.length === 2) break; }
  console.log("Y:", out);
})();
```

```
Y (how many "producing" lines):

why not more:

what state is the generator in after the break:
```

---

### Z · the trap — predict, then RUN it

```javascript
"use strict";

(async () => {
  const items = [delay(30, "ok"), Promise.reject(new Error("item 2")), delay(30, "third")];
  try {
    for await (const v of items) console.log("got", v);
  } catch (e) {
    console.log("Z: caught", e.message);
  }
})();
```

```
Z (what is printed, in what order):

Z2 (what happens to the process, and why — while you await item 1, who is watching item 2):

Z3 (the rewrite that handles the failure properly, and what changed):
```

---

### Build

```javascript
"use strict";

// 1. take(asyncIterable, n) — the async twin of Chapter 12's take
async function take(asyncIterable, n) {

}

// 2. A class that is async-iterable
class EventLog {
  constructor() { this.entries = []; }
  add(entry) {

  }
  // [Symbol.asyncIterator] here

}

// 3. Fix this without changing the caller
async function loadAll(ids) {

}
```

```
take(naturals(), 4) →   (must terminate, and pull exactly 4)

What happens if a consumer breaks out of EventLog halfway, and how do you clean up:

loadAll — the crash:

loadAll — the design smell:
```

---

## Self-assessment

```
- [ ] All 15 markers (A–O) correct with mechanisms
- [ ] J2 answered from an actual run
- [ ] C vs L distinction stated
- [ ] All 15 True/False correct
- [ ] deferred / timeout / retry / promisify pass their tests
- [ ] timeout clears its timer; the "cannot cancel" answer written
- [ ] retryBroken demonstrated and explained
- [ ] promisify forwards `this` and cannot double-settle
- [ ] P–U answered, both rewrites written
- [ ] V–Z3 answered, Z from an actual run
- [ ] take() terminates on an infinite async generator, pulls exactly n
- [ ] EventLog is async-iterable and cleans up on break
- [ ] Both problems in loadAll named and fixed
```

---

Anything that surprised you:

```

```
