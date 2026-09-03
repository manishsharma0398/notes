# Chapter 19 — Chapter Exercise: Numeric Edge Cases

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer,
name the **rule** — "not representable in binary", "gap grows with magnitude", "every comparison
with NaN is false", "coerces first", "SameValueZero", "sign bit is independent", "silent
overflow", "past 2^53 integers collide", "rounded the value it was actually given".

Plain `node file.js` is enough for everything here.

---

## Program 1 — Representation and comparison

### A · the classic, and its neighbours

```javascript
console.log(0.1 + 0.2 === 0.3);
console.log(0.1 + 0.2 - 0.3);
console.log(0.5 + 0.25 === 0.75);
console.log(0.1 + 0.7);
console.log(0.3 % 0.1);
```

*Predict all five. Line 3 behaves differently from line 1 — say why, in one sentence about
denominators.*

### B · the tolerance that isn't

```javascript
const near = (a, b) => Math.abs(a - b) < Number.EPSILON;
console.log(near(0.1 + 0.2, 0.3));
console.log(near(1e9 + 0.1 + 0.2, 1e9 + 0.3));
console.log((1e9 + 0.1 + 0.2) - (1e9 + 0.3));
```

*Predict all three. The second line uses identical arithmetic to the first — explain the different
answer in terms of what `Number.EPSILON` is **defined as**, not in terms of "bigger numbers are
less precise".*

### C · where the gap is

```javascript
console.log(1 + Number.EPSILON === 1);
console.log(1 + Number.EPSILON / 2 === 1);
console.log(1e16 + 1 === 1e16);
console.log(Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2);
```

*Predict all four. Lines 3 and 4 are the same fact stated two ways — say what that fact is.*

---

## Program 2 — `NaN`

### D · identity and containment

```javascript
console.log(typeof NaN);
console.log(NaN === NaN, Object.is(NaN, NaN));
console.log([NaN].indexOf(NaN), [NaN].includes(NaN));
console.log(new Set([NaN, NaN, NaN]).size);
```

*Predict every value. Lines 3 and 4 disagree with line 2 — name the algorithm each one uses.*

### E · the two functions with almost the same name

```javascript
for (const v of ["hello", "", "42", null, undefined, [], [1], {}]) {
  console.log(isNaN(v), Number.isNaN(v));
}
```

*Predict the eight pairs. Then state, in one sentence, what question `isNaN` is **actually**
answering — it is not "is this NaN".*

### F · the guard that doesn't guard

```javascript
const readings = [12, 8, undefined, 15];
const avg = readings.reduce((a, b) => a + b, 0) / readings.length;

if (avg > 10) console.log("high");
else if (avg <= 10) console.log("normal");
else console.log("???");
```

*Which branch runs? Predict before running. Then answer: is there ANY comparison you could add to
that chain that would catch this case? Say why or why not.*

---

## Program 3 — Zeros and infinities

### G · telling the zeros apart

```javascript
console.log(-0 === 0, Object.is(-0, 0));
console.log(1 / -0);
console.log(Math.round(-0.4), Math.round(-0.5), Math.round(-1.5));
console.log(String(-0), JSON.stringify(-0), (-0).toFixed(2));
console.log(new Intl.NumberFormat("en-US").format(-0));
```

*Predict every value. Line 4 and line 5 disagree about the same value — which one would a user
see, and which one would your log file show?*

### H · a small negative is not the same bug

```javascript
console.log((-0.001).toFixed(2));
console.log(Object.is(-0.001, -0));
console.log((-0.001 + 0).toFixed(2));
console.log(Math.round(-0.001 * 100) / 100);
```

*Predict all four. G and H both put a minus sign in front of a zero on screen — say precisely how
the two causes differ, and which fix applies to which.*

### I · the silent edges

```javascript
console.log(Number.MAX_VALUE * 2);
console.log(Number.MAX_VALUE + 1 === Number.MAX_VALUE);
console.log(Number.MIN_VALUE, Number.MIN_VALUE / 2);
console.log(Math.max(), Math.min(), Math.max(...[]));
console.log(Infinity - Infinity, Infinity + Infinity, 0 * Infinity);
console.log(JSON.stringify({ a: Infinity, b: NaN }));
console.log(Math.Infinity);
```

*Predict every value. Two of these lines produce a value with no error at all where another
language might throw — name which two and what the "error" would have been.*

---

## Program 4 — Integers and money

### J · past 2^53

```javascript
console.log(9007199254740992 === 9007199254740993);
console.log(Number.isInteger(2 ** 53), Number.isSafeInteger(2 ** 53));
const parsed = JSON.parse('{"id": 12345678901234567890}');
console.log(parsed.id, Number.isSafeInteger(parsed.id));
console.log(String(parsed.id) === "12345678901234567890");
```

*Predict every value. Then answer: at what point in that sequence was the original id
unrecoverable, and could a `reviver` passed to `JSON.parse` have saved it? Be precise about why.*

### K · BigInt's walls

