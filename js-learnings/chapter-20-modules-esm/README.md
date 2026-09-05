# Chapter 20 — Modules (ESM)

Why the module at the bottom of your file runs before the line at the top of it, why an imported
`const` can throw `ReferenceError` in a cycle where CommonJS would hand you `undefined`, why you
cannot reassign an import even though its descriptor says `writable: true`, and why `require()` of
an ESM module used to be impossible and now mostly isn't.

Chapter 19 was about a value being slightly other than the one you typed. This one is about
*bindings* — the boxes names point at — being wired up by a phase that runs **before any of your
code does**. Almost every module surprise is that phase becoming visible.

> **Read this box first.** Seven facts.
>
> 1. **A module is loaded in three phases — parse, link, evaluate — and linking finishes for the
>    entire graph before the first statement of any module runs.** Everything below is a
>    consequence of that split.
> 2. **`import` is not a function call and not a statement that "runs".** It is a declaration.
>    It is hoisted, so its position in the file is irrelevant; a dependency imported on the last
>    line evaluates before the first line.
> 3. **An import is a live, read-only, *indirect* binding** — the importing module's variable
>    points at the exporting module's slot. Not a copy. That single fact explains live values,
>    the read-only-ness, and the TDZ error in a cycle.
> 4. **In a cycle, reading an imported `let`/`const` too early throws
>    `ReferenceError: Cannot access 'x' before initialization`.** The name resolves — linking made
>    the box — but the box is empty. CommonJS gives you `undefined` for the same mistake, silently.
> 5. **Module scope is not script scope.** `this` is `undefined`, strict mode is permanently on,
>    top-level `var` never lands on `globalThis`, and there is no `require`, `module`,
>    `__dirname` or `arguments`.
> 6. **Top-level `await` makes the module *async*: every importer waits for it**, and an `await`
>    that never settles kills the process with exit code 13 and no thrown error.
> 7. **`export default` is not `module.exports`.** `default` is just a named export whose name is
>    the string `"default"`.

---

## How this chapter is examined

Modules is where an interviewer checks whether you understand *when* things happen, not just what
the syntax means. Two questions carry the round: **the cyclic-import TDZ question** (Part 4) and
**"why can't you `require()` an ESM module?"** (Part 7) — the second because the honest 2026 answer
is no longer the folklore one.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "What are live bindings?" (Part 2) | The three spec phase names (Part 1) |
| "Can you reassign an import?" (Part 2) | Module namespace exotic `[[Set]]` (Part 5) |
| "What happens with circular imports?" (Part 4) | Sorted namespace keys (Part 5) |
| *"Why can't `require()` load ESM?"* (Part 7) | `cjs-module-lexer`'s exact heuristics (Part 7) |
| "Why must imports be static / top-level?" (Part 5) | Async-module ordering rules (Part 6) |
| "`import` vs `import()`?" (Part 5) | `import.meta` beyond `url`/`dirname` (Part 3) |
| "`this` at the top of a module?" (Part 3) | Import attributes / JSON modules (Part 5) |
| "What does top-level `await` block?" (Part 6) | |
| "`export default` vs `module.exports`?" (Part 7) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every output block in this file was produced by the files in `examples/`, on **Node 22.13.0**. The
Node version matters more here than in any other chapter: `require()` of ESM changed behaviour in
22.12, so an answer that was correct in 2023 is wrong now.

**Scope note.** This is the language half. The resolution algorithm, the module cache, package
`exports` maps and loader hooks are runtime concerns and live in
`node-learnings/14-module-system-internals/`. What is here is what the *language* guarantees.

---

## Part 0 — The one idea

A script is a list of statements. **A module is a list of statements plus a contract that is
negotiated before any of them run.**

```
   SCRIPT                              MODULE
   ──────                              ──────
   read the file                       read the file
   run it top to bottom                parse it, find every import/export
   discover what it needs              fetch + parse every dependency, transitively
     as it goes                        wire every import to the exact slot it names
                                       ─── only now ───
                                       run the bodies, deepest dependency first
```

CommonJS is the first column. `require()` is a function; it runs where it sits, it returns a value,
and the only way to find out what a module exports is to execute it. ESM is the second column, and
the interesting consequences all come from the horizontal line in the middle.

