# Chapter 19 — Numeric Edge Cases

Why `0.1 + 0.2` isn't `0.3`, why `NaN` isn't equal to itself, why there are two zeros and what
puts one of them in your UI, where integers stop being exact, and what to actually do about money.

Chapter 18 was about references travelling further than you meant. This one is about *values*
being slightly other than you typed — and the through-line is the same: the thing you're
reasoning about is not quite the thing that's stored.

> **Read this box first.** Six facts.
>
> 1. **There is one number type**, an IEEE-754 double: 1 sign bit, 11 exponent bits, 52 mantissa
>    bits. Every surprise in this chapter is a consequence of that shape.
> 2. **`0.1` is not `0.1`.** It's the nearest double to it — `0.10000000000000000555`. Binary can
>    represent tenths no better than decimal can represent thirds.
> 3. **`Number.EPSILON` is the gap between `1` and the next double**, so it is only a valid
>    tolerance *near 1*. At `1e9` the real error is ~500 million times bigger than it.
> 4. **`NaN` is of type `number`, isn't equal to itself, and every comparison against it is
>    `false`** — so the guard you'd write to catch it lets it through. `isNaN` and
>    `Number.isNaN` are different functions.
> 5. **There are two zeros.** `-0 === 0` is `true`, `Object.is(-0, 0)` is `false`, and
>    `String(-0)` hides the sign while `Intl.NumberFormat` shows it.
> 6. **Integers are exact only to 2^53.** `9007199254740992 === 9007199254740993` is `true`, which
>    is why a 64-bit id through `JSON.parse` silently becomes a different id.

---

## How this chapter is examined

The `0.1 + 0.2` question is the opener and everybody has heard it — which means **saying
"floating point" scores nothing**. What's scored is whether you can say *why* in terms of binary
fractions, and then what you'd actually do about it. The round is usually decided on the money
question, because it's the one with a design answer rather than a trivia answer.

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "Why is `0.1 + 0.2 !== 0.3`?" (Parts 1–2) | The bit layout of a double (Part 1) |
| "How would you compare two floats safely?" (Part 2) | Subnormals, underflow to zero (Part 5) |
| "Why is `NaN !== NaN`?" (Part 3) | Why `NaN` has millions of bit patterns (Part 1) |
| "`isNaN` vs `Number.isNaN`?" (Part 3) | `Math.round`'s toward-`+Infinity` rule (Part 6) |
| *"How do you handle money in JS?"* (Part 6) | `toPrecision` vs `toFixed` (Part 6) |
| "What's `Number.MAX_SAFE_INTEGER` and why 2^53?" (Part 5) | Bitwise operators coercing to int32 (Part 7) |
| "Have you hit the big-id problem?" (Part 5) | |
| "When would you use `BigInt`?" (Part 5) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every number and output block in this file came from the files in `examples/`, on Node 22.17.1.
**If `1e9`, "mantissa" or "exponent" are unfamiliar, read Part 0 first** — it defines the
vocabulary everything else here uses.

---

## Part 0 — The vocabulary (skip if `1e9` and "mantissa" are already familiar)

Two pieces of notation the rest of this chapter leans on constantly. `examples/00_notation_primer.js`
runs all of this.

### `1e9` is a spelling, not a type

`e` means *"times ten to the power of"*. That's all. It's a way of writing a number literal, and
`1e9 === 1000000000` is `true` — same value, two spellings.

```
  1e0     = 1
  1e3     = 1000                 = 1,000
  1e6     = 1000000              = 1,000,000
  1e9     = 1000000000           = 1,000,000,000        (a billion)
  1e16    = 10000000000000000    = 10,000,000,000,000,000
  2.5e3   = 2500
  1e-1    = 0.1                  <- negative: move the point LEFT
  1e-3    = 0.001
```

Positive exponent moves the decimal point right (bigger), negative moves it left (smaller).

**JavaScript also prints numbers this way on its own**, past certain sizes — so `5e-7` appearing in
a log doesn't mean anyone wrote it that way:

```
  1000000000000000000000 prints as: 1e+21
  0.0000005              prints as: 5e-7
```

### Mantissa and exponent — in decimal first

You already do this whenever you write scientific notation:

```
   Earth's radius = 6371000 metres

   6.371  x  10^6
   ^^^^^        ^
   MANTISSA     EXPONENT
   the digits   the scale
```

