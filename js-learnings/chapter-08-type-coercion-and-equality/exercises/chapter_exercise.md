# Chapter 8 Exercise — Type Coercion and Equality

## Overview

This exercise applies only Chapter 8 concepts: `ToPrimitive`, `ToNumber`, `ToString`, `ToBoolean`, the `==` algorithm, the `+` operator, relational comparison, and the four equality algorithms.

**Rule: do not run the code before answering.** The entire skill being trained here is deriving the answer from the algorithm. Running first teaches you nothing — you can verify afterwards.

For every answer, write the **trace**, not just the result. A correct value with no derivation scores zero; a wrong value with a nearly-correct trace is worth more.

**Estimated time:** 30–60 minutes

---

## Program 1 — Output Tracer

Predict the output of each `console.log`.

```javascript
"use strict";

console.log(1 + "2" + 3);       // << A
console.log(1 + 2 + "3");       // << B
console.log("5" - "2" + "1");   // << C
console.log(+"" + +"0" + +[]);  // << D
```

```javascript
"use strict";

console.log([] == false);  // << E
console.log([0] == false); // << F
console.log([1] == true);  // << G
console.log([2] == true);  // << H
```

```javascript
"use strict";

console.log(null == 0);         // << I
console.log(null >= 0);         // << J
console.log(undefined == null); // << K
console.log(undefined >= null); // << L
```

```javascript
"use strict";

const d = new Date(0);
console.log(typeof (d + 1)); // << M
console.log(typeof (d - 1)); // << N
```

```javascript
"use strict";

console.log([NaN].includes(NaN));             // << O
console.log([NaN].indexOf(NaN));              // << P
console.log(new Set([0, -0, NaN, NaN]).size); // << Q
```

For each output, write:
- The value
- The steps that produced it — name the operation (`ToPrimitive`, `ToNumber`, the `==` step number, or "relational, not equality")

---

## Program 2 — True/False Reasoning

For each statement, write True or False and explain why in one sentence.

1. `"" == 0`
2. `"" == "0"`
3. `[] == ![]`
4. `[]` is falsy
5. `null == false`
6. `"10" < "9"`
7. `3 > 2 > 1` evaluates to `true`
8. `Number("010") === 8`
9. `isNaN("hello")` and `Number.isNaN("hello")` return the same value
10. `1n == 1` is `true` but `1n === 1` is `false`
11. `Object.is(0, -0)` and `0 === -0` return the same value
12. `typeof (new Date() + 1)` is `"string"`

---

## Program 3 — Coercion Detective

This program instruments the conversion methods so you can see exactly which one the engine reaches for.

```javascript
"use strict";

function trace(label) {
  return {
    valueOf() {
      console.log(label, "valueOf");
      return 10;
    },
    toString() {
      console.log(label, "toString");
      return "TEN";
    },
  };
}

const a = trace("a");

console.log(`${a}`);   // << R  — which method logs? what is the result?
console.log(a + 1);    // << S
console.log(a * 2);    // << T
console.log(String(a)); // << U
console.log(a == 10);  // << V
console.log(a > 5);    // << W
```

For each of R–W, write **two** things: which method (`valueOf` or `toString`) the engine calls, and the final result. Name the hint that decided it.

Now a `Symbol.toPrimitive` object — the same value with three different primitive forms:

```javascript
"use strict";

const money = {
  amount: 1999, // cents
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `$${(this.amount / 100).toFixed(2)}`;
    return `Money(${this.amount})`; // hint "default"
  },
};

console.log(+money);        // << X
console.log(`${money}`);    // << Y
console.log(money + "");    // << Z
console.log(money > 1000);  // << AA
console.log(money == 1999); // << AB
```

`AB` is the one worth thinking hardest about. Before you answer, ask: **which hint does `==` use?** Then follow what happens to the value it gets back.

---

## Program 4 — Implement `looseEqual`

Implement the `==` algorithm yourself.

```javascript
"use strict";

function looseEqual(a, b) {
  // TODO: implement IsLooselyEqual
  //
  // HARD CONSTRAINT: you may not use == or != anywhere in this function.
  // Allowed: ===, !==, typeof, Number(), String(), Object.is, Array.isArray,
  //          Number.isNaN, and any control flow you like.
  //
  // Implement these steps in order:
  //   1.  same type                  → return a === b
  //   2/3 null ↔ undefined           → true
  //   4/5 Number ↔ String            → convert the string with ToNumber, retry
  //   8/9 Boolean on either side     → convert THAT side with ToNumber, retry
  //   10/11 Object vs primitive      → ToPrimitive the object, retry
  //   13. anything else              → false
  //
  // Note the shape: several steps CONVERT and then RESTART the whole
  // algorithm. Recursion models this far better than a flat if-chain.
}

function toPrimitive(obj) {
  // TODO: implement the "default" hint
  // - Symbol.toPrimitive first, if present — call it with "default"
  // - otherwise valueOf(), then toString()
  // - take the first result that is NOT an object
  // - neither works → throw a TypeError
}
```

