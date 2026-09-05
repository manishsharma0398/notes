# Chapter 22 — Strict Mode, and Why It Exists

Why a *string literal* changes the language, why you have probably never written `"use strict"`
and have also never been outside it, and why this one directive decides whether half a dozen
other behaviours throw or fail silently.

This is the last chapter in the track, and it is deliberately last: almost everything it changes
is something an earlier chapter already showed you. `Object.freeze` throwing (Ch18), `this` being
`undefined` in an extracted method (Ch5), `undefined = 42` failing (Ch21), unmapped `arguments`
(Ch21), modules being permanently strict (Ch20) — those are all *this* chapter, seen from
somewhere else. What is left is the story that connects them.

> **Read this box first.** Seven facts.
>
> 1. **Strict mode is a second dialect of the language**, not a linter and not a flag. The spec
>    defines two sets of semantics and every piece of code is parsed under one of them.
> 2. **The directive is an ordinary string literal**, and that is the whole design — an engine
>    that has never heard of it evaluates a string, discards it, and runs your code sloppily
>    rather than throwing a `SyntaxError`.
> 3. **It must be the first statement** of a script or function body. A statement before it —
>    even one a tool inserted — makes it silently do nothing.
> 4. **It is lexical, inherited and one-way.** Nested functions are strict too, there is no
>    `"use sloppy"`, and the *caller's* mode is irrelevant.
> 5. **ES modules and class bodies are always strict**, with no directive and no opt-out. That is
>    why most modern code has never needed to write it.
> 6. **The changes are three categories, not twenty items**: silent failures become errors, `this`
>    and `arguments` change behaviour, and some syntax is removed at parse time.
> 7. **It exists because the web can't break.** You can never remove a behaviour from JavaScript,
>    so the only way to fix a mistake is to define a new dialect and let code opt in.

---

## How this chapter is examined

**This is a follow-up question, almost never an opener.** It arrives attached to something else:
you say `Object.freeze` prevents writes and they ask *"does it throw?"*; you say an extracted
method loses `this` and they ask *"what is `this` then?"*. The answer to both is "it depends which
mode the file is in", and being able to say that — and then say *which* mode and *why* — is what
is being scored.

The one question asked directly is *"what does strict mode change?"*, and the failure mode there
is reciting a list. **A list of twenty items is the two-year answer; three categories plus the
reason the dialect exists at all is the four-year one.**

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "What does `"use strict"` change?" (Part 2) | The full reserved-word list (Part 2) |
| "Why does it exist at all?" (Part 1) | Octal escapes in string literals (Part 2) |
| *"Do you still need to write it?"* (Part 3) | `arguments.callee` / `.caller` poisoning (Part 2) |
| "Does `Object.freeze` throw?" → mode (Part 2) | Annex B function-in-block semantics (Part 2) |
| "What is `this` in a plain function call?" (Part 2) | Sloppy `eval` leaking bindings (Part 2) |
| "Are modules strict?" (Part 3) | Why the directive is a string (Part 1) |
| *"Is strict mode faster?"* (Part 5) | |
| "Can you turn it off?" (Part 4) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every output block came from the files in `examples/`, on Node 22.13.0.

---

## The model

One sentence, and everything else follows:

> **JavaScript cannot remove a behaviour, because every page ever written must keep working. So
> the only way to fix a mistake is to define a second dialect that doesn't have it, and let code
> opt in. Strict mode is that dialect.**

That constraint explains every design choice in this chapter, including the ones that look odd:

```
        one language, two dialects, chosen at PARSE time
        ─────────────────────────────────────────────────

   sloppy mode                          strict mode
   ───────────                          ───────────
   everything ever shipped              the same language, minus the mistakes
   default for: scripts, CommonJS       default for: modules, class bodies
   opt in:      —                       opt in:      "use strict"
   opt out:     —                       opt out:     IMPOSSIBLE

                    ▲                              ▲
                    └──────── a function ──────────┘
                       carries the mode of the code
                       it was WRITTEN in, forever
```

- **Why a string, not a keyword?** Because a keyword would be a `SyntaxError` on every engine
  older than the proposal, and the whole point was to ship a fix that old browsers would ignore.
  A string literal in statement position is valid everywhere back to 1997 and does nothing.
- **Why can't you turn it off?** Because a guarantee you can revoke in a nested scope isn't one.
  If `"use sloppy"` existed, reading the top of a file would tell you nothing about the code below.
