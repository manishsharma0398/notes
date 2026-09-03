# Chapter 19 — Interview Questions: Numeric Edge Cases

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

The `0.1 + 0.2` opener is one everybody has heard, which inverts the usual scoring: **saying
"floating point" earns nothing**, because it's the answer they expect from a two-year candidate.
The credit is in the mechanism and in what you'd do about it. The round is usually decided on
**Q9**, the money question, because it's the only one with a design answer.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "Why is `0.1 + 0.2` not `0.3`?" · 60s

**Say:**

> Because a JS number is an IEEE-754 double — 64 bits, 52 of them mantissa — and it can only
> represent fractions exactly when the denominator is a power of two. One tenth in binary is
> `0.0001100110011…` repeating forever, the same way one third is `0.333…` forever in decimal, so
> it gets cut off at 52 bits. `0.1` is actually stored as `0.10000000000000000555`.
>
> So the addition isn't `0.1 + 0.2` — it's two approximations being added, and the exact sum of
> those two approximations isn't the nearest double to `0.3` either. You get
> `0.30000000000000004`, which is one representable value away from `0.3`. Nothing went wrong;
> three correct roundings landed one ULP off.
>
> And it's worth saying this isn't a JavaScript quirk — you get exactly the same result in Python,
> Java, C and Go. What's unusual about JS is that it has only this one numeric type, so there's no
> decimal type to switch to when you need one.

**Scored on:** "denominator has to be a power of two", and volunteering that it's not
JS-specific. Both signal you understand the format rather than having memorised the example.

**They'll push:** *"So which decimals ARE exact?"* → Anything whose fractional part is a sum of
powers of two: `0.5`, `0.25`, `0.75`, `0.125`. `0.5 + 0.25` is exactly `0.75`.

**Red flags:** "JavaScript is bad at math." "Floating point is imprecise" with no mechanism.
Claiming other languages don't have this.

---

## Q2 — "How would you compare two floats then?" · 75s

The question that separates people who read one blog post from people who've done it.

**Say:**

> Not with `===`, and not with a bare `Number.EPSILON` either, which is the answer most people
> give.
>
> `Number.EPSILON` is *defined* as the gap between 1 and the next representable double — it's
> `2**-52`. So it describes the precision available near 1.0, and nowhere else. The spacing between
> doubles grows with magnitude: near 1 it's about 2.2e-16, near 1e9 it's about 1e-7, and past 1e16
> it's bigger than 1. I measured the classic case shifted up to 1e9 and the real difference was
> about 537 million times `EPSILON` — so the `Math.abs(a - b) < Number.EPSILON` check returns false
> for two values that are equal to within rounding.
>
> So the tolerance has to scale with what you're comparing: take the larger magnitude of the two,
> multiply by `EPSILON` and by however many ULPs of slack you'll accept, and compare against that.
>
> One caveat I'd flag: that breaks down when one side is exactly zero, because the scale becomes
> the other value and every non-zero number is infinitely many ULPs from zero. Comparing against
> zero needs an absolute tolerance you pick from the domain — the language can't choose it for you.

**Scored on:** knowing what `EPSILON` actually *is*. "Use `Number.EPSILON`" is the answer they're
expecting to have to correct; defining it and then explaining why it's magnitude-dependent is the
four-year answer. The zero caveat, unprompted, is the senior one.

**They'll push:** *"Where does that show up in real code?"* → Anywhere you compare accumulated
values — a running total against an expected total, a computed geometry coordinate, a progress
fraction. And the accumulation itself is the bigger problem: adding `0.1` a hundred thousand times
lands 1.9e-8 off, because the errors compound rather than cancel.

**Red flags:** `Math.abs(a-b) < Number.EPSILON` presented as the general answer. Not knowing what
`EPSILON` is. Suggesting `toFixed` for comparison.

---

## Q3 — "Why is `NaN` not equal to itself?" · 45s

**Say:**

