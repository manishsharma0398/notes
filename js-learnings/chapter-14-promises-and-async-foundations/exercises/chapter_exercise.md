# Chapter 14 — Chapter Exercise: Promises as a Language Feature

**Time:** 30–60 minutes
**Rule:** predict everything **before** running anything.

Ordering *between* independent chains is Chapter 15's subject and is deliberately not asked
here. Where a question involves order, it is either inside one chain or the sync-vs-async
boundary — both of which this chapter settles.

Work in `exercises/solution/chapter_exercise_worksheet.md`.

---

## Program 1 — Output Tracer

For each marker, write the output **and name the mechanism** — "the executor is synchronous",
"settled once", "adopted the thenable", "pass-through handler".

```javascript
"use strict";

console.log("A1");
const p = new Promise((resolve) => {
  console.log("A2");
  resolve("A3");
});
p.then((v) => console.log(v));
console.log("A4");
// << A: all four lines, in order
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
// << C: both lines
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
// << F   (and say why the second .catch does not run)
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
// << H (both)
```

```javascript
"use strict";

Promise.resolve({ id: 1, then(resolve) { resolve("adopted"); } }).then((v) => console.log("I:", v));
Promise.resolve({ id: 2, then: 42 }).then((v) => console.log("I2:", v.id));
// << I (both)
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
// << J: which line prints?
// << J2: run it in Node. What ELSE happens, and why? (This one is not rhetorical.)
```

```javascript
"use strict";

(async () => {
  const v = await 42;                                   // not a promise
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
// << L: roughly how long? There are two `await`s — explain your number.
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
// << N: which order?
```

```javascript
"use strict";

const po = Promise.resolve(1);
console.log("O1:", Promise.resolve(po) === po);
console.log("O2:", new Promise((r) => r(po)) === po);
// << O1, O2
```

**C and L are the pair.** One is about *where the handler is attached*, the other about *when
the function was called*. Say which is which before you answer either.

---

## Program 2 — True/False Reasoning

One sentence of *mechanism* each. "True" alone scores zero.

1. A promise starts the work it represents
2. `p.then(f)` returns `p`
3. `.catch(f)` and `.then(undefined, f)` are the same thing
4. `.then(f, g)` and `.then(f).catch(g)` are the same thing
5. A handler attached to an already-fulfilled promise runs synchronously
6. `throw` inside a `.then` handler crashes the program
7. An `async` function can throw synchronously
8. `await` on a non-promise value returns immediately, without yielding
9. A promise can be fulfilled with another promise
10. `Promise.all` runs its inputs in parallel
11. When `Promise.all` rejects, the remaining operations stop
12. `Promise.race([])` fulfils with `undefined`
13. You can read a fulfilled promise's value without a callback
14. Rejecting with a string works the same as rejecting with an `Error`
15. `finally`'s return value can change the outcome of the chain

---

## Program 3 — Build Four Primitives

No libraries. Each is ten to twenty lines; the point is which *shape* each one demands.

```javascript
"use strict";

// 1. deferred() — resolve/reject pulled OUT of the executor.
//    The escape hatch for bridging an event-based API into a promise.
function deferred() {
  // TODO: return { promise, resolve, reject }
  //       hint: the executor is synchronous — that is the whole trick
}

// 2. timeout(promise, ms) — reject if it takes too long.
function timeout(promise, ms, message = "timed out") {
  // TODO: reject with an Error after `ms`, otherwise pass the outcome through
  //       then answer, in a comment: does this STOP the original work? Why not?
  //       and: what leaks if you don't clear the timer on the happy path?
}

// 3. retry(thunk, times, delayMs) — re-run on failure.
function retry(thunk, times = 3, delayMs = 0) {
  // TODO: run thunk(); on rejection, wait and try again; rethrow the LAST error
  //       thunk is `() => promise` — NOT a promise. That is the exercise.
}

// 4. promisify(fn) — Node-style callback (err, value) → promise.
function promisify(fn) {
  // TODO: return (...args) => new Promise(...)
  //       `this` must pass through   (Chapter 5 + 11)
  //       call the callback ONCE — a double callback must not double-settle
}
```

**Tests:**

```javascript
// deferred
const d = deferred();
d.promise.then((v) => console.log("deferred:", v));
setTimeout(() => d.resolve("released"), 20);

// timeout
timeout(delay(500, "slow"), 50).catch((e) => console.log("timeout:", e.message));
timeout(delay(10, "fast"), 50).then((v) => console.log("timeout:", v));

// retry
let n = 0;
const flaky = () => (++n < 3 ? Promise.reject(new Error("flaky " + n)) : Promise.resolve("ok on " + n));
retry(flaky, 5, 10).then(console.log);

// promisify
const readish = (key, cb) => setTimeout(() => (key ? cb(null, "value:" + key) : cb(new Error("no key"))), 10);
promisify(readish)("a").then(console.log);
promisify(readish)("").catch((e) => console.log("promisify:", e.message));
```

