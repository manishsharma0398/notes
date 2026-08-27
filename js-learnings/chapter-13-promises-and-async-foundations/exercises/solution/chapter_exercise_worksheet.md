# Chapter 13 Worksheet — Promises as a Language Feature

Work entirely in this file. Fill in every `Answer:` block. Predict **before** running.

For every answer, name the **mechanism** — "the executor is synchronous", "settled once",
"adopted the thenable", "pass-through handler", "the work started at the call".

---

## Program 1 — Output Tracer

```javascript
"use strict";

console.log("A1");
const p = new Promise((resolve) => {
  console.log("A2");
  resolve("A3");
});
p.then((v) => console.log(v));
console.log("A4");
// << A
```

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
// << B
```

```javascript
"use strict";

const base = Promise.resolve(1);
base.then((v) => v + 1).then((v) => console.log("C chain:", v));
base.then((v) => v + 1);
base.then((v) => console.log("C branch:", v));
// << C
```

```javascript
"use strict";

Promise.resolve("user")
  .then((u) => { Promise.resolve(u + "-orders"); })
  .then((o) => console.log("D:", o));
// << D
```

```javascript
"use strict";

Promise.resolve("kept")
  .then(null)
  .then("not a function")
  .then((v) => console.log("E:", v));
// << E
```

```javascript
"use strict";

Promise.reject(new Error("boom"))
  .catch(() => "recovered")
  .then((v) => console.log("F:", v))
  .catch(() => console.log("F: never"));
// << F
```

```javascript
"use strict";

Promise.resolve("ok")
  .then(
    () => { throw new Error("G-error"); },
    (e) => console.log("G: first"),
  )
  .catch((e) => console.log("G: second", e.message));
// << G
```

```javascript
"use strict";

Promise.resolve("H-value").finally(() => "H-ignored").then((v) => console.log("H:", v));
Promise.resolve("x").finally(() => { throw new Error("H-thrown"); }).catch((e) => console.log("H2:", e.message));
// << H, H2
```

```javascript
"use strict";

Promise.resolve({ id: 1, then(resolve) { resolve("adopted"); } }).then((v) => console.log("I:", v));
Promise.resolve({ id: 2, then: 42 }).then((v) => console.log("I2:", v.id));
// << I, I2
```

```javascript
"use strict";

async function boom() { throw new Error("J-boom"); }

try {
  boom();
  console.log("J: the line after the call");
} catch (e) {
  console.log("J: caught", e.message);
}
// << J, J2 (what else happens when you actually run it?)
```

```javascript
"use strict";

(async () => {
  const v = await 42;
  console.log("K:", v);
  const r = await Promise.resolve(1).then((n) => n + 1);
  console.log("K2:", r);
})();
console.log("K3: sync");
// << K, K2, K3 — in order
```

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
// << L
```

```javascript
"use strict";

Promise.all([]).then((v) => console.log("M1:", v));
Promise.any([]).catch((e) => console.log("M2:", e.constructor.name));
Promise.race([]).then(() => console.log("M3: settled"));
setTimeout(() => console.log("M3 check: did it settle?"), 200);
// << M1, M2, M3
```

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
Promise.all([delay(30, "x"), delay(10, "y")]).then((v) => console.log("N:", v));
// << N
```

```javascript
"use strict";

const po = Promise.resolve(1);
console.log("O1:", Promise.resolve(po) === po);
console.log("O2:", new Promise((r) => r(po)) === po);
// << O1, O2
```

### Answers — Program 1

```
A  (all four lines, in order):
   mechanism:

B:
   mechanism:

C chain:
C branch:
   mechanism:

D:
   mechanism:

E:
   mechanism:

F:
   why the second .catch never runs:

G:
   mechanism:

H:
H2:
   mechanism:

I:
I2:
   mechanism:

J  (which line prints):
J2 (what else happens when run, and why):

K:
K2:
K3:
   order, and why:

L  (~ms):
   why, given there are two awaits:

M1:
M2:
M3:

N:
   which order, and why:

O1:
O2:
   mechanism:
```

**C and L — which is "where the handler is attached" and which is "when the function was
called"?**

```
Answer:
```

---

## Program 2 — True/False

One sentence of mechanism each.

```
1.  A promise starts the work it represents                                  →
2.  p.then(f) returns p                                                      →
3.  .catch(f) and .then(undefined, f) are the same thing                     →
4.  .then(f, g) and .then(f).catch(g) are the same thing                     →
5.  A handler on an already-fulfilled promise runs synchronously             →
6.  throw inside a .then handler crashes the program                         →
7.  An async function can throw synchronously                                →
8.  await on a non-promise returns immediately, without yielding             →
9.  A promise can be fulfilled with another promise                          →
10. Promise.all runs its inputs in parallel                                  →
11. When Promise.all rejects, the remaining operations stop                  →
12. Promise.race([]) fulfils with undefined                                  →
13. You can read a fulfilled promise's value without a callback              →
14. Rejecting with a string works the same as rejecting with an Error        →
15. finally's return value can change the outcome of the chain               →
```

---

## Program 3 — Build Four Primitives

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

function deferred() {
  // Write here
}

function timeout(promise, ms, message = "timed out") {
  // Write here
}

function retry(thunk, times = 3, delayMs = 0) {
  // Write here
}

function promisify(fn) {
  // Write here
}
```

```
Does timeout() stop the original work? Why not?

What leaks if the timer isn't cleared on the happy path?

Where does `this` have to be forwarded in promisify, and what breaks if it isn't?
```

The deliberately broken retry (takes a promise, not a thunk):

```javascript
function retryBroken(promise, times) {
  // Write here
}
```

```
Result when run against flaky():
One-sentence explanation:
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
P (what count prints, and why):

Q (fetchRow(2) rejects — which line reports it):

R (what happens to the process, and when):

S (the two-word fix for main's try/catch):

T (withRetry's subtle flaw, and when it shows up):
```

U — both rewrites of `importAll`:

```javascript
// concurrent

// sequential
```

```
When each is the right one:
```

---

## Program 5 — Async Iteration

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

async function* g() { yield 1; yield 2; }
console.log("V:", g().next());
// << V
```

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
// << W, X
```

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
// << Y
```

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
// << Z, Z2
```

### Answers — Program 5

```
V:
   mechanism:

W (~ms):
X (~ms):
   why they differ:

Y (how many "producing" lines):
   why not more:

Z (printed, in order):
Z2 (what happens to the process, and why):
Z3 (the rewrite, and what changed):
```

### Build

```javascript
"use strict";

async function take(asyncIterable, n) {
  // Write here
}

class EventLog {
  constructor() { this.entries = []; }
  add(entry) {
    // Write here
  }
  // Write [Symbol.asyncIterator] here
}

async function loadAll(ids) {
  // Write the fixed version here
}
```

```
What happens if a consumer breaks out of EventLog halfway, and how do you clean up?

loadAll — the crash:

loadAll — the design smell:
```

**Test results:**

```

```

---

## Self-assessment

```
- [ ] All 15 markers correct with mechanisms
- [ ] J2 answered from an actual run
- [ ] C vs L distinction stated
- [ ] All 15 True/False correct
- [ ] deferred / timeout / retry / promisify all pass their tests
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
