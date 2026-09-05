# Chapter 22 Worksheet — Strict Mode

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "prologue ended", "lexical not dynamic", "silent failure
becomes an error", "substitution", "boxing", "mapped arguments", "removed at parse time",
"Annex B", "always strict".

**Before anything else:** confirm your sloppy file is actually sloppy. A `.js` file in a package
with `"type": "module"` is a module and therefore strict.

```
how I confirmed my sloppy file is sloppy:


```

---

## Program 1 — The directive

### A · placement

```javascript
function a1() { "use strict"; try { x1 = 1; return "no error"; } catch (e) { return e.constructor.name; } }
function a2() { const local = 0; "use strict"; try { x2 = 1; return "no error"; } catch (e) { return e.constructor.name; } }
function a3() { /* a comment */ "use strict"; try { x3 = 1; return "no error"; } catch (e) { return e.constructor.name; } }
function a4() { "some other string"; "use strict"; try { x4 = 1; return "no error"; } catch (e) { return e.constructor.name; } }
console.log(a1(), a2(), a3(), a4());
```

```
a1:                a2:                a3:                a4:

what a directive prologue is allowed to contain:

rule:
```

---

### B · lexical, not dynamic

```javascript
function sloppyHelper() { helperLeak = 1; return "no error"; }
function strictCaller() { "use strict"; return sloppyHelper(); }
console.log(strictCaller());
console.log(typeof globalThis.helperLeak);
```

```
line 1:                          line 2:

if sloppyHelper moved INSIDE strictCaller's body, what changes and why:


rule:
```

---

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

```
prediction:

what "use sloppy" is actually doing to the program (be precise):
```

---

## Program 2 — The three categories

### D · silent failures

```javascript
const frozen = Object.freeze({ a: 1 });
const getterOnly = { get x() { return 1; } };
const prim = "hello";
// four try/catch writes: frozen.a, getterOnly.x, prim.foo, delete Object.prototype
```

```
SLOPPY:  frozen:            getter:            primitive:            delete:

STRICT:  frozen:            getter:            primitive:            delete:

the VALUE of the expression `frozen.a = 2` in the sloppy run:

why that means execution continues:
```

---

### E · reads vs writes

```javascript
try { if (!neverDeclared) out.push("read: no error"); } catch (e) { out.push("read: " + e.constructor.name); }
try { alsoNeverDeclared = 1; out.push("write: no error"); } catch (e) { out.push("write: " + e.constructor.name); }
out.push("typeof: " + typeof stillNeverDeclared);
```

```
SLOPPY:  read:              write:              typeof:

STRICT:  read:              write:              typeof:

which single line differs:

why that matters for "this vendor file worked before we changed the build":


```

---

### F · `this`

```javascript
function report() { return [this === globalThis, this === undefined, typeof this]; }
report();  report.call("abc");  report.call(42);  report.call(null);
```

```
SLOPPY   plain:                       call "abc":
         call 42:                     call null:

STRICT   plain:                       call "abc":
         call 42:                     call null:

the two distinct sloppy behaviours, named separately:
  1.
  2.

why the `typeof` on the call-null row is what it is (without the word "boxed"):
```

---

### G · `arguments`

```javascript
function writeParam(a) { a = 99; return arguments[0]; }
function writeArgs(a) { arguments[0] = 99; return a; }
function withDefault(a = 1) { a = 99; return arguments[0]; }
```

```
SLOPPY:  writeParam:          writeArgs:          withDefault:

STRICT:  writeParam:          writeArgs:          withDefault:

why withDefault behaves the same in both — and what actually causes it:
```

---

### H · removed syntax

```
                                   sloppy?          strict?        fails WHEN?
010
"\101"
with ({a:1}) { a }
var v = 1; delete v;
(function (x, x) {...})(1,2)
var interface = 1;
(function(){ return arguments.callee; })()

the consequence of failing at parse time vs at run time:


```

---

## Program 3 — Silent behavioural differences

### I · function in a block

```javascript
console.log("before:", typeof f);
{ function f() { return 1; } console.log("inside:", typeof f); }
console.log("after: ", typeof f);
```

```
SLOPPY:  before:            inside:            after:

STRICT:  before:            inside:            after:

what "no error in either mode" implies for a CommonJS -> ESM migration:


```

---

### J · eval

```javascript
function host() { eval("var injected = 7"); return typeof injected; }
```

```
SLOPPY:                      STRICT:

the OTHER construct removed for the same reason:

that reason, in one sentence:
```

---

## Program 4 — Detection

### K · the probe

```javascript
function probeA() { return this === undefined; }
function probeB() { return (function () { return this === undefined; })(); }
```

```
SLOPPY file:  A plain:        A .call({}):        B plain:        B .call({}):

STRICT file:  A plain:        A .call({}):        B plain:        B .call({}):

which probe is the valid detector:

what the other one is actually measuring:

the single row that is the evidence:
```

---

### L · where you already are

```
1. top level of a .cjs, no directive          :
2. top level of an .mjs, no directive         :
3. class method in a sloppy .cjs              :
4. static block in that same class            :
5. fn passed to setTimeout from strict code,
   but DEFINED in a sloppy file               :
6. eval("...") called from strict code        :
7. node -e "..."                              :
8. .js in a package with "type": "module"     :

the two I was least sure about, and why:


```

