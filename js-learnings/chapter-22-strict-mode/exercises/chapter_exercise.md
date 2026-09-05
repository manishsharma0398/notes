# Chapter 22 — Chapter Exercise: Strict Mode

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer,
name the **rule** — "prologue ended", "lexical not dynamic", "silent failure becomes an error",
"substitution", "boxing", "mapped arguments", "removed at parse time", "Annex B", "always strict".

**Set-up matters more than usual in this chapter.** Every program says which file it belongs in.
Getting a sloppy file is harder than it looks: a `.js` file in a package with `"type": "module"`
is a *module* and therefore strict. Use a `.cjs` extension, or a directory with no `package.json`,
and verify with the detector from Program 4 before trusting any sloppy prediction.

---

## Program 1 — The directive

All of these go in **one sloppy `.cjs` file**.

### A · placement

```javascript
function a1() {
  "use strict";
  try { x1 = 1; return "no error"; } catch (e) { return e.constructor.name; }
}
function a2() {
  const local = 0;
  "use strict";
  try { x2 = 1; return "no error"; } catch (e) { return e.constructor.name; }
}
function a3() {
  // a comment
  "use strict";
  try { x3 = 1; return "no error"; } catch (e) { return e.constructor.name; }
}
function a4() {
  "some other string";
  "use strict";
  try { x4 = 1; return "no error"; } catch (e) { return e.constructor.name; }
}
console.log(a1(), a2(), a3(), a4());
```

*Predict all four. `a4` is the one to think hardest about — what exactly is a directive prologue
allowed to contain?*

### B · lexical, not dynamic

```javascript
function sloppyHelper() {
  helperLeak = 1;
  return "no error";
}

function strictCaller() {
  "use strict";
  return sloppyHelper();
}

console.log(strictCaller());
console.log(typeof globalThis.helperLeak);
```

*Predict both lines. Then answer: if you moved `sloppyHelper` inside `strictCaller`'s body without
otherwise changing it, what changes and why?*

### C · one-way

```javascript
function outer() {
  "use strict";
  function inner() {
    "use sloppy";
    try { escapee = 1; return "no error"; } catch (e) { return e.constructor.name; }
  }
  return inner();
}
console.log(outer());
```

*Predict. What is `"use sloppy"` actually doing to the program — be precise, it is doing
something.*

---

## Program 2 — The three categories

### D · silent failures

Run each of these **twice** — once in a sloppy `.cjs`, once with `"use strict"` on line 1.

```javascript
const frozen = Object.freeze({ a: 1 });
const getterOnly = { get x() { return 1; } };
const prim = "hello";

const results = [];
try { frozen.a = 2; results.push("frozen: no error"); } catch (e) { results.push("frozen: " + e.constructor.name); }
try { getterOnly.x = 2; results.push("getter: no error"); } catch (e) { results.push("getter: " + e.constructor.name); }
try { prim.foo = 1; results.push("primitive: no error"); } catch (e) { results.push("primitive: " + e.constructor.name); }
try { delete Object.prototype; results.push("delete: no error"); } catch (e) { results.push("delete: " + e.constructor.name); }
console.log(results);
```

*Predict both runs, all four entries each. Then: what is the VALUE of the expression
`frozen.a = 2` in the sloppy run? (It has one. That is the whole mechanism.)*

### E · reads vs writes

```javascript
const out = [];
try { if (!neverDeclared) out.push("read: no error"); } catch (e) { out.push("read: " + e.constructor.name); }
try { alsoNeverDeclared = 1; out.push("write: no error"); } catch (e) { out.push("write: " + e.constructor.name); }
out.push("typeof: " + typeof stillNeverDeclared);
console.log(out);
```

*Predict for BOTH modes. Only one of the three lines differs between them — which, and why does
that matter when you are told "this vendor file worked before we changed the build"?*

### F · `this`

```javascript
function report() { return [this === globalThis, this === undefined, typeof this]; }
console.log("plain:  ", report());
console.log("call str:", report.call("abc"));
console.log("call 42: ", report.call(42));
console.log("call null:", report.call(null));
```

*Predict all four rows in BOTH modes — twelve values each. Two distinct sloppy behaviours are
visible here; name them separately. Watch the `typeof` on the last row and say why it is what it
is without using the word "boxed".*

### G · `arguments`

```javascript
function writeParam(a) { a = 99; return arguments[0]; }
function writeArgs(a) { arguments[0] = 99; return a; }
function withDefault(a = 1) { a = 99; return arguments[0]; }
console.log(writeParam(1), writeArgs(1), withDefault(1));
```

*Predict all three in both modes. The third one is the trap — it behaves the same in both, and the
reason is not strict mode. (Chapter 21 covered it.)*

### H · removed syntax

For each, predict: does it run in sloppy? In strict? If it fails, is it a `SyntaxError`,
`TypeError` or `ReferenceError` — and **when** does it fail relative to the rest of the file?

