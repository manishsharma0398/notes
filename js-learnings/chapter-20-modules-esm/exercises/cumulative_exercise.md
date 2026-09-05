# Chapter 20 — Cumulative Exercise: Build a Module System

**Time:** 1–3 hours. **Scope:** everything from Chapters 13–20 — callbacks and inversion of control,
promises, microtask ordering, error semantics, retention, and modules.

Implement a **miniature module system** that reproduces both CommonJS and ESM semantics, on the same
fixture graph, and prove the differences by measurement rather than assertion.

This is a whiteboard question at this level in its short form — *"implement `require`"* — and the
long form is the more interesting one, because the CommonJS half takes about twenty minutes and the
ESM half is where you find out whether you actually understand linking.

**The deliverable is a comparison table you can defend, not a working loader.** Each phase adds one
mechanism and re-runs the *same* fixtures; the last phase is a written comparison against real Node.

No libraries. No parsing — see below. Node only.

---

## The fixtures

You are not writing a JavaScript parser. Each module is a **descriptor object** that declares what a
parser would have extracted, plus a body function:

```javascript
// fixtures.mjs — the graph every phase runs against. Do not change it after Phase 1.
export const GRAPH = {
  "app": {
    imports: [{ from: "config", names: ["settings", "describe"] }],
    exports: ["main"],
    body: (imported, exports, log) => {
      log("app: body start");
      log("app: settings =", imported.settings);
      exports.main = () => `main sees ${imported.describe()}`;
      log("app: body end");
    },
  },

  "config": {
    imports: [{ from: "defaults", names: ["DEFAULTS"] }],
    exports: ["settings", "describe"],
    body: (imported, exports, log) => {
      log("config: body start");
      exports.settings = { ...imported.DEFAULTS, region: "eu-west-1" };
      exports.describe = () => `config for ${exports.settings.region}`;
      log("config: body end");
    },
  },

  // the cycle: defaults reaches back into config
  "defaults": {
    imports: [{ from: "config", names: ["settings"] }],
    exports: ["DEFAULTS"],
    body: (imported, exports, log) => {
      log("defaults: body start");
      log("defaults: sees settings =", imported.settings);   // <-- the interesting line
      exports.DEFAULTS = { retries: 3 };
      log("defaults: body end");
    },
  },
};
```

Two rules that make this exercise honest:

- **`imported.settings` must be a real read through your machinery**, not a value captured before
  the body ran. If your design lets a body close over a plain object that you mutate later, you have
  built the CommonJS answer and you will not be able to build the ESM one on top of it.
- **`log` collects into an array** rather than printing, so every phase produces a comparable trace.

---

## Phase 0 — The trace harness

**Build**

- `makeLog()` → `{ log, lines }`, where `log(...args)` appends a formatted line.
- `run(system, entry)` → `{ lines, error }` — never throws; captures the error and returns the trace
  up to the point it stopped.
- `diff(a, b)` → prints two traces side by side with the first differing line marked.

**Success criteria**

- [ ] A run that throws still returns every line logged before the throw.
- [ ] `diff` on two identical traces prints nothing, and on the Phase 1 vs Phase 4 traces will later
      point at exactly one line.
- [ ] One sentence, written down now: what does "the same trace" prove, and what does it not?

---

## Phase 1 — CommonJS

Build `cjsSystem(graph)` with a single entry point `require(name)`.

The semantics you are reproducing, all of which you can state from Chapter 20:

- `require` is a **function call**: the dependency is loaded at the point the body asks for it.
- Each module has a mutable `exports` object, created **before** the body runs and cached
  immediately — that is what makes the cycle terminate.
- A module in the cycle receives whatever is on that object *right now*.
- A body that throws **removes** the module from the cache.

**Build**

```javascript
export function cjsSystem(graph, log) {
  const cache = new Map();
  function require(name) { /* ... */ }
  return { require, cache };
}
```

**Success criteria**

- [ ] `require("app")` completes, and the trace shows `defaults: sees settings = undefined`.
- [ ] Each body runs exactly once across the whole run.
- [ ] The cache holds the `exports` object *before* the body runs — demonstrate this with an
      assertion, not a comment.
- [ ] A fixture that throws is gone from the cache afterwards, and requiring it again re-runs the
      body. Prove it with a counter.
- [ ] Write down: which line of the trace is the bug, and why nothing in the system can detect it.

---

## Phase 2 — Split parse, link and evaluate

Now build `esmSystem(graph)` — but stop before bindings. This phase is only about **ordering**.

**Build**

- `parse(entry)` — walk the graph from the entry, collecting every reachable module into records.
  Detect a missing module here.
- `link(records)` — for now, only verify that every imported name appears in the exporting module's
  `exports` list. **Throw the equivalent of Node's error, with the same shape:**
  `does not provide an export named 'x'`.
- `evaluate(records)` — run bodies **depth-first, post-order**, each exactly once.

**Success criteria**

- [ ] Add a fixture importing a name that doesn't exist. The error is raised by `link`, and **no
      body has run** — assert on the trace being empty, not on your memory of it.
- [ ] The evaluation order for the fixture graph differs from Phase 1's. Show both traces with
      `diff` and say in one sentence which rule produced each order.
- [ ] Your post-order walk terminates on the cycle. Say what you used to make it terminate, and what
      the equivalent is in the real algorithm.
- [ ] The `imported` object handed to a body is still not live. Confirm that; you fix it next.

---

## Phase 3 — Live bindings

Replace the plain `imported` object with real indirection: **a read of `imported.x` must reach the
exporting module's own slot at the moment of the read.**

**Build**

