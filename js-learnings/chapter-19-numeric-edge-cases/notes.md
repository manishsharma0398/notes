# Chapter 19 — Numeric Edge Cases: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. **One number type: IEEE-754 double.** 1 sign + 11 exponent + 52 mantissa bits. Everything else
   here is a consequence.
2. **`0.1` is not `0.1`** — it's `0.10000000000000000555`. Binary can't do tenths, like decimal
   can't do thirds.
3. **`Number.EPSILON` = gap between 1 and the next double** (`2**-52`). Valid as a tolerance
   *near 1 only*. At 1e9 the real error is 5.37e8 × EPSILON.
4. **`typeof NaN === "number"`, `NaN !== NaN`, every comparison against it is `false`** — so
   comparison-based guards let it through. `isNaN` ≠ `Number.isNaN`.
5. **Two zeros.** `-0 === 0` true, `Object.is(-0,0)` false, `String(-0)` hides the sign,
   `Intl.NumberFormat` shows it.
6. **Integers exact only to 2^53.** `9007199254740992 === 9007199254740993` is `true` — the
   64-bit-id-through-JSON bug.

---

## The one sentence

> **A JS number is a fixed number of significant BITS, not decimal places — so what's stored is
> the nearest representable value to what you wrote, and how near depends on how big it is.**

```
┌─┬───────────┬──────────────────────────────────┐
│S│ exponent  │           mantissa                │
│1│    11     │              52                   │
└─┴───────────┴──────────────────────────────────┘
 │      │                    └─ 52 bits of significance, rest rounded away
 │      └─ scales the value → spacing between doubles GROWS with magnitude
 └─ sign, independent of magnitude → two zeros, two infinities
```

```
0.1        0 01111111011 1001100110011001100110011001100110011001100110011010
0.2        0 01111111100 1001100110011001100110011001100110011001100110011010  ← same mantissa
0.3        0 01111111101 0011001100110011001100110011001100110011001100110011
0.1 + 0.2  0 01111111101 0011001100110011001100110011001100110011001100110100  ← last bit differs
+0         0 00000000000 000...0
-0         1 00000000000 000...0     ← ONE bit apart
Infinity   0 11111111111 000...0     ← all-ones exponent, zero mantissa
NaN        0 11111111111 100...0     ← all-ones exponent, ANY non-zero mantissa
```

- Exact only when the denominator is a power of two: `0.5`, `0.25`, `0.125`. Never `0.1`.
- **Gap grows with magnitude:** near 1 it's 2.2e-16; near 1e9 it's 1; near 1e16 it's >1, so
  `1e16 + 1 === 1e16`.
- Same in Python/Java/C/Go. **Not a JS quirk.**

---

## Comparison (Part 2)

```
0.1 + 0.2 = 0.30000000000000004      0.1 + 0.7 = 0.7999999999999999
0.1 + 0.2 - 0.3 = 5.551115123125783e-17      0.3 % 0.1 = 0.09999999999999998
0.5 + 0.25 = 0.75  (exact — powers of two)
```

**`Number.EPSILON` as an absolute tolerance fails at scale:**

```
naiveEqual(0.1+0.2, 0.3)              true   ← looks like it works
naiveEqual(1e9+0.1+0.2, 1e9+0.3)      false  ← same maths, wrong answer
actual diff at 1e9: 1.19e-7  =  5.37e8 × EPSILON
```

```javascript
function nearlyEqual(a, b, ulps = 4) {
  if (a === b) return true;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= scale * Number.EPSILON * ulps;
}
```

- **Caveat to say unprompted:** relative tolerance is undefined against exactly **zero** — scale
  becomes the other value. Comparing to 0 needs a domain-chosen absolute tolerance.
- **Accumulation (scale caveat):**

```
0.1 added     10 times: 0.9999999999999999   error -1.11e-16
0.1 added   1000 times: 99.9999999999986     error -1.41e-12
0.1 added 100000 times: 10000.000000018848   error  1.89e-8
```

Errors don't cancel; the running total's magnitude grows, so later adds round on a coarser grid.

---

## NaN (Part 3)

```
typeof NaN          "number"     ← names the FAILURE, not the type
NaN === NaN         false        NaN == NaN  false
Object.is(NaN,NaN)  true
```

**Four equality algorithms, one value:**

| | result | algorithm |
|---|---|---|
| `[NaN].indexOf(NaN)` | `-1` | strict equality — never finds it |
| `[NaN].includes(NaN)` | `true` | SameValueZero |
| `new Set([NaN,NaN]).size` | `1` | SameValueZero |
| `new Map([[NaN,'a']]).get(NaN)` | `'a'` | SameValueZero |

**`isNaN` coerces, `Number.isNaN` doesn't:**

```
isNaN("hello")  true    Number.isNaN("hello")  false
isNaN("")       false   isNaN(undefined)  true   isNaN([])  false
```

`isNaN(x)` really asks "is x unconvertible to a number". **Use `Number.isNaN`.**

**Why it matters more than the trivia:**