```javascript
010
"\101"
with ({ a: 1 }) { a }
var v = 1; delete v;
(function (x, x) { return x; })(1, 2)
var interface = 1;
(function () { return arguments.callee; })()
```

*The "when does it fail" half is the important one and most people skip it.*

---

## Program 3 — Silent behavioural differences

### I · function in a block

```javascript
console.log("before:", typeof f);
{
  function f() { return 1; }
  console.log("inside:", typeof f);
}
console.log("after: ", typeof f);
```

*Predict all three lines in both modes. This one produces no error in either mode — say what that
implies for a file being migrated from CommonJS to an ES module.*

### J · eval

```javascript
function host() {
  eval("var injected = 7");
  return typeof injected;
}
console.log(host());
```

*Predict both modes. Then: name the OTHER construct strict mode removed for the same underlying
reason, and state that reason in one sentence.*

---

## Program 4 — Detection

### K · the probe

```javascript
function probeA() { return this === undefined; }
function probeB() { return (function () { return this === undefined; })(); }

console.log("A plain:      ", probeA());
console.log("A .call({}):  ", probeA.call({}));
console.log("B plain:      ", probeB());
console.log("B .call({}):  ", probeB.call({}));
```

*Predict all four **in both a sloppy file and a strict one** — eight values. You need both runs:
in one of the two files all four agree, and the disagreement that identifies the broken probe only
appears in the other. Say which probe is the valid mode detector, what the other one is actually
measuring, and which single row is the evidence.*

### L · where you already are

Without running anything, state the mode for each, then verify with the probe you chose in K:

1. the top level of a `.cjs` file with no directive
2. the top level of an `.mjs` file with no directive
3. a method inside a `class` in a sloppy `.cjs` file
4. a static block inside that same class
5. a function passed to `setTimeout` from strict code but *defined* in a sloppy file
6. `eval("...")` called from strict code
7. `node -e "..."`
8. a `.js` file in a package whose `package.json` has `"type": "module"`

*Two of these catch people. Say which two you were least sure about and why.*

---

## True / false — with the mechanism

Answer each with **true or false plus one sentence of mechanism**. A bare true/false scores zero.

1. `"use strict"` can appear anywhere in a file and still take effect.
2. A comment before the directive prevents it from applying.
3. A function called from strict code runs in strict mode.
4. There is a `"use sloppy"` directive to opt back out.
5. ES modules require `"use strict"` to get strict semantics.
6. Class methods are strict only if the file is.
7. In strict mode, `this` is `undefined` inside every function.
8. In strict mode, a primitive `this` is converted to its wrapper object.
9. Assigning to an undeclared variable throws in both modes.
10. *Reading* an undeclared variable throws only in strict mode.
11. `typeof someUndeclaredName` throws in strict mode.
12. `Object.freeze` prevents writes in both modes.
13. In strict mode, writing a parameter also updates `arguments[0]`.
14. `with` is a `TypeError` in strict mode.
15. `delete someVariable` returns `false` in strict mode.
16. Duplicate parameter names are a runtime error in strict mode.
17. A function declaration inside a block is visible after the block in strict mode.
18. Sloppy `eval` can create a variable in the scope that called it.
19. Strict mode is measurably faster on modern engines.
20. Strict mode catches typos in property names.

---

## Build these

Four small things. The value is in the invariant each one enforces.

### 1. `isStrict()` — and a version that lies

```javascript
function isStrict() {
  // must work when called as isStrict(), as obj.isStrict(), and as isStrict.call(anything)
}
```

**Success criteria**

- [ ] Returns the correct answer regardless of how it is called — verify with a plain call, a
      method call, `.call(null)` and `.call({})`.
- [ ] Also write `isStrictWrong()`, the naive version that reads `this` directly. Show one call
      shape where it disagrees with `isStrict()`, and say what it is actually measuring.
- [ ] A comment answering: if you put `isStrict` in a shared sloppy utility module and import it
      into a strict module, what does it report and why? Is it useful there?
- [ ] Run it at the top level of a `.cjs` and an `.mjs` and record both.

### 2. `auditDirective(source)` — find the inert directive

```javascript
// Given the SOURCE TEXT of a file, report whether a "use strict" directive
// is actually in effect at the top level, or present-but-inert.
function auditDirective(source) {
  // return "strict" | "inert-directive" | "none"
}
```

**Success criteria**

- [ ] Correctly reports `"strict"` for a file with the directive on line 1.
- [ ] Correctly reports `"inert-directive"` for a file with a `const` above it — this is the case
      the whole function exists for.
- [ ] Handles a leading block comment, a leading line comment, and a leading blank line, all of
      which are legal before the directive.
- [ ] Handles both quote styles, and a leading BOM or shebang (`#!/usr/bin/env node`) if you want
      it to work on real files.
- [ ] A comment stating the limit of a text-based approach and naming what you would use instead
      for a real audit.
- [ ] Run it over the `examples/` directory of this chapter and record what it finds.

