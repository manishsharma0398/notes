# Chapter 19 Worksheet — Numeric Edge Cases

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "not representable in binary", "gap grows with magnitude",
"every comparison with NaN is false", "coerces first", "SameValueZero", "sign bit is independent",
"silent overflow", "past 2^53 integers collide", "rounded the value it was actually given".

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

```
line 1:
line 2:
line 3:
line 4:
line 5:

why line 3 differs from line 1 (one sentence about denominators):

rule:
```

---

### B · the tolerance that isn't

```javascript
const near = (a, b) => Math.abs(a - b) < Number.EPSILON;
console.log(near(0.1 + 0.2, 0.3));
console.log(near(1e9 + 0.1 + 0.2, 1e9 + 0.3));
console.log((1e9 + 0.1 + 0.2) - (1e9 + 0.3));
```

```
line 1:
line 2:
line 3:

what Number.EPSILON is DEFINED as:

why line 2 differs from line 1 (using that definition, NOT "big numbers are less precise"):
```

---

### C · where the gap is

```javascript
console.log(1 + Number.EPSILON === 1);
console.log(1 + Number.EPSILON / 2 === 1);
console.log(1e16 + 1 === 1e16);
console.log(Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2);
```

```
line 1:            line 2:
line 3:            line 4:

the single fact lines 3 and 4 both state:
```

---

## Program 2 — NaN

### D · identity and containment

```javascript
console.log(typeof NaN);
console.log(NaN === NaN, Object.is(NaN, NaN));
console.log([NaN].indexOf(NaN), [NaN].includes(NaN));
console.log(new Set([NaN, NaN, NaN]).size);
```

```
line 1:
line 2:
line 3:
line 4:

algorithm used by indexOf:                    algorithm used by includes/Set:
```

---

### E · the two functions with almost the same name

```javascript
for (const v of ["hello", "", "42", null, undefined, [], [1], {}]) {
  console.log(isNaN(v), Number.isNaN(v));
}
```

```
"hello":            "":                 "42":               null:

undefined:          []:                 [1]:                {}:

what question isNaN is ACTUALLY answering (it is not "is this NaN"):
```

---

### F · the guard that doesn't guard

```javascript
const readings = [12, 8, undefined, 15];
const avg = readings.reduce((a, b) => a + b, 0) / readings.length;

if (avg > 10) console.log("high");
else if (avg <= 10) console.log("normal");
else console.log("???");
```

```
which branch runs:

is there ANY comparison that could catch this case? why / why not:


where does the check have to live instead:
```

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

```
line 1:
line 2:
line 3:
line 4:
line 5:

which of lines 4/5 would a USER see:                which would your LOG FILE show:
```

---

### H · a small negative is not the same bug

```javascript
console.log((-0.001).toFixed(2));
console.log(Object.is(-0.001, -0));
console.log((-0.001 + 0).toFixed(2));
console.log(Math.round(-0.001 * 100) / 100);
```

```
line 1:            line 2:
line 3:            line 4:

how G's cause and H's cause differ:


which fix applies to which:
```

---

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

```
line 1:
line 2:
line 3:
line 4:
line 5:
line 6:
line 7:

the two lines where the format ran out of room, and what another language might have thrown:
```

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

```
line 1:            line 2:
line 4:            line 5:

at what exact point were the digits unrecoverable:

could a reviver passed to JSON.parse have saved it? why:
```

---

### K · BigInt's walls

```javascript
console.log(1n == 1, 1n === 1, 1n < 2);
console.log(7n / 2n);
// 1n + 1
// Math.sqrt(4n)
// BigInt(0.5)
// JSON.stringify({ id: 1n })
```

```
line 1:            line 2:

1n + 1                    throws?         which error:
Math.sqrt(4n)             throws?         which error:
BigInt(0.5)               throws?         which error:
JSON.stringify({id: 1n})  throws?         which error:

why the RangeError one is a different KIND of complaint from the others:
```

---

### L · rounding

```javascript
console.log((1.005).toFixed(2), (2.675).toFixed(2), (0.025).toFixed(2));
console.log((1.005).toFixed(20));
console.log((0.025).toFixed(20));
console.log(typeof (1.5).toFixed(2));
console.log(Math.round(0.5), Math.round(1.5), Math.round(-0.5), Math.round(-1.5));
```

```
line 1:
line 2:
line 3:
line 4:
line 5:

why 1.005 rounds down and 0.025 rounds up (no use of the word "bug"):


Math.round's actual rule, in one phrase:
```

---

## True / false — with the mechanism