- **Why is it per-file *and* per-function?** So an existing sloppy codebase could adopt it one
  function at a time. That granularity is also the source of the only bug this chapter has
  (Part 4).

---

## Part 1 — The directive, and why it looks like that

`examples/01_the_directive.js`:

```
=== A. It must be the FIRST statement, or it is just a string ===

  directive placed after a statement: no error — the directive did nothing
  globalThis.undeclaredHere = 5  <- it leaked, so we were sloppy
  directive placed after a comment:   ReferenceError — the directive DID apply
```

The **directive prologue** is the run of string-literal expression statements at the very top of a
script or function body. Comments don't end it — they aren't statements. Any real statement does.

**This is the failure that ships**: a copyright banner is fine, but a `const` hoisted up during a
refactor, an `import` inserted by a tool, or a logging line added at the top turns strict mode off
with no error and no warning. The file still *contains* `"use strict"`, so it still passes the
grep someone used to audit it.

```
=== B. Why a STRING, and not a keyword ===

  typeof "use strict" -> string  — it is an ordinary string literal
```

That is the entire design decision, and it's worth being able to state: a 2008 engine parses the
file, evaluates a string expression, throws it away, and runs everything in sloppy mode. A new
keyword would have been a `SyntaxError` and every page using it would have gone blank in older
browsers. **The syntax is ugly because backward compatibility was the requirement, not an
afterthought.**

```
=== C. Strict is lexical, inherited, and ONE-WAY ===

  a function nested in a strict function: strict (inherited from the enclosing function)
  trying to opt back out:                 still strict — there is no opt-out
```

And from `examples/02_silent_failures.js`, the half people get wrong:

```
=== Strictness is lexical, not dynamic ===

  a sloppy function called from strict code: no error
  globalThis.calledFromStrict = 1  <- it still leaked
```

**The caller's dialect is irrelevant.** Each function carries the mode of the source it was
*written* in, fixed at parse time. A sloppy library function called from your strict module stays
sloppy; your strict function called from sloppy vendor code stays strict.

---

## Part 2 — What it actually changes, in three categories

Twenty-odd individual changes, but they group into three, and the grouping is the answer.

### Category 1 — Silent failures become errors

`examples/02_silent_failures.js`, the same five operations in both dialects:

| Operation | sloppy | strict |
|---|---|---|
| assignment to an undeclared name | creates a global | **`ReferenceError`** |
| write to a non-writable property | ignored | **`TypeError`** |
| write to a getter-only property | ignored | **`TypeError`** |
| set a property on a primitive | ignored | **`TypeError`** |
| `delete` something non-configurable | returns `false` | **`TypeError`** |

```
=== The identical five, in STRICT mode ===

  1. undeclared assignment         -> ReferenceError: strictAccidentalGlobal is not defined
  2. write to a frozen property    -> TypeError: Cannot assign to read only property 'a' of object '#<Object>'
  3. write to a getter-only prop   -> TypeError: Cannot set property x of #<Object> which has only a getter
  4. set a property on a string    -> TypeError: Cannot create property 'foo' on string 'hello'
  5. delete Object.prototype       -> TypeError: Cannot delete property 'prototype' of function Object() { [native code] }
```

All five are the same shape: **an operation that cannot do what it says, doing nothing instead of
saying so.** Sloppy mode's rule is that a failed write evaluates to the assigned value and changes
nothing, so the statement completes normally and you carry on with a variable you believe you set.

Two things worth separating:

- **#1 changes how you write code.** A typo'd variable silently becomes a global in sloppy mode.
- **#2–#5 make other features trustworthy.** `Object.freeze` (Ch18) is a *suggestion* in sloppy
  mode and an *enforced guarantee* in strict — same call, same object, different dialect. Ch18's
  "check the file's mode before trusting a freeze" warning is exactly this row.

> **The sentence: strict mode doesn't add new rules — it makes the rules that already existed
> produce errors instead of silence.**

### Category 2 — `this` and `arguments` behave differently

These are the ones that change what *working* code does, rather than turning a failure into an
error. `examples/03_this_and_arguments.js`:

```
  SLOPPY:
    plain call, this ===  globalThis : true
    .call('abc')  -> typeof this     : object  <- BOXED into a String object
    .call(null)   -> this ===  globalThis : true  <- substituted

  STRICT:
    plain call, this is              : undefined  <- undefined, not globalThis
    .call('abc')  -> typeof this     : string  <- the primitive itself
    .call(null)   -> this is         : null  (typeof: object)
```