### 3. `bundle(files)` — reproduce and then fix the hazard

```javascript
// Concatenate an array of {name, source} into one script.
function bundleNaive(files) { /* just join them */ }
function bundleSafe(files)  { /* preserve each file's mode */ }
```

**Success criteria**

- [ ] With a sloppy file first and a strict file second, `bundleNaive` produces a bundle where the
      strict file is **not** strict. Prove it by running the bundle, not by reading it.
- [ ] With the order reversed, `bundleNaive` produces a bundle where the sloppy file **throws**.
      Prove it the same way.
- [ ] `bundleSafe` gives each file the mode it was written in, for both orderings.
- [ ] `bundleSafe` still lets files expose things to each other — decide the mechanism and justify
      it in a comment.
- [ ] One sentence on why this problem does not exist for ES modules.

### 4. `strictify(fn)` — or a proof that you cannot

```javascript
// Take a sloppy function and return a strict-mode equivalent.
function strictify(fn) {
  // ...or an explanation of why this cannot work.
}
```

**Success criteria**

- [ ] Attempt it. `new Function` and `eval` are both fair game; so is reading `fn.toString()`.
- [ ] Whatever you produce, test it against a sloppy function that (a) assigns an undeclared
      variable and (b) closes over a local from its original scope.
- [ ] **(b) is the point.** Write down what happens and why. This is the criterion that matters.
- [ ] A written conclusion: is a general `strictify` possible? State the limitation precisely
      rather than as "it doesn't work".

---

## Hints

Read one at a time.

**A** — The prologue is a run of *string literal expression statements*. Ask what that phrase
allows and what it excludes; `a4` is testing exactly the "run of" part.

**B** — Ask when the mode of a function is decided: when it is written, or when it is called?
Everything follows from that.

**C** — `"use sloppy"` is not special to the language, so ask what the parser does with it. It is
in a position where *something* is allowed to be.

**D** — Look up what an assignment expression evaluates to. Then ask what a failed one evaluates
to, and why that means execution continues.

**E** — Two of the three lines behave identically in both modes. Work out which before predicting,
then ask what "worked before" can and cannot have meant for the vendor file.

**F** — There are two independent transformations happening in sloppy mode, and only one of them
involves creating an object. For the last row: what is `typeof null`, and did anything actually
transform?

**G** — For the third function, ask what Chapter 21 said about parameter lists that are not
"simple". The presence of a default is the trigger, not the mode.

**H** — Sort them into two piles first: things rejected while the file is being *parsed*, and
things that fail when the line *runs*. The pile a case lands in decides whether the rest of the
file executes at all.

**I** — The sloppy behaviour has a name (it is in Annex B of the spec, the "web compatibility"
section). Ask what that section exists for, and that tells you why the two modes differ.

**J** — The reason is about what the engine can know by *reading* a function, without running it.
The other construct is the one that makes every identifier in its body ambiguous.

**K** — One probe measures a property of the code it lives in; the other measures a property of
the call. A detector has to give the same answer however it is called, so look for the probe that
*disagrees with itself* between two call shapes in the same file — and note that this only shows
up in one of the two files, which is why you need both runs.

**L** — For 5, remember B. For 4, remember that the rule for class bodies is about the *body*, not
about any particular kind of member.

**Build 1** — The failing call shape for the naive version is the one where the caller supplies a
`this`. That is also why the correct version needs its own inner call.

**Build 2** — You are looking for the first *statement*, which means you need to skip comments and
whitespace without skipping code. Decide early whether you are writing a parser or a heuristic,
and be honest in the comment about which you chose.

**Build 3** — The fix has to give the directive a body to be the first statement of. For sharing
between files, note that the naive bundle relied on everything being in one shared scope, and your
fix removes that.

**Build 4** — Write a sloppy function that closes over a local variable, then look at what
`fn.toString()` actually gives you. The closure is not in the string.

---

## What to verify

- [ ] Every prediction written down **before** running anything.
- [ ] For each, the **rule** named, not just the outcome.
- [ ] You actually confirmed your "sloppy" file is sloppy, with the probe, before trusting a
      single sloppy prediction.
- [ ] A4 answered correctly and you can say what a directive prologue may contain.
- [ ] B and C answered as one idea: the mode is fixed at parse time and cannot be undone.
- [ ] D's "what does the failed assignment evaluate to" answered.
- [ ] E's single differing line identified, with the vendor-file consequence stated.
- [ ] F's two sloppy behaviours named separately, and the `null` row explained without "boxed".
- [ ] G's third case attributed to the right cause (not strict mode).
- [ ] H sorted into parse-time and run-time, with the consequence of each.
- [ ] I and J both identified as **silent** differences, and what that means for a CJS→ESM move.
- [ ] All twenty true/false answered with mechanism.
- [ ] All four builds pass their criteria, including Build 4's honest conclusion.
- [ ] You can say out loud, in under 75 seconds, the three categories of change and the sentence
      that ties them together.