---

## True / false — with the mechanism

```
1.  "use strict" can appear anywhere in a file and still take effect.
    T/F:            mechanism:

2.  A comment before the directive prevents it from applying.
    T/F:            mechanism:

3.  A function called from strict code runs in strict mode.
    T/F:            mechanism:

4.  There is a "use sloppy" directive to opt back out.
    T/F:            mechanism:

5.  ES modules require "use strict" to get strict semantics.
    T/F:            mechanism:

6.  Class methods are strict only if the file is.
    T/F:            mechanism:

7.  In strict mode, `this` is undefined inside every function.
    T/F:            mechanism:

8.  In strict mode, a primitive `this` is converted to its wrapper object.
    T/F:            mechanism:

9.  Assigning to an undeclared variable throws in both modes.
    T/F:            mechanism:

10. Reading an undeclared variable throws only in strict mode.
    T/F:            mechanism:

11. typeof someUndeclaredName throws in strict mode.
    T/F:            mechanism:

12. Object.freeze prevents writes in both modes.
    T/F:            mechanism:

13. In strict mode, writing a parameter also updates arguments[0].
    T/F:            mechanism:

14. `with` is a TypeError in strict mode.
    T/F:            mechanism:

15. delete someVariable returns false in strict mode.
    T/F:            mechanism:

16. Duplicate parameter names are a runtime error in strict mode.
    T/F:            mechanism:

17. A function declaration inside a block is visible after the block in strict mode.
    T/F:            mechanism:

18. Sloppy eval can create a variable in the scope that called it.
    T/F:            mechanism:

19. Strict mode is measurably faster on modern engines.
    T/F:            mechanism:

20. Strict mode catches typos in property names.
    T/F:            mechanism:
```

---

## Build these

### 1. `isStrict()` — and a version that lies

```javascript
function isStrict() { /* correct under every call shape */ }
function isStrictWrong() { /* the naive version */ }
```

```
the call shape where they disagree:

what isStrictWrong is actually measuring:

if isStrict lives in a shared SLOPPY utility imported into a strict module,
what does it report, and is it useful there:


.cjs top level:                    .mjs top level:
```

- [ ] correct for plain call, method call, `.call(null)`, `.call({})`
- [ ] `isStrictWrong` written and the disagreeing shape identified
- [ ] the shared-utility comment written
- [ ] both file types run and recorded

---

### 2. `auditDirective(source)`

```javascript
function auditDirective(source) { /* "strict" | "inert-directive" | "none" */ }
```

```
the limit of a text-based approach:

what you'd use instead for a real audit:

what it found when run over this chapter's examples/:


```

- [ ] `"strict"` for a directive on line 1
- [ ] `"inert-directive"` for a `const` above it
- [ ] handles block comment / line comment / blank line before it
- [ ] handles both quote styles, and BOM or shebang
- [ ] run over `examples/`, findings recorded

---

### 3. `bundle(files)`

```javascript
function bundleNaive(files) { /* just join */ }
function bundleSafe(files)  { /* preserve each file's mode */ }
```

```
naive, sloppy-then-strict — what happened when RUN:

naive, strict-then-sloppy — what happened when RUN:

how bundleSafe lets files expose things to each other, and why that mechanism:

why this problem does not exist for ES modules:
```

- [ ] naive loses strictness in one ordering, proven by running it
- [ ] naive imposes strictness in the other, proven by running it
- [ ] `bundleSafe` correct for both orderings
- [ ] the ESM sentence written

---

### 4. `strictify(fn)` — or a proof that you cannot

```javascript
function strictify(fn) { /* ...or the explanation */ }
```

```
what happened with the undeclared-assignment function:

what happened with the closure-over-a-local function:


the precise limitation (not "it doesn't work"):


is a general strictify possible? conclusion:
```

- [ ] attempted, with `new Function` / `eval` / `toString`
- [ ] tested against both function shapes
- [ ] **the closure case explained** — this is the criterion that matters
- [ ] a precise written conclusion

---

## The 75-second answer

Write it out, then say it out loud, timed.

```
the three categories of change, plus the sentence that ties them together:




```

---

## What to verify

- [ ] Every prediction written down **before** running anything
- [ ] For each, the **rule** named
- [ ] Sloppy file confirmed sloppy with the probe before trusting any sloppy prediction
- [ ] A4 answered, and you can say what a prologue may contain
- [ ] B and C answered as one idea: fixed at parse time, cannot be undone
- [ ] D's "what does the failed assignment evaluate to" answered
- [ ] E's single differing line identified, with the vendor-file consequence
- [ ] F's two sloppy behaviours named separately; the null row explained without "boxed"
- [ ] G's third case attributed to the right cause (not strict mode)
- [ ] H sorted into parse-time vs run-time, with the consequence
- [ ] I and J identified as **silent** differences, and what that means for CJS→ESM
- [ ] All twenty true/false answered with mechanism
- [ ] All four builds pass, including Build 4's honest conclusion
- [ ] The 75-second answer said out loud, timed
