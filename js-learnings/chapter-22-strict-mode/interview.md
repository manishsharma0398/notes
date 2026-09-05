# Chapter 22 — Interview Questions: Strict Mode

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

**This topic is examined as a follow-up, not an opener.** It arrives attached to something else —
you mention `Object.freeze` and they ask "does it throw?", you mention an extracted method and
they ask "what's `this` then?". So the questions below are ordered by how they actually turn up,
and **Q1 is the one you'll be asked most and the one most people answer badly**, by reciting a
list.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What does `"use strict"` change?" · 75s

**Say:**

> Three categories rather than a list, because the list is about twenty things.
>
> **One: operations that used to fail silently now throw.** Assigning to an undeclared variable is
> a `ReferenceError` instead of quietly creating a global. Writing to a frozen or non-writable
> property, writing to a getter-only property, setting a property on a primitive, deleting
> something non-configurable — all `TypeError`s instead of doing nothing. That's the biggest
> category and the one that pays for itself.
>
> **Two: `this` and `arguments` behave differently.** In a plain function call `this` is
> `undefined` rather than `globalThis`, and a primitive `this` isn't boxed into a wrapper object.
> And `arguments` stops being a live two-way alias of the parameters — writing a parameter no
> longer changes `arguments[0]` and vice versa.
>
> **Three: some syntax is just gone**, at parse time. `with`, legacy octal literals like `010`,
> `delete` on a bare variable, duplicate parameter names, and a set of reserved words like
> `interface` and `private`.
>
> The framing I'd add is that it doesn't add *new* rules — it makes the rules that already existed
> produce errors instead of silence.

**Scored on:** the three categories, and the closing reframe. Twenty memorised items is the
two-year answer; grouping them and saying what they have in common is the four-year one.

**They'll push:** *"Which one matters most in practice?"* → The undeclared-variable one, because
it changes how you write code — a typo becomes an error instead of a global. But the one I think
about most is frozen writes throwing, because it means `Object.freeze` is only an enforced
guarantee in strict mode. Same call, same object, different dialect.

**Red flags:** reciting items with no structure. Saying it's "a linter" or "for performance".
Not knowing `this` becomes `undefined`.

---

## Q2 — "Why does strict mode exist at all? Why not just fix the language?" · 60s

The question that separates people who know *what* from people who know *why*.

**Say:**

> Because you can't remove a behaviour from JavaScript. Every page ever written has to keep
> working, and there's no recall mechanism for the web — you can't deprecate something and ship
> the removal five years later, because the pages that depend on it are still up and nobody is
> maintaining them.
>
> So the only way to fix a design mistake is to define a *second dialect* that doesn't have it,
> and let code opt in. That's what strict mode is — not a linter, not a flag, a second set of
> semantics defined in the spec, chosen at parse time.
>
> And that constraint explains the odd parts of the design. It's a **string literal** rather than
> a keyword specifically so that an engine which has never heard of it evaluates a string, throws
> it away, and runs your code sloppily — instead of throwing a `SyntaxError` and blanking the
> page. A keyword would have meant nobody could adopt it until every old browser was gone, which
> for the web is never. The syntax is ugly because incremental adoption was the requirement.

**Scored on:** "you can't remove behaviour from the web", and then the string-literal design
following from it. That second half is the part almost nobody says, and it's the strongest signal
available on this question.

**They'll push:** *"Why is it per-function as well as per-file?"* → So an existing sloppy codebase
could adopt it one function at a time rather than all at once. That granularity is also where the
one real bug comes from — see Q6.

**Red flags:** "it's for performance". "It's a modern best practice" with no history. Treating it
as a linter rule.

---

## Q3 — "Does `Object.freeze` prevent writes?" · 45s

This is how the topic actually arrives — as a follow-up to Chapter 18.

**Say:**

> It prevents them from taking effect, always. Whether it *tells* you depends on the mode.
>
> In strict mode a write to a frozen property throws a `TypeError`. In sloppy mode the identical
> line silently does nothing — the assignment evaluates to the value, the statement completes
> normally, and you carry on believing you set it.
>
> Which means "it's frozen, so it can't be the bug" is only safe to say once you know which mode
> the file is in. And that's a real distinction now rather than a historical one, because a
> module is strict and a CommonJS file isn't — so the same code moved between the two changes
> whether it throws.