- **Mantissa** (also called the *significand*): the significant digits. It says **what** the number
  is.
- **Exponent**: the power. It says **how big** it is — where the decimal point sits.

Same digits, different exponent, wildly different number: `6.371e-3` is `0.006`, `6.371e9` is
`6,371,000,000`.

### A double does exactly this, in binary

```
   value  =  sign  ×  1.mantissa  ×  2^exponent
```

And those three pieces *are* the three fields of the 64 bits:

| Field | Bits | What it holds |
|---|---|---|
| sign | 1 | `0` positive, `1` negative |
| exponent | 11 | the scale, stored **+1023** (the "bias") so it can represent negatives |
| mantissa | 52 | the fraction after an **implied leading `1.`** — so 53 bits of significance |

Decoding real values proves it — the primer reconstructs each one exactly:

```
  1         exponent bits 01111111111 = 1023, minus bias 1023 = 0
            significand = 1
            1 x 2^0 = 1                        (reconstructed exactly: true)

  0.1       exponent bits 01111111011 = 1019, minus bias 1023 = -4
            significand = 1.6
            1.6 x 2^-4 = 0.1                   (reconstructed exactly: true)

  6371000   exponent bits 10000010101 = 1045, minus bias 1023 = 22
            significand = 1.5189647674560547
            1.5189647674560547 x 2^22 = 6371000   (reconstructed exactly: true)
```

### Why that's the whole chapter

**The mantissa is a fixed size — 53 bits of significance, about 15–17 significant decimal digits,
always, at every scale. The exponent only moves the point; it never buys you more digits.**

Watch the 17th digit stop existing:

```
  1e0  + 1  =>  2                     changed: true
  1e9  + 1  =>  1000000001            changed: true
  1e15 + 1  =>  1000000000000001      changed: true
  1e16 + 1  =>  10000000000000000     changed: false   <- the +1 vanished
  1e17 + 1  =>  100000000000000000    changed: false

  distance to the next representable double:
    near 1e0    1 away
    near 1e15   1 away
    near 1e16   2 away
    near 1e20   16384 away
```

That is what *"precision is relative to magnitude"* means: the gap is always about 1 part in 2^53,
which is a **bigger absolute amount when the number is bigger**. It's why `Number.EPSILON` — the
gap at 1.0 — is the wrong tolerance anywhere else (Part 2), and why integers stop being exact past
2^53 (Part 5).

And it's why `0.1` is inexact specifically: its significand is `1.6`, but stored in *binary*, and
`1.6` in binary is `1.1001100110011…` repeating forever — the same way `1/3` is `0.333…` forever in
decimal. 52 bits is where it gets chopped.

One more term used throughout: **ULP**, "unit in the last place" — the gap between one
representable double and the next one. Part 2's tolerance is measured in ULPs.

---

## The model

One sentence, and the rest of the chapter is consequences:

> **A JavaScript number is a fixed number of significant *bits*, not a fixed number of decimal
> places — so what gets stored is the nearest representable value to what you wrote, and how near
> that is depends on how big the number is.**

```
   64 bits, always:

   ┌─┬───────────┬──────────────────────────────────────────────────┐
   │S│  exponent │                   mantissa                        │
   │1│    11     │                      52                           │
   └─┴───────────┴──────────────────────────────────────────────────┘
    │      │                            │
    │      │                            └─ 52 bits of significance. Everything
    │      │                               past that is rounded away.
    │      └─ scales the value. Bigger exponent = coarser spacing between
    │         representable numbers. This is why precision is RELATIVE.
    └─ sign, independent of magnitude — which is why there are two zeros
       and two infinities.
```

`examples/01_the_format.js` prints the actual bits:

```
            sign exponent    mantissa
  0.1        0 01111111011 1001100110011001100110011001100110011001100110011010
  0.2        0 01111111100 1001100110011001100110011001100110011001100110011010
  0.3        0 01111111101 0011001100110011001100110011001100110011001100110011
  0.1 + 0.2  0 01111111101 0011001100110011001100110011001100110011001100110100
  +0         0 00000000000 0000000000000000000000000000000000000000000000000000
  -0         1 00000000000 0000000000000000000000000000000000000000000000000000
  Infinity   0 11111111111 0000000000000000000000000000000000000000000000000000
  NaN        0 11111111111 1000000000000000000000000000000000000000000000000000
```

Four facts are visible in that table before any explanation:

