# Chapter 20 — Chapter Exercise: Modules (ESM)

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer, name
the **phase** — *parse*, *link*, or *evaluate* — and where relevant the **rule**: "hoisted
declaration", "indirect binding", "depth-first post-order", "one instance per resolved URL", "TDZ",
"initialised at link", "namespace `[[Set]]` returns false", "async module", "lexer scan, not
evaluation".

Modules need real files, so most questions are a small file set rather than a snippet. Create them
under `solution/scratch/` (make the directory; it's yours). There is **no `package.json` in this
repo**, so use explicit `.mjs` and `.cjs` extensions everywhere — that is also the point of
several questions.

Plain `node file.mjs` is enough for everything here. A few questions ask for the **exit code**:
`node file.mjs; echo $?`.

---

## Program 1 — Phases

### A · where the import sits

```javascript
// a.mjs
console.log("a: top");
export const A = "A";

// b.mjs
import { A } from "./a.mjs";
console.log("b: top", A);
export const B = "B";

// main.mjs
console.log("main: 1");
import { B } from "./b.mjs";
console.log("main: 2", B);
import { A } from "./a.mjs";
console.log("main: 3", A);
```

*Predict the full output, in order. Then say which of the four `console.log`s in `main.mjs` and
`b.mjs` could be moved without changing anything, and why `a.mjs` appears the number of times it
does.*

### B · what runs before a link error

```javascript
// loud.mjs
console.log("loud: evaluating");
export const REAL = 1;

// user.mjs
import { REAL, MISSING } from "./loud.mjs";
console.log("got", REAL, MISSING);
```

*Predict: does `loud: evaluating` print? What is the error's **constructor name**? Which phase
threw? Now write the CommonJS equivalent (`loud.cjs`, `user.cjs`, `require` + destructure) and
predict that too. State the one-sentence difference.*

### C · a module that throws

```javascript
// boom.mjs
console.log("boom: evaluating");
throw new Error("boom");

// retry.mjs
for (let i = 0; i < 2; i++) {
  try { await import("./boom.mjs"); } catch (e) { console.log("attempt", i, "->", e.message); }
}
```

*How many times does `boom: evaluating` print? Write the `.cjs` equivalent with `require` and
predict that. They differ — say which is which, and give one concrete way each behaviour could hurt
you in production.*

---

## Program 2 — Bindings

### D · what is live and what is not

```javascript
// state.mjs
export let value = "one";
export default value;
export { value as alsoDefault };
export function change() { value = "two"; }

// read.mjs
import def, { value, alsoDefault, change } from "./state.mjs";
import * as ns from "./state.mjs";

console.log(def, value, alsoDefault, ns.value, ns.default);
change();
console.log(def, value, alsoDefault, ns.value, ns.default);
```

*Predict both lines — ten values. Exactly one of the five names does not track the change. Name it,
and explain in one sentence what is different about how it was exported.*

### E · four ways to fail to write

```javascript
// write.mjs
import { value, change } from "./state.mjs";
import * as ns from "./state.mjs";

try { value = "x"; } catch (e) { console.log(1, e.constructor.name, e.message); }
try { ns.value = "x"; } catch (e) { console.log(2, e.constructor.name, e.message); }
try { ns.brandNew = "x"; } catch (e) { console.log(3, e.constructor.name, e.message); }
try { Object.defineProperty(ns, "value", { value: "x" }); } catch (e) { console.log(4, e.constructor.name, e.message); }
console.log(Object.isSealed(ns), Object.isFrozen(ns));
console.log(Object.getOwnPropertyDescriptor(ns, "value"));
```

*Predict all four errors and the last two lines. **One of these does not even reach runtime** —
which, and why? (You will have to comment it out to see the others.) Then: the descriptor and the
behaviour contradict each other. Explain the contradiction.*

### F · the snapshot bug

```javascript
// consumer.mjs
import * as ns from "./state.mjs";
const { value } = ns;
const alias = ns.value;
ns.change?.() ?? (await import("./state.mjs")).change();
console.log(value, alias, ns.value);
```

*Predict. Then answer: is there **any** syntax that gives you a live local `const` aliasing an
import? Say why or why not, in terms of what a binding is.*

---

## Program 3 — Module scope

### G · the same file, twice

Write `probe.mjs` and `probe.cjs` containing the *same* body:

```javascript
var v = 1;
console.log("this            :", this);
console.log("globalThis.v    :", globalThis.v);
console.log("typeof require  :", typeof require);
console.log("typeof __dirname:", typeof __dirname);
console.log("typeof arguments:", typeof arguments);
(function () { console.log("plain-call this :", this); })();
```

*Predict both outputs, all twelve lines. Two of the differences have the **same observable value but
different mechanisms** — find them and state both mechanisms. Then: add
`console.log(arguments.length)` to the `.cjs` and predict the number, and say what the arguments
are.*

### H · the conversion trap

```javascript
// legacy.cjs
this.setting = "on";
module.exports.other = "also on";
```

*What does `require("./legacy.cjs")` return? Now rename the file to `legacy.mjs` and change nothing
else. Predict the result. This is a real migration failure — describe the symptom someone would
report.*

### I · you cannot opt out

```javascript
// strictness.mjs
try { undeclared = 1; } catch (e) { console.log("A", e.constructor.name); }
try { eval("with ({}) {}"); } catch (e) { console.log("B", e.constructor.name); }
try { eval("var x = 010;"); } catch (e) { console.log("C", e.constructor.name); }
console.log("D", typeof import.meta.url, typeof import.meta.dirname);
```

*Predict all four. Then: write the one line that feature-detects whether the current file is an ES
module. (This is a trick — if you conclude it can't be done, say precisely why.)*

---

## Program 4 — Cycles

### J · predict the crash

```javascript
// x.mjs
console.log("x: start");
import { yName, yLabel } from "./y.mjs";
export const xName = "X";
export function xLabel() { return "x-label"; }
console.log("x: sees", yName, yLabel());
console.log("x: end");

// y.mjs
console.log("y: start");
import { xName, xLabel } from "./x.mjs";
console.log("y: xLabel()", xLabel());
console.log("y: xName", xName);
export const yName = "Y";
export function yLabel() { return "y-label"; }
console.log("y: end");

// main.mjs
import "./x.mjs";
console.log("main: done");
```

*Predict the complete output including the error, its type and its message. Which module's body
starts first, and why is it not the one `main` imported? Then answer: how many lines of `y.mjs` run
before the process dies?*

### K · the same cycle in CommonJS

*Port `x.mjs` / `y.mjs` / `main.mjs` to `.cjs` faithfully — `require` at the same position,
`exports.` assignments where the `export` declarations were. Predict the output before running.*

*Then fill in this table from your two runs:*

| | ESM | CJS |
|---|---|---|
| which body starts first | | |
| what `y` sees for `xName` | | |
| what `y` sees for `xLabel` | | |
| does the process survive | | |
| any diagnostic from Node | | |

*One sentence: why can CommonJS not produce the ESM error message even in principle?*

### L · two fixes, and which one is real

*Make the ESM version run to completion, twice, in two different ways:*

1. **Without deleting the cycle** — change only *when* the reads happen.
2. **By deleting the cycle** — extract a third module.

*For each: what still runs first? Which one would you put in a PR, and what would you write in the
description?*

---

## Program 5 — Static shape

### M · which of these parse?

```javascript
// 1
export const on = true;
if (on) { import x from "./a.mjs"; }

// 2
const spec = "./a.mjs";
import x from spec;

// 3
import x from "./a" + ".mjs";

// 4
function load() { return import("./a.mjs"); }

// 5
const f = import;

// 6
export default 1; export default 2;

// 7
import { A } from "./a.mjs";
import { A } from "./a.mjs";
```

*For each: does it parse? If not, is the error at parse or at link, and what is its constructor
name? Put each in its own file — a parse error in one hides the rest.*

### N · identity

```javascript
// id.mjs
const a = await import("./state.mjs");
const b = await import("./state.mjs");
const c = await import("./state.mjs?x=1");
const d = await import(new URL("./state.mjs", import.meta.url).href);

console.log(a === b, a === c, a === d);
a.change();
console.log(a.value, c.value, d.value);
```

*Predict all six values. Then: `d` uses a completely different-looking specifier from `a`. Explain
the result in one sentence. What is the general rule for module identity?*

---

## Program 6 — Top-level await

### O · who waits

```javascript
// slow.mjs
console.log("slow: start");
export const S = await new Promise((r) => setTimeout(() => r("S"), 30));
console.log("slow: done");

// quick.mjs
console.log("quick: evaluated");
export const Q = "Q";

// main.mjs
import { S } from "./slow.mjs";
import { Q } from "./quick.mjs";
console.log("main:", S, Q);
```

*Predict the order of the four lines. Now swap the two imports in `main.mjs` and predict again.
Does the order change? Explain what that tells you about which modules an async module actually
suspends.*

### P · the silent death

```javascript
// hang.mjs
export const never = await new Promise(() => {});

// main.mjs
import { never } from "./hang.mjs";
console.log("main: reached");
```

*Predict: what is printed, on which stream, and what is the **exit code**? Run it with
`node main.mjs; echo $?`. Then answer: would a `try`/`catch` around anything here help? Would
`process.on("uncaughtException")`? Say why.*

---

## Program 7 — Interop

### Q · what the lexer can see

```javascript
// mixed.cjs
exports.plain = 1;
module.exports.viaModule = 2;
const key = "computed";
exports[key] = 3;
if (process.env.X !== "off") { exports.conditional = 4; }
Object.assign(exports, { assigned: 5 });
exports["literalString"] = 6;
```

*For each of the seven names, predict whether `import { name } from "./mixed.cjs"` links. Test each
in its own file. Then predict `Object.keys(await import("./mixed.cjs"))` and the keys of the
**default** import. State the rule that explains every case.*

### R · requiring across the line

```javascript
// sync.mjs
export const V = 1;
export default function () { return V; }

// async.mjs
export const V = await Promise.resolve(1);

// probe.cjs
for (const spec of ["./sync.mjs", "./async.mjs"]) {
  try { console.log(spec, "->", require(spec)); }
  catch (e) { console.log(spec, "->", e.code ?? e.constructor.name); }
}
```

*Predict both lines exactly — including the shape of what comes back for the one that works, and the
error **code** for the one that doesn't. Then: `require("./sync.mjs")` returns something; is it the
default export? What extra property does Node add and why?*

---

## Build

Three small primitives. No libraries.

### 1 · `classify(specifier)` → which phase failed

```javascript
// classify.mjs
export async function classify(specifier) {
  // -> "ok" | "not-found" | "link-error" | "eval-error" | "async-in-require"
}
```

Given a specifier, load it and report **which phase** the failure came from — not just that it
failed. Build the fixture modules to exercise all five outcomes.

The interesting part is that two of these arrive as the same error *class*. Work out what actually
distinguishes them and write down what your discriminator relies on — if it's the message string,
say so explicitly, because that's a real answer with a real cost.

### 2 · `describe(ns)` → a namespace report

```javascript
// describe.mjs
export function describe(ns) {
  // -> { keys, hasDefault, defaultType, isSealed, isFrozen, prototype, tag, writableClaims }
}
```

`writableClaims` should be the count of own properties whose descriptor says `writable: true`.
Print it next to the result of actually attempting a write. **The point of the exercise is that
those two numbers disagree** — get them into one output line and write the sentence that explains
it.

### 3 · `loadAll(dir)` → a plugin loader

```javascript
// loadAll.mjs
export async function loadAll(dir) {
  // -> { loaded: Map<name, plugin>, failures: [{ file, phase, error }] }
}
```

Every `.mjs` in `dir` default-exports `{ name, run }`. Load them all concurrently, and reuse
`classify` so each failure records its phase. Requirements:

- one broken plugin must not stop the others;
- a plugin whose default export has no `run` must be a `failures` entry, not a crash later;
- `failures` must name the file — which means you cannot lose the index while collecting.

Then write down the answer to: **what does `import()` need here that a static `import` cannot
give you, and what did you have to do to the path before passing it?** That second half is the
question an interviewer actually asks.

---

## What to verify

Before you look at the hints, check that you can answer each of these without re-running anything:

- [ ] Which **phase** each of these errors comes from: `Cannot find module`, `does not provide an
      export named 'x'`, `Cannot access 'x' before initialization`, `ERR_REQUIRE_ASYNC_MODULE`.
- [ ] Why `a.mjs` in question A evaluates once, not twice.
- [ ] The one export form in D that is **not** live, and why.
- [ ] Why the namespace descriptor says `writable: true` and the write still throws.
- [ ] The two same-value/different-mechanism differences in G.
- [ ] Which body runs first in the ESM cycle, and which in the CJS one — and why they differ.
- [ ] The exact error message from the ESM cycle, and what CJS produces instead.
- [ ] Why `xLabel()` works inside the cycle but `xName` doesn't.
- [ ] Which of the seven M snippets fail at **parse** and which at **link**.
- [ ] The rule for module identity, stated in four words.
- [ ] What top-level await suspends and what it doesn't.
- [ ] The exit code from P, and why nothing catches it.
- [ ] The rule that predicts all seven names in Q.
- [ ] What `require()` of a sync ESM file returns, and the one property Node adds.

---

## Hints

<details>
<summary>A — evaluation order</summary>

Two rules combine: `import` is a hoisted *declaration*, and evaluation is depth-first **post-order**
over the graph. A module body is the last thing to run in its own subtree. For the count question:
the registry is keyed by resolved URL, and there is exactly one record per URL.
</details>

<details>
<summary>B — before the link error</summary>

Ask yourself what the linker needs in order to *detect* a missing export, and whether producing that
information requires running the file. The two module systems answer that differently, and the error
class you get is a clue to which phase you're in.
</details>

<details>
<summary>C — a module that threw</summary>

One system records the failure on the module record; the other removes the record entirely. Think
about what happens to a module whose top half opened something before its bottom half threw.
</details>

<details>
<summary>D/E/F — bindings</summary>

`export default <expression>` is an expression. `export { x as default }` is a binding. That is the
whole of D.

For E: one of the four is not a runtime error at all — look at which line the parser can reject
outright. For the contradiction, remember that a namespace is an *exotic* object: `[[GetOwnProperty]]`
and `[[Set]]` are separate internal methods and nothing requires them to agree.

For F: ask what a `const` declaration creates, and whether any syntax lets you create one that is
*indirect*.
</details>

<details>
<summary>G/H — scope</summary>

`globalThis.v` is `undefined` in both, but for different reasons: one file is wrapped in a function,
the other has its own environment record. `this` differs because one of them has a `module.exports`
to point at.

`arguments.length` tells you exactly how many parameters the wrapper has. Name them.

For the feature-detection line in I: `import.meta` is *syntax*. What does `typeof` need in order to
be safe on an undefined identifier, and does that apply to syntax?
</details>

<details>
<summary>J/K/L — cycles</summary>

Draw the two-phase picture before predicting. After linking, every binding in both modules exists.
Ask, for each name `y` reads: was it *initialised* by linking, or does it need evaluation?

For K: CommonJS has no export list at link time — it never built one. What would it have to compare
against to produce the ESM message?

For L, fix 1: the constraint is "no module reads an imported binding **during its own
evaluation**". Find every read that happens at evaluation time and move it.
</details>

<details>
<summary>M/N — static shape and identity</summary>

For M, split them into separate files first; a parse error is not recoverable and hides everything
after it. Then, for each: could the linker answer this question without running code? If the answer
is no, the parser rejects it.

`export default 1; export default 2;` and the duplicate `import` are different kinds of duplicate.
One is about the exporting module's export list, one about the importing module's declarations.

For N: `new URL("./state.mjs", import.meta.url).href` — write out what that string actually is, and
compare it to what `"./state.mjs"` resolves to.
</details>

<details>
<summary>O/P — top-level await</summary>

An async module returns a promise from its evaluation. Which modules have to await that promise:
the ones it imports, the ones that import it, or its siblings in the parent's import list?

For P: the process didn't crash and it didn't hang. Something else ended it. What has to be true of
the event loop for Node to exit at all, and does a suspended module keep it alive?
</details>

<details>
<summary>Q/R — interop</summary>

Node runs `cjs-module-lexer` over the CJS **source text**. It is a scanner, not an evaluator. For
each of the seven, ask: is the *name* present in the text, as part of a shape the scanner
recognises? Note that "inside an `if`" and "assigned through a variable" are not the same obstacle.

For R: the one that fails does so because `require` has exactly one thing it cannot do. Name that
thing and the error code follows.
</details>

<details>
<summary>Build 1 — `classify`</summary>

Start by writing down, for each of the five outcomes, what you actually receive: the error's
constructor, its `code` if any, and whether the fixture's `console.log` ran. Two of the five share a
constructor. Whatever separates them, be explicit about how load-bearing it is — a discriminator
built on an error *message* is a real answer, but it is one that breaks on a Node upgrade, and
saying so is the point of writing it down.
</details>

<details>
<summary>Build 3 — `loadAll`</summary>

`import()` takes a *specifier*, not a path. A bare `plugins/a.mjs` is treated as a package name.
Node has a function for turning a filesystem path into the right thing.

For the failures array: `Promise.all` rejects on the first failure, and the settled variant gives
you results in input order — which is the only reason you can still say which file each one was.
</details>
