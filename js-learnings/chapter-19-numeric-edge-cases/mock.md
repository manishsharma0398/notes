# Chapter 19 — Mock Interview: Numeric Edge Cases

A realistic 20-minute round on numbers, written as a transcript. **I** is the interviewer, **You**
is the answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

This round has a distinctive trap: **the opener is the most famous question in JavaScript**, so an
interviewer hears the standard answer several times a day and has stopped scoring it. The credit
starts at "why", and the round is really decided at minute 13 when money comes up.

---

## Minute 0–3 — The opener

> **I:** Why is `0.1 + 0.2` not `0.3`?

> **You:** Because a number is an IEEE-754 double — 64 bits, 52 of mantissa — and it can only hold
> a fraction exactly when the denominator is a power of two. One tenth in binary is
> `0.0001100110011…` repeating forever, same as a third in decimal, so it's cut off at 52 bits.
> `0.1` is stored as `0.10000000000000000555`.
>
> So it isn't `0.1 + 0.2` — it's two approximations added, and the exact sum of those two isn't the
> nearest double to `0.3` either. You land one representable value away, at
> `0.30000000000000004`. Three correct roundings, one ULP off.
>
> Worth adding: this isn't a JS quirk. Python, Java, C and Go all print the same thing. What's
> unusual about JS is that it has only the one numeric type, so there's no decimal to switch to.

⟵ *"Power-of-two denominators" plus "not JS-specific" is the whole opener. The candidate who says
"floating point precision" and stops has said the thing the interviewer expected and moves on with
zero credit banked.*

> **I:** So which decimals are exact?

> **You:** Anything whose fraction is a sum of powers of two — `0.5`, `0.25`, `0.75`, `0.125`.
> `0.5 + 0.25` is exactly `0.75`.

⟵ *A free point. Take it and stop — there's nothing more available here.*

---

## Minute 3–8 — The prediction

> **I:** What does this print?

```javascript
const rows = [{ amount: 10 }, { amount: 20 }, { amount: undefined }, { amount: 40 }];
const total = rows.reduce((sum, r) => sum + r.amount, 0);

if (total > 0) console.log("charging", total);
else console.log("nothing to charge");
```

> **You:** `"nothing to charge"`.
>
> `30 + undefined` is `NaN`, and from there the reduction is poisoned — `NaN + 40` is `NaN`. Then
> `NaN > 0` is `false`, so it takes the else branch.
>
> The part that makes this nasty is that it looks like it worked. No error, and the branch it took
> is a plausible one — the system quietly decides there's nothing to bill and the money just
> doesn't get charged. And you can't fix it by flipping the comparison, because *every* comparison
> against `NaN` is false: `>`, `<`, `>=`, `===`, all of them.

⟵ *The level marker is predicting the branch rather than just spotting the `NaN`. "Every
comparison is false, so the guard doesn't guard" is the sentence — it converts a trivia fact into
the reason the bug is expensive.*

> **I:** How would you fix it?

> **You:** Validate at the boundary, not in the reducer. `Number.isFinite(r.amount)` on each row
> before summing — that rejects `NaN` and both infinities in one call — and then decide explicitly
> what a missing amount means. Skip the row and count it, or fail the whole batch loudly.
>
> What I wouldn't do is `sum + (r.amount || 0)`. That makes the symptom disappear and turns a
> broken record into a zero-value one, so you'd bill a customer the wrong amount instead of not
> billing them, and now there's no signal at all that the data was bad.

⟵ *Rejecting `|| 0` unprompted is worth more than the fix itself. It's the reflex answer, and
naming why it's worse — silent wrong number instead of a visible wrong branch — is the senior
move.*

> **I:** What happens if that `NaN` total gets sent to another service?

> **You:** `JSON.stringify` renders `NaN` as `null` — same for `Infinity`. So the downstream
> service sees a missing field rather than a corrupted one, and the incident gets attributed to
> whoever's on the other side of that boundary.