- **`0.1` and `0.2` have the same repeating mantissa.** One tenth in binary is
  `0.0001100110011…` forever, exactly as one third in decimal is `0.333…` forever. The 52-bit cut
  is where the error enters.
- **`0.3` and `0.1 + 0.2` differ in the last bit.** That is the entire famous bug.
- **`+0` and `-0` differ in exactly one bit** — the sign. Everything else is identical.
- **`Infinity` is the all-ones exponent with a zero mantissa; `NaN` is the all-ones exponent with
  *any* non-zero mantissa.** Which is why there are millions of `NaN` bit patterns and exactly one
  `NaN` value you can observe.

---

## Part 1 — What is actually stored

```
What you typed vs what is stored (20 decimal places):
  0.1 -> 0.10000000000000000555
  0.2 -> 0.20000000000000001110
  0.3 -> 0.29999999999999998890
  0.5 -> 0.50000000000000000000  <- exact: 1/2 is a power of two
  0.25 -> 0.25000000000000000000  <- exact
```

A double can represent a fraction exactly only when its denominator is a power of two. `0.5`,
`0.25`, `0.75`, `0.125` are exact. `0.1`, `0.2`, `0.3` are not, and never will be, in any language
using this format — this is not a JavaScript defect, it's the same in Java `double`, C `double`,
Python `float` and Go `float64`. **The languages that don't have this problem have a separate
decimal type; JavaScript has one numeric type and it is this one.**

### Precision is relative to magnitude

```
The spacing between adjacent doubles is not constant:
  gap near 1     : 2.220446049250313e-16
  gap near 1e9   : 1
  gap near 1e16  : 0  <- adding 1 does NOTHING here
  gap near 1e17  : 0  <- adding 2 does nothing either
```

The mantissa holds 52 bits of *significance*, and the exponent decides where those bits sit. Near
1, the gap between representable neighbours is about 2.2e-16. Near 1e16 the gap is larger than 1 —
so `1e16 + 1` evaluates to `1e16`, and the `+ 1` is simply gone. **The safe-integer limit in Part 5
is this same fact, stated in integer terms.**

---

## Part 2 — `0.1 + 0.2`, and the comparison people get wrong

`examples/02_comparison.js`:

```
1. 0.1 + 0.2            = 0.30000000000000004
   0.1 + 0.2 === 0.3    = false
   0.1 + 0.2 - 0.3      = 5.551115123125783e-17
   0.1 + 0.7            = 0.7999999999999999
   0.3 % 0.1            = 0.09999999999999998  <- not 0, and modulo inherits everything above
   0.5 + 0.25           = 0.75  <- exact, because both are powers of two
```

Two already-inexact values are added, and the exact sum of those two approximations isn't the
nearest double to `0.3` — so the result rounds to a *different* double. Nothing went wrong; three
correct roundings produced a value one ULP away from the one you expected.

### `Number.EPSILON` is a definition, not a tolerance

This is the part that separates a memorised answer from a real one.

```
2. Number.EPSILON       = 2.220446049250313e-16
   2 ** -52             = 2.220446049250313e-16  same: true
```

`Number.EPSILON` **is defined as the gap between `1` and the next representable double**. That's
all it is. It describes the precision available *near 1.0*, so using it as an absolute tolerance
works near 1 and fails everywhere else:

```
3. naiveEqual(0.1 + 0.2, 0.3)               : true  <- looks like it works
   naiveEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3)   : false  <- same maths, wrong answer
   the actual difference at 1e9             : 1.1920928955078125e-7
   ...which is 5.37e+8 x EPSILON
```

**537 million times `EPSILON`.** The tolerance has to scale with the magnitude of what you're
comparing:

```javascript
function nearlyEqual(a, b, ulps = 4) {
  if (a === b) return true;                       // exact hits, and Infinity === Infinity
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= scale * Number.EPSILON * ulps;
}
```

```
4. nearlyEqual(0.1 + 0.2, 0.3)              : true
   nearlyEqual(1e9 + 0.1 + 0.2, 1e9 + 0.3)  : true  <- correct at both scales
   nearlyEqual(1, 1.5)                      : false  <- still says no to a real difference
   nearlyEqual(0, 1e-300)                   : false  <- the one case relative tolerance can't do
```