**The sentence to hold onto:** *the graph is fully linked before it is partly evaluated.*

---

## Part 1 — The three phases

The spec splits loading into three operations. You do not need the spec names to answer a question,
but you do need the boundaries, because **which phase an error comes from tells you what kind of
error it is**.

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 1. CONSTRUCTION / PARSE                                                  │
 │    fetch each file, parse it into a Source Text Module Record,           │
 │    read off its import list and export list, recurse into dependencies   │
 │    ERRORS HERE: SyntaxError in the file itself, module not found         │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ 2. INSTANTIATION / LINKING                                               │
 │    allocate a Module Environment Record per module,                      │
 │    create a box for every declaration, then point every import binding   │
 │    at the exporting module's box                                         │
 │    ERRORS HERE: "does not provide an export named 'x'", ambiguous export │
 │    NO USER CODE HAS RUN YET                                              │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ 3. EVALUATION                                                            │
 │    run module bodies, depth-first, post-order, each exactly once         │
 │    ERRORS HERE: everything else — TDZ, throws, rejections                │
 └──────────────────────────────────────────────────────────────────────────┘
```

### Phase 2 finishing before phase 3 starts is observable

`examples/01-phases/` has `main.mjs` whose two `import` declarations are the **last** lines in the
file:

```javascript
// main.mjs
console.log("  main.mjs   : statement 1");
console.log("  main.mjs   : statement 2");

import { NAME } from "./dep.mjs";       // dep.mjs imports leaf.mjs
import { OTHER } from "./other.mjs";    // other.mjs also imports leaf.mjs

console.log("  main.mjs   : statement 3, has", NAME, OTHER);
```

```
$ node main.mjs
  leaf.mjs   : evaluating
  dep.mjs    : evaluating, sees leaf-value
  other.mjs  : evaluating, sees leaf-value
  main.mjs   : statement 1
  main.mjs   : statement 2
  main.mjs   : statement 3, has dep other
```

Three things in one run:

- **Position doesn't matter.** `import` is a declaration, and declarations are hoisted. Moving it to
  the bottom changed nothing.
- **Depth-first, post-order.** `leaf` is the deepest, so it goes first; a module runs only after
  every module it imports has finished.
- **Each module evaluates once.** `leaf.mjs` is imported by both `dep` and `other` and logs once.
  The registry is keyed by resolved URL, and the second request gets the already-evaluated record.

### Phase 2 errors happen without running anything

This is the part people miss. `link-error.mjs` asks for an export that doesn't exist, from a module
that logs loudly when it evaluates:

```javascript
// noisy.mjs
console.log("  noisy.mjs  : if you can see this, evaluation happened");
export const REAL = 1;

// link-error.mjs
import { REAL, IMAGINARY } from "./noisy.mjs";
```

```
$ node link-error.mjs
import { REAL, IMAGINARY } from "./noisy.mjs";
               ^^^^^^^^^
SyntaxError: The requested module './noisy.mjs' does not provide an export named 'IMAGINARY'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:180:21)
```

**`noisy.mjs` never printed.** It was fetched and parsed, and its export list was read — but the
link failed, so evaluation never began. Note also the error *class*: `SyntaxError`, not
`ReferenceError`. A missing export is a **static** defect in this language, the same category as an
unbalanced brace, even though the two files are separately valid on their own.

Compare the CommonJS mirror, `runtime-error.cjs`:

```
$ node runtime-error.cjs
  noisy.cjs  : evaluated (CJS runs the file to find out what it exports)
reached anyway: 1 undefined
```

CJS had to run the file to learn its shape, and then the typo became a plain `undefined` that
travels. **This is the whole argument for static module syntax**, and it is the answer to "why
can't imports be dynamic": the checkable-before-running property is what you would be giving up.

> **What developers think happens:** `import` is a fancier `require` — it fetches a module and
> assigns the result.
> **What actually happens:** by the time any of your code runs, every module in the graph has
> already been fetched, parsed, and had its imports wired to specific slots. `import` is a
> declaration about that wiring, not an instruction to perform it.

---

## Part 2 — Live bindings

An import is an **indirect binding**: the importing module's environment record does not hold a
value for `count`, it holds a pointer to the *exporting* module's box for `count`.

```
   counter.mjs environment            main.mjs environment
   ┌────────────────────┐             ┌──────────────────────────┐
   │ count  ──► [ 3 ]   │◄────────────┼── count  (indirect ref)  │
   │ inc    ──► [fn]    │◄────────────┼── inc    (indirect ref)  │
   └────────────────────┘             └──────────────────────────┘
        the box lives here                 the name lives here
        writable by counter.mjs            READ-ONLY through this name
