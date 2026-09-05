# Chapter 20 Worksheet — Modules (ESM)

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **phase** — *parse*, *link*, or *evaluate* — and where relevant the
**rule**: "hoisted declaration", "indirect binding", "depth-first post-order", "one instance per
resolved URL", "TDZ", "initialised at link", "namespace `[[Set]]` returns false", "async module",
"lexer scan, not evaluation".

Create the files under `scratch/` next to this worksheet. There is no `package.json` in this repo,
so use explicit `.mjs` and `.cjs` extensions. Exit codes: `node file.mjs; echo $?`.

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

```
full output, in order:
1:
2:
3:
4:
5:

which console.logs could be moved without changing anything, and why:

how many times does a.mjs evaluate, and what rule decides that:

phase + rule:
```

---

### B · what runs before a link error

```javascript
// loud.mjs
console.log("loud: evaluating");
export const REAL = 1;

// user.mjs
import { REAL, MISSING } from "./loud.mjs";
console.log("got", REAL, MISSING);
```

```
does "loud: evaluating" print:

error constructor name:

which phase threw:

--- now the CommonJS version (loud.cjs / user.cjs, require + destructure) ---

output:

the one-sentence difference:
```

---

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

```
how many times does "boom: evaluating" print (ESM):

how many times (CJS equivalent with require):

which system does what:

one way ESM's behaviour could hurt in production:

one way CJS's behaviour could hurt in production:
```

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

```
line 1 (five values):

line 2 (five values):

which name does NOT track the change:

what is different about how it was exported (one sentence):
```

---

### E · four ways to fail to write

```javascript
try { value = "x"; } catch (e) { console.log(1, e.constructor.name, e.message); }
try { ns.value = "x"; } catch (e) { console.log(2, e.constructor.name, e.message); }
try { ns.brandNew = "x"; } catch (e) { console.log(3, e.constructor.name, e.message); }
try { Object.defineProperty(ns, "value", { value: "x" }); } catch (e) { console.log(4, e.constructor.name, e.message); }
console.log(Object.isSealed(ns), Object.isFrozen(ns));
console.log(Object.getOwnPropertyDescriptor(ns, "value"));
```

```
1:
2:
3:
4:
isSealed / isFrozen:
descriptor:

which one does not reach runtime, and why:

the descriptor and the behaviour contradict each other — explain the contradiction:
```

---

### F · the snapshot bug

```javascript
import * as ns from "./state.mjs";
const { value } = ns;
const alias = ns.value;
ns.change?.() ?? (await import("./state.mjs")).change();
console.log(value, alias, ns.value);
```

```
output:

is there ANY syntax that gives a live local const aliasing an import:

why or why not, in terms of what a binding is:
```

---

## Program 3 — Module scope

### G · the same file, twice

```javascript
var v = 1;
console.log("this            :", this);
console.log("globalThis.v    :", globalThis.v);
console.log("typeof require  :", typeof require);
console.log("typeof __dirname:", typeof __dirname);
console.log("typeof arguments:", typeof arguments);
(function () { console.log("plain-call this :", this); })();
```

```
probe.mjs                          probe.cjs
this            :                  this            :
globalThis.v    :                  globalThis.v    :
typeof require  :                  typeof require  :
typeof __dirname:                  typeof __dirname:
typeof arguments:                  typeof arguments:
plain-call this :                  plain-call this :

the two differences with the SAME value but DIFFERENT mechanisms:
  (i)  value:            mjs mechanism:                cjs mechanism:
  (ii) value:            mjs mechanism:                cjs mechanism:

arguments.length in the .cjs:

what the arguments are, in order:
```

---

### H · the conversion trap

```javascript
// legacy.cjs
this.setting = "on";
module.exports.other = "also on";
```

```
require("./legacy.cjs") returns:

renamed to legacy.mjs, unchanged — result:

the symptom someone would report in a bug ticket:
```

---

### I · you cannot opt out

```javascript
try { undeclared = 1; } catch (e) { console.log("A", e.constructor.name); }
try { eval("with ({}) {}"); } catch (e) { console.log("B", e.constructor.name); }
try { eval("var x = 010;"); } catch (e) { console.log("C", e.constructor.name); }
console.log("D", typeof import.meta.url, typeof import.meta.dirname);
```

```
A:
B:
C:
D:

the one line that feature-detects "am I an ES module":

(if it can't be done) precisely why:
```

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

```
complete output including the error:

error type:

error message, exactly:

which module's body starts first:

why it is not the one main imported:

how many lines of y.mjs run before the process dies:
```

---

### K · the same cycle in CommonJS

```
predicted output:

actual output:

| | ESM | CJS |
|---|---|---|
| which body starts first | | |
| what y sees for xName | | |
| what y sees for xLabel | | |
| does the process survive | | |
| any diagnostic from Node | | |

why CommonJS cannot produce the ESM error message even in principle:
```

---

### L · two fixes, and which one is real