**The last line is the honest caveat, and mentioning it unprompted is worth a level.** Relative
tolerance is undefined against exactly zero: `scale` becomes the other value, and every non-zero
number is infinitely many ULPs from zero. Comparing against zero needs an *absolute* tolerance
picked from your domain, and the language cannot pick it for you.

### The scale caveat, measured

```
5. Error accumulates — same operation, more iterations:
   0.1 added     10 times: 0.9999999999999999   expected 1      error -1.110e-16
   0.1 added    100 times: 9.99999999999998     expected 10     error -1.954e-14
   0.1 added   1000 times: 99.9999999999986     expected 100    error -1.407e-12
   0.1 added 100000 times: 10000.000000018848   expected 10000  error 1.885e-8
```

Each individual addition is off by at most half a ULP. Across N additions those errors don't
cancel, and the running total's own magnitude grows, so later additions are rounded on a coarser
grid than earlier ones. **Fine for ten. Wrong for a hundred thousand** — and "wrong" here means a
report that doesn't reconcile, with no error anywhere to point at.

---

## Part 3 — `NaN`

`examples/03_nan.js`:

```
1. typeof NaN            : number  <- it IS a number. 'Not a Number' names the FAILURE, not the type.
   NaN === NaN           : false
   NaN == NaN            : false  <- loose equality doesn't rescue it either
   Object.is(NaN, NaN)   : true
```

`NaN` is the result the format produces when an operation has no representable answer. It compares
unequal to everything **including itself**, because IEEE-754 defines it that way: "the result of a
failed computation" shouldn't equal another failed computation just because both failed.

### The four equality algorithms, all visible in one value

```
2. [NaN].indexOf(NaN)    : -1  <- strict equality (===). never finds it.
   [NaN].includes(NaN)   : true  <- SameValueZero. finds it.
   new Set([NaN, NaN]).size : 1  <- SameValueZero: one entry
   new Map([[NaN, 'a']]).get(NaN) : a  <- SameValueZero: retrievable
```

This is Chapter 8's four-algorithm table with a single value applied to it — `indexOf` uses strict
equality and can never find `NaN`; `includes`, `Set` and `Map` use SameValueZero and can.

### `isNaN` vs `Number.isNaN` — different functions, one bad name

```
3. isNaN COERCES its argument. Number.isNaN does not:
   "hello"    isNaN: true   Number.isNaN: false  Number(): NaN
   ""         isNaN: false  Number.isNaN: false  Number(): 0
   undefined  isNaN: true   Number.isNaN: false  Number(): NaN
   []         isNaN: false  Number.isNaN: false  Number(): 0
   "42"       isNaN: false  Number.isNaN: false  Number(): 42
   NaN        isNaN: true   Number.isNaN: true   Number(): NaN
```

`isNaN(x)` really asks *"is `x` unconvertible to a number"*, which is a different question wearing
a misleading name. `Number.isNaN(x)` asks *"is `x` the `NaN` value"*. **Use the second one.**

### Why `NaN` matters more than the trivia

```
5. one missing field poisons the whole reduction:
   total                 : NaN
   total > 0             : false    total < 0: false    total === 0: false
   JSON.stringify({total}): {"total":null}  <- becomes null on the way out
```

`NaN` is **produced silently** (`undefined + 1`, `JSON.parse("{}").x * 2`, `parseInt("abc")`),
**propagates through every subsequent operation**, makes **every comparison false** — so an
`if (total > 0)` guard doesn't catch it, it routes it to the `else` branch — and then
`JSON.stringify` turns it into `null`, so a corrupted value leaves your process looking like a
legitimately absent one.

**The rule: validate at the boundary with `Number.isFinite`, not later with a comparison.**
`Number.isFinite` rejects `NaN`, `Infinity` and `-Infinity` in one call, which is nearly always the
check you actually meant.

---

## Part 4 — The two zeros

`examples/04_zero_and_infinity.js`:

```
1. -0 === 0              : true    -0 == 0: true
   Object.is(-0, 0)      : false  <- the only built-in predicate that sees the difference
   1 / -0                : -Infinity    1 / 0: Infinity  <- the classic operator trick
```