```

`examples/02-live-bindings/`:

```javascript
// counter.mjs
export let count = 0;
export function inc() { count++; }

// main.mjs
import { count, inc } from "./counter.mjs";
import * as ns from "./counter.mjs";

console.log("before:", count, ns.count);
inc(); inc(); inc();
console.log("after :", count, ns.count);

const { count: snapshot } = ns;     // destructuring READS — this is a copy
inc();
console.log("live:", count, " snapshot:", snapshot);
```

```
$ node main.mjs
before: 0 0
after : 3 3
live: 4  snapshot: 3
```

`count` was never reassigned in `main.mjs`, and `inc` is not returning anything — yet the value
read through the imported name changed. It changed because the read goes to `counter.mjs`'s box.

**The last line is the one worth memorising.** Destructuring the namespace is an ordinary property
read, so `snapshot` is a value copy and stops tracking immediately. *Live-ness belongs to the
binding, not to the module.*

### The CommonJS contrast, which is what interviewers actually want

```javascript
// counter.cjs
exports.count = 0;
exports.inc = function inc() { exports.count++; };

// main.cjs
const { count, inc } = require("./counter.cjs");   // destructured = copied
const mod = require("./counter.cjs");              // object reference
```

```
$ node main.cjs
before: 0 0
after : 0 3
```

`count` is stuck at `0` forever. `require()` returns an object; destructuring it copies the
current values out. The `mod.count` read works only because you kept the object and dereferenced it
late. **CJS has no live bindings — it has an object you can reach through**, and every stale-value
bug in CJS code is someone destructuring at the top of a file.

### You cannot assign to an import

```javascript
import { count } from "./counter.mjs";
count = 99;
```

```
TypeError: Assignment to constant variable.
```

The box belongs to `counter.mjs`. Only code inside that module may write it. This is what makes
ESM statically analysable at all: an exported binding has exactly one writer, so a bundler can prove
what a name can be.

It is also why **you cannot monkey-patch an ES module from the outside**, which is the entire reason
test frameworks need loader hooks to mock ESM while `jest.mock` on CJS was a one-liner. That
connection is worth volunteering — it turns a language fact into a tooling fact.

### The namespace object lies in its descriptors

```
$ node assign-to-namespace.mjs
prototype of namespace: null
Symbol.toStringTag    : Module
keys (sorted?)        : [ 'count', 'inc' ]
isSealed / isFrozen   : true / false
descriptor of count   : { value: 0, writable: true, enumerable: true, configurable: false }
ns.count = 99 -> TypeError: Cannot assign to read only property 'count' of object '[object Module]'
ns.brandNew = 1 -> TypeError: Cannot add property brandNew, object is not extensible
```

Read those last three lines together. The descriptor says **`writable: true`** and the assignment
throws anyway. A module namespace is an *exotic object*: its internal `[[Set]]` is defined to return
`false` unconditionally, regardless of what `[[GetOwnProperty]]` reports. `writable: true` is there
because the *value* genuinely can change — the exporting module can still reassign `count` — but not
through this object.

So: **`Object.isFrozen(ns)` is `false` while every write fails.** It is the only place in the
language where a property descriptor is not the authority on whether a write succeeds.

---

## Part 3 — Module scope is a different scope

`examples/03-module-scope/`, the same program in both formats:

```
$ node scope.mjs                            $ node scope.cjs
this                     : undefined        this                : {} === module.exports: true
globalThis.topLevelVar   : undefined        globalThis.topLevelVar : undefined
globalThis.topLevelFn    : undefined        typeof require      : function
typeof require           : undefined        typeof __dirname    : string
typeof module            : undefined        typeof arguments    : object
typeof __dirname         : undefined        arguments.length    : 5
import.meta.url          : .../scope.mjs    undeclared = 1 succeeded : 1
import.meta.dirname      : string           this inside a plain call : globalThis
undeclared = 1 -> ReferenceError            
this inside a plain call : undefined        
typeof arguments         : not defined      
```

Four facts and their reasons:

**`this` is `undefined`.** Not `globalThis`, not `{}`. The spec sets `[[ThisValue]]` on a module
environment to `undefined` deliberately, so that `this` at the top level can never be mistaken for
a place to hang state. In CJS `this` is `module.exports`, which is why `this.foo = 1` at the top of
a `.cjs` file exports `foo` — and why that idiom silently exports nothing after a conversion to
`.mjs`. In a classic `<script>`, it's `globalThis`.

**Strict mode is permanent.** Module code is strict, there is no `"use sloppy"`, and `eval` inside
a module inherits it:

```
$ node sloppy-attempt.mjs
15 octal literal is fine
legacy octal 010 -> SyntaxError: Octal literals are not allowed in strict mode.
with statement   -> SyntaxError: Strict mode code may not include a with statement
duplicate params -> SyntaxError: Duplicate parameter name not allowed in this context
```

The practical consequences you'll actually hit: assignment to an undeclared variable throws instead
of creating a global, `this` in a plain function call is `undefined` instead of `globalThis`, and
duplicate parameter names are rejected.

**Top-level `var` does not create a global property.** `globalThis.topLevelVar` is `undefined` in
both columns — but for *different reasons*, and interviewers like that difference. In CJS it's
because the file is wrapped in a function, so `var` is function-scoped to the wrapper. In ESM it's
because the module has its own environment record whose outer scope is the global one; `var` is
scoped to the module, full stop. Same observation, two mechanisms.

**`arguments.length` is `5` in CJS.** That is the proof of the wrapper. Node compiles every CJS file
as the body of a function taking `(exports, require, module, __filename, __dirname)` — which is why
`require` and `__dirname` are not globals but *parameters*, and why they are simply absent from a
module, where there is no wrapper at all.

The replacement is `import.meta`, a module-only object:

- `import.meta.url` — the fully-resolved `file://` URL of the current module. Always present.
- `import.meta.dirname` / `import.meta.filename` — Node ≥ 21.2, the plain paths, added because
  everyone was writing `fileURLToPath(new URL('.', import.meta.url))`.