⟵ *Connecting the value to how it leaves the process is what makes this an operational answer
rather than a language-trivia one.*

---

## Minute 8–13 — The live debug

> **I:** This passes its tests and fails in production. Why?

```javascript
function isPaidInFull(invoiceTotal, payments) {
  const paid = payments.reduce((a, p) => a + p, 0);
  return Math.abs(paid - invoiceTotal) < Number.EPSILON;
}

isPaidInFull(0.3, [0.1, 0.2]);        // true  — the test
isPaidInFull(1250.75, [1000.50, 250.25]);  // ?   — production
```

> **You:** Two problems, and the second one is the interesting one.
>
> The obvious one: `Number.EPSILON` isn't a general tolerance. It's *defined* as the gap between 1
> and the next representable double — `2**-52`. So it describes the precision available near 1.0
> and nowhere else. The spacing between doubles grows with magnitude: near 1 it's about 2.2e-16,
> near 1e9 it's about 1e-7. I've measured the classic case shifted up to 1e9 and the real
> difference was about 537 million times `EPSILON` — so this check returns `false` for two amounts
> that are equal to within rounding.
>
> The test passes because the values are near 1, which is the only range where `Number.EPSILON`
> happens to be the right size. Production has four-figure invoices, and the tolerance is now
> orders of magnitude too tight.
>
> The second problem is that this function shouldn't be comparing floats at all. It's money. The
> amounts should be integer cents, and then the check is `paid === total` with no tolerance
> anywhere — an exact comparison on exact values.

⟵ *Diagnosing the `EPSILON` misuse is the pass mark. Saying "and this shouldn't be a float
comparison in the first place" is what separates a candidate who debugs the line from one who
questions the design. That's also the transition the interviewer is waiting for into the money
section.*

> **I:** Suppose you can't change the storage format today. Fix the comparison.

> **You:** Scale the tolerance by the magnitude of what's being compared:

```javascript
function nearlyEqual(a, b, ulps = 4) {
  if (a === b) return true;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= scale * Number.EPSILON * ulps;
}
```

> Take the larger magnitude, multiply by `EPSILON` and by however many ULPs of slack you'll accept.
> That's correct at both 0.3 and 1250.75.
>
> One caveat worth stating: it breaks down when one side is exactly zero, because `scale` becomes
> the other value and every non-zero number is infinitely many ULPs from zero. Comparing against
> zero needs an absolute tolerance chosen from the domain — the language can't pick it for you. For
> a paid-in-full check that's actually a live case: a zero-total invoice.

⟵ *The zero caveat, unprompted, and then tied back to this specific function's domain. That
combination — knowing the general limitation AND spotting that it applies here — is the strongest
thirty seconds available in this round.*

---

## Minute 13–18 — The whiteboard

> **I:** Design the money handling for a billing service. Talk me through it.

> **You:** Four steps, and the first one does most of the work.
>
> **Store money as an integer number of minor units** — cents, paise. Integers are exact in a
> double up to 2^53, which is about 90 trillion cents, so real application money never approaches
> the limit. `19.99` is stored as `1999`. That's a schema decision, not a code style one.
>
> **Do arithmetic on those integers.** Addition and subtraction become exact. Adding ten cents a
> million times as a float lands about 1.3e-6 off; as integers it's exactly right. And the reason
> not to trust floats even at small scale is that you can't predict which cases break —
> `[19.99, 5.01, 0.1, 0.2]` sums exactly, `[12.35, 4.45, 8.90]` gives `25.700000000000003`. Nothing
> in the code tells them apart, so "it worked when I tested it" says nothing about the next basket.
>
> **Round explicitly, once, where you're forced to divide** — tax, a percentage discount, splitting
> a bill:

```javascript
function splitEvenly(totalCents, ways) {
  const base = Math.floor(totalCents / ways);
  const remainder = totalCents - base * ways;
  return Array.from({ length: ways }, (_, i) => base + (i < remainder ? 1 : 0));
}

splitEvenly(1000, 3);   // [334, 333, 333] — sums back to exactly 1000
```

> The naive version rounds each share independently and gives `[3.33, 3.33, 3.33]`, which sums to
> `9.99`. A cent is gone. "The parts have to add back to the whole" is a business rule, not a
> rounding mode, so it has to be code somebody decided on — and someone has to decide *who* gets
> the extra cent.
>
> **Format at the very edge with `Intl.NumberFormat`.** Currency symbol, correct decimal places for
> that currency, and locale grouping — including lakh/crore for en-IN, which nothing else in the
> language does. `toFixed` gives you none of that and returns a string with no currency attached.

⟵ *The bill split is what proves this is experience rather than reading. Everyone says "use
integers"; the remainder-distribution problem is the one that actually shows up in a reconciliation
ticket.*

> **I:** Why not just use `toFixed(2)` after each operation?

> **You:** Two reasons. The error is already inside the accumulated value before you round it, so
> rounding is papering over a representation problem with a formatting one — and rounding at every
> step introduces its own drift in whichever direction the rule leans.
>
> And `toFixed` doesn't do what people think. `(1.005).toFixed(2)` is `"1.00"`, not `"1.01"`. It's
> not broken and it's not banker's rounding — it rounds half-up correctly on the value it was
> given, and that value is `1.00499999999999989342`, which is genuinely below the halfway point. I
> surveyed 399 values of the form `x.xx5`: 120 round up, 279 round down, depending on which side of
> the decimal half the nearest double landed. Deterministic, but not a rule anyone specified. Also
> it returns a string, so you'd be parsing it back to a number and re-introducing the problem.

⟵ *"Correct rounding of a number that isn't the one you typed" is the sentence. Candidates who
call `toFixed` buggy or attribute it to banker's rounding both lose the point.*

> **I:** What about ids — anything to watch there?

> **You:** Yes, and it's the same 2^53 limit from the other direction. A 64-bit id — a snowflake, a
> Postgres `bigint`, a ledger id — exceeds it, and `JSON.parse` turns it into a `Number` that
> rounds. `12345678901234567890` comes back as `12345678901234567000`, silently, and then you send
> it back and address a different row. There's no rescue after `JSON.parse` — the digits are gone
> by then, so the fix is upstream: send ids as strings, or parse with a reviver.
>
> And I'd use strings rather than `BigInt` for that, because `BigInt` doesn't mix with `Number` in
> arithmetic, `Math.*` rejects it, and `JSON.stringify` *throws* on it. For a value you never do
> arithmetic on, a string is less machinery.

⟵ *Volunteering the id problem in a money conversation is a strong move — it's the same limit, and
most candidates file it as a separate topic.*

---

## Minute 18–20 — The closer

> **I:** Anything you'd change about how JS handles numbers?

> **You:** Honestly, not the format. Doubles are what the hardware does — a double add is one FPU
> instruction, decimal is software and 10 to 100 times slower, and JS's original job was a browser
> main thread. Making decimal the default would tax every program for something only money needs.
> And decimal doesn't remove the surprise anyway, it moves it — it does tenths exactly and still
> can't do thirds.
>
> What IEEE-754 buys is that the behaviour is portable and fully specified: `0.1 + 0.2` is
> `0.30000000000000004` everywhere, in every language. I'd rather have a sharp edge that's
> identical on every machine than a softer one that varies.
>
> What I *would* want is a decimal type available alongside — there's a TC39 proposal — because
> right now `BigInt` solved only the integer half and truncates on division, so there's no built-in
> answer for fractional money at all. And I'd want the silent failures to be less silent: overflow
> to `Infinity`, underflow to zero and a rounded 64-bit id all happen with no signal whatsoever.