- A per-module **environment**: one slot per declared export.
- An `imported` view that resolves each name to the exporting module's slot on every access.
- Writes through `imported` must fail. Match the language: a namespace write throws a `TypeError`
  even though the slot is writable by its owner.

**Success criteria**

- [ ] A test where module A exports `let n = 0` and a `bump()`; B imports both, reads `n`, calls
      `bump()`, reads `n` again, and sees `0` then `1` — **with no mutation of any shared object by
      your test**.
- [ ] Destructuring the view produces a snapshot that does *not* track. Assert on both behaviours in
      one test, because the pair is the point.
- [ ] `view.n = 5` throws; `Object.getOwnPropertyDescriptor(view, "n").writable` is `true`. If your
      implementation can't produce that combination, say what the real language uses that you don't
      have.
- [ ] One sentence: which chapter's mechanism did you actually use to build the indirection — and
      why a getter and a closure are the same answer here.

---

## Phase 4 — TDZ across the cycle

Give each slot three states: **uninitialised**, **initialised**, and — for a `const` — **frozen after
first write**.

Reading an uninitialised slot throws
`ReferenceError: Cannot access 'settings' before initialization`.

**Build**

- Slot state transitions, set by `link` (create, uninitialised) and by the body (initialise).
- Hoisted-function semantics: a fixture may declare an export as a **function declaration**, and
  those must be *initialised during linking*, before any body runs.

**Success criteria**

- [ ] The unchanged fixture graph now throws where Phase 1 logged `undefined` — same graph, same
      entry, different failure. `diff` the two traces and point at the single line.
- [ ] Change `defaults` to read `describe()` (a hoisted function) instead of `settings`. It now
      works. Explain why in one sentence containing the word *link*.
- [ ] Apply the "move the read into a function body" fix and show the graph completing. Then write
      the PR description you would put on that change — including the sentence about what it does
      *not* fix.
- [ ] Your error message names the binding. Say why CommonJS structurally cannot produce that
      message.

---

## Phase 5 — The namespace object

Give the system `namespaceOf(record)` returning a module namespace with the real properties:

- prototype `null`, `Symbol.toStringTag` of `"Module"`;
- own keys **sorted in code-unit order**, not declaration order;
- sealed: no new properties, none configurable;
- **every write fails, while descriptors report `writable: true`**;
- reads are live, and reading an uninitialised slot still throws.

**Success criteria**

- [ ] `Object.isSealed(ns)` is `true` and `Object.isFrozen(ns)` is `false`.
- [ ] `Object.keys(ns)` on a module exporting `zebra`, `Apple`, `default` returns them in the order
      real ESM would. Verify against a real `.mjs`, don't reason it out.
- [ ] Every one of the four write attempts from the chapter exercise fails the same way yours does.
- [ ] One paragraph: which invariant of your implementation is a lie about the real language, and
      what would have to be true for it not to be. (There is at least one — find it before you are
      asked about it.)

---

## Phase 6 — Async modules

A module descriptor may declare `async: true`, meaning its body returns a promise.

**Build**

- Evaluation of an async module returns a promise; its **importers** await it.
- **Siblings do not wait.** Prove this with a trace: an async module and an independent sibling in
  the same parent's import list, where the sibling's body appears *between* the async module's start
  and its resolution.
- A synchronous entry point that reaches an async module must fail the way `require` does —
  a distinct error, not a generic one.

**Success criteria**

- [ ] The sibling-doesn't-wait trace, exactly as measured in the chapter's `06-top-level-await`
      example.
- [ ] `requireSync(entry)` on a graph containing an async module throws your equivalent of
      `ERR_REQUIRE_ASYNC_MODULE` — and on a fully synchronous graph, returns the namespace.
- [ ] Detect the async-ness **transitively**, before evaluating anything. Say which phase that check
      belongs in and why it cannot be discovered during evaluation.
- [ ] A cycle where two async modules await each other. What does your system do? What *should* it
      do? Real Node has an answer here; find out what it is before you write yours.

---

## Phase 7 — The comparison

The actual deliverable. One table, filled in from **your** system and from **real Node**, run
side by side on the equivalent real `.mjs`/`.cjs` fixtures.

| | your CJS | real CJS | your ESM | real ESM |
|---|---|---|---|---|
| first body to run | | | | |
| what `defaults` sees | | | | |
| error class / message | | | | |
| bodies run per module | | | | |
| behaviour after a throw | | | | |
| hoisted function in a cycle | | | | |
| missing export detected at | | | | |
| namespace write | | | | |
| async module from sync entry | | | | |

Then, in prose, no more than a page:

1. **The one mechanism** that produces most of the ESM column. Name it in a sentence.
2. **Every place your system diverges from Node**, and for each: is it a simplification you chose or
   a misunderstanding you found? Be honest about which.
3. **The three sentences you would say** if an interviewer asked you to explain circular imports,
   now that you have implemented both.
4. **What you could not build, and why.** There are at least two things in the real system you have
   no way to reproduce with objects and closures. Name them.

---

## Success criteria for the whole exercise

- [ ] One fixture graph, unchanged from Phase 1, produces every behaviour in the table.
- [ ] Every claim in the table came from a run, not from this chapter's notes.
- [ ] You can explain the ESM cycle result without using the word "cache".
- [ ] You can say what a binding is in one sentence, without saying "variable".

---

## If you want to go further

Deliberately out of scope — do these only if the core is finished and written up:

- **Retention.** Hold a namespace from a module that has been "reloaded" under a new key and show
  the old record is still reachable. That is Chapter 17's mechanism producing Chapter 20's leak.
- **The `?v=` reload,** in your system: two records for one descriptor, and an `instanceof` that
  fails across them.
- **A `classify`-style loader** that reports which phase failed, reusing the chapter exercise's
  build.