- `import.meta.resolve(spec)` — resolve a specifier against this module without importing it.

`import.meta` is *syntax*, not an object you can reference elsewhere: it is a `SyntaxError` outside
a module, so it cannot be feature-detected with `typeof`.

---

## Part 4 — Cycles, and why ESM throws where CJS shrugs

This is the highest-value part of the chapter, and it is also where the sibling Node chapter is
wrong: `node-learnings/14-module-system-internals/` says cycles "safely point to empty memory
slots". They point at slots, and the slots are empty — but reading one is not safe. It throws.

### The mental model

Linking created a box for **every** binding in the graph. So in a cycle the *name* always resolves —
there is never an "is not defined" error. What linking cannot do is put a value in the box; only
evaluation does that. So the failure mode of an ESM cycle is precisely the **temporal dead zone**
you already know from `let` and `const` in Chapter 4, just reached across a file boundary.

```
   LINK (no code has run)                   EVALUATE (depth-first)
   a.aValue  ──► [ uninitialised ]          b runs first: reads a.aValue ──► TDZ ──► throws
   b.bValue  ──► [ uninitialised ]          a runs second: reads b.bValue ──► [ "B" ] ──► fine
```

### Measured

`examples/04-cycles/esm/` — `main` imports `a`, `a` imports `b`, `b` imports back from `a`:

```
$ node esm/main.mjs
  b: start
  b: aFn() -> aFn()
  b: aValue -> ReferenceError: Cannot access 'aValue' before initialization
  b: end
  a: start
  a: bFn() -> bFn()
  a: bValue -> B
  a: end
main: importing a
main: done
```

Three separate lessons in nine lines:

1. **`b` evaluates entirely before `a` starts**, even though `a` is the one `main` asked for.
   Depth-first post-order does not care what you typed first.