- Produced **silently**: `0/0`, `Math.sqrt(-1)`, `parseInt("abc")`, `undefined + 1`,
  `JSON.parse("{}").x * 2`.
- **Propagates** through everything downstream.
- **Every comparison is false** → `if (total > 0)` routes it to `else`. Guards don't catch it.
- `JSON.stringify({total: NaN})` → `{"total":null}` — leaves the process looking legitimately absent.

→ **Validate at the boundary with `Number.isFinite`** (rejects NaN + both infinities in one call).

---

## The two zeros (Part 4)

```
-0 === 0            true       Object.is(-0, 0)   false
1 / -0              -Infinity  1 / 0              Infinity
```

**Where -0 comes from — none contrived:**
`Math.round(-0.4)` · `Math.round(-0.5)` · `-1 * 0` · `0 * -5` · `0 / -3` · `Math.min(0,-0)` ·
`Math.ceil(-0.5)` · `parseFloat("-0")` · `JSON.parse("-0")`

**Two different bugs, same screenshot:**

| Printer | true `-0` | small negative `-0.001` |
|---|---|---|
| `String` / `` `${}` `` / `toString` | `"0"` | `"-0.001"` |
| `JSON.stringify` | `0` | `-0.001` |
| `toFixed(2)` | `"0.00"` | **`"-0.00"`** |
| `Intl.NumberFormat` | **`"-0"`** | `"-0"` |
| `console.log` (Node inspector) | **`-0`** | `-0.001` |

- A true `-0` is invisible to every log line you'd write, visible in the formatted UI.
- A small negative rounding to zero gives `"-0.00"` — more common, different cause.
- **Fix at the formatting boundary:** `x + 0` normalises `-0`; round *before* formatting.
- **Collections use SameValueZero** — `includes`/`Set`/`Map` treat the two zeros as one key. Only
  `Object.is` separates them.

---

## Infinity and integer limits (Part 5)