**Then break `retry` deliberately.** Write `retryBroken(promise, times)` that takes a *promise*
instead of a thunk, run it against `flaky()`, and explain the result in one sentence. This is
Part 1 of the chapter with a receipt.

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
P: What does `console.log(result.count)` print, and why?
Q: `fetchRow(2)` rejects. Which line reports it? (Careful.)
R: What happens to the Node process, and at what point?
S: The try/catch in main() catches nothing. Give the two-word fix.
T: withRetry looks correct and has one subtle flaw. What is it, and when does it show up?
U: Rewrite importAll twice — once concurrent, once sequential — and say when each is right.
```

---

## Program 5 — Async Iteration

```javascript
"use strict";

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

async function* g() { yield 1; yield 2; }
console.log("V:", g().next());
// << V: what exactly is logged? (not the value — the thing itself)
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
// << W and X: both take three/two 100ms operations. Why do the times differ?
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
// << Y: how many "producing" lines, and why not more?
```

```javascript
"use strict";

// Predict, then RUN it. Something happens that the code does not suggest.
(async () => {
  const items = [delay(30, "ok"), Promise.reject(new Error("item 2")), delay(30, "third")];
  try {
    for await (const v of items) console.log("got", v);
  } catch (e) {
    console.log("Z: caught", e.message);
  }
})();
// << Z: what is printed, in what order, and what happens to the process?
// << Z2: rewrite it so the failure is handled properly. What did you change?
```

**Then build:**

```javascript
"use strict";

// 1. take(asyncIterable, n) — the async twin of Chapter 12's take
async function take(asyncIterable, n) {
  // TODO: first n values as an array; must work on an INFINITE async generator
  //       and must not pull an (n+1)th value
}

// 2. A class that is async-iterable.
class EventLog {
  constructor() { this.entries = []; }
  add(entry) { /* TODO */ }
  // TODO: [Symbol.asyncIterator] — yield entries as they arrive, with a small
  //       simulated delay per entry. Then answer: what happens if a consumer
  //       breaks out halfway, and how do you clean up?
}

// 3. Fix this without changing the caller.
async function loadAll(ids) {
  const rows = [];
  for await (const row of ids.map((id) => fetchRow(id))) rows.push(row);
  return rows;
}
// TODO: state the two problems, then fix it. One is a crash, one is a design smell.
```

**Tests:**

```javascript
async function* naturals() { let n = 1; while (true) yield await delay(5, n++); }
console.log(await take(naturals(), 4));   // [1, 2, 3, 4] — and it must terminate
```

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A: which of these four lines is scheduled rather than executed?
- C: what value does each handler *receive*?
- D: does an arrow with braces return anything?
- E: what does `then` do with a handler that isn't a function?
- G: are `f` and `g` in sequence, or side by side?
- I: what makes something a thenable — the name `then`, or a callable `then`?
- J: an async function converts a throw into what?
- L: when did the two 100ms operations *start*?
- M: what could ever settle a race with no participants?

**Program 2**
- 5: a guarantee, not an optimisation. Search "releasing Zalgo".
- 9: what does the resolution procedure do with a thenable?
- 11: name one thing in JavaScript that cancels anything.

**Program 3**
- `deferred`: the executor runs synchronously, so assigning `resolve` to an outer variable
  inside it is safe — the variable is set before `deferred()` returns.
- `timeout`: `Promise.race`. The timer keeps the process alive until it fires unless you
  `clearTimeout` in a `finally`.
- `retry`: a `for` loop with `await` in a `try/catch`, rethrowing on the last attempt.
- `promisify`: `fn.apply(this, [...args, callback])`, and a `settled` flag for the double
  callback.

**Program 5**
- V: what does an async iterator's `next()` return?
- W vs X: in one of them the work starts together; in the other each value is produced on
  demand. Which is which?
- Z: while you're awaiting item 1, who is watching item 2?
- `take`: `for await` with a `break`, exactly like Chapter 12 — the `break` also closes it.
- `loadAll`: one of the two problems is the same one as Z.

**Program 4**
- P: how many promises does `forEach` wait for?
- Q: which of those promises has a handler attached to it?
- T: how many *fresh calls* does `withRetry` make, and what does it do when the first
  rejection is a 400 rather than a 503?

</details>

---

## What to Verify

- [ ] Program 1: all 15 markers with a named mechanism
- [ ] Program 1: J2 answered — you ran it and know why the process died
- [ ] Program 1: you can say which of C and L is "where" and which is "when"
- [ ] Program 2: 15 answers, each with a mechanism
- [ ] Program 3: all four primitives pass their tests
- [ ] Program 3: `timeout` clears its timer, and you've written why it can't cancel
- [ ] Program 3: `retryBroken` demonstrated and explained
- [ ] Program 4: P–U answered, including both rewrites
- [ ] Program 5: V–Z2 answered, Z from an actual run
- [ ] Program 5: `take` terminates on an infinite async generator and pulls exactly n
- [ ] Program 5: `EventLog` is async-iterable and cleans up on `break`
- [ ] Program 5: both problems in `loadAll` named and fixed
