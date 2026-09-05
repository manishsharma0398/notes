# Chapter 22 — Mock Interview: Strict Mode

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

This round has a shape none of the others have: **strict mode is almost never the stated topic.**
It arrives as a follow-up inside a round about something else — here, a code review that turns
into a debugging session. That is how it is actually examined, so the transcript is written that
way rather than as "tell me about strict mode".

---

## Minute 0–3 — It arrives as a follow-up

> **I:** Quick one to start. Does `Object.freeze` stop someone modifying an object?

> **You:** It stops the modification taking effect, always. Whether it *tells* you depends on the
> mode the code is in.
>
> In strict mode a write to a frozen property throws a `TypeError`. In sloppy mode the identical
> line silently does nothing — the assignment evaluates to the value, the statement completes, and
> you carry on believing you set it.

⟵ *The interviewer asked a Chapter 18 question. Answering it with "it depends on the mode" is what
opens this round — it signals you know the two dialects exist without being asked about them.*

> **I:** Interesting — so when would it be sloppy?

> **You:** A CommonJS file or a plain `<script>` with no `type="module"`, unless it has
> `"use strict"` at the top. ES modules are strict automatically and permanently, so the same code
> moved from a `.cjs` to an `.mjs` starts throwing where it used to fail silently.

⟵ *Naming the module/CJS split concretely. "It depends" without saying which contexts is the
two-year version.*

---

## Minute 3–8 — The code review

> **I:** Here's a file from our codebase. Anything wrong with it?

```javascript
/* Copyright 2019 Acme Corp */
const VERSION = "2.1.0";
"use strict";

function applyDefaults(config) {
  const merged = Object.freeze({ ...config });
  merged.retries = merged.retries ?? 3;
  reuslt = validate(merged);
  return reuslt;
}
```

> **You:** Three things, and the first one causes the other two.
>
> **The `"use strict"` is not a directive.** It has to be the first statement of the script, and
> `const VERSION` is a statement — so by the time the parser reaches the string, the directive
> prologue is over and it's evaluated as an ordinary expression and thrown away. The copyright
> comment is fine, comments aren't statements. The `const` is what breaks it.
>
> So the file is sloppy, and now the two real bugs are both silent. `merged.retries = ...` writes
> to a frozen object, which in sloppy mode does nothing at all — so `retries` stays whatever the
> caller passed, including `undefined`, and the `?? 3` default never actually gets applied. And
> `reuslt` is a typo, which in sloppy mode creates a global instead of throwing.
>
> Move the directive above the `const` and both of those become loud: a `TypeError` on the frozen
> write, a `ReferenceError` on the typo.

⟵ *The level marker of the round. Spotting the typo is table stakes. Spotting that the directive
is inert — and then connecting it to why the OTHER two bugs are silent — is the answer. Notice the
order: the mode is diagnosed first, and the two bugs are consequences of it.*

> **I:** Nice. How would you catch that class of thing in review?

> **You:** Honestly the directive one is hard to catch by eye, because the file *does* contain the
> string `"use strict"` — it passes any grep someone runs to audit the codebase. That's what makes
> it a good bug.
>
> The structural answer is to stop relying on the directive: make it a module. Then strict is on
> with nothing to misplace. If it has to stay CommonJS, a lint rule for directive placement
> handles it, and I'd write it on line one above the banner rather than below it.

⟵ *"It passes the grep" is the sentence. Saying the structural fix — modules remove the failure
mode entirely — rather than "be more careful" is the senior move.*

---

## Minute 8–13 — The live debug

> **I:** Different one. This worked for years and started throwing after we changed the build.
> The change was moving from a concatenating bundler to one that emits ES modules.

```javascript
// analytics-legacy.js — vendor file, unchanged since 2014
function track(event) {
  if (!queue) { queue = []; }
  queue.push(event);
  return queue.length;
}
```

> **You:** `queue` is never declared. In sloppy mode `queue = []` creates a global on first call,
> and every subsequent call finds it — so this has been quietly working via an implicit global for
> a decade.
>
> Under the new build it's an ES module, which is strict with no opt-out, so the assignment is a
> `ReferenceError`. And the `if (!queue)` check throws first, actually — reading an undeclared
> variable is a `ReferenceError` in *both* modes, it's the write that differed. So under the old
> build the read threw on the very first call too... unless something else had already created
> the global.
>
> Which is worth checking: this file probably depends on some other file having created `queue`
> first, or on being called after something that did. That's the real bug — an implicit global
> used as shared state between files.