**Scored on:** connecting the freeze guarantee to the mode, and then to the module/CJS split. The
first half alone is fine; the second half shows you've hit it.

**They'll push:** *"Any other place freeze doesn't do what people expect?"* → Two, both Chapter 18:
it's shallow, so nested objects are untouched; and it locks *data properties*, so a `Map` or `Set`
inside a frozen object is still fully mutable through its methods, and an accessor's setter still
runs.

**Red flags:** "yes, it always throws". Not knowing the mode matters.

---

## Q4 — "What's `this` in a plain function call?" · 60s

**Say:**

> `undefined` in strict mode, `globalThis` in sloppy mode.
>
> Two separate sloppy behaviours are switched off and people conflate them. One is
> **substitution** — a `null` or `undefined` `this` gets replaced with `globalThis`. The other is
> **boxing** — a primitive `this` gets wrapped in its object form, so `typeof this` inside a
> function called with `.call("abc")` is `"object"` in sloppy and `"string"` in strict.
>
> Where it matters is the extracted-method bug. You pull a method off an object, call it bare, and
> `this` is wrong. In strict mode that's a `TypeError` on `undefined` pointing at the line. In
> sloppy mode `this` is `globalThis`, so `this.n++` reads an absent global, gives you `NaN`, and
> *writes it back to the global object* — no error, wrong answer, and the failure surfaces
> somewhere else entirely, later. I've measured both: same code, one returns `NaN` and corrupts a
> global, the other stops at the call site.

**Scored on:** separating substitution from boxing, and the "silently corrupts a global" version
of the consequence. Just saying "`undefined` vs `globalThis`" is the flashcard answer.

**They'll push:** *"Does that affect arrow functions?"* → No — arrows have no `this` binding at
all, they close over the enclosing one lexically, so there's nothing to substitute or box. Same
for methods called normally and anything `bind`-ed.

**Red flags:** "strict mode makes `this` undefined everywhere". Not knowing about boxing.

---

## Q5 — "Do you still write `"use strict"` in new code?" · 45s

**Say:**

> No, and the reason is the interesting part: **ES modules and class bodies are strict already,
> permanently, with no directive and no way to opt out.** So in a module, or anywhere inside a
> class, writing it is noise — and slightly worse than noise, because it suggests the author
> doesn't know the code is already strict.
>
> Where I *would* write it is a CommonJS file or a bare `<script>` I'm maintaining, because those
> are sloppy by default. And on line one, where nothing can get above it.
>
> The framing I'd use is that `"use strict"` isn't something you write any more — it's something
> you need to *recognise*, because whether a given file has it decides whether half a dozen other
> behaviours throw or fail silently.

**Scored on:** modules and class bodies, and the "recognise, don't write" reframe. Saying "yes,
always add it" is a dated answer.

**They'll push:** *"How would you check which mode some code is running in?"* → An inner function
that reports its own `this`:
> ```javascript
> const isStrict = (function () { return this === undefined; })();
> ```
> It has to create and call its own function — reading `this` directly measures the caller's
> binding, not the dialect. And it reports on where it was *written*, because strictness is
> lexical.

**Red flags:** "yes, always". Not knowing modules are strict. Thinking it's inherited from the
caller.

---

## Q6 — "This file has `"use strict"` at the top and still leaks globals. Why?" · 60s

```javascript
/* Copyright 2019 */
const VERSION = "2.1.0";
"use strict";

function save(data) {
  reuslt = transform(data);   // typo
  return reuslt;
}
```

**Say:**

> The directive isn't a directive here — it's just a string expression sitting in the middle of
> the file, doing nothing.
>
> `"use strict"` has to be the **first statement** of a script or a function body. What's allowed
> before it is the directive prologue: other string literals, and comments, because comments
> aren't statements. The `const VERSION` line is a statement, so the prologue is over by the time
> the parser reaches the directive, and it's evaluated as an ordinary expression and discarded.
>
> So the file is sloppy, and `reuslt` creates a global instead of throwing. And the file still
> contains the text `"use strict"`, so it passes whatever grep somebody used to audit the
> codebase.
>
> The fix is to move it above the `const`. The general version is that this is the classic way a
> file loses strict mode — a banner is fine, but a hoisted `const`, an import a tool inserted, or
> a logging line added at the top silently turns it off.