2. **`aFn()` works.** Function declarations are hoisted *and initialised* during instantiation, so
   the box already holds the function before any evaluation. This is why the classic advice
   "export functions, not values" actually works — it is not style, it is the hoisting rule.
3. **`aValue` throws.** `const` is hoisted but left uninitialised. The binding exists, the value
   does not, and reading it is a `ReferenceError`.

The CommonJS version of the identical cycle:

```
$ node cjs/main.cjs
main: requiring a
  a: start
  b: start
  b: a.aFn -> undefined
  b: a.aValue -> undefined
  b: end
  a: b.bFn() -> bFn()
  a: b.bValue -> B
  a: end
main: done
(node:18273) Warning: Accessing non-existent property 'aFn' of module exports inside circular dependency
```

Compare the two carefully — this contrast is the answer to the question:

| | ESM | CJS |
|---|---|---|
| Where the cycle is cut | at **linking**: bindings exist, values don't | at **evaluation**: you get the half-filled `exports` object |
| Reading too early | `ReferenceError` — loud, at the exact line | `undefined` — silent, travels downstream |
| Which module starts | deepest dependency first (`b`) | the one that was required first (`a`) |
| Hoisted functions | initialised at link, so they work | assigned during evaluation, so they're `undefined` |
| Diagnosis | the error names the binding | a runtime `Warning`, if you're lucky |

**The sentence:** *both systems break a cycle by handing the second module something incomplete —
CJS hands it a partially-populated object and can't tell "not exported" from "not assigned yet", ESM
hands it real bindings that are still in TDZ, so the same mistake is a thrown error instead of an
`undefined` that propagates.*

Note the CJS warning text: *"Accessing non-existent property"*. Node cannot distinguish a cycle
ordering bug from a typo, because in CJS there is nothing to distinguish them with. ESM can, because
linking recorded that the export exists.

### The fix, and why it works

`examples/04-cycles/esm-fix/` is the same cycle with one rule applied: **no module reads an imported
binding during its own evaluation.** Every read is inside a function body.

```javascript
// a.mjs
import { describeB } from "./b.mjs";
export const aValue = "A";
export function describeA() { return `a says ${aValue}, and ${describeB()}`; }
```

```
$ node esm-fix/main.mjs
  b: evaluated (read nothing)
  a: evaluated (read nothing)
main: a says A, and b says B and can see a's A
```

It works because by the time anyone *calls* `describeA`, every module has finished evaluating and
every box is full. TDZ is about *when you read*, not about where the binding came from. That is also
the honest caveat to give: **this doesn't remove the cycle, it moves the read to a point where the
cycle no longer matters.** A cycle in the graph is still a design smell — extract the shared piece
into a third module — but it is not, by itself, a bug.

---

## Part 5 — The static shape: what you must give up, and what you get

An `import` declaration must be **at the top level** with a **string-literal specifier**. Both are
enforced by the parser, and both fail before the file runs:

```javascript
// conditional-static.mjs
if (process.env.FEATURE === "on") {
  import heavy from "./heavy.mjs";
}
```

```
SyntaxError: Unexpected identifier 'heavy'
    at compileSourceTextModule (node:internal/modules/esm/utils:338:16)
```

```javascript
// computed-specifier.mjs
const name = "./heavy.mjs";
import x from name;
```

```
SyntaxError: Unexpected identifier 'name'
```

**Why the language cannot allow either:** linking runs before evaluation, and both of these ask the
linker to know something that only evaluation could produce — the value of `process.env`, the value
of `name`. Allowing them would mean the graph could not be known until it was already running, which
would take away the very things static structure buys: link-time export checking (Part 1), a
guaranteed evaluation order, tree shaking, and a bundler's ability to prove which exports are dead.

### `import()` is the escape hatch, and it's a different thing

```javascript
if (FEATURE) {
  const mod = await import("./heavy.mjs");
}
```

```
$ node dynamic.mjs                        $ FEATURE=on node dynamic.mjs
FEATURE = false                           FEATURE = true
before the dynamic import                 before the dynamic import
heavy.mjs was never fetched, parsed,        heavy.mjs: evaluated (expensive)
  linked or evaluated                     namespace keys : [ 'VERSION', 'default' ]
  heavy.mjs: evaluated (expensive)        default is fn  : function
same namespace object twice: true         calling it     : heavy result
                                          same namespace object twice: true
```

