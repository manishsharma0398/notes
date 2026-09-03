# Chapter 19 — Cumulative Exercise: A Ledger That Reconciles

**Time:** 1–3 hours. **Scope:** everything from Chapters 12–19 — iteration protocols, promises and
error semantics, retention, immutability, and numeric representation.

Build a small double-entry **ledger**: money is posted in balanced entries, every entry is
immutable once written, and the ledger can produce a statement and prove it reconciles. The whole
exercise is organised around **one invariant** — *the sum of every entry is exactly zero, and the
sum of the parts of any split equals the whole* — which is trivially true with integers and
quietly false with floats.

**The deliverable is the proof, not the code.** Phase 1 builds the float version and *measures*
how far it drifts. Every later phase closes one gap and re-runs the identical workload against the
identical assertion. At the end you should be able to show a number, not make a claim.

`Money.allocate` in Phase 3 and the reconciliation check in Phase 5 are both asked directly as
whiteboard questions at this level.

No libraries. Node only.

---

## The workload

Use this generator throughout so every phase is measured on the same thing. Do not change it after
Phase 1 — a benchmark you edited is not a comparison.

```javascript
// workload.js — deterministic, so runs are comparable
function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function makeInvoices(count, rng = makeRng()) {
  return Array.from({ length: count }, (_, i) => ({
    id: `inv-${i}`,
    lines: Array.from({ length: 1 + Math.floor(rng() * 5) }, () => ({
      // prices with two decimal places, the way a real catalogue has them
      unitPrice: Math.floor(rng() * 20000) / 100,
      qty: 1 + Math.floor(rng() * 4),
    })),
    taxRate: [0.05, 0.12, 0.18][Math.floor(rng() * 3)],
    splitWays: 1 + Math.floor(rng() * 4),
  }));
}
```

---

## Phase 0 — The assertion harness

Nothing later in this exercise means anything without this, and building it first is the point.

**Build**

- `assertReconciles(entries)` → throws with a useful message if the entries do not sum to exactly
  zero. Decide, and write down, what "exactly" means for the representation you're currently using.
- `drift(actual, expected)` → returns the absolute difference, formatted so a `1e-13` result is
  readable rather than printed as `0`.
- `report(label, results)` → prints a comparison row you'll reuse in every phase.

**Success criteria**

- [ ] `assertReconciles` fails on a deliberately unbalanced entry, with a message naming the amount
      it is off by — not just "assertion failed".
- [ ] `drift` distinguishes "exactly equal" from "off by 1e-16" — a check written with `===` and one
      written with a tolerance disagree here, and you can say which you used and why.
- [ ] One sentence: why can this harness not use `Number.EPSILON` as its tolerance, given the
      amounts involved run into the thousands?

---

## Phase 1 — Build it with floats, and measure the drift

Write the version almost everyone writes first. **Do not fix anything yet.**

```javascript
// ledger-v1.js — the obvious implementation
function invoiceTotal(invoice) {
  const subtotal = invoice.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const tax = subtotal * invoice.taxRate;
  return Number((subtotal + tax).toFixed(2));
}

function split(total, ways) {
  return Array.from({ length: ways }, () => Number((total / ways).toFixed(2)));
}
```

**Find and name every defect in those eight lines before running anything.** There are at least
four, and one of them is not about precision at all.

**Then measure**, over 10,000 generated invoices:

- How many invoices have `split(total, ways)` summing to something other than `total`?
- What is the total drift across all invoices — the sum of every discrepancy?
- What is the single worst discrepancy?
- How many totals differ from a correctly-computed integer version?

**Success criteria**

- [ ] A written list of the defects, each named as a *shape* — "float accumulation", "rounds with
      `toFixed` then reparses", "splits without placing the remainder", and whatever else you found.
- [ ] The four measurements above recorded. If the drift is zero, your workload isn't exercising
      the problem — increase the invoice count and the number of lines before continuing.