```
fix 1 — without deleting the cycle (change only WHEN the reads happen):

  what changed:

  what still runs first:

fix 2 — by deleting the cycle (extract a third module):

  what changed:

  what still runs first:

which one goes in the PR:

the PR description:
```

---

## Program 5 — Static shape

### M · which of these parse?

```javascript
// 1  export const on = true; if (on) { import x from "./a.mjs"; }
// 2  const spec = "./a.mjs"; import x from spec;
// 3  import x from "./a" + ".mjs";
// 4  function load() { return import("./a.mjs"); }
// 5  const f = import;
// 6  export default 1; export default 2;
// 7  import { A } from "./a.mjs"; import { A } from "./a.mjs";
```

```
      parses?   phase (parse/link)   constructor name   message
1:
2:
3:
4:
5:
6:
7:

what 6 and 7 are duplicates OF, and why that makes them different kinds of error:
```

---

### N · identity

```javascript
const a = await import("./state.mjs");
const b = await import("./state.mjs");
const c = await import("./state.mjs?x=1");
const d = await import(new URL("./state.mjs", import.meta.url).href);

console.log(a === b, a === c, a === d);
a.change();
console.log(a.value, c.value, d.value);
```

```
line 1 (three values):

line 2 (three values):

why d behaves as it does, in one sentence:

the general rule for module identity (four words):
```

---

## Program 6 — Top-level await

### O · who waits

```javascript
// slow.mjs   logs "slow: start", awaits 30ms, logs "slow: done"
// quick.mjs  logs "quick: evaluated"
// main.mjs   imports slow then quick, logs "main:", S, Q
```

```
order of the four lines:
1:
2:
3:
4:

after swapping the two imports in main.mjs:
1:
2:
3:
4:

did the order change:

what that tells you about which modules an async module suspends:
```

---

### P · the silent death

```javascript
// hang.mjs   export const never = await new Promise(() => {});
// main.mjs   import { never } from "./hang.mjs"; console.log("main: reached");
```

```
what is printed:

on which stream:

exit code:

would try/catch around anything help — and why:

would process.on("uncaughtException") help — and why:
```

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

```
named import links?
  plain         :
  viaModule     :
  computed      :
  conditional   :
  assigned      :
  literalString :

Object.keys(await import("./mixed.cjs")):

keys of the DEFAULT import:

the rule that explains every case:
```

---

### R · requiring across the line

```javascript
// probe.cjs
for (const spec of ["./sync.mjs", "./async.mjs"]) {
  try { console.log(spec, "->", require(spec)); }
  catch (e) { console.log(spec, "->", e.code ?? e.constructor.name); }
}
```

```
./sync.mjs  ->

./async.mjs ->

is what comes back for sync.mjs the default export:

what extra property does Node add, and why:

the one thing require genuinely cannot do:
```

---

## Build

### 1 · `classify(specifier)`

```
the five fixtures I built:
  ok               :
  not-found        :
  link-error       :
  eval-error       :
  async-in-require :

the two outcomes that share an error class:

what my discriminator relies on:

what breaks it (be specific about the cost):
```

---

### 2 · `describe(ns)`

```
output for a real namespace:

writableClaims:

writes that actually succeeded:

the sentence that explains the disagreement:
```

---

### 3 · `loadAll(dir)`

```
what import() needs here that a static import cannot give:

what I had to do to the path before passing it, and why:

how I kept the filename attached to each failure:

what happens when one plugin has a syntax error:

what happens when a plugin's default export has no run():
```

---

## What to verify

Tick only what you can answer without re-running anything.

- [ ] Phase for each error: `Cannot find module` ___ · `does not provide an export named 'x'` ___ ·
      `Cannot access 'x' before initialization` ___ · `ERR_REQUIRE_ASYNC_MODULE` ___
- [ ] Why `a.mjs` in A evaluates once, not twice:
- [ ] The export form in D that is not live, and why:
- [ ] Why the namespace descriptor says `writable: true` and the write still throws:
- [ ] The two same-value/different-mechanism differences in G:
- [ ] Which body runs first in each cycle, and why they differ:
- [ ] The exact ESM cycle error message, and what CJS produces instead:
- [ ] Why `xLabel()` works inside the cycle but `xName` doesn't:
- [ ] Which M snippets fail at parse, which at link:
- [ ] Module identity, in four words:
- [ ] What top-level await suspends, and what it doesn't:
- [ ] The exit code from P, and why nothing catches it:
- [ ] The rule that predicts all seven names in Q:
- [ ] What `require()` of a sync ESM file returns, and the property Node adds:

---

## The sentences I can now say out loud

*Write these in your own words — they are the ones the round is scored on.*

```
1. What an import actually is (one sentence, without the word "copy"):

2. Why a circular import throws in ESM and not in CJS:

3. Why import specifiers must be static, and what that buys:

4. What top-level await costs, and how it fails:

5. Why require() of ESM works now, and when it still doesn't:
```