**Scored on:** "first statement, comments don't count", plus noticing that it still passes a text
search. That second observation is what makes it a real debugging answer.

**They'll push:** *"Where else does a directive get lost?"* → Bundling. A file-level directive is a
claim about a file, and a file isn't a unit the runtime respects — only functions and modules are.
Concatenate a strict file after a sloppy one and the directive is no longer first, so the whole
bundle is sloppy. Concatenate the other way and the directive now applies to vendor code that
never asked for it. Both silent, opposite failures — which is why bundlers wrap each file in a
function.

**Red flags:** not knowing about the prologue. Saying it applies anywhere in the file.

---

## Q7 — "Can you turn strict mode off inside a strict function?" · 45s

**Say:**

> No. There's no `"use sloppy"` — writing one just gives you an inert string. Strict mode is
> lexical and one-way: any function defined inside strict code is strict too, permanently.
>
> And that's deliberate rather than an oversight. A guarantee you can revoke in a nested scope
> isn't a guarantee. Today, seeing `"use strict"` at the top of a file means you can reason about
> assignment, `this` and `delete` for the whole file without reading further. If there were an
> opt-out you'd have to check every enclosing scope of every line before you could conclude
> anything — the property that makes it useful is exactly that it can't be undone.
>
> The other half people get wrong is that it's *lexical*, not dynamic. A sloppy function called
> from strict code stays sloppy and can still leak a global. The caller's mode is irrelevant —
> each function carries the mode of the source it was written in, fixed at parse time.

**Scored on:** "a revocable guarantee isn't one", and the lexical-not-dynamic half. The second one
comes up constantly in real debugging when a dependency misbehaves.

**They'll push:** *"So does calling into a sloppy library from a strict module weaken anything?"* →
The library keeps its own semantics, so it can still create implicit globals and silently ignore
frozen writes — but only inside its own code. Nothing about your module's guarantees changes.

**Red flags:** thinking `"use sloppy"` exists. Thinking strictness propagates from the caller.

---

## Q8 — "Is strict mode faster?" · 45s

**Say:**

> Not meaningfully, today, and I'd be careful about claiming it.
>
> There's a real mechanism behind the claim: strict mode removed `with` and stopped `eval` from
> injecting bindings into the calling scope. Both of those made it impossible to know a function's
> set of variable bindings by reading it, so the engine had to resolve identifiers dynamically.
> Removing them made scope resolution statically decidable, and unmapping `arguments` removed an
> aliasing relationship the optimiser had to preserve. In 2009 that was worth real performance.
>
> Modern engines optimise both paths well, so the honest answer is that I'd adopt it for the error
> behaviour, not for speed — and if performance mattered I'd measure rather than assume.

**Scored on:** knowing the actual mechanism *and* declining to claim the benefit. "It's faster" is
a very common repeated-from-a-blog-post answer, and being able to explain why it *was* true while
saying it isn't a reason today is a strong signal.

**They'll push:** *"So is there any runtime cost either way?"* → Nothing I'd design around. The
differences are semantic, not a fast path versus a slow path.

**Red flags:** "yes, it's faster" with no mechanism. Claiming a measured win you can't produce.

---

## Q9 — "What can strict mode NOT do?" · 60s

**Say:**

> Four things worth naming.
>
> It **can't be turned off** — one-way by design, as we covered.
>
> It **can't be applied to the language retroactively**. That's the whole reason it's a dialect
> rather than a fix: there's no version of "make these errors for everyone" that doesn't break a
> large fraction of the web.
>
> It **isn't a linter or a type system.** It catches a specific, small, fixed set of mistakes
> chosen in 2009. It'll catch a typo'd *variable* name, but not a typo'd *property* name —
> `obj.nmae` is a perfectly legal read of an absent property and gives you `undefined`. It won't
> catch unused variables, shadowing, or anything type-related. Reaching for it as your safety net
> instead of a linter is answering the wrong question.
>
> And it **can't make a dependency strict**, because it's lexical.