```javascript
console.log(1n == 1, 1n === 1, 1n < 2);
console.log(7n / 2n);
// which of these four throw, and with what?
// 1n + 1
// Math.sqrt(4n)
// BigInt(0.5)
// JSON.stringify({ id: 1n })
```

*Predict the values, then for each of the four commented expressions predict whether it throws and
which error type. One of the four is a `RangeError` and the rest are `TypeError`s — say why that
one is different in kind.*

### L · rounding

```javascript
console.log((1.005).toFixed(2), (2.675).toFixed(2), (0.025).toFixed(2));
console.log((1.005).toFixed(20));
console.log((0.025).toFixed(20));
console.log(typeof (1.5).toFixed(2));
console.log(Math.round(0.5), Math.round(1.5), Math.round(-0.5), Math.round(-1.5));
```

*Predict every value. `1.005` rounds down and `0.025` rounds up — explain the difference using
lines 2 and 3, without using the word "bug". Then state `Math.round`'s actual rule in one phrase.*

---

## True / false — with the mechanism

Answer each with **true or false plus one sentence of mechanism**. A bare true/false scores zero.

1. `0.1 + 0.2 !== 0.3` is a JavaScript-specific defect.
2. All decimal fractions with two decimal places are exactly representable as a double.
3. `Number.EPSILON` is the smallest positive number representable as a double.
4. `Math.abs(a - b) < Number.EPSILON` is a correct float equality check for any two finite numbers.
5. `typeof NaN` is `"NaN"`.
6. `x !== x` is `true` only when `x` is `NaN`.
7. `isNaN("hello")` and `Number.isNaN("hello")` return the same value.
8. `[NaN].includes(NaN)` is `false` because `NaN !== NaN`.
9. `-0` and `0` are the same value with two ways of writing it.
10. `String(-0)` and `Intl.NumberFormat().format(-0)` produce the same string.
11. `Number.MIN_VALUE` is the most negative representable number.
12. Multiplying past `Number.MAX_VALUE` throws a `RangeError`.
13. `Math.max()` with no arguments returns `0`.
14. Every integer below `Number.MAX_VALUE` is exactly representable.
15. `Number.isInteger(x)` and `Number.isSafeInteger(x)` return the same value for every integer.
16. `JSON.stringify` throws on `NaN` the same way it throws on a `BigInt`.
17. `(2.675).toFixed(2)` returns `"2.67"` because `toFixed` uses banker's rounding.
18. `Math.round` rounds halves away from zero.
19. Storing money as integer cents removes all rounding decisions from the code.
20. `7n / 2n` evaluates to `3.5n`.

---

## Build these

Four primitives. All four are small; the value is in the invariant each one enforces.

### 1. `nearlyEqual(a, b, ulps)` — a comparison that holds at every magnitude

```javascript
function nearlyEqual(a, b, ulps = 4) {
  // scaled tolerance. must be correct at 0.3 AND at 1e9 AND at 1e-9.
}
```

**Success criteria**

- [ ] `nearlyEqual(0.1 + 0.2, 0.3)` is `true`; `nearlyEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3)` is `true`.
- [ ] `nearlyEqual(1, 1.5)` is `false` — it must still reject genuinely different values.
- [ ] `Infinity` compared to itself is `true`; `NaN` compared to anything, including `NaN`, is
      `false`. Say in a comment which of those two needs an explicit branch and which falls out of
      the arithmetic.
- [ ] A documented decision about comparing against exactly `0`, with one sentence on why the
      relative form cannot work there.
- [ ] A test table: at least five pairs across magnitudes from `1e-9` to `1e12`, each with the
      expected answer written down **before** you ran it.

### 2. `parseSafeInt(text)` — a boundary that refuses to lie

```javascript
// Takes the RAW STRING form of an integer (as it appeared on the wire) and
// returns a Number — but refuses rather than silently rounding.
function parseSafeInt(text) {
  // ...
}
```

**Success criteria**

- [ ] `"42"` returns `42`; `"12345678901234567890"` does **not** return a rounded number.
- [ ] The refusal is something a caller can act on — an error with a message naming the actual
      problem, not a bare `NaN`.
- [ ] It rejects `"1.5"`, `"1e3"`, `""`, `" "`, `"abc"` and `"0x10"`. For each, one word on why —
      and note which of those `Number()` would have accepted.
- [ ] It handles a leading `-`, and `"-0"` is a decision you document.
- [ ] A comment answering: why must this take a **string** rather than a number, and what has
      already happened if the caller hands you `12345678901234567890` as a number?

### 3. `Money` — integer minor units with a real API

```javascript
// Holds an integer number of minor units. Never exposes a float internally.
class Money {
  // static fromMinor(cents, currency)
  // static fromDecimalString("19.99", currency)   <- parse WITHOUT a float round trip
  // plus(other) / minus(other) / times(scalar)
  // splitEvenly(ways)
  // toString() / format(locale)
}
```

**Success criteria**