> Because IEEE-754 defines it that way, and the reasoning is that `NaN` represents *a computation
> that failed*, not a value. Two failed computations aren't the same thing just because both
> failed — `0/0` and `Math.sqrt(-1)` shouldn't compare equal — so the format makes `NaN` unequal to
> everything, including itself.
>
> The practical consequence is the part that matters: **every** comparison against `NaN` is false.
> Not just `===`, but `>`, `<`, `>=`, all of them. So a guard like `if (total > 0)` doesn't catch a
> `NaN` total, it routes it to the else branch. That's what makes `NaN` bugs hard — the value
> propagates through everything downstream, no comparison stops it, and then `JSON.stringify` turns
> it into `null`, so a corrupted number leaves your process looking like a legitimately missing one.
>
> Which is why I check numeric input at the boundary with `Number.isFinite` — one call that rejects
> `NaN` and both infinities — rather than with a comparison later.

**Scored on:** "every comparison is false, so guards don't catch it". The trivia (`NaN !== NaN`) is
free; the operational consequence is the answer.

**They'll push:** *"How do you test if something IS `NaN`, then?"* → `Number.isNaN(x)`, or
`Object.is(x, NaN)`. Not the global `isNaN`, which coerces its argument first — `isNaN("hello")` is
`true` for a string that was never a number, because it's really asking "is this unconvertible to a
number".

**And then:** *"`typeof NaN`?"* → `"number"`. The name describes the failed operation, not the type.

**Red flags:** `typeof NaN` being anything other than `"number"`. Using the global `isNaN`.
Not knowing `Object.is(NaN, NaN)` is `true`.

---

## Q4 — The prediction · 60s

```javascript
const rows = [{ amount: 10 }, { amount: 20 }, { amount: undefined }, { amount: 40 }];
const total = rows.reduce((sum, r) => sum + r.amount, 0);

if (total > 0) console.log("charging", total);
else console.log("nothing to charge");
```

**Say:**

> It prints `"nothing to charge"`.
>
> The third row's `amount` is `undefined`, and `30 + undefined` is `NaN`. From that point the
> reduction is poisoned — `NaN + 40` is `NaN` — so `total` is `NaN`. Then `NaN > 0` is `false`, so
> it takes the else branch.
>
> The dangerous part is that this *looks* like it worked. There's no error, and the branch it took
> is a perfectly plausible one — the system just silently decides there's nothing to charge, and
> the amount that should have been billed disappears. If instead the branch had been
> `if (total >= 0)`, that's also false, so you can't fix it by flipping the comparison — every
> comparison against `NaN` is false.
>
> The fix is at the boundary: validate each row with `Number.isFinite(r.amount)` before summing,
> and decide explicitly what a missing amount means — skip it, or fail loudly. Not `|| 0`, because
> that silently treats a broken record as a zero-value one.

**Scored on:** predicting the *branch*, not just the `NaN`. And rejecting `|| 0` as the fix — that's
the reflex answer and it hides the data problem.

**They'll push:** *"What if this total gets logged or sent to an API?"* → `JSON.stringify` renders
`NaN` as `null`, so a downstream service sees a missing field rather than a corrupted one, and the
error gets attributed to the wrong system.

**Red flags:** saying it prints `"charging NaN"`. Fixing it with `|| 0` and stopping there.

---

## Q5 — "What's `-0`, and does it matter?" · 60s

**Say:**

> The format has a sign bit that's independent of the magnitude bits, so zero comes in a signed
> pair — `+0` and `-0` differ in exactly one bit and are otherwise identical.
>
> `-0 === 0` is `true`, and so is `==`, so no operator distinguishes them. `Object.is(-0, 0)` is
> `false`, and the old trick is `1 / -0`, which gives `-Infinity` rather than `Infinity`.
>
> It matters for one specific reason: you get `-0` from ordinary operations —
> `Math.round(-0.4)`, `-1 * 0`, `Math.min(0, -0)`, `parseFloat("-0")` — and then whether you can
> *see* it depends entirely on how it's printed. `String(-0)` is `"0"`, template literals give
> `"0"`, `JSON.stringify` gives `0`. But `Intl.NumberFormat` renders `"-0"` and Node's console
> inspector shows `-0`. So it's invisible in every log line you'd naturally write and visible in
> the formatted UI, which is a miserable combination to debug.
>
> In practice the same-looking bug is more often a small negative that rounds to zero —
> `(-0.001).toFixed(2)` is `"-0.00"`, sign correct, magnitude rounded away. Either way I'd fix it
> at the formatting boundary: normalise with `x + 0`, and round before formatting rather than
> letting the formatter do it.