**Scored on:** the `obj.nmae` example specifically. It's the concrete demonstration that strict
mode's coverage is much narrower than people assume, and it ties to how absence works (Ch21).

**They'll push:** *"So what would you actually use to catch that?"* → A linter for the mechanical
cases and TypeScript for the property one. Strict mode is a floor, not a strategy.

**Red flags:** describing it as a general safety feature. Not being able to name something it
misses.

---

## Q10 — "What would break if it worked differently?" · 60s

**Say:**

> Two counterfactuals, and they point at the two design decisions.
>
> **If the directive had been a keyword** rather than a string: every browser released before the
> proposal throws a `SyntaxError` on line one. So no page can adopt strict mode until old browsers
> are gone, which for the web is never — the feature would have shipped into a spec and never been
> used. The ugly string-literal syntax is precisely what made incremental adoption possible. The
> string *is* the feature.
>
> **If it could be switched off in a nested scope**: every guarantee becomes local and
> unverifiable. Right now, `"use strict"` at the top of a module lets me reason about the whole
> file without reading it. With an opt-out I'd have to check every enclosing scope of every line
> before concluding anything, and the cost of checking would exceed the value of the guarantee.
>
> That's a shape this language does repeatedly — an unobservable garbage collector, an
> irreversible `Object.freeze`, immutable module bindings. **The restriction is the feature.** You
> give up the ability to do something and get back the ability to reason about code you haven't
> read.

**Scored on:** generalising to "the restriction is the feature" and citing another instance of it.
That's the answer that shows you think about language design rather than API surface.

**They'll push:** *"Is there anything you'd change about it?"* → Not the semantics. I'd want the
silent-no-op case gone — a directive that isn't in the prologue should probably be a warning
somewhere, because "the file says `"use strict"` and isn't strict" is the one failure with no
diagnostic at all.

**Red flags:** "they should have made it the default" — that's the thing that was impossible.

---

## Rapid fire

One sentence each.

- **What is strict mode?** — A second dialect in the spec, chosen at parse time. Not a linter.
- **Why does it exist?** — You can't remove behaviour from the web, so you add a dialect and opt in.
- **Why a string literal?** — Old engines evaluate and discard it instead of throwing.
- **Where must the directive go?** — First statement of a script or function body.
- **Do comments before it break it?** — No. Comments aren't statements.
- **What if a `const` precedes it?** — It's an inert string. No strict mode, silently.
- **Is it dynamic or lexical?** — Lexical. The caller's mode is irrelevant.
- **Can you opt out?** — No. There's no `"use sloppy"`.
- **The three categories?** — Silent failures → errors; `this`/`arguments` change; syntax removed.
- **`this` in a plain call?** — `undefined` strict, `globalThis` sloppy.
- **What else about `this`?** — Primitives aren't boxed into wrapper objects.
- **Does `Object.freeze` throw?** — Strict yes, sloppy silently ignores the write.
- **Typo'd variable?** — `ReferenceError` strict, new global sloppy.
- **What's mapped `arguments`?** — Sloppy's live two-way alias with parameters; strict unmaps it.
- **`arguments.callee`?** — `TypeError` in strict. It leaks the call stack.
- **Three removed syntaxes?** — `with`, legacy octal, `delete` on a bare variable.
- **Why remove `with`?** — Identifiers unresolvable until runtime; kills static analysis.
- **Duplicate parameter names?** — `SyntaxError` in strict; sloppy let the second one win.
- **Are modules strict?** — Always, no opt-out. Class bodies too.
- **Write it in new code?** — No. Modules and classes are already strict.
- **How do you detect it?** — `(function () { return this === undefined; })()`.
- **The bundler bug?** — Concatenation misplaces the directive; both directions fail silently.
- **How do bundlers fix it?** — Wrap each file in its own function.
- **Is it faster?** — Not meaningfully today. Adopt it for error behaviour.
- **Does it catch typos?** — Variable names only. `obj.nmae` is still legal.
- **Function declaration in a block?** — Sloppy hoists it out (Annex B); strict keeps it block-scoped.
- **Sloppy `eval`?** — Can inject bindings into the calling scope. Strict `eval` gets its own.
