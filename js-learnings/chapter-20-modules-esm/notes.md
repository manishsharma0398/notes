# Chapter 20 — Modules (ESM): Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*
*All outputs measured on Node 22.13.0 — the `require(esm)` answer is version-dependent.*

## The seven facts

1. **Three phases: parse → link → evaluate.** Linking finishes for the **whole graph** before the
   first statement of any module runs.
2. **`import` is a hoisted declaration, not a call.** Its position in the file is irrelevant.
3. **An import is a live, read-only, *indirect* binding** — your name points at the exporter's slot.
4. **Cycle + reading an imported `let`/`const` early = `ReferenceError: Cannot access 'x' before
   initialization`.** CJS gives `undefined` for the same mistake.
5. **Module scope ≠ script scope:** `this === undefined`, always strict, top-level `var` not on
   `globalThis`, no `require`/`module`/`__dirname`/`arguments`.
6. **Top-level await makes the module async** — importers wait; unsettled = **exit 13**, no throw.
7. **`export default` is a named export called `"default"`.** Not `module.exports`.

---

## The phase table — which error comes from where

```
 PARSE       fetch, parse, read import/export lists, recurse
             ERR: SyntaxError in the file · module not found

 LINK        one Module Environment Record per module,
             a box per declaration, imports wired to the EXPORTER's box
             ERR: SyntaxError: does not provide an export named 'y'
             ***NO USER CODE HAS RUN***

 EVAL        run bodies, depth-first POST-order, each module once
             ERR: everything else — TDZ, throws, rejections
```

**Proof that link precedes eval:** importing a non-existent name from a module that `console.log`s
on evaluation — the log never appears. A missing export is a `SyntaxError`, same class as a bad
brace.

**Proof that `import` is hoisted:** put both `import`s on the last lines of `main.mjs`.

```
$ node main.mjs        (main's imports are the LAST lines of the file)
  leaf.mjs   : evaluating       <- deepest first
  dep.mjs    : evaluating
  other.mjs  : evaluating       <- leaf NOT re-evaluated (one instance per URL)
  main.mjs   : statement 1
```

---

## Live bindings

```
   counter.mjs env                    main.mjs env
   count ──► [ 3 ] ◄──────────────────── count   (indirect, READ-ONLY here)
   ^ only counter.mjs may write this box
```

```javascript
// counter.mjs:  export let count = 0;  export function inc(){ count++ }
import { count, inc } from "./counter.mjs";
import * as ns from "./counter.mjs";
console.log(count, ns.count);      // 0 0
inc(); inc(); inc();
console.log(count, ns.count);      // 3 3      <- never reassigned here
const { count: snap } = ns; inc();
console.log(count, snap);          // 4 3      <- destructuring is a COPY
```

CJS mirror: `const { count, inc } = require("./counter.cjs")` → `0` forever; `mod.count` → `3`.
**CJS has no live bindings, only an object you can re-read.**

- `count = 99` in the importer → `TypeError: Assignment to constant variable.`
- → **hence ESM cannot be monkey-patched from outside** → hence loader hooks for mocking.
- **Live-ness belongs to the binding, not the module.** Any read that copies (destructuring,
  `const x = ns.y`) stops tracking.
- `export default someLet` snapshots the value; `export { someLet as default }` is live.

### The namespace object

```
prototype             : null
Symbol.toStringTag    : "Module"
Object.keys(ns)       : sorted in CODE-UNIT order  ->  [ 'VERSION', 'default' ]
isSealed              : true      isFrozen: false
descriptor of count   : { value: 0, writable: TRUE, enumerable: true, configurable: false }
ns.count = 99         : TypeError: Cannot assign to read only property 'count'
```

**The descriptor says `writable: true` and the write still throws.** Module namespaces are exotic:
`[[Set]]` returns `false` unconditionally. `writable: true` because the exporter can still change
the value — just not through this object. Only place in the language where the descriptor isn't the
authority.

---

## Module scope

| | ESM | CJS | classic script |
|---|---|---|---|
| top-level `this` | `undefined` | `module.exports` | `globalThis` |
| strict mode | always, no opt-out | opt-in | opt-in |
| top-level `var` on `globalThis` | no (module env) | no (function wrapper) | **yes** |
| `require`/`module`/`__dirname` | absent | wrapper **parameters** | absent |
| `arguments` at top level | not defined | `object`, `length === 5` | not defined |

`arguments.length === 5` in CJS is the proof of the wrapper:
`(exports, require, module, __filename, __dirname)`.

Replacements — `import.meta` is **syntax**, a `SyntaxError` outside a module, so no `typeof` check:

- `import.meta.url` — resolved `file://` URL, always present
- `import.meta.dirname` / `.filename` — Node ≥ 21.2, plain paths
- `import.meta.resolve(spec)` — resolve without importing

