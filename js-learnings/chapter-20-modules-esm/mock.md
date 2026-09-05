# Chapter 20 — Mock Interview: Modules (ESM)

A realistic 20-minute round on modules, written as a transcript. **I** is the interviewer, **You**
is the answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

This round has a shape worth knowing in advance. The opener sounds like a syntax question and is
really a *timing* question; minute 8 is the one that separates people who've read about modules
from people who've migrated a codebase; and the closer is a version-dating question where the
common answer has been out of date since Node 22.12.

The single habit that carries the whole round: **answer "what happens" with "in which phase"**.

---

## Minute 0–3 — The opener

> **I:** What's actually different about `import` compared to `require`?

> **You:** The syntax is the least interesting part. `require` is a function call — it runs where
> it sits, returns the `module.exports` object, and the only way to know what a module exports is to
> execute it. `import` is a declaration, handled by a phase that finishes before any of my code
> runs.
>
> ES modules load in three phases. Parse fetches every file in the graph and reads its import and
> export lists. Link creates a binding — a box — for every declaration in every module, and points
> each import at the *exporting* module's box. Only then does evaluation run the bodies, deepest
> dependency first.
>
> Almost everything people list as a difference falls out of that one split. Imports are hoisted.
> A missing export is a `SyntaxError` at link instead of an `undefined` at runtime. Imports are live
> and read-only because they point at someone else's box. And you can't import conditionally,
> because the graph has to be known before anything runs.

⟵ *The phase split, volunteered, is the whole opener. "One is static, one is dynamic" is the
two-year version of the same sentence; naming what the static phase actually does is the four-year
one. Notice the answer never mentions `async` — that's the trap in this question.*

> **I:** What does being static buy you, concretely?

> **You:** Three things. Export typos are caught before anything runs. The evaluation order is
> deterministic, so it's the same in dev and in prod. And tree shaking — a bundler can prove an
> export is unused, because an exported binding has exactly one writer and every import of it is
> visible without running code.

⟵ *"Exactly one writer" is a strong throwaway. It connects tree shaking to the read-only rule
rather than treating it as a bundler feature.*

---

## Minute 3–8 — The prediction

> **I:** What does this print?

```javascript
// counter.mjs
export let count = 0;
export function inc() { count++; }

// main.mjs
import { count, inc } from "./counter.mjs";
import * as ns from "./counter.mjs";

console.log(count, ns.count);
inc(); inc(); inc();
console.log(count, ns.count);

const { count: snapshot } = ns;
inc();
console.log(count, snapshot);
```

> **You:** `0 0`, then `3 3`, then `4 3`.
>
> The first two lines are live bindings: `count` in `main` isn't a copy, it's an indirect binding
> pointing at `counter.mjs`'s own slot. Nothing in `main` assigns to it and the value still changes,
> because the read goes to the exporter's box.
>
> The last line is the one worth being careful about. Destructuring the namespace is an ordinary
> property read, so `snapshot` is a value copy and stops tracking straight away — `4` and `3`.
> **Live-ness belongs to the binding, not to the module.**

⟵ *Everyone gets `3 3`. The level marker is the third line and the sentence that explains it. In
real code the bug is always this shape — someone destructured at the top of a file and wondered why
their value went stale.*

> **I:** What if I add `count = 99` in `main.mjs`?

> **You:** `TypeError: Assignment to constant variable.` The box belongs to `counter.mjs`, and only
> code inside that module may write it.
>
> Worth connecting: that's exactly why mocking an ES module in tests needs a loader hook or
> `module.register`, while `jest.mock` on CommonJS was just reassigning a property on an object.
> The language guarantee that makes ESM analysable is the same one that makes it un-patchable.

⟵ *Unprompted, that link is the strongest sentence available in this section. It turns a language
rule into a tooling consequence the interviewer has personally been annoyed by.*

> **I:** And `ns.count = 99`?

> **You:** Also throws — `Cannot assign to read only property 'count' of object '[object Module]'`.
> Though the fun part is that if you print the property descriptor it says `writable: true`. A
> module namespace is an exotic object whose internal `[[Set]]` returns false unconditionally,
> regardless of the descriptor. It's the one place in the language where the descriptor isn't the
> authority on whether a write succeeds — and `Object.isFrozen` on it is `false` while nothing can
> be written.