- [ ] One sentence on why `Number((x).toFixed(2))` does not fix anything, naming both what
      `toFixed` returns and what re-parsing it produces.
- [ ] The worst single discrepancy expressed in **currency**, not in scientific notation. That
      number is the one you'd put in a bug report.

Keep `ledger-v1.js`. Every later phase is measured against it on the identical workload.

---

## Phase 2 — `Money` as an immutable value type

**Build** a `Money` class holding an integer number of minor units, plus a currency.

**Success criteria**

- [ ] `Money.fromDecimalString("19.99", "USD")` yields exactly `1999` minor units, parsed
      **without** a float round trip. A comment explains why `parseFloat("19.99") * 100` is not
      acceptable — run it and put the actual value in the comment.
- [ ] Instances are immutable: every operation returns a new `Money`, and mutating a returned one
      throws in strict mode. Say which Chapter 18 mechanism you used, and name one thing it does
      **not** protect (Chapter 18, Part 4 has the candidates).
- [ ] `plus`/`minus` reject a mismatched currency with an error a caller can act on (Chapter 16 —
      say which of its rules you're applying to the error's shape).
- [ ] Arithmetic never produces a non-integer minor-unit value. Assert this in the constructor with
      `Number.isSafeInteger`, and say why `Number.isInteger` would be the weaker check.
- [ ] `equals` is exact; there is no tolerance anywhere in this class. One sentence on why a
      tolerance in a money type is a design smell.

---

## Phase 3 — Allocation: where the rounding decision lives

**Build** `money.allocate(ratios)` and `money.splitEvenly(ways)`.

**Success criteria**

- [ ] `Money.fromMinor(1000).splitEvenly(3)` returns parts summing to exactly `1000`.
- [ ] `allocate([1, 1, 1])` on `1000` and `allocate([50, 30, 20])` on `1001` both sum to the input
      exactly. Test both.
- [ ] The remainder distribution rule is **documented and deliberate** — write down who gets the
      extra minor unit and one sentence justifying it. "Largest remainder first" and "first
      claimant" are both defensible; silence is not.
- [ ] `allocate` with a ratio of `0` gives that party exactly zero, and doesn't consume a remainder
      unit.
- [ ] A property test: 10,000 random (amount, ratios) pairs, asserting the parts always sum to the
      whole. Run it and record the number of cases.
- [ ] The same property test run against Phase 1's float `split`, with the failure count recorded
      side by side.

---

## Phase 4 — Boundaries: nothing untrusted becomes a Number by accident

Every value entering the ledger comes from JSON — an API, a file, a queue.

**Build** a `parseEntry(raw)` that validates and converts, and refuses rather than guesses.

**Success criteria**

- [ ] Amounts arrive as strings and are parsed with the Phase 2 parser. A raw JSON *number* for an
      amount is **rejected**, with a comment explaining what has already happened by the time your
      code sees it.
- [ ] Ids are kept as strings. Demonstrate the failure you're preventing: parse
      `'{"id": 12345678901234567890}'` and show what comes back, then show your version keeping it
      intact.
- [ ] Every numeric field is validated with `Number.isFinite`, and you can say what three distinct
      values that one call rejects.
- [ ] A malformed entry produces one error naming the field and the reason — not a `NaN` that
      travels further into the system. Say which Chapter 16 idea this is.
- [ ] A test that a `NaN` **cannot** reach the ledger by any path you've written, including through
      a `0`-quantity line or a missing tax rate.

---

## Phase 5 — The ledger, and the invariant

**Build** an append-only ledger: `post(entry)` where an entry is a list of `Money` legs that must
sum to zero, plus `statement(accountId)` and `balance(accountId)`.

**Success criteria**

- [ ] `post` rejects an unbalanced entry before storing anything — assert the ledger is unchanged
      after a rejected post (Chapter 16: the failed operation leaves no partial state).