Two separate sloppy behaviours are switched off, and they get conflated constantly:

1. **Substitution** — a `null`/`undefined` `this` is replaced by `globalThis`.
2. **Boxing** — a primitive `this` is wrapped in its object form.

In strict mode `this` is whatever was passed, unchanged. (The `typeof` on the `.call(null)` row
reads `"object"` because `typeof null` is `"object"` — Ch21. That's `null` arriving intact, not
boxing.)

**Why this matters more than the trivia**, same file:

```
=== The extracted-method bug, both ways ===

  sloppy: extracted method returned NaN and wrote to globalThis.n = NaN
  strict: extracted method threw TypeError: Cannot read properties of undefined (reading 'n')
```

The sloppy version **does not fail**. It corrupts a global with `NaN`, returns it, and the bug
surfaces somewhere else entirely, later. The strict version stops at the call site. That contrast
is the strongest argument for strict mode available in one screen.

**`arguments` stops mirroring the parameters:**

```
  SLOPPY (arguments is MAPPED — a live two-way link):
    write the param, read arguments[0] : 99  <- changed
    write arguments[0], read the param : 99  <- changed

  STRICT (arguments is UNMAPPED — a snapshot of the call):
    write the param, read arguments[0] : 1  <- unchanged
    write arguments[0], read the param : 1  <- unchanged

    arguments.callee -> TypeError
```

Mapped `arguments` is an aliasing relationship the engine has to maintain: every parameter write
must be visible through the arguments object and vice versa. Removing it kills a real
action-at-a-distance bug and made these functions easier to optimise.

`arguments.callee` and `Function.prototype.caller` are poisoned because they leak the call stack
to anyone holding a reference to your function — a genuine encapsulation hole.

### Category 3 — Syntax removed at parse time

`examples/04_removed_syntax.js` — these are `SyntaxError`s, which means **the file doesn't run at
all**, a different failure mode from the other two categories:

```
  case                              sloppy                     strict
  ------------------------------------------------------------------------------------
  legacy octal literal              allowed -> 8               SyntaxError
  octal escape in a string          allowed -> A               SyntaxError
  with (obj) { }                    allowed -> 1               SyntaxError
  delete an unqualified name        allowed -> true            SyntaxError
  duplicate parameter names         allowed -> 2               SyntaxError
  `private` as an identifier        allowed -> 1               SyntaxError
  `interface` as an identifier      allowed -> 1               SyntaxError
  `package` as an identifier        allowed -> 1               SyntaxError
  assigning to `eval`               allowed -> 1               SyntaxError
  assigning to `arguments`          allowed -> 1               SyntaxError
```

None of it is arbitrary tidying:

- **`with`** makes every identifier in its body unresolvable until runtime, because the object's
  properties can change. It defeats every static analysis including the engine's own scope
  resolution.
- **Legacy octal** — `010` meaning `8` is inherited from C, and every reader who hasn't memorised
  it reads ten. `0o10` is explicit and legal in both dialects.
- **`delete v`** on a binding is meaningless in a lexically scoped language; bindings aren't
  properties of anything.
- **Duplicate parameters** — `function (x, x)` silently made the second win. No reading of that is
  what the author meant.
- **Reserved words** — `implements`, `interface`, `let`, `package`, `private`, `protected`,
  `public`, `static`, `yield`. Reserved in 2009 for a version that mostly never arrived, and now
  unreleasable without breaking the strict code written since.

**Two silent behavioural differences hide in this category**, and they're the ones worth knowing
because nothing errors:

```
=== The function-in-a-block difference ===

  SLOPPY:
    typeof f AFTER  the block: function  <- Annex B hoisted the binding to function scope

  STRICT:
    typeof g AFTER  the block: undefined  <- block-scoped. gone.

=== And eval stops leaking bindings ===

  sloppy: eval('var sneaky = 7') then typeof sneaky -> number  <- it leaked into the function
  strict: same code                              -> undefined  <- eval got its own scope
```

A file moved into a module (Ch20) changes both of these with no diagnostic anywhere.

---

## Part 3 — Where you're already strict without writing it

`examples/06_am_i_in_strict_mode.js`:

