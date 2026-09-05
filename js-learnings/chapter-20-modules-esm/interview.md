# Chapter 20 — Interview Questions: Modules (ESM)

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

Two questions decide this round. **Q5** — circular imports — because the difference between the
ESM answer and the CJS answer is the difference between someone who has read about modules and
someone who has migrated a codebase. And **Q9** — `require()` of ESM — because the folklore answer
is now out of date, and saying the current one accurately is the cheapest way in this whole track
to sound like you keep up.

One habit for the whole chapter: **when you are asked what happens, answer with which phase it
happens in.** "That's a link error, so no code has run yet" is a stronger sentence than any
description of the symptom.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What's the difference between `require` and `import`?" · 75s

The opener. It's broad on purpose, and most people answer it with syntax.

**Say:**

> The syntax difference is the least interesting part. `require` is a **function call** — it runs
> where it sits, it returns the `module.exports` object, and the only way to find out what a module
> exports is to execute it. `import` is a **declaration**, and it's processed by a phase that runs
> before any of my code does.
>
> ES modules load in three phases: parse, link, evaluate. Parse fetches every file in the graph and
> reads off its import and export lists. Link creates a binding — a box — for every declaration in
> every module, and points each import at the exporting module's box. Only then does evaluation
> run the bodies, deepest dependency first.
>
> Nearly every difference people list falls out of that. Imports are hoisted, so where you write
> them doesn't matter. A missing export is a `SyntaxError` at link time rather than an `undefined`
> at runtime. Imports are live and read-only, because they point at someone else's box. And you
> can't import conditionally, because the graph has to be known before anything runs.

**Scored on:** answering with the phase split rather than a syntax list. "It's static versus
dynamic" is the two-year answer; naming *what* the static phase does is the four-year one.

**They'll push:** *"What does static buy you?"* → Link-time export checking, a deterministic
evaluation order, and tree shaking — a bundler can prove an export is unused because an exported
binding has exactly one writer.

**Red flags:** "`import` is asynchronous and `require` is synchronous" as the whole answer — it's
about loading phases, not about async. "`import` is ES6 syntax for `require`."

---

## Q2 — "What are live bindings?" · 60s

**Say:**

> An import isn't a copy of a value, it's an **indirect binding** — my module's variable points at
> the exporting module's own slot. So if the exporter reassigns it, I see the new value, without
> anything being pushed to me.
>
> The demo is a counter module that exports `let count` and an `inc` function. I import both, log
> `count`, call `inc` three times, log again — and it's gone from 0 to 3, even though nothing in my
> file ever assigned to `count`.
>
> The part I'd flag is that **live-ness belongs to the binding, not to the module**. The moment you
> copy the value out — destructure the namespace, or `const c = ns.count` — you have an ordinary
> snapshot and it stops tracking.
>
> CommonJS has nothing equivalent. `require` gives you an object, so `const { count } = require(…)`
> copies the value once and is stale forever, whereas keeping the object and reading `mod.count`
> late works. That's the source of most stale-value bugs in CJS code: someone destructured at the
> top of the file.

**Scored on:** "the binding, not the module" — and volunteering the destructuring caveat, which is
the form the bug actually takes.