**Tests:**

```javascript
console.log(looseEqual(null, undefined));            // true
console.log(looseEqual(null, 0));                    // false
console.log(looseEqual(undefined, false));           // false
console.log(looseEqual("1", 1));                     // true
console.log(looseEqual("", 0));                      // true
console.log(looseEqual("", "0"));                    // false
console.log(looseEqual("0", 0));                     // true
console.log(looseEqual([], false));                  // true
console.log(looseEqual([], ![]));                    // true
console.log(looseEqual([1], true));                  // true
console.log(looseEqual([2], true));                  // false
console.log(looseEqual(NaN, NaN));                   // false
console.log(looseEqual({ valueOf: () => 1 }, 1));    // true
console.log(looseEqual({}, {}));                     // false
```

**Then verify it properly.** Build a matrix of values and assert your implementation agrees with the real operator on every pair:

```javascript
const values = [
  null, undefined, true, false, 0, -0, 1, NaN,
  "", "0", "1", "false", [], [0], [1], {}, { valueOf: () => 1 },
];

let mismatches = 0;
for (const a of values) {
  for (const b of values) {
    // eslint-disable-next-line eqeqeq
    if (looseEqual(a, b) !== (a == b)) {
      mismatches++;
      console.log("MISMATCH:", String(a), "vs", String(b));
    }
  }
}
console.log(mismatches === 0 ? "all 289 pairs agree" : `${mismatches} mismatches`);
```

Using `==` in the **test harness** is not just allowed, it is the point — the real operator is your oracle. The constraint applies only to `looseEqual` itself.

**Bonus (optional):** add step 12 so `looseEqual(1n, 1)` returns `true` and `looseEqual(1n, 1.5)` returns `false`.

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A, B: `+` is left-associative. Evaluate the leftmost pair first and ask whether *that* result is a string.
- C: `-` has no string path at all.
- D: unary `+` is `ToNumber` exposed. What is `ToNumber("")`? What is `ToPrimitive([])`?
- E–H: the boolean converts to a **number** first (step 9), not to truthiness. Then the array flattens via `join(",")`.
- I–L: `==` has an early step for null/undefined that stops before conversion. Relational operators have no such step. Also: what is `ToNumber(undefined)`, and what does every comparison with `NaN` return?
- M, N: which built-in flips the "default" hint to "string"?
- O–Q: three different equality algorithms appear in these three lines.

**Program 2**
- 4: this is a `ToBoolean` question, and `ToBoolean` has a closed list of eight values. Is `[]` on it?
- 7: each `>` is binary and returns a boolean, which the next `>` then converts.
- 9: one of these two coerces its argument first. Which, and what does that do to a non-numeric string?

**Program 3**
- The hint decides the method order: `"string"` → `toString` first, `"number"`/`"default"` → `valueOf` first.
- Which hint does a template literal use? Unary `+`? `*`? A relational operator? `==`?
- For AB: `==` uses the **default** hint. Get the primitive that produces, then continue the algorithm with it — you now have a String on one side and a Number on the other, which means step 5 runs `ToNumber` on it. What is `ToNumber("Money(1999)")`?

**Program 4**
- Steps 4/5, 8/9, 10/11 all end in "retry" — write them as `return looseEqual(convertedA, b)`.
- Detect an object with `(typeof v === "object" && v !== null) || typeof v === "function"`. Remember `typeof null === "object"` (Ch 7).
- Step 1 must come first and handle NaN correctly — `a === b` already does, since `NaN === NaN` is false.
- `toPrimitive`: check `v[Symbol.toPrimitive]` is a function, call it with `"default"`. Otherwise loop over `["valueOf", "toString"]`.
- If your matrix test reports mismatches on the `{ valueOf: () => 1 }` row, check that you are calling `toPrimitive` on the *object* side only, and that you restart afterwards rather than comparing directly.

</details>

---

## What to Verify

- [ ] Program 1: All 17 outputs (A–Q) predicted correctly, each with a named mechanism
- [ ] Program 2: All 12 True/False answers correct with one-sentence reasons
- [ ] Program 3: R–W name the right method *and* the right result
- [ ] Program 3: X–AB correct, and you can explain AB without running it
- [ ] Program 4: `looseEqual` passes all 14 listed tests
- [ ] Program 4: The 289-pair matrix reports zero mismatches
- [ ] Program 4: No `==` or `!=` appears inside `looseEqual` or `toPrimitive`