**`Math.Infinity` DOES NOT EXIST** (it's `undefined`). Global `Infinity` /
`Number.POSITIVE_INFINITY`. `Math` has functions and constants (`PI`, `E`); limits live on `Number`.

```
MAX_VALUE          1.7976931348623157e+308
MAX_VALUE * 2      Infinity      ← silent OVERFLOW
MAX_VALUE + 1      === MAX_VALUE ← the +1 vanished
MIN_VALUE          5e-324        ← smallest POSITIVE, not most negative
MIN_VALUE / 2      0             ← silent UNDERFLOW
-MAX_VALUE                       ← THIS is the most negative finite
Infinity - Infinity / 0 * Infinity / Infinity / Infinity  → NaN
Infinity + Infinity → Infinity   ← this one IS defined
Math.max() → -Infinity   Math.min() → Infinity   ← identity elements; empty array bug
JSON.stringify({x: Infinity}) → {"x":null}
```

**2^53:**

```
MAX_SAFE_INTEGER = 9007199254740991 = 2**53 - 1
9007199254740992 === 9007199254740993   true
MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2   (both 9007199254740992)
Number.isInteger(2**53)      true   ← "no fractional part"
Number.isSafeInteger(2**53)  false  ← "+ it's the ONLY integer with this representation"
```

**The shipping bug:** `JSON.parse('{"id": 12345678901234567890}')` → `12345678901234567000`.
Silent. **No client-side rescue after parse** — fix upstream (send as string, or a reviver).

**BigInt — the four walls:**

```
typeof 1n  "bigint"    1n == 1  true    1n === 1  false    1n < 2  true
1n + 1                    → TypeError: Cannot mix BigInt and other types
Math.sqrt(4n)             → TypeError: Cannot convert a BigInt value to a number
BigInt(0.5)               → RangeError: not an integer
JSON.stringify({id: 1n})  → TypeError: Do not know how to serialize a BigInt
7n / 2n                   → 3n   ← truncates. There is no BigDecimal.
```

→ **Use strings for ids you never do arithmetic on.** BigInt is for >2^53 arithmetic staying
in-process.

---

## Money (Part 6)

**`toFixed` is not broken and is not banker's rounding:**

```
(1.005).toFixed(2) = 1.00     (1.005).toFixed(20) = 1.00499999999999989342  ← below the half
(0.025).toFixed(2) = 0.03     (0.025).toFixed(20) = 0.02500000000000000139  ← above the half
survey of 399 x.xx5 values: 120 round up, 279 round down
```

It rounds half-up **correctly on a value that isn't the decimal you typed.** Deterministic, but not
what anyone specified.

**`Math.round` rounds half toward `+Infinity`:**

```
0.5→1   1.5→2   2.5→3      -0.5→-0   -1.5→-1   -2.5→-2
```

Positive and negative amounts of the same magnitude round differently. Matters once refunds exist.

**The exactness is unpredictable from reading the code:**

```
[19.99, 5.01, 0.1, 0.2]  → 25.3                  exact
[12.35, 4.45, 8.90]      → 25.700000000000003    not
```

**Accumulation, float vs integer cents:**

```
    100 additions of 10c:  float error -1.95e-14   cents error 0
  10000 additions:         float error  1.59e-10   cents error 0
1000000 additions:         float error  1.33e-6    cents error 0
```

**Splitting:**

```
splitEvenly(1000, 3) → [334, 333, 333]  sums to 1000
naive float split    → [3.33, 3.33, 3.33]  sums to 9.99   ← a cent vanished
```

**The four-step answer:**

1. **Store integer minor units** (cents/paise). Exact to 2^53 ≈ 90 trillion cents.
2. **Arithmetic on integers** — addition/subtraction exact.
3. **Round explicitly, once, with a chosen rule, when you divide** — place the remainder
   deliberately ("parts sum to the whole" is a business rule, not a rounding mode).
4. **`Intl.NumberFormat` at the edge** for display (currency symbol, locale grouping —
   `₹12,34,567.50` for en-IN).

---

## What JS cannot do (Part 7)

- **Represent `0.1` exactly**, and there's no decimal type to switch to. (`Decimal` is a proposal.)
- **Tell you precision was lost** — overflow, underflow, id rounding, drift: all silent.
- **Distinguish `-0` from `+0` with any operator.** Only `Object.is` / the `1/x` trick.
- **Interoperate `BigInt` with `Number`** — no mixing, no `Math.*`, `JSON.stringify` throws.
- **Represent exact fractions at all** — `7n / 2n` is `3n`; no rational or decimal type.

**Why not just make numbers decimal?** Doubles are what the hardware does — one FPU instruction;
decimal is software, 10–100x slower, and JS's original job was a browser main thread. Every program
would pay a cost only money needs. And decimal doesn't remove surprises, it moves them: it does
tenths exactly and still can't do thirds. What IEEE-754 buys is **portability** — `0.1 + 0.2` is
`0.30000000000000004` in Python, Java, C and Go too. Specified and identical everywhere, just not
decimal.

Same shape as Ch18's shallow-copy default: **the language gives you the cheap primitive the
hardware provides and expects you to build the domain-correct thing on top.**

---

## Interview quick-fire

One sentence each. Hesitate on any and it goes back in this file.

- **Why isn't `0.1 + 0.2` `0.3`?** — Binary can't represent tenths; both inputs are already
  approximations and the sum rounds to a different double.
- **Is that a JS bug?** — No, IEEE-754. Same in Python, Java, C, Go.
- **How do you compare floats?** — Tolerance scaled by magnitude, not a bare `Number.EPSILON`.
- **What IS `Number.EPSILON`?** — The gap between 1 and the next double, `2**-52`.
- **When does the scaled comparison break?** — Against exactly zero. Needs an absolute tolerance.
- **`typeof NaN`?** — `"number"`.
- **Why `NaN !== NaN`?** — IEEE-754: two failed computations aren't equal just because both failed.
- **Which equality finds `NaN`?** — SameValueZero (`includes`, `Set`, `Map`), and `Object.is`.
- **`isNaN` vs `Number.isNaN`?** — The global coerces first; `isNaN("hello")` is `true`.
- **How do you validate a number at a boundary?** — `Number.isFinite` — rejects `NaN` and both
  infinities.
- **Why won't `if (x > 0)` catch a `NaN`?** — Every comparison against `NaN` is `false`.
- **How does `NaN` leave the process?** — `JSON.stringify` turns it into `null`.
- **`-0 === 0`?** — `true`. Only `Object.is` and `1/x` tell them apart.
- **Where does `-0` come from?** — `Math.round(-0.4)`, `-1 * 0`, `Math.min(0,-0)`, and more.
- **Why does the UI show `-0.00`?** — Either a true `-0` through `Intl`, or a small negative that
  rounded to zero through `toFixed`.
- **`Math.Infinity`?** — Doesn't exist. Global `Infinity` / `Number.POSITIVE_INFINITY`.
- **`Number.MIN_VALUE`?** — Smallest **positive**. Most negative is `-Number.MAX_VALUE`.
- **What happens on overflow?** — Silently becomes `Infinity`. Underflow silently becomes `0`.
- **`Math.max()` with no args?** — `-Infinity`, the identity element. Bites on empty arrays.
- **Why 2^53?** — 52 mantissa bits + implied leading 1 = 53 bits of integer significance.
- **`isInteger` vs `isSafeInteger`?** — "No fractional part" vs "+ it's the only integer with this
  representation".
- **The big-id bug?** — A 64-bit id through `JSON.parse` rounds silently; unrecoverable after parse.
- **When `BigInt`?** — Integer arithmetic past 2^53 that stays in-process. Not for ids — use
  strings.
- **What does `JSON.stringify` do with a `BigInt`?** — Throws `TypeError`.
- **Is `toFixed` buggy?** — No. Correct half-up rounding on a value that isn't the decimal you typed.
- **How does `Math.round` handle halves?** — Toward `+Infinity`. `-0.5` → `-0`, `-1.5` → `-1`.
- **How do you handle money?** — Integer minor units, integer arithmetic, explicit rounding once,
  `Intl.NumberFormat` for display.