```
  context                                                mode     note
  ------------------------------------------------------------------------------------------------
  ES module (.mjs, type: module, <script type=module>)   STRICT   always, no opt-out (Ch20)
  class body — methods, fields, static blocks            STRICT   always, even in a sloppy script
  CommonJS file (.cjs, .js in a CJS package)             sloppy   unless it has the directive
  <script> with no type="module"                         sloppy   unless it has the directive
  node -e '...' / REPL                                   sloppy   unless --input-type=module
  function inside strict code                            STRICT   inherited, permanently
  eval() called from strict code                         STRICT   and it gets its own scope
  eval() called from sloppy code                         sloppy   and it can leak bindings out
  a .ts file compiled by tsc                             depends  on the emitted module format
```

**Modules and class bodies are the reason this chapter is mostly historical for new code.** If
you're writing an ES module or a class, you're strict and the directive is noise. If you're in a
CommonJS file or a bare `<script>`, you're sloppy until you say otherwise — and that is still a
very large amount of production JavaScript.

The runtime detector, when you need to know:

```javascript
function isStrict() {
  return (function () { return this === undefined; })();
}
```

It must create and call its own inner function — a version that reads `this` directly measures the
*caller's* binding, not the dialect. And it reports on the code *it* was written in, because
strictness is lexical.

> **The framing that scores: `"use strict"` isn't something you write in new code, it's something
> you need to recognise** — because whether a file has it decides whether half a dozen other
> behaviours throw or fail silently.

---

## Part 4 — The one bug this ships: concatenation

A file-level directive is a claim about a *file*, and **a file is not a unit the runtime
respects** — only functions and modules are. Bundlers concatenate files.
`examples/05_the_concatenation_hazard.js` runs both directions as real subprocesses:

```
=== Each file on its own, behaving as its author intended ===
  vendor-legacy.js: legacy ok
  modern.js:        ReferenceError — strict, as intended

=== Case 1: strict file bundled AFTER the sloppy one ===
  modern(): modern ok (NOT strict!)

=== Case 2: sloppy file bundled AFTER the strict one ===
  legacy(): ReferenceError: implicitGlobal is not defined
```

Two opposite silent failures:

- **Case 1** — the `"use strict"` is no longer the first statement, so it's just a string in the
  middle of a script. The whole bundle is sloppy and the file that *asked* for strict didn't get
  it. Every guarantee its author relied on is gone in production and present in their tests.
- **Case 2** — the directive is first, so it applies to the entire concatenated script, including
  a file whose author never asked for it. This is the version that shows up as a vendor library
  exploding on a line that has worked for a decade.

The fix is what every bundler does:

```
=== Case 3: the fix — a per-file wrapper preserves each file's mode ===
  legacy(): legacy ok
  modern(): ReferenceError — still strict, as ITS author intended
```

Wrapping each file in a function gives the directive a **function body** to be the first statement
of. This is most of why bundlers wrap modules in functions rather than gluing text together — and
why the problem barely exists for ES modules, which are strict with no directive to misplace.

---

## Part 5 — What strict mode cannot do, and why

**1. You cannot turn it off.** No `"use sloppy"`, no nested escape, no runtime toggle. Deliberate:
a guarantee revocable in a nested scope is not a guarantee, and reading the top of a file would
stop telling you anything about the code below it.

**2. It cannot be applied retroactively to the whole language.** This is the entire reason it
exists as a dialect rather than a fix. There is no version of "just make the bad behaviours errors
for everyone" that doesn't break a large fraction of the pages on the web, and the web has no
recall mechanism.

**3. It is not a linter and it is not a type system.** It catches a specific, small, fixed set of
mistakes chosen in 2009. It will not catch a typo'd *property* name (`obj.nmae` is a perfectly
legal read of an absent property — Ch21), an unused variable, a shadowed binding, or any type
error. Reaching for `"use strict"` as a safety measure in a codebase without a linter is
answering the wrong question.

**4. It cannot make a sloppy dependency strict.** Strictness is lexical, so vendor code stays in
its own dialect regardless of how yours is written.

**5. It doesn't make code meaningfully faster today.** Removing `with` and sloppy `eval` made
scope resolution statically decidable, which mattered a lot in 2009. Modern engines optimise both
paths well, and the honest answer is *"it removed the two constructs that made scope resolution
undecidable, which mattered more then than now — I'd adopt it for the error behaviour, not for
speed."* Claiming a performance win you can't measure is a red flag.

### What would break if this worked differently

Two counterfactuals worth having ready:

**If `"use strict"` had been a keyword** instead of a string: every browser released before the
proposal would have thrown a `SyntaxError` on the first line, so no page could adopt it until
old browsers were gone — which, for the web, is *never*. The ugly syntax is what made incremental
adoption possible at all. **The string literal is the feature.**