- [ ] Entries are immutable once posted, and `statement()` cannot hand a caller something that lets
      them mutate ledger state. Say what you return and why (Chapter 18, Part 7's argument applies
      directly).
- [ ] `statement(accountId)` is **iterable** — implement the protocol from Chapter 12 rather than
      returning an array. Then answer: does your iterator see a live view or a snapshot, and what
      happens if a `post` occurs mid-iteration?
- [ ] `balance()` over 100,000 posted entries is exact, asserted with `===` against an
      independently computed total.
- [ ] A `reconcile()` that proves the whole ledger sums to zero, and reports the offending entry ids
      if not.
- [ ] Retention check (Chapter 17): after `statement()` is consumed and dropped, nothing from that
      call is retained. Say which structure would have leaked if you'd cached statements by account.

---

## Phase 6 — Posting a batch, asynchronously

Real entries arrive from a queue, and a batch must be all-or-nothing.

**Build** `postBatch(entries)` that validates everything first, then commits, and reports per-entry
failures without losing the successful ones' work — or refuses the whole batch, your choice,
**documented**.

**Success criteria**

- [ ] The all-or-nothing decision is written down with its reasoning, and the code matches it.
- [ ] A rejection in the middle of a batch leaves the ledger in a state you can state precisely, and
      a test asserts it.
- [ ] Cleanup runs on every path, and there is **no `return` inside a `finally`** — one sentence on
      what would happen if there were (Chapter 16, Part 4).
- [ ] `Promise.all` over 10,000 entries: state the memory caveat from Chapter 17 and say whether it
      applies here or not, with a reason.
- [ ] An entry that throws synchronously during validation becomes a rejection, not an uncaught
      exception.

---

## Phase 7 — Prove it (do not skip)

The phase the whole exercise exists for.

**Build** one script that runs the identical workload against `ledger-v1.js` and the finished
ledger, and prints the comparison.

**Success criteria**

- [ ] A table over 10,000 invoices: splits that failed to reconcile, total drift, worst single
      discrepancy, and totals differing from the exact value — both versions, side by side.
- [ ] The finished version's drift column is **exactly zero**, asserted with `===`. If it isn't,
      you have a float somewhere — find it before writing the paragraph.
- [ ] A scaling row: the same measurements at 1,000 / 10,000 / 100,000 invoices, showing how v1's
      drift grows and the integer version's does not.
- [ ] **A paragraph naming which defect each phase closed** — and, the important half, **what this
      ledger still cannot represent**. At least two: one about fractional minor units (the reason FX
      and per-unit pricing exist), and one about a numeric limit you have not hit but could
      (name the limit and roughly how much money it corresponds to).
- [ ] One sentence you could say in an interview describing the whole thing in under 30 seconds.

---

## Stretch, genuinely optional

- Add a **currency conversion** entry type. This is where the exercise's integer discipline breaks
  down — an FX rate has more than two decimal places. Decide how to represent the rate, where the
  rounding happens, and which side of the conversion absorbs the remainder. Write the argument
  before the code.
- Make the ledger **async-iterable** so `for await (const entry of ledger.stream(accountId))` works
  over a paginated source (Chapter 12's protocol, Chapter 14's async twin), then answer the
  Chapter 17 question it raises: what does abandoning that loop without `break` retain?
- Replace the integer minor units with `BigInt` and measure what it costs — arithmetic speed on
  100,000 operations, and every place your code had to change at a boundary. Then say whether it
  bought you anything at these amounts, and be willing to answer "no".

---

## Where this goes next

Chapter 20 is modules (ESM). It lands on this exercise directly: whether `Money` imported into two
files is the same class (and what breaks if it isn't), what a live binding means for the ledger's
module-level state, and why a cyclic import between `money.js` and `ledger.js` throws a
`ReferenceError` at exactly the wrong moment rather than giving you a partially-initialised object.
