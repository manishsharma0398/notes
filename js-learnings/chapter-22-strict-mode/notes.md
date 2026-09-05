# Chapter 22 — Strict Mode: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The seven facts

1. **A second dialect**, not a linter and not a flag. Two sets of semantics in the spec; every
   piece of code is parsed under one.
2. **The directive is an ordinary string literal** — so an engine that never heard of it evaluates
   a string, discards it, and runs sloppily instead of throwing.
3. **Must be the FIRST statement** of a script or function body. A statement before it (comments
   are fine) makes it inert, silently.
4. **Lexical, inherited, one-way.** Nested functions inherit; no `"use sloppy"`; the **caller's
   mode is irrelevant**.
5. **ES modules and class bodies are always strict** — no directive, no opt-out.
6. **Three categories of change**, not twenty items: silent failures → errors; `this`/`arguments`
   behave differently; some syntax removed at parse time.
7. **It exists because the web can't break.** You can never remove a behaviour, so you define a
   new dialect and let code opt in.

---

## The one sentence

> **JS cannot remove a behaviour — every page ever written must keep working. So the only way to
> fix a mistake is a second dialect that doesn't have it. Strict mode is that dialect.**

```
   sloppy                              strict
   ──────                              ──────
   everything ever shipped             same language, minus the mistakes
   default: scripts, CommonJS          default: modules, class bodies
   opt in:  —                          opt in:  "use strict"
   opt out: —                          opt out: IMPOSSIBLE

   a function carries the mode of the code it was WRITTEN in, fixed at parse time
```

- **Why a string?** A keyword would be a `SyntaxError` on every older engine → no page could adopt
  it. The ugly syntax is what made incremental adoption possible.
- **Why no opt-out?** A guarantee revocable in a nested scope isn't one.
- **Why per-file AND per-function?** So a sloppy codebase could adopt it one function at a time.
  That granularity is also the source of the concatenation bug.

---

## The directive (Part 1)

```javascript
function tooLate() {
  const x = 1;        // a statement → prologue is over
  "use strict";       // now just an inert string
  undeclared = 5;     // leaks. no error.
}
```

- **Directive prologue** = the run of string-literal statements at the top. Comments don't end it;
  any real statement does.
- **The shipping bug:** a banner, a hoisted `const`, a tool-inserted `import` → strict silently off,
  and the file still passes a grep for `"use strict"`.
- **Lexical, not dynamic:** a sloppy function called from strict code stays sloppy, and leaks.

---

## Category 1 — silent failures become errors (Part 2)

| Operation | sloppy | strict |
|---|---|---|
| assignment to an undeclared name | creates a global | **`ReferenceError`** |
| write to a non-writable property | ignored | **`TypeError`** |
| write to a getter-only property | ignored | **`TypeError`** |
| set a property on a primitive | ignored | **`TypeError`** |
| `delete` non-configurable | returns `false` | **`TypeError`** |

- All the same shape: **an operation that can't do what it says, doing nothing instead of saying so.**
- #1 changes how you write code (typos → globals).
- #2–#5 make other features trustworthy: **`Object.freeze` is a suggestion in sloppy and a
  guarantee in strict** (Ch18).

> **Say: strict mode doesn't add new rules — it makes existing rules produce errors instead of
> silence.**

---

## Category 2 — `this` and `arguments` (Part 2)

```
                       sloppy              strict
plain call             globalThis          undefined
.call('abc')           object (BOXED)      string  (the primitive)
.call(null)            globalThis (SUBST)  null
```

Two separate sloppy behaviours switched off: **substitution** (null/undefined → globalThis) and
**boxing** (primitive → wrapper object). `typeof` on `.call(null)` reads `"object"` because
`typeof null` is `"object"` (Ch21) — that's null intact, not boxing.

**The money demo:**

```
sloppy: extracted method returned NaN and wrote to globalThis.n = NaN
strict: extracted method threw TypeError: Cannot read properties of undefined (reading 'n')
```

Sloppy doesn't fail — it corrupts a global and surfaces elsewhere, later.

**`arguments`:**

```
                                     sloppy (MAPPED)   strict (UNMAPPED)
write param, read arguments[0]       99                1
write arguments[0], read param       99                1
arguments.callee                     works             TypeError
```

Mapped = a live two-way alias the engine must maintain. `callee`/`caller` poisoned — they leak the
call stack to any holder of your function reference.

---

## Category 3 — syntax removed at parse time (Part 2)

`SyntaxError` — **the file doesn't run at all**, unlike the other two categories.

| Removed | Why |
|---|---|
| `with` | identifiers unresolvable until runtime; defeats all static analysis |
| legacy octal `010` (and `'\101'`) | means 8, inherited from C, everyone reads ten. Use `0o10` |
| `delete v` (unqualified) | bindings aren't properties of anything |
| duplicate params `(x, x)` | second silently won; no reading is what the author meant |
| reserved words | `implements interface let package private protected public static yield` |
| assigning to `eval` / `arguments` | makes the two most special names mean something else locally |

**Two SILENT differences hide here** (no error, so nothing tells you):