```
1.  0.1 + 0.2 !== 0.3 is a JavaScript-specific defect.
    T/F:            mechanism:

2.  All decimal fractions with two decimal places are exactly representable as a double.
    T/F:            mechanism:

3.  Number.EPSILON is the smallest positive number representable as a double.
    T/F:            mechanism:

4.  Math.abs(a - b) < Number.EPSILON is a correct float equality check for any two finite numbers.
    T/F:            mechanism:

5.  typeof NaN is "NaN".
    T/F:            mechanism:

6.  x !== x is true only when x is NaN.
    T/F:            mechanism:

7.  isNaN("hello") and Number.isNaN("hello") return the same value.
    T/F:            mechanism:

8.  [NaN].includes(NaN) is false because NaN !== NaN.
    T/F:            mechanism:

9.  -0 and 0 are the same value with two ways of writing it.
    T/F:            mechanism:

10. String(-0) and Intl.NumberFormat().format(-0) produce the same string.
    T/F:            mechanism:

11. Number.MIN_VALUE is the most negative representable number.
    T/F:            mechanism:

12. Multiplying past Number.MAX_VALUE throws a RangeError.
    T/F:            mechanism:

13. Math.max() with no arguments returns 0.
    T/F:            mechanism:

14. Every integer below Number.MAX_VALUE is exactly representable.
    T/F:            mechanism:

15. Number.isInteger(x) and Number.isSafeInteger(x) return the same value for every integer.
    T/F:            mechanism:

16. JSON.stringify throws on NaN the same way it throws on a BigInt.
    T/F:            mechanism:

17. (2.675).toFixed(2) returns "2.67" because toFixed uses banker's rounding.
    T/F:            mechanism:

18. Math.round rounds halves away from zero.
    T/F:            mechanism:

19. Storing money as integer cents removes all rounding decisions from the code.
    T/F:            mechanism:

20. 7n / 2n evaluates to 3.5n.
    T/F:            mechanism:
```

---

## Build these

### 1. `nearlyEqual(a, b, ulps)`

```javascript
function nearlyEqual(a, b, ulps = 4) {
  // scaled tolerance. correct at 0.3 AND 1e9 AND 1e-9.
}
```

```
which special value needs an explicit branch, and which falls out of the arithmetic:

your decision about comparing against exactly 0, and why the relative form can't work there:

test table (write the expected value BEFORE running):
  pair                                    expected      actual
  ────────────────────────────────────────────────────────────



```

- [ ] correct at 0.3 and at 1e9
- [ ] `nearlyEqual(1, 1.5)` is false
- [ ] `Infinity`/`NaN` handled, with the comment above
- [ ] the zero decision documented
- [ ] five pairs across 1e-9 to 1e12, predicted first

---

### 2. `parseSafeInt(text)`

```javascript
function parseSafeInt(text) {
  // takes the RAW STRING. refuses rather than silently rounding.
}
```

```
"1.5" / "1e3" / "" / " " / "abc" / "0x10" — one word each on why rejected,
and which of these Number() would have accepted:


your decision on "-0":

why must this take a string, and what has already happened if the caller passes a number?


```

- [ ] `"42"` → `42`; the 20-digit id does not silently round
- [ ] refusal is actionable, not a bare `NaN`
- [ ] all six rejections above handled
- [ ] leading `-` handled, `"-0"` documented
- [ ] the string-vs-number comment written

---

### 3. `Money`

```javascript
class Money {
  // static fromMinor(cents, currency)
  // static fromDecimalString("19.99", currency)
  // plus / minus / times / splitEvenly / toString / format
}
```

```
actual value of parseFloat("19.99") * 100:

Chapter 18 mechanism used for immutability, and one thing it does NOT protect:


why Number.isSafeInteger and not Number.isInteger in the constructor:

times() rounding rule — direction and why:

splitEvenly(3) on 1000: who gets the extra unit, and why that's a decision:

float sum of [12.35, 4.45, 8.90]:              via Money:

en-US format:                                  en-IN format:

the one thing this class still cannot represent:
```

- [ ] `fromDecimalString("19.99")` → exactly 1999, no float round trip
- [ ] immutable; mutation throws in strict mode
- [ ] currency mismatch → actionable error
- [ ] constructor asserts safe integer minor units
- [ ] `[12.35, 4.45, 8.90]` sums to exactly 25.70
- [ ] `splitEvenly` parts sum to the whole
- [ ] `format()` differs between en-US and en-IN

---

### 4. `describeNumber(x)`

```javascript
function describeNumber(x) {
  // "safe integer" | "unsafe integer" | "negative zero" | "NaN"
  // | "infinite" | "finite non-integer" | "not a number type"
}
```

```
the only predicate that can identify -0:

how you detected NaN without using x !== x:

what check makes both "42" and 1n classify as "not a number type":

two checks that give the WRONG answer if swapped, and why:


```

- [ ] `-0` → `"negative zero"`, `0` → not
- [ ] `NaN` detected without `x !== x`
- [ ] `2**53` and `2**53 - 1` classify differently
- [ ] `"42"` and `1n` both `"not a number type"`
- [ ] ordering comment written

---

## The 90-second answer

Write it out, then say it out loud, timed. This is the one that carries the chapter.

```
how do you handle money in JavaScript — all four steps:




```

---

## What to verify

- [ ] All twelve predictions written down **before** running anything
- [ ] For each, the **rule** named, not just the value
- [ ] B answered from the definition of `Number.EPSILON`, not "big numbers are less precise"
- [ ] F's second question answered — whether *any* comparison could catch it
- [ ] G and H distinguished: same output, two causes, two fixes
- [ ] J pinpoints where the digits were lost and whether a reviver helps
- [ ] L explained without the word "bug"
- [ ] All twenty true/false answered with mechanism
- [ ] All four primitives pass their success criteria
- [ ] `Money`'s float-vs-integer comparison recorded, both numbers
- [ ] The 90-second money answer said out loud, timed