⟵ *Separating "this is a deliberate trade I'd keep" from "this is a genuine gap I'd fill" is the
strongest way to end. Naming the silence as the real problem — rather than the arithmetic — shows
you've debugged this rather than read about it.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| `0.1 + 0.2` | "floating point" | "binary can't represent tenths" | + "power-of-two denominators; same in Python/Java/C" |
| Comparing floats | `===` or `toFixed` | "use `Number.EPSILON`" | "`EPSILON` is the gap at 1 — scale it, and zero is its own case" |
| The `NaN` prediction | "prints `charging NaN`" | "prints nothing to charge" | + rejects `\|\| 0` and names how it leaves via `JSON.stringify` |
| `isNaN` | doesn't distinguish | "`Number.isNaN` doesn't coerce" | "use `Number.isFinite` at the boundary — one call, three values" |
| The `EPSILON` debug | spots the tolerance | fixes it with a scaled one | "and this shouldn't be a float comparison at all" |
| `-0` | "a display thing" | "`Object.is` distinguishes it" | separates true `-0` from a small negative that rounds to zero |
| Money | "`toFixed(2)`" | "integer cents" | + explicit rounding, remainder placement, `Intl` at the edge |
| `toFixed(1.005)` | "it's buggy" | "banker's rounding" *(wrong, confidently)* | "correct half-up rounding of a value that isn't the decimal you typed" |
| Big ids | never hit it | "2^53 limit" | "no rescue after `JSON.parse`; send as strings, not `BigInt`, and here's why" |
| Design critique | "JS numbers are broken" | "it's IEEE-754, all languages" | keeps the format, wants a decimal type + louder failures |

**The sentences that raise your level most:**

- "Binary can't represent tenths, the same way decimal can't represent thirds."
- "`Number.EPSILON` is the gap between 1 and the next double — so it's only a tolerance near 1."
- "Every comparison against `NaN` is false, so the guard doesn't guard."
- "I wouldn't use `|| 0` — that turns a visible wrong branch into a silent wrong number."
- "This shouldn't be a float comparison at all."
- "Correct rounding of a number that isn't the one you typed."
- "The parts have to add back to the whole — that's a business rule, not a rounding mode."
- "There's no rescue after `JSON.parse`; the digits are already gone."
- "The arithmetic isn't the problem — the silence is."

**Red flags — each of these visibly drops you a level:**

- "JavaScript is bad at math." → It's IEEE-754, identical in every language.
- `Math.abs(a - b) < Number.EPSILON` offered as the general float comparison.
- Not knowing what `Number.EPSILON` actually is.
- `typeof NaN` being anything other than `"number"`.
- Using the global `isNaN`.
- Fixing a `NaN` with `|| 0` and stopping there.
- "`toFixed` uses banker's rounding."
- Floats for money plus "round at the end".
- Proposing `BigInt` for ids with no cost named.
- "`Math.Infinity`" — it doesn't exist.
- Saying `Number.MIN_VALUE` is the most negative number.

---

## Drill it

Say these out loud, timed, until they're boring:

```
[ ] why 0.1 + 0.2 isn't 0.3, with power-of-two denominators   (60s)
[ ] what Number.EPSILON IS, and why it's not a tolerance      (75s)
[ ] the NaN reduction prediction — the BRANCH, not the value  (60s)
[ ] why || 0 is the wrong fix                                  (30s)
[ ] isNaN vs Number.isNaN vs Number.isFinite                   (45s)
[ ] the EPSILON debug, both problems                           (90s)
[ ] nearlyEqual from scratch, with the zero caveat             (3 min)
[ ] -0: where it comes from, and the two UI bugs it looks like (60s)
[ ] 2^53, isInteger vs isSafeInteger, the id bug               (60s)
[ ] the four-step money answer                                 (90s)
[ ] splitEvenly from scratch, and why the remainder matters    (3 min)
[ ] is toFixed buggy — the reframe                             (60s)
[ ] one thing you'd change, one you wouldn't                   (60s)
```