⟵ *This is a "have you actually looked" detail. It cannot be guessed, and it costs nothing to say.*

---

## Minute 8–13 — The live debug

> **I:** This worked as CommonJS. It was converted to ESM and now it crashes on startup. What's
> going on?

```javascript
// config.mjs
import { DEFAULTS } from "./defaults.mjs";
export const config = { ...DEFAULTS, region: "eu-west-1" };

// defaults.mjs
import { config } from "./config.mjs";
export const DEFAULTS = { retries: 3, timeoutMs: config?.timeoutMs ?? 1000 };
```

> **You:** It's a cycle, and the crash is `ReferenceError: Cannot access 'config' before
> initialization` in `defaults.mjs`.
>
> The graph is `config → defaults → config`. Depth-first evaluation means `defaults.mjs` runs first,
> and it reads `config` at line 2 — while `config.mjs` hasn't evaluated at all. Linking already
> created the box for `config`, so the *name* resolves; there's no "is not defined". But `const` is
> hoisted uninitialised, so the read is a temporal dead zone error. It's ordinary TDZ, just reached
> across a file boundary.
>
> The reason it "worked" in CommonJS is the part that matters. CJS cuts the cycle at evaluation
> instead: `defaults` would have got `config.mjs`'s half-populated exports object, `config` would
> have been `undefined`, and the `?.` and `??` would have quietly swallowed it. So it didn't work —
> it silently used `1000` instead of the configured timeout, and nobody found out.

⟵ *"It didn't work, it failed silently" is the answer. Framing the crash as the migration exposing
an existing bug — rather than as a regression ESM introduced — is the difference between a candidate
who has read the docs and one who has done this.*

> **I:** Would it help if `defaults.mjs` exported a function instead?

> **You:** Yes, and it's worth being precise about why. Function declarations are hoisted *and
> initialised* during linking, so their box already holds the function before any evaluation. That's
> why the old advice "export functions, not values" survives a cycle — it isn't style, it's the
> hoisting rule.
>
> But the fix here isn't the export shape, it's *when the read happens*. If `DEFAULTS` becomes
> `getDefaults()` and the `config` read moves inside the body, it runs after the whole graph has
> finished evaluating and every box is full. TDZ is about when you read, not where the binding came
> from.
>
> I'd say plainly though: that hides the cycle, it doesn't remove it. The real fix is pulling the
> shared constants into a third module that neither imports the other.

⟵ *Two things scored here. The precise reason functions survive — "initialised at link" — and
refusing to present the lazy-read trick as a fix. Naming your own workaround as a workaround reads
as seniority.*

> **I:** Which module would evaluate first in the CommonJS version?

> **You:** The opposite one. In ESM, `defaults` runs to completion before `config` starts, because
> evaluation is depth-first post-order. In CJS, `config` starts first and gets interrupted mid-body
> at the `require` line. The two systems don't just differ on what you get in a cycle — they differ
> on who runs first.

⟵ *A detail almost nobody has. It's the clearest possible evidence that you've run both.*

---

## Minute 13–18 — The whiteboard

> **I:** Build me a plugin loader. Plugins are ES modules in a directory; each default-exports an
> object with a `name` and a `run` function. Load them all, skip broken ones, and give me a way to
> call one by name.

> **You:** The core is `import()`, because the specifier is only known at runtime — a static
> `import` can't be built from a directory listing.

```javascript
import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