Strict-mode consequences you'll actually hit: undeclared assignment throws; `this` in a plain call
is `undefined`; legacy octal, `with`, duplicate params are `SyntaxError`.

**Conversion trap:** `this.foo = 1` at the top of a `.cjs` file exports `foo`; the same line in
`.mjs` is `TypeError: Cannot set properties of undefined`.

---

## Cycles — the highest-value part

**Model:** linking made a box for every binding in the graph, so **the name always resolves**;
only evaluation fills the box. An ESM cycle failure is Chapter 4's TDZ, reached across a file.

`main → a → b → a`:

```
$ node esm/main.mjs
  b: start
  b: aFn() -> aFn()                                          <- hoisted fn: initialised at LINK
  b: aValue -> ReferenceError: Cannot access 'aValue' before initialization
  b: end
  a: start                                                   <- b finished BEFORE a began
  a: bValue -> B
```

```
$ node cjs/main.cjs
  a: start                    <- a starts first: require() runs where it sits
  b: start
  b: a.aFn -> undefined       <- silent
  b: a.aValue -> undefined    <- silent
Warning: Accessing non-existent property 'aValue' of module exports inside circular dependency
```

| | ESM | CJS |
|---|---|---|
| cycle cut at | **link** — bindings exist, values don't | **eval** — half-filled `exports` object |
| early read | `ReferenceError`, names the binding | `undefined`, travels |
| starts with | deepest dependency | whichever was required first |
| hoisted functions | work (initialised at link) | `undefined` (assigned at eval) |

**Say:** *both break the cycle by handing the second module something incomplete — CJS a
partially-populated object that can't distinguish "not exported" from "not assigned yet", ESM real
bindings still in TDZ. Same bug, one is loud.*

**The fix:** never read an imported binding *during your own evaluation* — put every read inside a
function body, called after the graph finishes. Works because TDZ is about *when you read*.
Caveat to volunteer: this hides the cycle, it doesn't remove it; extract the shared piece.

---

## Static shape

Both are `SyntaxError`, at parse:

```javascript
if (flag) { import x from "./a.mjs"; }   // SyntaxError: Unexpected identifier 'x'
const n = "./a.mjs"; import x from n;    // SyntaxError: Unexpected identifier 'n'
```

**Why:** linking runs before evaluation, and both ask the linker for a value only evaluation could
produce. Allowing them costs: link-time export checking, guaranteed order, tree shaking, dead-export
proofs.

`import()` — an **operator that looks like a function**:

- runtime expression specifier · legal anywhere, including CJS
- returns a **promise for the namespace object**
- cached by resolved URL → two parallel `import()`s of one URL give the identical object
- **not a function value**: no `.call`, no `const f = import`

---

## Top-level await

- A module with TLA (or importing one, transitively) is an **async module**; its evaluation returns
  a promise and **every importer waits**.
- **Independent siblings do not wait** — measured: `sibling.mjs` evaluated between `config: start`
  and `config: resolved`. So TLA serialises *dependents*, which is why the cost hides locally.
- **Unsettled TLA = `Warning: Detected unsettled top-level await` and `exit code 13`. Nothing is
  thrown, nothing is catchable.** Loop emptied while a module was suspended.
- Scale caveat: fine behind a 2ms local read, wrong behind a network call with no timeout. Put the
  timeout in the promise, not around the import.
- TLA anywhere in a graph is what makes `require()` of it impossible.

---

## Interop

### `require()` of ESM — the answer that changed

**Node ≥ 22.12: it works, if the whole graph is synchronous.**

```
$ node require-sync-esm.cjs
[Module: null prototype] { VALUE: 'sync-esm', __esModule: true, default: [Function: default] }
```

```
$ node require-async-esm.cjs
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await.
```

**Say:** *`require` is synchronous and ESM loading has async phases — but if the graph turns out
fully synchronous, Node runs them inline and returns the namespace. With top-level await it can't,
because `require` cannot return a promise.* Node < 22.12 → `ERR_REQUIRE_ESM`.

You get the **namespace**, not `module.exports`; Node adds `__esModule: true` for the transpiler
convention. No unwrapping — `require("./x.mjs")` is not the default export.

### `import` of CJS

- **default === `module.exports`.** Always works.
- **Named imports are best-effort**: Node lexically scans with `cjs-module-lexer` for
  `exports.foo =` shapes. It does not evaluate.

```javascript
exports.staticName = 1;                 // found
if (dev) { exports.devOnly = 2; }       // FOUND — the scanner matches shapes, not conditions
exports[computedKey] = 3;               // NOT found
```

```
SyntaxError: Named export 'computedName' not found. The requested module './legacy.cjs' is a
CommonJS module, which may not support all module.exports as named exports.
```