**Scored on:** separating the two causes of "the UI shows -0.00". Most candidates know `-0` exists;
knowing it's usually *not* the culprit is the level marker.

**They'll push:** *"Do `Set` and `includes` distinguish them?"* → No. They use SameValueZero, which
deliberately treats the two zeros as one key — `new Set([0, -0]).size` is `1`, `[-0].includes(0)` is
`true`. `Object.is` is the only built-in that separates them.

**Red flags:** "`-0` is just a display artefact". Not knowing `Object.is`. Thinking `Set`
distinguishes them.

---

## Q6 — "What's `Number.MAX_SAFE_INTEGER` and why that number?" · 60s

**Say:**

> It's `2**53 - 1`, about 9 quadrillion. The mantissa is 52 bits plus an implied leading 1, so 53
> bits of integer significance — past that, consecutive integers start sharing a representation.
> `9007199254740992 === 9007199254740993` is literally `true`.
>
> "Safe" means something precise: an integer is safe if it's exactly representable *and* it's the
> only integer with that representation. That's why `Number.isInteger` and `Number.isSafeInteger`
> are different checks — `2**53` passes the first, because it has no fractional part, and fails the
> second, because `2**53 + 1` rounds to the same double.
>
> Where this actually bites is 64-bit ids. Any snowflake id, Postgres `bigint`, ledger id — those
> exceed 2^53, and `JSON.parse` turns them into a `Number`, which rounds. I've seen the shape:
> `12345678901234567890` comes back as `12345678901234567000`, silently, and then you send that
> back and address a different row. There's no client-side rescue after `JSON.parse` — the digits
> are gone by then. The fix has to be upstream: send it as a string, or parse with a reviver that
> keeps it as one.

**Scored on:** the `isInteger` vs `isSafeInteger` distinction and the "no rescue after parse" point.
Those two show it's operational knowledge, not a memorised constant.

**They'll push:** *"So use `BigInt` for ids?"* → Usually no. `BigInt` doesn't mix with `Number` in
arithmetic, `Math.*` rejects it, and `JSON.stringify` *throws* on it — so every boundary needs
handling. For an identifier you never do arithmetic on, a string is simpler and safer. `BigInt` is
for genuine integer arithmetic past 2^53 that stays inside the process.

**Red flags:** "it's just a big number". Not knowing `JSON.stringify` throws on `BigInt`. Proposing
`BigInt` for ids without naming a single cost.

---

## Q7 — "What does this print?" · 45s

```javascript
console.log(Math.max());
console.log(Math.max(...[]));
console.log(Number.MIN_VALUE);
console.log(Number.MAX_VALUE * 2);
```

**Say:**

> `-Infinity`, `-Infinity`, `5e-324`, and `Infinity`.
>
> `Math.max()` with no arguments returns `-Infinity` because that's the identity element for max —
> any real argument beats it. Correct, and a genuine bug source: spread an array of prices that
> turns out to be empty and your maximum price is now `-Infinity`, which then propagates.
>
> `Number.MIN_VALUE` is the smallest **positive** value, not the most negative — that catches
> people. The most negative finite double is `-Number.MAX_VALUE`.
>
> And `MAX_VALUE * 2` overflows to `Infinity` silently. No error, no warning. Same at the other
> end: `Number.MIN_VALUE / 2` underflows to `0`. The format has no way to signal that it gave up
> on precision.

**Scored on:** all four, quickly, plus naming the empty-array consequence for `Math.max`.

**They'll push:** *"How would you guard the `Math.max` case?"* → Check the array is non-empty before
spreading. And separately — spreading passes each element as an *argument*, so a large array blows
the call stack: I measured `Math.max(...arr)` working at 125,000 elements and throwing
`RangeError: Maximum call stack size exceeded` at 150,000 on Node 22. A `reduce` has no such limit.
Two independent reasons the spread form is the wrong default.

**Red flags:** saying `Math.max()` is `0` or `NaN`. `Number.MIN_VALUE` being negative.

---

## Q8 — "Is `toFixed` buggy?" · 60s

```javascript
(1.005).toFixed(2)   // "1.00"
(2.675).toFixed(2)   // "2.67"
```

**Say:**