The sign bit is independent of the magnitude bits (Part 1's diagram), so zero comes in a signed
pair. Nothing in the arithmetic operators distinguishes them — `-0 === 0` is `true` — and division
is the trick that reveals it, because `1 / -0` overflows to the *negative* infinity.

### Where `-0` actually comes from

```
2. Math.round(-0.4)   -> -0
   Math.round(-0.5)   -> -0
   -1 * 0             -> -0
   0 * -5             -> -0
   0 / -3             -> -0
   Math.min(0, -0)    -> -0
   Math.ceil(-0.5)    -> -0
   parseFloat('-0')   -> -0
   JSON.parse('-0')   -> -0
```

None of those are contrived. Any small negative rounded down, any product with a negative factor
and a zero one, any `Math.min` over a set containing both.

### Whether you can see it depends entirely on how you print it

```
3. String(-0)            : "0"  <- sign is gone
   `${-0}`               : "0"  <- gone
   JSON.stringify(-0)    : 0  <- gone (survives a round trip as +0)
   (-0).toFixed(2)       : "0.00"  <- toFixed drops it for TRUE -0
   (-0.001).toFixed(2)   : "-0.00"  <- but a small NEGATIVE keeps the sign: '-0.00'
   Intl.NumberFormat(-0) : "-0"  <- Intl DOES show it for true -0
   console.log(-0)       : -0  <- Node's inspector shows it; string conversion doesn't
```

Those are **two different bugs that produce the same screenshot**, and being able to separate them
is the interesting part:

- **A true `-0`** is invisible to `String`, template literals, `toString`, `JSON.stringify` and
  even `toFixed` — every log line you'd naturally write to debug it — and *visible* to
  `Intl.NumberFormat` and Node's console inspector. So it flows silently through your code and
  appears in the formatted UI.
- **A small negative that rounds to zero** (`-0.001`) makes `toFixed(2)` produce `"-0.00"`. The
  sign is legitimately correct; the magnitude just rounded away. This is the more common one — a
  refund line, a delta, a percentage change.

Both are fixed at the **formatting boundary**: `-0 + 0` normalises a true `-0` to `+0`, and
rounding *before* formatting means a value that rounds to zero has actually become zero.

### Collections deliberately cannot tell them apart

```
4. [-0].includes(0)      : true
   [-0].indexOf(0)       : 0
   new Set([0, -0]).size : 1
   new Map([[-0,'a']]).get(0): a
```

SameValueZero exists precisely so that `-0` and `+0` are one key. Only `Object.is` separates them.

---

## Part 5 — `Infinity`, overflow, and where integers stop

**First, the correction that costs points in a round: `Math.Infinity` does not exist.**

```
5. Math.Infinity       : undefined  <- THERE IS NO SUCH PROPERTY
   Infinity            : Infinity    Number.POSITIVE_INFINITY: Infinity
   typeof Infinity     : number
```

It's the global `Infinity`, or `Number.POSITIVE_INFINITY`. `Math` holds functions and mathematical
constants (`Math.PI`, `Math.E`); the numeric limits live on `Number`.

### Overflow and underflow are silent

```
6. Number.MAX_VALUE          : 1.7976931348623157e+308
   Number.MAX_VALUE * 2      : Infinity  <- overflowed to Infinity
   Number.MAX_VALUE + 1      : === MAX_VALUE (the +1 vanished)
   Number.MIN_VALUE          : 5e-324  <- smallest POSITIVE. Not the most negative.
   Number.MIN_VALUE / 2      : 0  <- underflowed to zero
   -Number.MAX_VALUE         : -1.7976931348623157e+308  <- THIS is the most negative finite double
```

**`Number.MIN_VALUE` is the smallest positive value, not the most negative** — a reliable trap, and
the correct answer for "most negative" is `-Number.MAX_VALUE`.

```
7. Infinity - Infinity   : NaN
   Infinity / Infinity   : NaN
   0 * Infinity          : NaN
   Infinity + Infinity   : Infinity  <- this one IS defined
8. Math.max()            : -Infinity  <- identity for max
   Math.min()            : Infinity  <- identity for min
   Math.max(...[])       : -Infinity  <- an empty array of prices, and now your max price is -Infinity
```

`Math.max()` with no arguments returning `-Infinity` is correct (it's the identity element) and is
a real bug source the moment the array you spread turns out to be empty.

### 2^53 — where integers stop being exact

`examples/05_integers_and_bigint.js`:

```
1. Number.MAX_SAFE_INTEGER: 9007199254740991  = 2**53 - 1
   9007199254740992 === 9007199254740993 : true
   MAX_SAFE_INTEGER + 1 : 9007199254740992
   MAX_SAFE_INTEGER + 2 : 9007199254740992  <- +1 and +2 collide on the same value

2. 9007199254740992         isInteger: true   isSafeInteger: false
   1e+21                    isInteger: true   isSafeInteger: false
```

52 mantissa bits (plus an implied leading 1) gives exactly 53 bits of integer significance. Past
that, consecutive integers share a representation. **`Number.isInteger` means "no fractional
part"; `Number.isSafeInteger` adds "and it is the only integer with this representation".**

### The bug that actually ships

```
3. wire format  : {"id": 12345678901234567890, "user": "x"}
   after parse  : 12345678901234567000
   changed?     : true  <- silently, with no error anywhere
```

Any 64-bit identifier — a snowflake id, a Postgres `bigint`, a ledger id — exceeds 2^53.
`JSON.parse` hands you a `Number`, it rounds, and the id you send back addresses a different row.
**There is no client-side rescue after `JSON.parse` has run** — the digits are already gone. The
fix is upstream: send it as a string, or parse with a reviver that keeps it as one.

### `BigInt`, and its four walls

```
4. 9007199254740993n     : 9007199254740993n  <- exact, where the Number was not
   typeof 1n             : bigint
   1n == 1               : true    1n === 1: false
   1n < 2                : true  <- relational comparison DOES cross types

5. 1n + 1                     -> TypeError: Cannot mix BigInt and other types, use explicit conversions
   Math.sqrt(4n)              -> TypeError: Cannot convert a BigInt value to a number
   BigInt(0.5)                -> RangeError: The number 0.5 cannot be converted to a BigInt because it is not an integer
   JSON.stringify({id: 1n})   -> TypeError: Do not know how to serialize a BigInt
   7n / 2n               -> 3n  <- integer division TRUNCATES. There is no BigDecimal.
```

Those four walls make `BigInt` a decision rather than an upgrade: no mixing with `Number`, no
`Math.*`, no non-integers, and **`JSON.stringify` throws** — not "serialises oddly", throws.

**So the answer to "should I use `BigInt` for ids?" is usually no.** Use *strings* for identifiers
you never do arithmetic on. Keep `BigInt` for integer arithmetic that genuinely exceeds 2^53 and
stays inside your process.

---

## Part 6 — Money

`examples/06_money.js`. The one topic here with a design answer rather than a trivia answer.

### `toFixed` is not broken, and it is not banker's rounding

```
1. (1.005).toFixed(2)  : 1.00   expected 1.01
   (2.675).toFixed(2)  : 2.67   expected 2.68
   (1.005).toFixed(20) : 1.00499999999999989342
   (0.025).toFixed(20) : 0.02500000000000000139  <- this one sits ABOVE the half
   (0.025).toFixed(2)  : 0.03  <- ...so it rounds UP

2. Surveying 399 values of the form x.xx5: 120 round up, 279 round down.
```

`toFixed` rounds half-up **on the value it was given** — and the value it was given is never
exactly `x.xx5`, because that decimal isn't representable. Whether the nearest double sits just
above or just below the decimal half decides the direction, and that varies per value with no
pattern predictable from the decimal digits. **Correct rounding of a number that isn't the one you
typed** — deterministic, but not the behaviour anyone specified, which is why "just use `toFixed`
for money" fails review.

### `Math.round` rounds half toward `+Infinity`

```
3. Math.round(0.5  ) = 1        Math.round(-0.5 ) = -0
   Math.round(1.5  ) = 2        Math.round(-1.5 ) = -1
   Math.round(2.5  ) = 3        Math.round(-2.5 ) = -2
```

Not "half away from zero" and not "banker's rounding". **Positive and negative amounts of the same
magnitude round differently**, which matters the moment refunds exist. (And `Math.round(-0.5)` is
`-0`, tying Part 4 back in.)

### What to actually do

```
4. float sum          : 25.3   === 25.3: true  <- this one came out EXACT
   [12.35, 4.45, 8.90] : 25.700000000000003  === 25.7: false
   same, in cents      : 25.7  exact

5.     100 additions of 10c:  float 9.99999999999998    (error -1.95e-14)   cents 10     (error 0)
     10000 additions of 10c:  float 1000.0000000001588  (error  1.59e-10)   cents 1000   (error 0)
   1000000 additions of 10c:  float 100000.00000133288  (error  1.33e-6 )   cents 100000 (error 0)
```

Row 4 is the argument in two lines: one ordinary basket sums exactly and another equally ordinary
one doesn't, and **nothing in the code distinguishes them** — so "it worked when I tested it" is
not evidence about the next basket.

```
6. 1000c split 3 ways : [ 334, 333, 333 ]  sum: 1000  <- sums back exactly
   naive float split  : [ 3.33, 3.33, 3.33 ]  sum: 9.99  <- 1 cent has vanished
```

**The four-step answer, in the order you'd say it:**

1. **Store money as an integer number of minor units** (cents, paise). Integers are exact to 2^53
   — about 90 trillion cents — so application money never approaches the limit.
2. **Do arithmetic on those integers.** Addition and subtraction become exact: zero error at a
   million additions, versus 1.33e-6 for the float.
3. **Round explicitly, once, with a rule you chose, at the moment you must divide** — and place the
   remainder deliberately. "The parts must sum to the whole" is a business rule, not a rounding
   mode.
4. **Format with `Intl.NumberFormat` at the very edge**, for display only — it gives you currency
   symbols, locale grouping (`₹12,34,567.50` for en-IN) and nothing else in this chapter does.

---

## Part 7 — What JavaScript cannot do, and why

**1. It cannot represent `0.1` exactly, and there is no decimal type to switch to.** Languages that
handle money natively (`BigDecimal` in Java, `decimal.Decimal` in Python, `NUMERIC` in SQL) have a
*second* numeric type. JS has one, plus `BigInt` for integers. A `Decimal` proposal exists and is
not shipped.

**2. It cannot tell you that precision was lost.** Every failure in this chapter is silent:
overflow becomes `Infinity`, underflow becomes `0`, a 64-bit id rounds, an accumulation drifts. No
exception, no warning, no flag to enable. The only signal is a result you already know is wrong.

**3. `===` cannot distinguish `-0` from `+0`,** and no operator can. Only `Object.is` and the
`1/x` division trick.

**4. `BigInt` and `Number` do not interoperate.** No mixed arithmetic, no `Math.*`, no
`JSON.stringify`. Adopting it is a boundary you maintain by hand.

**5. There is no exact fractional type at all.** `BigInt` truncates on division (`7n / 2n` is
`3n`); there is no `BigDecimal` or rational type in the language.

### What would break if this worked differently

The question here is *"why not just make numbers decimal?"*, and the answer is a trade, not an
oversight:

**Doubles are what the hardware does.** Every FPU on every machine implements IEEE-754 in silicon;
a double add is one instruction. Decimal arithmetic is software — typically 10–100x slower — and
JavaScript's original job was running in a loop on a browser's main thread. Choosing decimal by
default would have made every number in every program pay a cost that only *money* actually needs.

And **the alternative isn't free of surprises, it just moves them.** A decimal type represents
`0.1` exactly and still cannot represent `1/3`; you trade "my tenths are inexact" for "my thirds
are inexact" plus a performance cost plus a second numeric type in the language. What IEEE-754 buys
is that the same program produces bit-identical results in every language on every machine —
`0.1 + 0.2` is `0.30000000000000004` in Python, Java, C and Go too. **The behaviour is portable and
specified; it's just not decimal.**

The design lesson generalises past numbers, and it's the same shape as Chapter 18's shallow-copy
default: **the language gives you the cheap primitive the hardware provides and expects you to
build the domain-correct thing on top** — integer cents, a relative comparison, a validated
boundary — rather than making every program pay for the expensive general case.

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| A total is off by 0.01 on some invoices and not others | Float accumulation. Exactness depends on the values, not the code (Part 6) |
| A test asserting `0.1 + 0.2 === 0.3` fails | The classic. Compare with a scaled tolerance, or use integers (Part 2) |
| A tolerance check works in tests and fails in production | `Number.EPSILON` used as an absolute tolerance on large values (Part 2) |
| A guard like `if (total > 0)` silently routes bad data to `else` | `total` is `NaN` — every comparison against it is `false` (Part 3) |
| A field arrives as `null` in JSON that wasn't null in your process | `NaN` or `Infinity` — `JSON.stringify` emits `null` for both (Parts 3, 5) |
| `isNaN(x)` returns `true` for a string that was never a number | You want `Number.isNaN`. The global one coerces first (Part 3) |
| The UI shows `-0.00` or `-0` | A small negative rounded down, or a true `-0` reaching `Intl` (Part 4) |
| An id from an API doesn't match the row it should | The id exceeded 2^53 and `JSON.parse` rounded it (Part 5) |
| `Math.max(...items)` returns `-Infinity` | `items` was empty — that's the identity element (Part 5) |
| A value becomes `Infinity` mid-calculation with no error | Overflow past `MAX_VALUE`, silently (Part 5) |
| Rounded amounts don't sum to the total they were split from | Rounding each part independently. Place the remainder deliberately (Part 6) |
| `JSON.stringify` throws `TypeError` on an object that looks fine | A `BigInt` somewhere in it (Part 5) |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| `0.1 + 0.2 !== 0.3` is a JavaScript quirk | It's IEEE-754. Same result in Python, Java, C, Go. |
| Use `Number.EPSILON` to compare floats | Only valid near 1.0. It's the gap at 1, so scale it by magnitude. |
| `NaN` means "not a number", so `typeof` isn't `number` | `typeof NaN` is `"number"`. The name describes the failure. |
| `isNaN` and `Number.isNaN` are the same | `isNaN` coerces first — `isNaN("hello")` is `true`. |
| You can guard against `NaN` with a comparison | Every comparison against `NaN` is `false`, including `!==`-based guards. |
| `-0` is just how some engines print zero | It's a distinct bit pattern with distinct behaviour (`1/-0`, `Object.is`, `Intl`). |
| `Math.Infinity` | Doesn't exist. Global `Infinity` / `Number.POSITIVE_INFINITY`. |
| `Number.MIN_VALUE` is the most negative number | It's the smallest **positive** value. Most negative is `-Number.MAX_VALUE`. |
| Overflow throws or warns | It silently becomes `Infinity`. Underflow silently becomes `0`. |
| Integers are safe up to `MAX_VALUE` | Exact only to 2^53. Past that, consecutive integers collide. |
| `toFixed` is buggy / uses banker's rounding | It rounds half-up correctly on a value that isn't the decimal you typed. |
| `Math.round` rounds half away from zero | It rounds half toward `+Infinity`: `-0.5` → `-0`, `-1.5` → `-1`. |
| `BigInt` is a drop-in fix for big numbers | No mixing with `Number`, no `Math.*`, and `JSON.stringify` throws. |
| Floats are fine for money if you round at the end | The error is already in the accumulated total before you round it. |

---

## Rules worth keeping

1. **Never compare floats with `===`.** Use a magnitude-scaled tolerance, and handle "compared
   against zero" as its own case with a domain-chosen absolute tolerance.
2. **`Number.EPSILON` is the gap at 1.0**, not a general tolerance. Multiply it by the magnitude.
3. **Validate numeric input at the boundary with `Number.isFinite`** — it rejects `NaN` and both
   infinities in one call. Never with a comparison, which `NaN` passes through.
4. **`Number.isNaN`, never `isNaN`.** Same for `Number.isFinite` over `isFinite`.
5. **Money is integer minor units.** Arithmetic on integers, round once and explicitly when you
   divide, format with `Intl.NumberFormat` at the edge.
6. **When you round a split, place the remainder deliberately** so the parts sum to the whole.
7. **Check `Number.isSafeInteger` on any id or counter that crosses a boundary**, and prefer
   strings for identifiers you never do arithmetic on.
8. **Normalise `-0` where it reaches a UI** (`x + 0`), and round before formatting so a value that
   rounds to zero has become zero.
9. **`Math.max`/`Math.min` on a possibly-empty array returns an infinity.** Guard the empty case.
10. **Assume nothing about a number that crossed `JSON.parse`** if it could exceed 2^53 — the loss
    happens during parsing and cannot be recovered afterwards.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — seven runnable files. **Run `00_notation_primer.js` first if `1e9`, "mantissa" or
  "exponent" are unfamiliar** — the rest of the chapter assumes them. Then `01_the_format.js`,
  since every other file is a consequence of its bit table
- `exercises/chapter_exercise.md` — prediction programs, then numeric primitives to build
- `exercises/cumulative_exercise.md` — a money/ledger module with an exactness invariant

Chapter 20 is modules (ESM) — live bindings, import hoisting, TDZ across a cyclic import, and why
`require` of an ESM module fails. Scoped to language semantics; the runtime half (resolution, the
module cache, load phases) lives in `node-learnings/14-module-system-internals/`.
