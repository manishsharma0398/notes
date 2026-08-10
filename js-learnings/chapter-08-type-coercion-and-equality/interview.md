# Chapter 8 — Interview Questions: Type Coercion and Equality

## Q1: "What's the difference between `==` and `===`?"

**The trap:** The stock answer — "`==` compares values, `===` compares values and types" — is wrong, and a good interviewer is listening for it. Both operators compare values. Both check types.

**Correct answer:** `===` (`IsStrictlyEqual`) returns `false` immediately when the operands have different types. `==` (`IsLooselyEqual`) instead applies a fixed 14-step conversion algorithm and *retries* until both sides share a type, then defers to `===`.

Say the shape of the algorithm and you've answered better than most senior candidates:

```
1.  same type            → ===
2/3 null ↔ undefined     → true
4/5 Number ↔ String      → ToNumber the string
8/9 Boolean on either    → ToNumber the boolean (0 or 1)
10/11 Object vs primitive → ToPrimitive the object, restart
13. otherwise            → false
```

**Follow-up you should volunteer:** `==` is not transitive — `"" == 0` and `"0" == 0`, yet `"" != "0"`. That, not unpredictability, is the real argument for `===`.

---

## Q2: Derive it — why is `[] == false` true?

**Answer:** Four steps, no memorization:

```
[] == false
  step 9  — y is Boolean       → ToNumber(false) = 0    → [] == 0
  step 11 — x is Object        → ToPrimitive([]) = ""   → "" == 0
  step 5  — String vs Number   → ToNumber("") = 0       → 0 == 0
  step 1  — same type          → true
```

Two facts do the work: `Array.prototype.toString` is `join(",")`, so an empty array becomes `""`; and `ToNumber("")` is `0`, not `NaN`.

**Follow-up: `[] == ![]`?** `![]` is `false` — arrays are objects, objects are truthy. So it reduces to the trace above. `true`.

**The trap inside the trap:** `[]` is **truthy**. `if ([])` runs. It becomes `0` only under `==`, through a completely different operation. Candidates who say "`[]` is falsy" have memorized an output instead of a mechanism.

---

## Q3: Why is `null >= 0` true when `null == 0` is false?

**Answer:** They are different algorithms that were never required to agree.

- `==` has an explicit early step for `null`/`undefined`: they equal each other and nothing else. It short-circuits *before* any conversion, so `ToNumber(null)` is never reached.
- `>=` is a **relational** operator. It has no null case at all — it converts via `ToNumber`, and `ToNumber(null)` is `0`. So `0 >= 0` is `true`.

The consequence is a value that is simultaneously "not equal to 0" and "both ≥ 0 and ≤ 0":

```javascript
null == 0;                  // false
null >= 0 && null <= 0;     // true
```

**Follow-up: what about `undefined >= 0`?** `false` — `ToNumber(undefined)` is `NaN`, and every relational comparison involving `NaN` is `false`, including `undefined <= 0`.

---

## Q4: "Why does JavaScript behave this way?" — Why does `==` exist at all?

**Answer:** It is the original equality operator, from 1995. There was no `===`; it arrived in ECMAScript 1 (1997) *after* the problems with `==` were understood.

The design was deliberate for the context: early JavaScript's job was form validation in Netscape 2. Every value out of an HTML form is a string, so `userAge == 18` "just working" against `"18"` removed a conversion step from the language's single most common task. The audience was assumed to be non-programmers writing a few lines.

What made it a mistake was not the coercion itself but that it was chosen as the **default-looking** operator. `==` is the shorter, more familiar spelling, so it reads as the normal choice while `===` looks like the special case — exactly backwards from how they should be used.

**What breaks if `==` were removed today?** `x == null` is the idiomatic nullish check and appears throughout real codebases and in the spec's own prose. More decisively: the web is unversioned. Removing an operator breaks pages nobody maintains and nobody can fix. That is why the fix was additive — a new operator, then linters, then TypeScript — rather than corrective.

---

## Q5: Trap — predict every line

```javascript
console.log(1 + "2");
console.log("5" - 2);
console.log([] + {});
console.log(1 + 2 + "3");
console.log("1" + 2 + 3);
console.log([1, 2] + [3]);
```

**Answers:** `"12"`, `3`, `"[object Object]"`, `"33"`, `"123"`, `"1,23"`

**The mechanism to state:** `+` runs `ToPrimitive` on **both** operands *first*, and only then asks whether either result is a string. Every other arithmetic operator (`-`, `*`, `/`, `%`) has no string path and goes straight to `ToNumber`.

`[1,2] + [3]` is the one that separates people who know the rule from people who pattern-match: both arrays stringify via `join(",")` to `"1,2"` and `"3"`, concatenating to `"1,23"`. It is not array concatenation, and the result is a string.

**Follow-up: `{} + []`?** `0` in a script, `"[object Object]"` in the Node REPL. The honest answer is that this is a **parsing** question, not a coercion one: at statement position `{}` is an empty block, leaving unary `+[]` → `ToNumber("")` → `0`. The REPL evaluates its input as an expression, so the object literal survives. Any puzzle whose answer changes between the REPL and a file is a parser question.

---

## Q6: How many equality algorithms does JavaScript have?

**Answer:** Four. Most candidates say two.

| | `==` | `===` | `Object.is` | SameValueZero |
|---|---|---|---|---|
| coerces | yes | no | no | no |
| `NaN` vs `NaN` | false | false | **true** | **true** |
| `+0` vs `-0` | true | true | **false** | true |
| reachable via | `==` | `===`, `indexOf`, `switch` | `Object.is` | `includes`, `Map`/`Set` keys |