export async function loadPlugins(dir) {
  const registry = new Map();
  const failures = [];

  const files = (await readdir(dir)).filter((f) => f.endsWith(".mjs"));

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const url = pathToFileURL(path.join(dir, file)).href;   // absolute URL, not a bare specifier
      const ns = await import(url);
      const plugin = ns.default;
      if (typeof plugin?.run !== "function") {
        throw new TypeError(`${file}: default export has no run()`);
      }
      return [plugin.name ?? path.basename(file, ".mjs"), plugin];
    }),
  );

  for (const [i, r] of results.entries()) {
    if (r.status === "fulfilled") registry.set(...r.value);
    else failures.push({ file: files[i], error: r.reason });
  }

  return { registry, failures };
}
```

> Four decisions I'd call out:
>
> **`pathToFileURL`, not the path.** `import()` takes a *specifier*, and a bare string like
> `plugins/a.mjs` is resolved as a package name, not a relative path. A raw Windows path isn't a
> valid URL at all. This is the line that breaks in CI on a different OS.
>
> **`ns.default`, not `ns`.** `import()` resolves to the namespace object, so the default export is
> on `.default`. Same for a dynamically imported CommonJS plugin, where `.default` is
> `module.exports`.
>
> **`allSettled`, not `all`.** One plugin with a syntax error should not take down the loader —
> and I want to report *which* one, which is why I keep the index.
>
> **Validate the shape.** A default export is whatever the plugin author wrote. `typeof
> plugin?.run !== "function"` is the boundary check; without it the failure surfaces much later, at
> call time, in the caller's stack.

⟵ *`pathToFileURL` is the single highest-signal line on this whiteboard — it's the one that only
appears if you've actually shipped dynamic imports. `allSettled` with the index preserved is the
second.*

> **I:** Now make it hot-reloadable — I edit a plugin, it picks up the change without a restart.

> **You:** I can do it, but I'd want to say what it actually costs first, because "reload" is the
> wrong word for what happens.
>
> There's no ESM equivalent of deleting from `require.cache`. The registry is keyed by resolved URL
> and has no public delete. So the only handle is the URL itself — append a cache-busting query:

```javascript
const url = pathToFileURL(file).href + `?v=${mtimeMs}`;
```

> But the old module isn't replaced, it's **joined**. Two instances now exist. I've measured this:
> two separate module-level `Map`s, and `new a.Token() instanceof b.Token` is `false`. Every reload
> leaks the previous copy, because the registry never releases anything.
>
> So I'd use `mtimeMs` rather than `Date.now()`, so an unchanged file doesn't create a new instance
> on every scan; I'd keep it dev-only; and I'd say up front that anything holding state, or with
> classes crossing the plugin boundary, needs a process restart instead. Fine for ten reloads in a
> dev session, wrong for a long-running process.

⟵ *Anyone can produce the query-string trick. The scoring is entirely in "joined, not replaced", the
`instanceof` consequence, and choosing `mtimeMs` over `Date.now()` for a reason. The scale caveat at
the end is the sentence that most raises the level in this round.*

> **I:** Is that the same problem as the dual package hazard?

> **You:** Exactly the same mechanism — one file reachable by two URLs, so two module instances with
> two copies of any module-level state. The hazard just gets there by accident through package
> resolution: a `.cjs` and a `.mjs` build, or two versions in the tree. Module identity is URL
> identity, and once you say it that way both problems are the same sentence.

⟵ *Collapsing two named problems into one mechanism is a senior move. It shows the model is doing
the work, not memory.*

---

## Minute 18–20 — The closer

> **I:** Last one. Why can't you `require()` an ES module?

> **You:** As of Node 22.12 you usually can, and I think the honest version is more useful than the
> old one.
>
> The real constraint is that `require` is synchronous and has to return a value, while ESM loading
> has phases that are *allowed* to be asynchronous. If the whole graph turns out to be synchronous —
> no top-level await anywhere in it — Node runs those phases inline and hands back the namespace.
> That shipped unflagged in 22.12.
>
> When it can't, you get `ERR_REQUIRE_ASYNC_MODULE` — "require() cannot be used on an ESM graph with
> top-level await". That's the case that's genuinely impossible, because `require` would have to
> return a promise. Before 22.12 it was a blanket `ERR_REQUIRE_ESM`.
>
> Two things people get wrong about the result: it's the **namespace object**, not `module.exports`,
> so the default is on `.default`; and Node adds `__esModule: true` so the transpiled-interop
> convention still works.

⟵ *The version, the specific error code, and "require can't return a promise" as the constraint. Even
with an interviewer who doesn't know 22.12 shipped, the reasoning holds — and being the person who
knows which Node version changed a behaviour is a cheap, durable signal.*

> **I:** Anything you'd change about how we're using modules?

> **You:** Two things I'd look for. Any top-level `await` in a widely-imported module — because it
> serialises everything downstream of it, and if the promise never settles the process exits 13 with
> a warning and no exception, which is very hard to diagnose from a container that just stops.
>
> And whether any dependency is resolving to two URLs. That's the one that produces bug reports like
> "the singleton reset" or "`instanceof` says it isn't a `Foo` but it obviously is".

⟵ *Ending on two things you'd go and check, both with a named symptom, is a better closer than a
list of best practices.*

---

## The levels table

The same question, answered at three levels.

**"What happens with circular imports?"**

| Level | Answer |
|---|---|
| **2yr** | "They cause problems — you should avoid them. You might get `undefined`." |
| **4yr** | "In ESM the name always resolves because linking created every binding, but the value can still be in TDZ — so reading an imported `const` too early throws `ReferenceError: Cannot access 'x' before initialization`. CommonJS gives you a half-populated exports object instead, so the same mistake is a silent `undefined`." |
| **Senior** | The 4yr answer, plus: "Function declarations survive because they're initialised at link, not at evaluation — that's why 'export functions, not values' works. And the evaluation order differs too: ESM runs the deepest dependency first, CJS runs whichever was required first. The fix is to move reads inside function bodies so they happen after the graph finishes, but that hides the cycle rather than removing it." |

**"Why must import specifiers be static?"**

| Level | Answer |
|---|---|
| **2yr** | "It's a rule — imports have to be at the top with a string." |
| **4yr** | "Linking happens before evaluation, so the specifier has to be knowable without running code. `import()` is the escape hatch." |
| **Senior** | The 4yr answer, plus what it buys: "Link-time export checking, deterministic evaluation order, and tree shaking. All three need the graph to be knowable statically, so the restriction is the price of them — and `import()` gives it up deliberately, per call site." |

**"What is top-level await's cost?"**

| Level | Answer |
|---|---|
| **2yr** | "It waits before the module finishes loading." |
| **4yr** | "The module becomes async and every importer waits for it — but independent siblings don't, so the cost is on your dependents." |
| **Senior** | The 4yr answer, plus the failure: "If the promise never settles there's no exception — the loop empties, Node warns about an unsettled top-level await and exits 13. Nothing you wrapped is involved. Fine behind a fast local read, wrong behind a network call with no timeout, and the timeout has to be in the promise because there's nothing to wrap." |

---

## The sentences that raise your level most

Said unprompted, in this round, each of these is worth more than a correct answer:

1. **"Live-ness belongs to the binding, not the module."** — destructuring kills it.
2. **"The name resolves; the value is in TDZ."** — the whole cycle answer in seven words.
3. **"Functions survive a cycle because they're initialised at link, not evaluation."**
4. **"That's the migration exposing an existing bug, not a regression."**
5. **"This hides the cycle, it doesn't remove it."** — naming your own workaround.
6. **"The old module is joined, not replaced."** — the reload leak.
7. **"Module identity is URL identity."** — collapses hot reload and dual package into one fact.
8. **"`require` can't return a promise."** — the actual constraint, not "ESM is async".
9. **"Fine for ten reloads in a dev session, wrong for a long-running process."** — the scale caveat.
10. **"The descriptor says `writable: true` and the write still throws."** — you looked.

---

## Red flags in this round

- **"`import` is asynchronous, `require` is synchronous."** It's about phases, not async. This one
  answer will cost you the opener and the closer.
- **Predicting `undefined` for an ESM cycle.** That's the CommonJS answer, and it says you've read
  about ESM rather than run it.
- **"Circular imports don't work."** They work, with defined semantics, in both systems.
- **Calling `require`, `module` and `__dirname` globals.** They're the CommonJS wrapper's
  parameters — `arguments.length` is `5`.
- **`import()` with a bare relative path in the loader.** Betrays never having shipped it.
- **Presenting `?v=Date.now()` as hot reload** with no mention of the leak.
- **"`export default` is the ESM `module.exports`."** One adds a named binding; the other replaces
  the object.
- **"You can't `require()` ESM"** with no version qualification, in 2026.
- **Saying the namespace object is frozen.** It's sealed; `isFrozen` is `false`.
- **Explaining top-level await as blocking the event loop.** It defers module evaluation; the loop
  keeps turning.