⟵ *Catching that the file relies on an implicit global is the pass mark. Noticing that the READ
would throw in both modes — so the "it worked before" story requires something else to have
created the global — is the part that shows you're tracing rather than pattern-matching. An
interviewer will often plant exactly this.*

> **I:** Good catch. Fix it.

> **You:** Declare it at module scope: `const queue = [];` and drop the lazy-init branch. It was
> only ever lazy because there was nowhere to put the declaration.
>
> If I couldn't touch the vendor file, I'd wrap it — put it in its own function scope with the
> declaration hoisted in. But the wrapping only helps if the file is still sloppy; inside a module
> it's strict regardless, so the declaration is the actual fix.

⟵ *Recognising that the wrapper trick doesn't rescue you inside a module — strictness is a
property of the module, not of the nesting — is a precise distinction most candidates miss.*

> **I:** Why did the bundler change matter at all? Isn't strict mode per file?

> **You:** It's per *file* when you write the directive, but a file isn't a unit the runtime
> respects — only functions and modules are. A concatenating bundler glues text together, so a
> file-level directive either stops being first (and the whole bundle goes sloppy) or becomes
> first for everything (and applies to vendor code that never asked for it). Both silent, opposite
> failures. That's why bundlers wrap each file in a function — it gives the directive a function
> body to be the first statement of.
>
> ES modules remove the problem, because they're strict by definition with no directive to
> misplace. Which is exactly what happened here — the new build didn't *lose* a guarantee, it
> imposed one that had been quietly absent.

⟵ *"A file isn't a unit the runtime respects" is the sentence for this whole section, and the
reframe at the end — the build didn't break the code, it revealed it — is the one that lands.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me something that tells me, at runtime, whether the code it's in is strict.

> **You:**

```javascript
function isStrict() {
  return (function () { return this === undefined; })();
}
```

> The mechanism is the `this` substitution rule. In sloppy mode a plain function call substitutes
> `globalThis` for an absent `this`; in strict mode it stays `undefined`. Nothing else needs to be
> true, so this is the smallest reliable probe.
>
> Two things I'd say about it. **It has to create and call its own inner function** — if I wrote
> `return this === undefined` directly, I'd be measuring whatever `this` the caller bound, not the
> dialect. And **it reports on the code it was written in**, because strictness is lexical: if I
> put this helper in a sloppy utility file and import it into a strict module, it reports sloppy.
> Which makes it useless as a shared utility and fine as something you paste in where you're
> actually debugging.

⟵ *Both caveats unprompted. The second one — that it can't be a shared helper — is the one that
proves you understand lexical scoping of the mode rather than having memorised the trick.*

> **I:** Where would you actually need that?

> **You:** Rarely, honestly. Mostly when a `<script>` or a CommonJS file is behaving in a way that
> only makes sense in one of the two dialects, and I want to confirm before I go looking further —
> a frozen object that isn't throwing, or a `this` that's `globalThis` when I expected `undefined`.
>
> The rest of the time I'd answer it by reading: is this an ES module, is it inside a class body,
> is there a directive on line one. Those three cover almost everything.

⟵ *Declining to oversell a party trick. Naming the three things you'd read instead is the
practical answer.*

> **I:** You mentioned class bodies. What's the rule there?

> **You:** The entire class body is strict — every method, every field initialiser, every static
> block — even if the file around it is sloppy and has no directive anywhere. Along with modules,
> that's why most people writing modern JavaScript have never typed `"use strict"` and have also
> never been outside it.

⟵ *A clean, complete answer to a factual question. Take it and move on.*

---

## Minute 18–20 — The closer

> **I:** If you were designing the language, would you have done this differently?

> **You:** I don't think there was a better option available, and the constraint is the
> interesting part.
>
> You can't remove a behaviour from JavaScript. Every page ever written has to keep working and
> there's no recall mechanism — you can't deprecate something and ship the removal in five years,
> because the pages depending on it are still up and unmaintained. So the only way to fix a design
> mistake is a second dialect that you opt into.
>
> And the string-literal syntax follows from the same constraint. If `"use strict"` had been a
> keyword, every browser older than the proposal would throw a `SyntaxError` on line one, so
> nobody could adopt it until old browsers were gone — which for the web is never. It's ugly
> specifically so old engines evaluate a string, discard it, and carry on. The syntax *is* the
> feature.
>
> The one thing I'd change is the silent-no-op case. A file that says `"use strict"` and isn't
> strict, because something got inserted above it, is the only failure here with no diagnostic at
> all — and it's the one I've actually seen ship.