Fix: `import pkg from './legacy.cjs'; const { computedName } = pkg;`

`module.exports = function connect(){}` + `.version` → imports as a default with properties intact;
namespace keys `[ 'default', 'version' ]`.

### `default`

`import x from "./m.mjs"` ≡ `import { default as x }`. `default` is a reserved word, so it must be
renamed to destructure. `export default` adds **one** binding; `module.exports =` **replaces the
whole object** — not the same operation.

---

## What ESM cannot do

| Can't | Because |
|---|---|
| conditional top-level import | graph must be knowable before evaluation |
| reassign / monkey-patch an import | the box belongs to the exporter |
| delete from the module registry | keyed by resolved URL, no public delete |
| `require()` an async ESM graph | `require` can't return a promise |
| check exports without importing | no reflection over the export list |
| retry a module that threw | it is recorded **errored**; the same error replays, the file does not re-run |

CJS is the opposite: a throwing module is **deleted from `require.cache`** and re-executes on the
next `require` — side effects and all. ESM fails permanently, CJS fails repeatably.

**The `?v=2` hot-reload hack, and why it's a hack:**

```
a === b (same specifier)  : true
a.store === c.store       : false      <- "./state.mjs" vs "./state.mjs?v=2"
instanceof across copies  : false
c sees the write          : undefined
```

The old instance is **joined, not replaced** — every reload leaks the previous copy.

That `instanceof` line is the **dual package hazard** in miniature: one dependency resolved by two
URLs (`.cjs` + `.mjs` build, two versions, subpath vs root) = two instances, two copies of
module-level state, cross-copy `instanceof`/`Symbol` failures. **Module identity is URL identity.**

One registry, though: `require()`d and `import()`ed *the same file* → same instance (`true`).

---

## The one sentence

> **An ES module's imports are wired to the exporter's own binding slots by a linking phase that
> completes before any code runs — so imports are live and read-only, missing exports are caught
> statically, and in a cycle the name always resolves while the value may still be in TDZ.**

```
   PARSE            LINK                        EVALUATE
   find imports  →  create every binding box  →  fill boxes, deepest first, once each
   find exports     wire imports to exporter    cycle? box exists but EMPTY → TDZ
                    slots (indirect, r/o)

   SyntaxError      SyntaxError:                ReferenceError:
   in the file      "does not provide an        "Cannot access 'x'
                     export named 'y'"           before initialization"
```

| | `require` (CJS) | `import` (ESM) |
|---|---|---|
| what it is | a function call | a hoisted declaration |
| resolved | when the line runs | before any line runs |
| you get | the `module.exports` object | indirect bindings to exporter slots |
| live | no | yes |
| importer can write | yes | no |
| missing export | `undefined` at runtime | `SyntaxError` at link |
| cycle gives | half-filled object | bindings, possibly TDZ |
| top-level `this` | `module.exports` | `undefined` |
| strict | opt-in | always |
| conditional | trivially | only `import()` |

---

## Rapid fire

- **`import` hoisted?** Yes — declaration, position irrelevant.
- **Missing export error class?** `SyntaxError`, at link, before any code runs.
- **Reassign an import?** `TypeError: Assignment to constant variable.`
- **`Object.isFrozen(namespace)`?** `false`. Every write still throws.
- **Namespace prototype?** `null`. `Symbol.toStringTag` is `"Module"`.
- **Namespace key order?** Sorted, code-unit order.
- **Top-level `this` in ESM?** `undefined`.
- **`typeof require` in ESM?** `"undefined"`.
- **`arguments.length` at the top of a CJS file?** `5`.
- **ESM cycle, early `const` read?** `ReferenceError: Cannot access 'x' before initialization`.
- **CJS cycle, same read?** `undefined` + a runtime `Warning`.
- **Why do functions survive a cycle?** Hoisted *and initialised* at link.
- **Evaluation order?** Depth-first, post-order, once per resolved URL.
- **Unsettled top-level await?** Warning + **exit 13**, nothing thrown.
- **`require()` an ESM file?** Node ≥ 22.12 yes, unless the graph has TLA →
  `ERR_REQUIRE_ASYNC_MODULE`. Older Node → `ERR_REQUIRE_ESM`.
- **What does `require()` of ESM return?** The namespace, plus `__esModule: true`.
- **`import x from "./legacy.cjs"` gives you?** `module.exports`.
- **Why do some named imports from CJS fail?** `cjs-module-lexer` scans text; computed keys aren't
  in the text.
- **`export default` ≡?** `export { x as default }` — one named binding, name `"default"`.
- **Two instances of one module?** Two resolved URLs. Dual package hazard.
- **Clear the ESM cache?** You can't. `?v=n` creates a *new* instance and leaks the old one.
- **Module threw during evaluation — import it again?** Same error, no re-run. CJS re-runs it.