> No, and this is my favourite one to explain, because "toFixed is broken" and "toFixed uses
> banker's rounding" are both wrong.
>
> `toFixed` rounds half-up, correctly — on the value it was actually given. And the value it was
> given is never exactly `1.005`, because that decimal isn't representable. It's stored as
> `1.00499999999999989342`, which is *below* the halfway point, so rounding it down to `1.00` is
> the correct answer for that number.
>
> The direction isn't random either — it depends on whether the nearest double landed above or
> below the decimal half, which varies per value with no pattern you can see from the digits. I
> surveyed 399 values of the form `x.xx5` and 120 rounded up while 279 rounded down. `0.025` is
> stored slightly *above* the half, so it rounds up to `0.03`.
>
> So it's correct rounding of a number that isn't the one you typed — deterministic, but not the
> behaviour anyone specified. Which is exactly why it doesn't belong in money code.

**Scored on:** "correct rounding of the wrong number". That single reframe is the whole answer, and
it's the one that leads naturally into Q9.

**They'll push:** *"What about `Math.round`?"* → It has its own surprise: it rounds half toward
`+Infinity`, not away from zero. `Math.round(-0.5)` is `-0` and `Math.round(-1.5)` is `-1`, while
`1.5` goes to `2`. So positive and negative amounts of the same magnitude round in different
directions, which matters as soon as refunds exist.

**Red flags:** "toFixed uses banker's rounding". "It's a floating point bug" with no explanation of
what `toFixed` actually did. Not knowing `toFixed` returns a string.

---

## Q9 — "How do you handle money in JavaScript?" · 90s

The one the round is decided on. Answer it as a design, in four steps.

**Say:**

> Four things, and the first one is the whole answer.
>
> **Store money as an integer number of minor units** — cents, paise. Integers are exact in a
> double up to 2^53, which is about 90 trillion cents, so ordinary application money never gets
> close to the limit. `19.99` becomes `1999`.
>
> **Do the arithmetic on those integers.** Addition and subtraction become exact. I measured this:
> adding ten cents a million times as a float lands 1.3e-6 off; as integer cents it's exactly
> right. And the reason not to trust the float version even at small scale is that you can't
> predict which cases break — `[19.99, 5.01, 0.1, 0.2]` sums exactly, and `[12.35, 4.45, 8.90]`
> gives `25.700000000000003`. Nothing in the code distinguishes them, so "it worked when I tested
> it" isn't evidence about the next basket.
>
> **Round explicitly, once, with a rule you chose, at the point where you have to divide** — tax,
> a discount, splitting a bill. And place the remainder deliberately: splitting 1000 cents three
> ways is `[334, 333, 333]`, not three copies of `3.33` which sum to `9.99`. "The parts must add
> back to the whole" is a business rule, not a rounding mode, so it has to be code someone decided
> on.
>
> **Format at the very edge with `Intl.NumberFormat`** — it handles the currency symbol, decimal
> places for that currency, and locale grouping, including the lakh/crore grouping for en-IN that
> nothing else in the language does.
>
> If the domain genuinely needs fractional minor units — FX rates, per-unit pricing at four decimal
> places — that's when I'd reach for a decimal library, because JS has no decimal type and `BigInt`
> truncates on division.

**Scored on:** integers first, and *rounding as an explicit decision* rather than a formatting
step. The bill-split example is what proves you've actually done this — the "parts must sum to the
whole" problem is the thing that bites in production.

**They'll push:** *"Why not just round to 2 decimals after each operation?"* → Because the error is
already in the accumulated value before you round it, and rounding at every step introduces its own
drift in whichever direction the rounding rule leans. You'd be papering over a representation
problem with a formatting one.

**And then:** *"What about a library like dinero.js or decimal.js?"* → Reasonable, and I'd use one
for anything with FX or fractional units. For a system that only ever deals in whole cents, integer
arithmetic plus `Intl` for display is less machinery for the same correctness.

**Red flags:** "use `toFixed(2)` everywhere". Floats plus rounding at the end. Not mentioning that
the parts of a split have to reconcile. Reaching for a library without being able to say what it's
solving.

---

## Q10 — "Why does JS have this problem at all — why not make numbers decimal?" · 60s

The "why does the language work this way" question for this chapter.

**Say:**