`import()` is an *operator* that looks like a function. It:

- takes a runtime expression, so the specifier can be computed;
- works anywhere — inside `if`, inside a function, inside CommonJS;
- returns a **promise for the module namespace object**, so the module is loaded, linked and
  evaluated at that moment;
- is cached by resolved URL like everything else, which is why the two parallel imports produce the
  identical namespace object.

It is not a function value: you cannot do `const f = import; f("./x.mjs")`, and it has no
`.call`/`.bind`. That's a favourite follow-up.

Note the ordering in the left-hand column: `heavy.mjs` still evaluated, *after* the `else` branch
printed. That's the second `Promise.all([import(...), import(...)])` at the bottom of the file
running unconditionally — a reminder that a dynamic import in dead-looking code still pulls the
module in as soon as it's reached.

### The namespace object's keys are sorted

`[ 'VERSION', 'default' ]` — not declaration order. The spec sorts a namespace's own keys in
code-unit order, so `VERSION` (uppercase) precedes `default`. Anything that iterates a namespace and
depends on ordering is depending on ASCII.

---

## Part 6 — Top-level `await` makes the module async

A module containing top-level `await` — or importing one that does, transitively — becomes an
**async module**. Its evaluation returns a promise, and every module that imports it waits for that
promise before its own body runs.

`examples/06-top-level-await/`:

```javascript
// config.mjs
export const settings = await new Promise((r) => setTimeout(() => r({ region: "eu-west-1" }), 50));

// main.mjs
import { settings } from "./config.mjs";
import { NAME } from "./sibling.mjs";
console.log("main:", NAME, settings);
```

```
$ node main.mjs
  config: start
  sibling: evaluated (no await anywhere)
  config: resolved
main: sibling { region: 'eu-west-1' }
```

The important detail is the middle line: **`sibling.mjs` did not wait.** Async modules suspend only
the modules that depend on them and their own continuation; independent siblings keep evaluating.
So top-level await serialises your *dependents*, not the whole graph — which is exactly why the
cost is easy to under-estimate: nothing looks slow locally, and then the one module that imports
your config module turns out to be everything.

### The failure mode: an await that never settles

```javascript
// gate.mjs
export const gate = new Promise(() => {});     // nothing ever settles this
// user.mjs
import { gate } from "./gate.mjs";
await gate;
```

```
$ node stall/main.mjs
  gate: evaluating
  user: awaiting the gate
Warning: Detected unsettled top-level await at .../stall/user.mjs:3
await gate;
^

exit code = 13
```

**No error was thrown, and nothing was caught.** The event loop simply emptied while a module was
still suspended, and Node exited 13. In production this is a container that starts, logs nothing
useful, and dies — and every `try`/`catch` you own is irrelevant, because there was no exception.
The scale caveat: fine for a config file behind a fast local read, catastrophic behind a network
call with no timeout. Put the timeout in the promise, not around the import.

### And it is what actually blocks `require()`

```
$ node require-async-esm.cjs
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await.
Use import() instead.
```

Which brings us to the question that has changed answers.

---

## Part 7 — Interop, in 2026

### `require()` of ESM now works — if the graph is synchronous

The folklore answer is *"you can't `require()` an ES module because ESM is asynchronous."* That was
true until **Node 22.12**, where `require(esm)` shipped unflagged:

```javascript
// require-sync-esm.cjs
const m = require("./sync.mjs");
```

```
$ node require-sync-esm.cjs
require of a SYNC esm module -> [Module: null prototype] {
  VALUE: 'sync-esm',
  __esModule: true,
  default: [Function: default]
} | default: function
```

So the precise answer is: **`require()` is synchronous, and ESM *loading* has asynchronous phases —
but if the whole graph turns out to be synchronous, Node can run those phases to completion inline
and hand back the namespace.** When it can't — top-level await anywhere in the graph — you get
`ERR_REQUIRE_ASYNC_MODULE`, because the one thing `require` cannot do is return a promise.

Two details worth having:

- You get the **namespace object**, not `module.exports`. A `.default` is on it, and Node adds
  `__esModule: true` so that the transpiled-interop convention (`m.__esModule ? m.default : m`)
  keeps working. There is no unwrapping: `require("./sync.mjs")` is not the default export.
- On Node < 22.12 the same call is `ERR_REQUIRE_ESM`. Knowing *which* error you'd see dates your
  answer correctly.

### `import` of CommonJS: the default is `module.exports`

```javascript
// legacy.cjs
exports.staticName = "found by static analysis";
exports.helper = function helper() { ... };
const computed = "computedName";
exports[computed] = "assigned through a variable key";
if (process.env.NODE_ENV !== "production") { exports.devOnly = "conditionally attached"; }
```

```
$ node import-named.mjs
staticName: found by static analysis
helper()  : helper()

$ node import-computed.mjs
SyntaxError: Named export 'computedName' not found. The requested module './legacy.cjs' is a
CommonJS module, which may not support all module.exports as named exports.
```

**Named imports from CJS are a best-effort convenience, not a guarantee.** ESM needs an export list
at link time; a CJS module doesn't have one until it runs. Node bridges this by *lexically scanning*
the source with `cjs-module-lexer` for `exports.foo =` patterns. That scan is textual, so:

- `exports.staticName = …` → found.
- `exports.devOnly = …` inside an `if` → **also found** (it appears in `Object.keys(ns)` below),
  because the scanner doesn't evaluate conditions, it matches shapes.
- `exports[computed] = …` → **not found**, because the key isn't in the text.

The default export always works, because it is just `module.exports` itself:

```
$ node import-default.mjs
default keys : [ 'staticName', 'helper', 'computedName', 'devOnly' ]
namespace    : [ 'default', 'devOnly', 'helper', 'staticName' ]
computed via default: assigned through a variable key
ns.default === legacy: true
```

Which is exactly what Node's own error message tells you to do: `import pkg from './legacy.cjs'`
then destructure. The two lines above are the whole interop story — the lexer found three of four
names statically; the fourth was only ever reachable through the object.

And the shape real libraries ship — `module.exports = function …` — imports cleanly as a default,
with its attached properties intact:

```
$ node import-reassigned.mjs
connect('db://x') : connected to db://x
connect.version   : 1.4.0
namespace keys    : [ 'default', 'version' ]
```

### `export default` is a named export called `"default"`

```
$ node default-is-a-name.mjs
an ESM namespace  : [ 'VALUE', 'default' ]
sync.default      : function
renamed()         : sync-esm | VALUE: sync-esm
```

`import x from "./m.mjs"` is sugar for `import { default as x }`. There is nothing special about the
slot; the only special thing is that `default` is a reserved word, so it needs renaming to be
destructured. This is why `export default` and `module.exports =` are **not** the same operation:
the first adds one named binding among many, the second replaces the entire exports object.

A live consequence: `export default someLet` exports the *value at that moment*, not a live binding,
because `export default <expression>` evaluates the expression. `export { someLet as default }` does
give you a live binding. That difference catches people.

---

## Part 8 — What ESM cannot do, and why

Interviewers ask this directly; the "why" is always the same phase split.

**You cannot conditionally import at the top level.** The graph must be knowable before evaluation.
Use `import()`.

**You cannot reassign or monkey-patch an imported binding.** It belongs to the exporter. This is
what makes ESM mocking a loader-hook problem rather than an assignment.

**You cannot delete a module from the registry — there is no `require.cache` equivalent.** The ESM
registry is keyed by resolved URL and has no public delete. The only handle you have is the URL
itself:

```javascript
const a = await import("./state.mjs");
const c = await import("./state.mjs?v=2");     // different URL -> different module instance
```

```
$ node identity.mjs
  state.mjs: evaluated — a NEW instance was created
  state.mjs: evaluated — a NEW instance was created
a === b (same specifier)  : true
a.store === c.store       : false
instanceof across copies  : false
b sees the write          : 1
c sees the write          : undefined
```

That query-string trick is the standard hot-reload hack, and the output shows exactly why it is a
hack rather than a reload: the old instance is **not** replaced, it is *joined*. Two `Map`s, two
`Token` classes, and `instanceof` false across them. Every reload leaks the previous copy, since the
registry never releases it.