SameValueZero has no operator — you only reach it through built-ins.

**Why it matters in production:**

```javascript
[NaN].indexOf(NaN);   // -1    ← indexOf uses ===
[NaN].includes(NaN);  // true  ← includes uses SameValueZero
```

`Array.prototype.includes` was added in ES2016 for exactly this reason. And a cache keyed with `indexOf` will silently never hit on `NaN`, while a `Map`-based one works — a performance bug that produces no error and no wrong answer, just quiet extra work.

---

## Q7: "Why doesn't this alternative exist?" — Why can't you overload `===`?

**Answer:** There is no `Symbol.equals`, and this is deliberate.

`===` on objects is identity comparison, and engines depend on it being **constant-time, side-effect-free, and infallible**. It is inlined into inline caches, hidden-class checks, and `Map` key dispatch — comparisons that happen millions of times per second and never appear in your source. If user code could run during `===`:

- `a === a` could return `false`, breaking the reflexivity every optimization assumes
- comparison could throw, so every comparison site would need exception handling
- comparison could allocate or mutate, so no comparison could be reordered or eliminated
- every inline cache would need a deoptimization guard

The cost lands on every comparison in every program, to serve a narrow value-object use case. Languages that do allow it (Python's `__eq__`, C++'s `operator==`) accept a fundamentally different performance model.

**The same reasoning, sharper, for `ToBoolean`:** there is no `Symbol.toBoolean` either, so you cannot build a falsy object. `if (x)` is the most common operation in any program; letting it run user code or throw would mean no control flow could be reasoned about locally.

**Follow-up: isn't `document.all` falsy?** Yes — the one exception in the entire language. It carries an internal `[[IsHTMLDDA]]` slot that makes it falsy, makes `typeof document.all` return `"undefined"`, and makes `document.all == null` true. It exists because legacy sites used `if (document.all)` to detect Internet Explorer; when other browsers implemented `document.all` for compatibility, it had to *look absent* to feature detection while still working when used. TC39 standardized the hack in Annex B rather than let the web rely on unspecified behavior. It is the exception that shows how firmly the rule is held.

---

## Q8: Why is `1n == 1` true but `1n + 1` a TypeError?

**Answer:** Because comparison has a safe answer and arithmetic does not.

`==` step 12 compares the **mathematical values** of a BigInt and a Number. That is well-defined and lossless — you are asking a question, not producing a value.

Arithmetic has to *return* something, and neither implicit conversion is safe:
- BigInt → Number silently loses precision above 2^53
- Number → BigInt silently loses any fractional part

TC39 chose a loud `TypeError` over a silent wrong result. Given that BigInt exists specifically for values Number cannot represent, a silent precision loss would defeat the type's entire purpose.

```javascript
1n == 1;      // true
1n === 1;     // false — different types
1n < 2;       // true  — relational comparison is also safe
1n + 1;       // TypeError
+1n;          // TypeError — unary + is defined as ToNumber, which rejects BigInt
Number(1n) + 1; // 2   — explicit conversion is fine
1n + "1";     // "11"  — concatenation uses ToString, not ToNumber
```

---

## Q9: Spot the bug

```javascript
function applyDiscount(cart) {
  if (cart.discount == false) {
    return cart.total;
  }
  return cart.total * (1 - cart.discount);
}
```

**Answer:** `== false` is not a truthiness test — it is `ToNumber(x) === 0` after conversion. So it matches far more than intended:

```javascript
applyDiscount({ total: 100, discount: 0 });    // 100 — intended
applyDiscount({ total: 100, discount: "" });   // 100 — "" → 0, matches
applyDiscount({ total: 100, discount: [] });   // 100 — [] → "" → 0, matches
applyDiscount({ total: 100, discount: "0" });  // 100 — "0" → 0, matches
```

Meanwhile the case the author almost certainly cared about slips through:

```javascript
applyDiscount({ total: 100 });  // NaN — discount is undefined;
                                //   undefined == false is FALSE, so we fall through
                                //   to 100 * (1 - undefined) → NaN
```

`undefined` and `null` equal only each other — never `false` — so a missing discount takes the *discount* branch and silently produces `NaN`, which then propagates through every downstream total.

**The fix — decide what you actually mean:**

```javascript
if (!cart.discount) { ... }              // any falsy discount, including 0 and missing
if (cart.discount == null) { ... }       // specifically missing (null or undefined)
if (cart.discount === 0) { ... }         // specifically an explicit zero
```

---

## Q10: What does this print, and what does it prove?

```javascript
const obj = {
  valueOf() {
    return this.n++;
  },
  n: 1,
};

console.log(obj == 1, obj == 2, obj == 3);
```

**Answer:** `true true true`

**What it proves:** `==` is **not a pure function** when an object is involved. Steps 10/11 call `ToPrimitive`, which calls *your* `valueOf` — so the same operands can produce a different answer on every evaluation, and evaluating `a == b` can mutate program state.

`===` never has this property: it either compares identity or compares primitives, and it never invokes user code.

**Where this bites in practice:** getters. An object with a computed `valueOf`, or a proxy, turns an innocuous-looking `==` into a call site. It is also why you should never define `valueOf`/`toString` to be non-deterministic — you make equality itself unreliable, and no one reading the comparison will suspect it.