> Because doubles are what the hardware does. Every FPU implements IEEE-754 in silicon, so a
> double add is a single instruction. Decimal arithmetic is software — usually 10 to 100 times
> slower — and JavaScript's original job was running in a loop on a browser's main thread. Making
> decimal the default would have made every number in every program pay a cost that only money
> actually needs.
>
> And the alternative doesn't remove the surprise, it moves it. A decimal type represents `0.1`
> exactly and still can't represent one third — you'd trade "my tenths are inexact" for "my thirds
> are inexact", plus the performance cost, plus a second numeric type in the language.
>
> What IEEE-754 actually buys is portability: `0.1 + 0.2` is `0.30000000000000004` in Python,
> Java, C and Go too. The behaviour is fully specified and identical everywhere — it's just not
> decimal.
>
> The general shape is the same trade the language makes elsewhere: give you the cheap primitive
> the hardware provides, and expect you to build the domain-correct thing on top of it — integer
> cents, a scaled comparison, a validated boundary — instead of making every program pay for the
> expensive general case.

**Scored on:** framing it as a trade with a named cost on both sides, and knowing the result is
identical in other languages. Candidates who answer "it's a legacy mistake" have the history wrong
and miss that it's a live design constraint.

**They'll push:** *"Is there anything coming that fixes it?"* → There's a `Decimal` proposal at TC39,
still at an early stage. `BigInt` shipped and solved the integer half only — it truncates on
division, so it's not a decimal answer.

**Red flags:** "it's a design flaw in JS". Not knowing other languages behave identically.

---

## Rapid fire

One sentence each.

- **Why isn't `0.1 + 0.2` `0.3`?** — Binary can't represent tenths; both inputs are already rounded.
- **Which fractions ARE exact?** — Those with power-of-two denominators: `0.5`, `0.25`, `0.125`.
- **Is this JS-specific?** — No. Same in Python, Java, C, Go.
- **What is `Number.EPSILON`?** — The gap between 1 and the next double, `2**-52`.
- **Is it a general float tolerance?** — No, only near 1.0. Scale it by magnitude.
- **When does a scaled tolerance fail?** — Comparing against exactly zero.
- **`typeof NaN`?** — `"number"`.
- **Why `NaN !== NaN`?** — Two failed computations aren't equal just because both failed.
- **Which comparisons against `NaN` are true?** — None.
- **Which equality algorithms find `NaN`?** — SameValueZero and `Object.is`, not `===`.
- **`isNaN` vs `Number.isNaN`?** — The global coerces first; use `Number.isNaN`.
- **Best boundary check for a number?** — `Number.isFinite` — rejects `NaN` and both infinities.
- **What does `JSON.stringify` do with `NaN`/`Infinity`?** — Emits `null` for both.
- **`-0 === 0`?** — `true`. Only `Object.is` and `1/x` separate them.
- **Name three sources of `-0`.** — `Math.round(-0.4)`, `-1 * 0`, `Math.min(0, -0)`.
- **Does `Set` distinguish `0` and `-0`?** — No, SameValueZero treats them as one key.
- **Does `String(-0)` show the sign?** — No. `Intl.NumberFormat` does.
- **`Math.Infinity`?** — Doesn't exist. Global `Infinity` / `Number.POSITIVE_INFINITY`.
- **`Number.MIN_VALUE`?** — Smallest **positive** value; most negative is `-Number.MAX_VALUE`.
- **What happens past `MAX_VALUE`?** — Silent overflow to `Infinity`.
- **`Math.max()` with no args?** — `-Infinity`, the identity element.
- **`Infinity - Infinity`?** — `NaN`.
- **Why 2^53?** — 52 mantissa bits plus an implied leading 1.
- **`isInteger` vs `isSafeInteger`?** — "No fractional part" vs "+ uniquely representable".
- **The 64-bit id bug?** — `JSON.parse` rounds it; unrecoverable afterwards. Send ids as strings.
- **`JSON.stringify` on a `BigInt`?** — Throws `TypeError`.
- **`7n / 2n`?** — `3n`. Integer division truncates; there's no decimal type.
- **Is `toFixed` buggy?** — No. Correct half-up rounding of a value that isn't the decimal you typed.
- **`Math.round(-1.5)`?** — `-1`. It rounds half toward `+Infinity`.
- **`toFixed` returns what type?** — A string.
- **How do you store money?** — Integer minor units; format with `Intl` at the edge.
- **Why not round after every operation?** — The error is already in the accumulated value.