That last line — `new a.Token() instanceof c.Token` is `false` — is also the **dual package hazard**
in miniature. Whenever a dependency ends up resolved by two different URLs (a `.cjs` and a `.mjs`
build, two versions in the tree, a subpath and a root specifier), you get two module instances, two
copies of any module-level state, and cross-copy `instanceof` and `Symbol` checks that fail for
reasons no stack trace explains. Module identity is URL identity.

**You cannot synchronously load an async ESM graph from CJS.** Part 7. `require` cannot return a
promise.

**You cannot retry a module that threw.** A module that throws during evaluation is recorded as
*errored*, and every later request replays the same error without re-running the file:

```
$ node retry.mjs                          $ node retry.cjs
  boom.mjs: evaluating                      boom.cjs: evaluating
attempt 0 -> boom                         attempt 0 -> boom
attempt 1 -> boom                           boom.cjs: evaluating     <- ran AGAIN
                                          attempt 1 -> boom
```

CommonJS does the opposite: a throwing module is **deleted from `require.cache`**, so the next
`require` re-executes it — side effects and all. Neither is obviously right, but they fail in
opposite directions. ESM's failure is permanent and consistent for the life of the process; CJS's
is retryable and can run half a module's side effects several times. If you have a CJS module that
opens a connection and then throws, that is two connections.


**You cannot observe a module's exports before it links.** There is no "does this module export X"
check that isn't itself an import.

One thing that *is* shared: a `require()`d and an `import()`ed ESM file are the same instance.

```
$ node both-worlds.cjs
  state.mjs: evaluated — a NEW instance was created
require()d === import()ed : true
```

One registry, one evaluation. The split is between *URLs*, never between the two syntaxes.

---

## Part 9 — Where this bites in production

- **A cycle that was fine in CJS becomes a crash in ESM.** The migration surfaces it as
  `Cannot access 'x' before initialization` from a file nobody edited. That is an upgrade — the bug
  existed before, silently, as an `undefined` — but it lands as a regression at 2am.
- **Top-level await in a shared module serialises everything downstream of it,** and an unsettled
  one exits 13 with no exception (Part 6). Fine for a config file behind a 2ms local read; wrong for
  a network call in a service that must start under a health-check deadline.
- **Two copies of a "singleton".** Dual package hazard, above. The symptom is state that resets, or
  an `instanceof` that fails for an object that is visibly the right class.
- **Named imports from a CJS dependency work in dev and fail in CI** when the export was attached
  behind a condition the lexer read differently, or through a computed key. The fix is a default
  import and a destructure — deliberately, not superstitiously.

---

## The one sentence

> **An ES module's imports are wired to the exporter's own binding slots by a linking phase that
> completes before any code runs — so imports are live and read-only, missing exports are caught
> statically, and in a cycle the name always resolves while the value may still be in TDZ.**

```
   PARSE            LINK                        EVALUATE
   ─────            ────                        ────────
   find imports  →  create every binding box  →  fill the boxes, deepest first
   find exports     wire imports to exporter    each module exactly once
                    slots (indirect, r/o)       cycle? the box exists but is EMPTY → TDZ

   SyntaxError      SyntaxError:                ReferenceError:
   in the file      "does not provide an        "Cannot access 'x'
                     export named 'y'"           before initialization"
```

| | `require` (CJS) | `import` (ESM) |
|---|---|---|
| What it is | a function call | a declaration, hoisted |
| When resolved | when the line runs | before any line runs |
| What you get | the `module.exports` object | indirect bindings to the exporter's slots |
| Live? | no — an object you re-read | yes — the binding itself |
| Writable by importer? | yes, it's a plain object | no |
| Missing export | `undefined` at runtime | `SyntaxError` at link |
| Cycle gives you | a half-filled object | real bindings, possibly in TDZ |
| `this` at top level | `module.exports` | `undefined` |
| Strict mode | opt-in | always |
| Conditional | trivially | only via `import()` |

---

## Next

Chapter 21 — `undefined` vs `null` vs missing: `??` versus `||`, optional chaining, default
parameters, and the three different ways a property can not be there.

**Exercises first.** `exercises/chapter_exercise.md`, then `exercises/cumulative_exercise.md`.