⟵ *Answering "would you change it" with "here's why it couldn't have been otherwise" plus ONE
specific thing you would change is the strongest possible close. It shows you can distinguish a
deliberate constraint from an actual gap.*

> **I:** Last thing — is strict mode faster?

> **You:** Not meaningfully today, and I'd be careful claiming it. There's a real mechanism behind
> the story: removing `with` and stopping sloppy `eval` from injecting bindings made scope
> resolution statically decidable, and unmapping `arguments` removed an aliasing relationship the
> optimiser had to maintain. In 2009 that was worth real performance. Modern engines optimise both
> paths well, so I'd adopt it for the error behaviour and measure if performance actually mattered.

⟵ *Knowing the mechanism and still declining the claim. "It's faster" repeated from a blog post is
common; being able to say why it WAS true and isn't a reason now is a strong finish.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Does `freeze` stop writes? | "yes" | "throws in strict" | "+ so check the file's mode; modules vs CJS differ" |
| What does strict change? | recites a list | three categories | "+ it doesn't add rules, it removes the silence" |
| Why does it exist? | "best practice" | "to fix old mistakes" | "you can't remove behaviour from the web — hence a dialect" |
| Why a string literal? | never considered it | "backward compatibility" | "a keyword would `SyntaxError` on old engines — the syntax IS the feature" |
| The inert-directive file | finds the typo | finds the directive placement | "+ it still passes the grep; make it a module" |
| The implicit-global vendor file | "undeclared variable" | "sloppy created a global" | "+ the read throws in both modes, so something else made it" |
| Bundler concatenation | unaware | "the directive moves" | "a file isn't a unit the runtime respects — only functions and modules" |
| Detecting the mode | doesn't know | writes the probe | "+ inner function required; reports where it was written" |
| Can you opt out? | "probably `use sloppy`" | "no" | "a revocable guarantee isn't one" |
| Is it faster? | "yes" | "not really" | knows the `with`/`eval` mechanism and still declines the claim |

**The sentences that raise your level most:**

- "It stops the write either way — whether it *tells* you depends on the mode."
- "It doesn't add new rules; it makes the existing rules produce errors instead of silence."
- "You can't remove a behaviour from the web, so the only fix is a second dialect."
- "A keyword would have been a `SyntaxError` on every old engine — the string literal is the feature."
- "The file still contains `"use strict"`, so it passes the grep."
- "A file isn't a unit the runtime respects — only functions and modules are."
- "Strictness is lexical, not dynamic. The caller's mode is irrelevant."
- "A guarantee you can revoke in a nested scope isn't a guarantee."
- "The build didn't break the code, it revealed it."

**Red flags — each of these visibly drops you a level:**

- "Strict mode is a linter." → It's a dialect with different semantics.
- "It's mainly for performance." → Adopt it for error behaviour; the perf story is from 2009.
- Reciting twenty items with no structure.
- "Always add `"use strict"` to new files." → Modules and classes are already strict.
- Thinking `"use sloppy"` exists.
- Thinking strictness is inherited from the *caller*.
- Not knowing the directive must be the first statement.
- "`Object.freeze` always throws."
- "Strict mode makes `this` `undefined` everywhere." → Only where it would have been substituted.
- Claiming it catches typo'd property names.

---

## Drill it

Say these out loud, timed, until they're boring:

```
[ ] does Object.freeze throw — and when it doesn't          (45s)
[ ] the three categories of change                           (75s)
[ ] why strict mode exists at all                            (60s)
[ ] why the directive is a string and not a keyword          (45s)
[ ] the inert-directive code review, all three findings      (90s)
[ ] this in a plain call — substitution AND boxing           (60s)
[ ] the extracted-method bug in both dialects                (45s)
[ ] mapped vs unmapped arguments                             (45s)
[ ] the implicit-global vendor debug                         (90s)
[ ] the concatenation hazard, both directions + the fix      (60s)
[ ] isStrict() from scratch, with both caveats               (2 min)
[ ] where you're already strict without writing it           (45s)
[ ] can you opt out — and why not                            (45s)
[ ] is it faster — the mechanism, and the refusal            (45s)
[ ] one thing you'd change, one you wouldn't                 (60s)
```