**If strict mode could be switched off in a nested scope**: every guarantee becomes local and
unverifiable. Today, seeing `"use strict"` at the top of a module means you can reason about
assignment, `this` and `delete` for the entire file without reading further. With an opt-out you'd
have to check every enclosing scope of every line — the property that makes it useful is exactly
its irrevocability.

The general shape is one this track has hit repeatedly: **the restriction is the feature.** Ch17's
unobservable garbage collector, Ch18's irreversible `Object.freeze`, Ch20's immutable module
bindings — all the same trade. Give up the ability to do something, get back the ability to reason
about code you haven't read.

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| A file contains `"use strict"` and still leaks globals | A statement precedes the directive — it's an inert string (Part 1) |
| `Object.freeze` "doesn't work" | Sloppy file: the write fails silently instead of throwing (Ch18, Part 2) |
| A typo'd variable silently becomes a global | Sloppy mode. The single most valuable thing strict catches |
| `this` is `globalThis` where you expected `undefined` | Sloppy function. The mode is lexical, not the caller's |
| A vendor library breaks after a build change | Its sloppy file got concatenated after a strict one (Part 4) |
| A strict file loses its guarantees in the bundle only | Concatenated after a sloppy one — directive no longer first (Part 4) |
| Code behaves differently after moving to `type: "module"` | Modules are strict; also Annex B function-in-block changes (Parts 2–3) |
| `arguments[0]` stopped tracking the parameter | Strict, or the function has a default/rest param (Ch21) |
| `SyntaxError` on a file that used to parse | Octal, `with`, duplicate params, or a reserved word (Part 2) |
| `arguments.callee` throws | Strict. Use a named function expression |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| Strict mode is a linter | It's a second dialect defined in the spec, with different semantics. |
| It's mainly about performance | It's about errors. The optimisation argument was a 2009 one and is largely gone. |
| It adds new rules | It makes existing rules produce errors instead of silence. |
| You should add `"use strict"` to new files | Modules and class bodies are already strict. It's noise there. |
| `"use strict"` anywhere in the file works | It must be the **first statement** of a script or function body. |
| A strict caller makes callees strict | Strictness is **lexical**, fixed at parse time. The caller is irrelevant. |
| You can opt back out in a nested function | There is no `"use sloppy"`. It is one-way. |
| Strict mode makes `this` `undefined` everywhere | Only where it would have been *substituted* — methods and `bind` are unaffected. |
| It catches typos | Only in *variable* names. `obj.nmae` is still a legal read of an absent property. |
| It's obsolete now | It's the default in all modern code. You're always in it — that's the opposite of obsolete. |
| `delete` on a variable just returns `false` | In strict it's a `SyntaxError`, at parse time. |

---

## Rules worth keeping

1. **Know which mode the file you're debugging is in before you trust `freeze`, `this`, or a
   failed assignment.** Three unrelated-looking behaviours hinge on it.
2. **Don't write `"use strict"` in an ES module or a class** — it's already on, and the noise
   suggests the author doesn't know that.
3. **Do write it in any CommonJS file or bare `<script>` you're maintaining**, and put it on line
   one where nothing can get above it.
4. **If a build step concatenates scripts, wrap each file in a function** — a file-level directive
   does not survive concatenation in either direction.
5. **Use the inner-function detector** (`(function () { return this === undefined; })()`) rather
   than guessing, and remember it reports on where it was *written*.
6. **Prefer `0o10` to `010`** — explicit, and legal in both dialects.
7. **Don't claim a performance benefit.** Adopt it for the error behaviour and say so.
8. **Strict mode is not a substitute for a linter or types.** It catches a small fixed set of
   1999-era mistakes and nothing else.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — six runnable files; `06_am_i_in_strict_mode.js` is the one that ties the chapter
  to the rest of the track in a single output block
- `exercises/chapter_exercise.md` — prediction programs across both dialects, then primitives
- `exercises/cumulative_exercise.md` — the capstone: audit and migrate a mixed-mode codebase

**This is the last chapter of the language track.** Chapters 1–22 now cover the topic list in
`prompt.md` end to end. The cumulative exercise here is deliberately a capstone rather than
another single-topic build — it touches Ch5, Ch17, Ch18, Ch20 and Ch21, because by this point the
interesting problems are the ones that cross chapters.