**They'll push:** *"Can you reassign an imported binding?"* → No. `TypeError: Assignment to
constant variable`. The box belongs to the exporter, and it's read-only through my name.

**And then:** *"So how do you mock an ES module in tests?"* → You can't by assignment, which is
exactly why ESM mocking needs loader hooks or `module.register`, while `jest.mock` on CommonJS was
just reassigning a property on an object.

**Red flags:** "It's like pass-by-reference." Saying the module object is live when it's the
binding that is.

---

## Q3 — "Is this a valid module? What does it print?" · 60s

```javascript
console.log("A");
import "./dep.mjs";      // dep.mjs logs "dep"
console.log("B");
```

**Say:**

> It's valid, and it prints `dep`, then `A`, then `B`.
>
> `import` is a declaration, and declarations are hoisted — its position in the file is irrelevant.
> More than that: the entire dependency graph is parsed and linked before evaluation starts, and
> then evaluation is depth-first and post-order, so every module I import finishes running before
> my first statement.
>
> The rule I'd state is that a module body is the *last* thing to run in its own subtree.

**Scored on:** getting `dep` first, and giving "hoisted declaration" as the reason rather than
"imports go at the top by convention".

**They'll push:** *"What if two of my modules import the same file?"* → It evaluates once. The
registry is keyed by resolved URL; the second request gets the existing module record.

**And then:** *"Two different specifiers resolving to the same file?"* → Same URL, same instance.
Different URLs — including a query string, or a `.cjs` and `.mjs` build of one package — are two
separate instances with separate state. That's the dual package hazard.

**Red flags:** predicting `A`, `dep`, `B`. Saying it's a `SyntaxError` because imports must be at
the top of the file — they must be at the *top level*, which is not the same thing.

---

## Q4 — "Why must the specifier be a string literal?" · 60s

```javascript
const path = "./" + name + ".mjs";
import mod from path;
```

**Say:**

> Because linking happens before evaluation, and this asks the linker for a value only evaluation
> could produce. It's a `SyntaxError` at parse — not a runtime failure, the file doesn't even
> compile. Same for putting an `import` inside an `if`.
>
> And the restriction is what pays for everything else. If the graph couldn't be known before
> running, you'd lose link-time export checking, the deterministic evaluation order, and tree
> shaking — a bundler can only prove an export is dead because it can see every import statically.
>
> When I genuinely need a runtime specifier I use `import()`, which is a different mechanism: it
> takes an expression, works anywhere including inside CommonJS, and returns a promise for the
> module namespace object.

**Scored on:** "the linker would need a value only evaluation can produce". The trade framing —
what the restriction buys — is the level marker.

**They'll push:** *"Is `import()` a function?"* → No, it's an operator that looks like one. You
can't do `const f = import`, and it has no `call` or `bind`. It gets special syntax because it needs
to know which module is doing the importing, to resolve the specifier relative to it.

**And then:** *"What does it resolve to?"* → The namespace object — same object you'd get from
`import * as ns` — so the default export is on `.default`.

**Red flags:** "you can, with a bundler". Confusing `import()` with `require` because both are
"dynamic".

---

## Q5 — "What happens with circular imports?" · 90s

**The question that decides the round.** Answer it with the contrast; the contrast is the content.

**Say:**

> Both module systems handle a cycle by giving the second module something incomplete. The
> difference is what "incomplete" means, and whether you find out.
>
> In ESM, linking already created a box for every binding in the whole graph — so in a cycle the
> **name always resolves**, there's never an "is not defined". What linking can't do is fill the
> box; only evaluation does that. So if module B reads an imported `const` from A while A is still
> mid-evaluation, you get `ReferenceError: Cannot access 'aValue' before initialization`. It's
> ordinary TDZ, just reached across a file boundary.
>
> In CommonJS the cycle is cut at evaluation instead: B gets A's `exports` object as it stands right
> now, half-populated, and the missing property is just `undefined`. And CJS can't tell "A never
> exported this" from "A hasn't got to that line yet" — there's no export list to check against —
> so it emits a vague runtime warning at best.
>
> One asymmetry worth knowing: **function declarations survive an ESM cycle**, because they're
> hoisted *and initialised* during linking, so the box already holds the function. That's why the
> old advice "export functions, not values" works — it isn't style, it's the hoisting rule.

**Scored on:** "the name resolves, the value doesn't" — and knowing the ESM error is a
`ReferenceError` with that exact TDZ shape rather than `undefined`. Most candidates describe CJS
behaviour and assume ESM matches.

**They'll push:** *"How would you fix it?"* → Make sure no module reads an imported binding during
its own evaluation — move every read inside a function body, so it runs after the graph has
finished. But I'd say plainly that this hides the cycle rather than removing it; the real fix is
extracting the shared piece into a third module.

**And then:** *"Which module evaluates first?"* → The deepest dependency. In ESM, `main → a → b →
a`, `b` runs to completion before `a` starts. In CJS, `a` starts first, because `require` runs
where it sits — so the two systems even disagree about the order.

**Red flags:** "circular imports don't work" (they do, with defined semantics). Saying ESM gives
`undefined` — that's the CJS answer. Not knowing that a `ReferenceError` here means the binding
exists.

---

## Q6 — "What is `this` at the top of a module?" · 45s

**Say:**

> `undefined` — in an ES module. Not `globalThis`, not an empty object. The spec sets the module
> environment's this-value to `undefined` deliberately, so top-level `this` can't be mistaken for a
> place to hang state.
>
> In CommonJS it's `module.exports`, which matters practically: `this.foo = 1` at the top of a
> `.cjs` file actually exports `foo`. Move that file to `.mjs` and the same line is
> `TypeError: Cannot set properties of undefined`. And in a classic browser `<script>` it's
> `globalThis`. Three formats, three answers.

**Scored on:** the three-way answer and the conversion trap. Just saying "undefined" is correct but
scores half.

**They'll push:** *"What else is different about module scope?"* → Strict mode is permanently on
with no opt-out. Top-level `var` doesn't become a `globalThis` property. There's no `require`,
`module`, `exports`, `__dirname` or `arguments` — those are parameters of Node's CommonJS wrapper
function, not globals. `import.meta.url` replaces `__dirname`, or `import.meta.dirname` on Node
21.2 and up.

**And then:** *"How do you know they're wrapper parameters?"* → Log `arguments.length` at the top of
a `.cjs` file: it's `5`. `(exports, require, module, __filename, __dirname)`.

**Red flags:** "`globalThis`". Calling `require` and `__dirname` globals.

---

## Q7 — "What does `import * as ns` give you?" · 60s

**Say:**

> A **module namespace exotic object**. It's not a plain object: its prototype is `null`, its
> `Symbol.toStringTag` is `"Module"`, and its own keys are sorted in code-unit order rather than
> declaration order — so `VERSION` comes before `default`.
>
> It's sealed, and every write to it fails. The detail I like is that if you look at the property
> descriptor it says `writable: true`, and the assignment throws anyway —
> `TypeError: Cannot assign to read only property`. That's because a namespace's internal `[[Set]]`
> is defined to return false unconditionally, regardless of the descriptor. The `writable: true` is
> honest about the *value* changing, since the exporting module can still reassign it — just not
> through this object.
>
> So it's the one place in the language where the descriptor isn't the authority on whether a write
> succeeds. And `Object.isFrozen` on it is `false`, even though nothing can be written.

**Scored on:** knowing it's exotic rather than a plain object, and ideally the descriptor
contradiction — that one is a genuine level marker because it can only come from having looked.

**They'll push:** *"Is `default` on it?"* → Yes, as a normal key. `import x from "./m.mjs"` is sugar
for `import { default as x }`; `default` only needs renaming because it's a reserved word.

**Red flags:** "it's just an object with the exports on it". Saying it's frozen.

---

## Q8 — "What does top-level `await` do to my app?" · 75s

**Say:**

> It turns the module into an **async module**: its evaluation returns a promise, and every module
> that imports it — transitively — waits for that promise before its own body runs.
>
> The nuance is that independent siblings *don't* wait. I've measured it: a config module awaiting a
> 50ms promise, and an unrelated sibling evaluates in the gap. So top-level await serialises your
> dependents, not the whole graph — which is why the cost hides in development. Nothing looks slow,
> and then it turns out the one module importing your config module is everything.
>
> The failure mode I'd actually worry about is an await that never settles. There's no exception —
> the event loop just empties while a module is still suspended, Node prints
> `Warning: Detected unsettled top-level await` and exits with **code 13**. Nothing you wrapped in
> `try`/`catch` is involved. In production that's a container that starts, logs nothing useful, and
> dies.
>
> So: fine for a config file behind a fast local read, wrong for a network call with no timeout —
> and the timeout goes in the promise, not around the import, because there's nothing to wrap.

**Scored on:** "importers wait, siblings don't" plus the exit-13 failure. The scale caveat is the
sentence that raises the level.

**They'll push:** *"Does it block the event loop?"* → No — it's an `await`, the loop keeps turning.
It defers *module evaluation*, not execution generally. That distinction matters because people
assume it's a blocking startup cost like a synchronous `readFileSync`, and it isn't.

**And then:** *"Anything it makes impossible?"* → It's what stops a CommonJS file `require`-ing that
graph, which is Q9.

**Red flags:** "it blocks the thread". Not knowing the process exits rather than hanging forever.

---

## Q9 — "Why can't you `require()` an ES module?" · 90s

**The dating question.** The expected answer has been wrong since Node 22.12, and saying so
correctly is worth more here than anywhere else in this chapter.

**Say:**

> As of Node 22.12 you often *can*, and I think the honest version of the answer is more useful
> than the old one.
>
> The real constraint is that `require` is synchronous and must return a value, while ESM loading
> has phases that are allowed to be asynchronous. But if the whole graph turns out to be
> synchronous — no top-level await anywhere in it — Node can run those phases to completion inline
> and hand the namespace back. That's `require(esm)`, unflagged since 22.12.
>
> When it can't, you get `ERR_REQUIRE_ASYNC_MODULE`: "require() cannot be used on an ESM graph with
> top-level await". That's the one thing `require` genuinely cannot do, because it would have to
> return a promise. On Node before 22.12 the same call was a blanket `ERR_REQUIRE_ESM`.
>
> Two details: what comes back is the **namespace object**, not `module.exports`, so the default
> export is on `.default` — there's no unwrapping. And Node adds `__esModule: true` so the
> transpiled-interop convention keeps working.

**Scored on:** knowing it changed, and stating the constraint as "require can't return a promise"
rather than "ESM is async". Even if the interviewer doesn't know 22.12 shipped, the reasoning is
right either way — and this is the moment to be precise about a version.

**They'll push:** *"So is CJS/ESM interop solved?"* → No. That direction is one-way and doesn't
touch the dual package hazard: if a dependency gets resolved through two URLs — a `.cjs` build and a
`.mjs` build, or two versions in the tree — you get two module instances, two copies of any
module-level state, and `instanceof` failing across them. Module identity is URL identity.

**Red flags:** "you can't, ESM is asynchronous" with no qualification. Claiming `require()` of ESM
returns the default export.

---

## Q10 — "Why do named imports from a CommonJS package sometimes fail?" · 60s

```javascript
import { something } from "some-cjs-package";
// SyntaxError: Named export 'something' not found.
```

**Say:**

> Because ESM needs an export list at link time and a CommonJS module doesn't have one until it
> runs. Node bridges that by **lexically scanning** the CJS source with `cjs-module-lexer`, looking
> for `exports.foo =` shapes in the text. It's a text scan, not an evaluation, so it's best-effort.
>
> Which means `exports.foo = …` is found, and interestingly so is one inside an `if` block — the
> scanner matches shapes, it doesn't evaluate conditions. But `exports[someVariable] = …` is not
> found, because the name isn't in the text at all.
>
> The default import always works, because the default of a CJS module is literally
> `module.exports`. So the fix is the one Node's own error message suggests: import the default and
> destructure from it. I'd do that deliberately rather than superstitiously — it's not a workaround,
> it's the only form that reflects what CJS actually guarantees.

**Scored on:** "there is no export list until it runs, so Node scans the text". The conditional-vs-
computed distinction is the detail that shows you've looked at the failure rather than memorised the
fix.

**They'll push:** *"So why does it work in dev and fail in CI?"* → Because the scan is over source
text: a different build, a minified or bundled dist file, or an export attached through a helper can
change what the scanner can see, without changing what the module does at runtime.

**Red flags:** "CJS and ESM don't mix". Suggesting a bundler as the explanation.

---

## Q11 — "How would you hot-reload a module?" · 60s

**Say:**

> You can't, properly. There's no ESM equivalent of deleting from `require.cache` — the registry is
> keyed by resolved URL and has no public delete.
>
> The hack is to change the URL: `await import("./mod.mjs?v=" + Date.now())`. That does give you
> freshly evaluated code, but it's worth being clear about what happened. The old instance isn't
> replaced, it's **joined**. I've measured it: two namespaces, two separate `Map`s, and
> `new a.Token() instanceof c.Token` is `false`. Every reload leaks the previous copy, because the
> registry never releases anything.
>
> So it's fine for a dev-time watcher on a leaf module. For anything holding state, or anything
> whose classes cross the boundary, it's a memory leak with confusing `instanceof` bugs attached —
> and the honest answer is to restart the process.

**Scored on:** "joined, not replaced" and naming the leak. Anyone can recite the query-string trick;
knowing its cost is the answer.

**They'll push:** *"Is that the same problem as the dual package hazard?"* → Yes, exactly the same
mechanism — one file, two URLs, two instances. The hazard just reaches it by accident through
package resolution instead of on purpose.

**Red flags:** presenting `?v=` as a solution. Thinking `import.meta` or a loader gives you a
`delete`.

---

## Q12 — "`export default` vs `module.exports`?" · 45s

**Say:**

> They look equivalent and they aren't. `export default` adds **one named binding whose name is the
> string `"default"`** — it sits alongside your other named exports, and
> `import x from "./m.mjs"` is just sugar for `import { default as x }`. `module.exports = …`
> **replaces the entire exports object**, so it wipes everything else out.
>
> One consequence people hit: `export default someVariable` exports the *value at that moment*,
> because the right-hand side is an expression that gets evaluated. It's not a live binding, even
> though every other export is. If you want a live default you have to write
> `export { someVariable as default }`.

**Scored on:** "default is just a name". The expression-versus-binding detail is the level marker —
it's the one export that behaves like CommonJS.

**They'll push:** *"Default or named exports for a library?"* → Named, mostly: they're statically
checkable at link time, they survive renaming better in tooling, and they tree-shake. A default is
one more thing to guess the right name for at every call site.

**Red flags:** "`export default` is the ESM version of `module.exports`."

---

## Rapid fire — one sentence each

- **Is `import` hoisted?** Yes, it's a declaration; its position in the file is irrelevant.
- **Error class for a missing export?** `SyntaxError`, thrown at link, before any code runs.
- **Does the imported module evaluate before the failing link?** No — nothing runs.
- **Assign to an import?** `TypeError: Assignment to constant variable.`
- **`Object.isFrozen(ns)`?** `false`, and every write still throws.
- **Namespace prototype?** `null`; `Symbol.toStringTag` is `"Module"`.
- **Namespace key order?** Sorted in code-unit order, not declaration order.
- **Top-level `this` in ESM / CJS / script?** `undefined` / `module.exports` / `globalThis`.
- **`typeof require` inside a `.mjs`?** `"undefined"`.
- **`arguments.length` at the top of a `.cjs`?** `5` — the wrapper's parameters.
- **Evaluation order?** Depth-first, post-order, once per resolved URL.
- **ESM cycle, early `const` read?** `ReferenceError: Cannot access 'x' before initialization`.
- **CJS cycle, same read?** `undefined`, plus a runtime warning.
- **Why do functions survive a cycle?** Hoisted *and* initialised during linking.
- **Unsettled top-level await?** Warning, then exit code 13 — nothing thrown.
- **Does top-level await block siblings?** No, only importers.
- **`require()` an ESM file today?** Yes on Node ≥ 22.12, unless the graph has top-level await.
- **What does that return?** The namespace object, with `__esModule: true` added.
- **Default import of a CJS module?** `module.exports` itself.
- **Why do some CJS named imports fail?** `cjs-module-lexer` scans text; computed keys aren't there.
- **Clear the ESM registry?** You can't; `?v=n` adds an instance and leaks the old one.
- **Re-import a module that threw?** The same error replays; it is not re-evaluated. CJS deletes it
  from `require.cache` and re-runs it.
- **Two instances of one package?** Two resolved URLs — the dual package hazard.
- **Is `import()` a function?** No, an operator; no `call`, no `bind`, can't be aliased.
- **Feature-detect `import.meta`?** You can't — it's syntax, a `SyntaxError` outside a module.