```
function-in-block:  sloppy → Annex B hoists the binding out of the block (typeof f === "function")
                    strict → block-scoped, gone after the block (undefined)

sloppy eval("var sneaky=7")  → leaks into the calling function
strict eval("var sneaky=7")  → its own scope, no leak
```

Moving a file into a module (Ch20) changes both with no diagnostic.

---

## Where you're already strict (Part 3)

| Context | Mode |
|---|---|
| ES module (`.mjs`, `type: module`, `<script type=module>`) | **STRICT**, no opt-out |
| class body (methods, fields, static blocks) | **STRICT**, even in a sloppy script |
| CommonJS `.cjs` / `.js` in a CJS package | sloppy unless the directive |
| `<script>` with no `type="module"` | sloppy unless the directive |
| `node -e` / REPL | sloppy unless `--input-type=module` |
| function inside strict code | **STRICT** (inherited) |
| `eval` from strict / from sloppy | strict (own scope) / sloppy (can leak) |

**Detector:**

```javascript
function isStrict() {
  return (function () { return this === undefined; })();
}
```

Must create and call its own **inner** function — reading `this` directly measures the caller's
binding, not the dialect. Reports on where it was *written*.

> **Say: `"use strict"` isn't something you write in new code, it's something you need to
> RECOGNISE** — it decides whether half a dozen other behaviours throw or fail silently.

---

## The concatenation bug (Part 4)

**A file-level directive is a claim about a file, and a file is not a unit the runtime respects —
only functions and modules are.**

```
strict file bundled AFTER a sloppy one:
   → directive is no longer first → inert string → WHOLE BUNDLE SLOPPY
   → the file that asked for strict silently didn't get it

sloppy file bundled AFTER a strict one:
   → directive applies to everything → vendor code that never asked for it now throws
```

**Fix:** wrap each file in a function, so the directive has a function body to be first statement
of. That's most of why bundlers wrap modules in functions. Barely exists for ESM — strict with no
directive to misplace.

---

## What it cannot do (Part 5)

- **Be turned off.** No `"use sloppy"`, no nested escape.
- **Be applied retroactively to the language.** That's why it's a dialect at all — no recall
  mechanism for the web.
- **Replace a linter or types.** Fixed set of 1999-era mistakes. Won't catch `obj.nmae` (a legal
  read of an absent property, Ch21), unused vars, shadowing, or any type error.
- **Make a sloppy dependency strict.** Lexical.
- **Make code meaningfully faster today.** Removing `with`/sloppy `eval` made scope resolution
  statically decidable — mattered in 2009, much less now. **Don't claim a perf win you can't
  measure.**

**Counterfactuals:**

- **If it were a keyword:** `SyntaxError` on every older browser → no incremental adoption → never
  shipped. **The string literal is the feature.**
- **If it could be switched off in a nested scope:** every guarantee becomes local and
  unverifiable; you'd check every enclosing scope of every line. **Irrevocability is what makes it
  useful.**

Same trade as Ch17's unobservable GC, Ch18's irreversible freeze, Ch20's immutable module
bindings: **the restriction is the feature** — give up doing something, get back reasoning about
code you haven't read.

---

## Interview quick-fire

One sentence each.

- **What is strict mode?** — A second dialect in the spec, chosen at parse time, not a linter.
- **Why does it exist?** — You can't remove behaviour from the web, so you add a dialect and opt in.
- **Why is the directive a string?** — Old engines evaluate and discard it instead of throwing.
- **Where must it go?** — First statement of a script or function body. Comments are fine before it.
- **What if something precedes it?** — It's an inert string. Silently no strict mode.
- **Is it dynamic?** — No, lexical. The caller's mode is irrelevant.
- **Can you turn it off?** — No. There's no `"use sloppy"`.
- **Name the three categories.** — Silent failures → errors; `this`/`arguments` change; syntax removed.
- **What's `this` in a plain call?** — `undefined` in strict, `globalThis` in sloppy.
- **What else changes about `this`?** — Primitives aren't boxed; `null`/`undefined` aren't substituted.
- **Does `Object.freeze` throw?** — Only in strict. Sloppy fails silently.
- **What happens to a typo'd variable?** — `ReferenceError` in strict, a new global in sloppy.
- **What's mapped `arguments`?** — Sloppy's live two-way alias with the parameters. Strict unmaps it.
- **Why is `arguments.callee` blocked?** — It leaks the call stack; encapsulation hole.
- **Name three removed syntaxes.** — `with`, legacy octal, `delete` on a variable.
- **Why remove `with`?** — Identifiers become unresolvable until runtime; kills static analysis.
- **Are modules strict?** — Always, no opt-out. Same for class bodies.
- **Do you write `"use strict"` in new code?** — No — modules and classes are already strict.
- **How do you detect it?** — `(function () { return this === undefined; })()`.
- **What's the bundler bug?** — Concatenation moves or spreads the directive; both directions break.
- **How do bundlers fix it?** — Wrap each file in its own function.
- **Is strict mode faster?** — Not meaningfully today. Adopt it for the error behaviour.
- **Does it catch typos?** — Only in variable names, not property names.