- [ ] `fromDecimalString("19.99")` yields exactly `1999` minor units. Do it **without** going
      through `parseFloat` / `Number` on the whole string — a comment saying why that matters.
- [ ] `plus` and `minus` reject a different currency with an actionable error.
- [ ] Summing `[12.35, 4.45, 8.90]` through this class equals `25.70` exactly. Compare against the
      naive float sum in a test and record both.
- [ ] `times(scalar)` has a **documented** rounding rule, and the doc says which direction and why
      you chose it.
- [ ] `splitEvenly(3)` on `1000` returns parts that sum to exactly `1000`, and you can say who gets
      the extra minor unit and why that's a decision rather than an implementation detail.
- [ ] `format()` uses `Intl.NumberFormat`. Prove it does something `toFixed` cannot by formatting
      the same amount in `en-US` and `en-IN`.
- [ ] A comment naming the one thing this class still cannot represent (hint: the reason FX exists).

### 4. `describeNumber(x)` — a classifier for everything in this chapter

```javascript
// Returns a short string classifying x: "safe integer", "unsafe integer",
// "negative zero", "NaN", "infinite", "finite non-integer", "not a number type".
function describeNumber(x) {
  // ...
}
```

**Success criteria**

- [ ] `-0` is classified as `"negative zero"` and `0` is not. Say which predicate is the only one
      that can do this.
- [ ] `NaN` is classified without using `x !== x`, and a comment explains what you used instead.
- [ ] `2 ** 53` and `2 ** 53 - 1` classify differently.
- [ ] `"42"` and `1n` both classify as `"not a number type"` — say what check you used, since
      `typeof` alone gets one of these wrong if you're careless.
- [ ] The order of your checks is deliberate: write a comment naming two checks that would give the
      wrong answer if swapped, and why.

---

## Hints

Read one at a time.

**A** — Ask which denominators a binary fraction can represent exactly. Then check which of the
five literals in that program have such a denominator.

**B** — Look up what `Number.EPSILON` is *defined* as, not what it's used for. Then ask: if it's a
gap measured at one specific place on the number line, what is it saying about a different place?

**C** — Lines 3 and 4 are both asking "is the spacing between representable doubles bigger than 1
here?". Work out roughly where on the number line that starts being true.

**D** — Chapter 8 has the four equality algorithms. Two different ones appear in this program.

**E** — Run `Number(v)` on each value first, then apply the definition "returns true if the result
is `NaN`". That will tell you what `isNaN` is really testing.

**F** — The trick is not which comparison is right, it's what all comparisons against this value
have in common. Once you see that, the answer to the second question follows immediately — and it
tells you where the check has to live instead.

**G** — Five different ways of turning a number into text, and they do not agree. Sort them into
"drops the sign" and "keeps the sign" before reasoning about which matters.

**H** — One of these values is negative zero and one is a negative number that is not zero. Check
which is which with `Object.is` before deciding what each formatting call is doing.

**I** — Two of the lines are the format running out of room — at the top and at the bottom. Ask
what a language with integer overflow checking would have done there instead.

**J** — The question is about *when* the digits were lost. Trace the string through: what does
`JSON.parse` do internally before your reviver is ever called? That answers whether the reviver
could help.

**K** — Three of the four failures are "these two types don't combine". The fourth is "this
specific value can't become that type at all" — which is a different kind of complaint.

**L** — Print `.toFixed(20)` on both values first. The rounding rule is the same for both; the
inputs are not what you typed. Then ask what "half" means when the value isn't exactly at the half.

**Build 1** — Two of the special values need explicit handling and one of them is handled by the
first line you'd write anyway. Work out which by asking what `Math.abs(a - b)` gives for each.

**Build 2** — If the function's argument is already a number, the interesting question is not "how
do I check it" but "what happened before I was called". Write that comment first; it will tell you
the signature.

**Build 3** — For `fromDecimalString`, split on the decimal point and treat both halves as
integers. The reason not to use `parseFloat` on the whole thing is the entire chapter.

**Build 4** — One of your checks must come before the others or it will never fire, because the
value it's looking for passes an earlier, broader test. Find it by listing what `Number.isInteger`
says about the value in question.

---

## What to verify

- [ ] All twelve predictions in Programs 1–4 written down **before** running anything.
- [ ] For each, the **rule** named, not just the value.
- [ ] B answered in terms of what `Number.EPSILON` is defined as, not "big numbers are less precise".
- [ ] F's second question answered — whether *any* comparison could catch it, and why.
- [ ] G and H distinguished: the same-looking output, two different causes, two different fixes.
- [ ] J answers exactly where the digits were lost and whether a reviver could help.
- [ ] L explained without the word "bug".
- [ ] All twenty true/false answered with mechanism.
- [ ] All four primitives pass their success criteria, with the comments they ask for.
- [ ] `Money`'s float-vs-integer comparison test run, with both numbers recorded.
- [ ] You can say out loud, in under 90 seconds, the four-step answer to "how do you handle money
      in JavaScript".
