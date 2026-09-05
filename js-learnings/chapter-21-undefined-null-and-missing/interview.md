# Chapter 21 — Interview Questions: `undefined`, `null`, and Missing

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

This topic is scored differently from the rest of the track. Everyone knows the syntax, so almost
nothing here is about *what* an operator does — it is about whether you treat absence as a
**modelling decision**. Two questions carry it: **Q1**, where "when do you use each" has a real
answer about APIs rather than a style preference, and **Q4**, *"when would you deliberately want
`||`?"*, which is a trap for anyone who learned "always use `??`" as a rule.

One habit for the whole chapter: **name which of the five states you're talking about.** "Present
but holding `undefined`" and "absent" are different words, and using them separates you
immediately.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "`null` vs `undefined` — when do you use each?" · 75s

The opener, and the one most people answer with a definition instead of a rule.

**Say:**

> The mechanical difference is who produced it. **`undefined` is what the language gives you when
> nobody supplied a value** — a missing property, a missing argument, an uninitialised `let`, a
> function with no `return`. **`null` is what somebody assigned.** JavaScript never produces a
> `null` on its own; every one in your program was written by you, a library, or a host API.
>
> So the convention I follow is: `undefined` means *unset*, `null` means *deliberately empty*. A
> field the user never filled in is `undefined`; a field the user cleared is `null`.
>
> And that distinction is load-bearing rather than cosmetic. In a `PATCH` body,
> `{ "nickname": null }` means delete the nickname, while omitting the key means don't touch it. If
> you flatten both into "missing", your API can't express deletion. That's the reason I'd give for
> keeping them apart, rather than picking one and normalising.

**Scored on:** "the language produces one, you assign the other", plus a concrete case where the
difference does work. Anyone can define both; the `PATCH` example is what makes it an answer.

**They'll push:** *"So would you ban `null` in a codebase?"* → Not from the domain layer — I'd want
the two to mean different things there. Where I would normalise is at a boundary I don't control: a
JSON payload where `null` and missing arrive interchangeably, pick one on the way in and be
consistent inside.

**Red flags:** "They're basically the same." Reciting `typeof` without the design rule. Claiming
JavaScript produces `null` for missing properties.

---

## Q2 — "Why is `typeof null` `"object"`?" · 45s

**Say:**

> It's a bug from the first implementation in 1995. Values were stored with a type tag in the low
> bits, and `000` meant "object". `null` was represented as the machine null pointer — all zero bits
> — so it read as an object tag.
>
> There was a proposal to fix it in ES4 and it was rejected on web-compatibility grounds: too much
> deployed code branches on `typeof x === "object"`, and changing it would have broken pages nobody
> maintains any more.
>
> The tell that it's a bug rather than a design is that the language contradicts itself about it:
> `typeof null` says `"object"`, but `null instanceof Object` is `false`, and
> `Object.prototype.toString.call(null)` gives `[object Null]` — that one's a spec-level branch
> rather than a tag read, so it gets it right.

**Scored on:** the tag-bits mechanism and the web-compat reason it stayed. The `instanceof` /
`toString` contradiction, unprompted, is the level marker.

**They'll push:** *"So how do you check for null?"* → `x === null` if I mean exactly null,
`x == null` if I mean null-or-undefined, which is the one loose-equality case worth using.

**Red flags:** "JavaScript is weird." Not knowing it was ever proposed for a fix.

---

## Q3 — "What does this print?" · 60s

```javascript
console.log(null == 0, null >= 0, null > 0);
```

**Say:**

> `false`, `true`, `false`.
>
> They look inconsistent and they're two different algorithms. **`==` has a hard-coded special
> case**: `null` and `undefined` are loosely equal to each other and to nothing else, and no
> coercion is attempted at all. That's why `null == 0` and `null == false` are both false.
>
> **Relational operators do coerce**, with `ToNumber`, and `Number(null)` is `0`. So `null >= 0` is
> really `0 >= 0`, which is true, and `null > 0` is `0 > 0`, which is false.
>
> `undefined` behaves differently in the second case, because `Number(undefined)` is `NaN` — so
> `undefined >= 0` and `undefined <= 0` are both `false`, since every comparison against `NaN` is
> false.

**Scored on:** "different algorithms" with both named. Getting the three values right and shrugging
is a two-year answer.

**They'll push:** *"Where would that actually bite you?"* → A range check on a value that might be
absent. `if (score >= 0)` passes for a `null` score and fails for an `undefined` one, so the same
missing-data bug behaves differently depending on which absence you got — and a `null` from
`JSON.parse` is very easy to get.

**Red flags:** Saying `null` is coerced to `0` for `==`. Not knowing `undefined` differs.

---

## Q4 — "`??` versus `||` — and when would you deliberately want `||`?" · 75s

**The question that decides the round.** The second half is the trap.

**Say:**

> `||` falls back when the left side is **falsy** — eight values: `false`, `0`, `-0`, `0n`, `""`,
> `null`, `undefined`, `NaN`. `??` falls back only when it's **nullish** — `null` or `undefined`.
> Everything else about them is the same: both short-circuit, both return an operand rather than a
> boolean.
>
> The gap is the six values in between, and every one of them is a legitimate config value. I've
> run a realistic options object through both: `retries: 0` becomes `3` under `||`, so "don't retry"
> silently turns into three retries, and `verbose: false` becomes `true`, so an opt-out becomes an
> opt-in. Those are the quiet kind of bug — `0` is exactly what someone sets while debugging a flaky
> call.
>
> But I would deliberately reach for `||` where falsy genuinely means absent for that type. The
> clearest case is a form field or a query parameter: `""` and "not filled in" are the same thing to
> the user, so `input.value || defaultValue` is saying what I mean, and `??` would let an empty
> string through as a real answer.

**Scored on:** the second half. "Always use `??`" is the answer of someone who learned a rule;
naming the case where `||` is *correct* shows you understand what each one tests.

**They'll push:** *"What happens with `a ?? b || c`?"* → `SyntaxError`. It's a parse error, not a
lint rule — the committee refused to assign a precedence because the two groupings genuinely differ:
`(0 ?? 1) || 2` is `2`, and `0 ?? (1 || 2)` is `0`. Whichever precedence they'd picked would have
silently done the other thing in half the code.

**And then:** *"Does `x ??= y` behave like `x = x ?? y`?"* → Not quite — `??=` short-circuits the
**assignment**, so if the value isn't nullish no write happens at all. `x = x ?? y` calls the setter
every time. That matters for a setter, a `Proxy` trap, a reactive framework's dependency tracking,
or a frozen object where the redundant write would throw.

**Red flags:** "`??` is just a better `||`". Listing falsy values wrong. Not knowing the mixing rule
is a parse error.

---

## Q5 — "What does `?.` actually protect you from?" · 75s

**Say:**

> Exactly one thing: reading a property of `null` or `undefined`. Nothing else.
>
> The part people get wrong is the scope of the short circuit. **`?.` short-circuits the entire
> remaining chain, not just the next access.** If `a.b` is null, `a.b?.c.d.e` is `undefined` — no
> error — because everything to the right is skipped, including further dots, brackets and calls. So
> you don't need `a?.b?.c?.d`; writing it suggests you think each `?.` only guards its own link.
>
> It stops at a parenthesis, though. `(a.b?.c).d` throws, because the parentheses end the chain and
> `.d` is a fresh access on the `undefined` that came out.
>
> Three things it doesn't do. It doesn't catch other errors — a getter that throws still throws. It
> doesn't make the *result* safe: `a.b?.c + 1` is `NaN`, so you've turned a loud failure at the read
> into a quiet one downstream. And it isn't valid on the left of an assignment, though `delete a?.b`
> is allowed.

**Scored on:** the whole-chain short circuit and the "result isn't safe" point. Those two together
are the difference between using the operator and understanding it.

**They'll push:** *"What would you say in review about `user?.profile?.settings?.theme?.color`?"* →
That it's four statements that we don't know the shape of our data. I'd ask which of those can
actually be missing — usually one — and make the rest plain accesses, so the next structural change
fails loudly instead of producing an `undefined` colour.

**And then:** *"Does `a?.b(sideEffect())` evaluate `sideEffect()` when `a` is null?"* → No. The
arguments are part of the short-circuited expression.

**Red flags:** "It stops errors." Chaining `?.` at every link. Not knowing about `?.()` and `?.[]`.

---

## Q6 — "Why doesn't the default fire here?" · 60s

```javascript
function connect(timeout = 5000) { return timeout; }
connect(null);   // ?
```

**Say:**

> It returns `null`. **A default parameter fires if and only if the argument is `undefined`** —
> `null` is a value, so it goes straight through.
>
> The thing worth saying next is that this is *narrower* than `??`. `??` catches both nullish
> values; a default only catches one. So two features that exist for the same reason have different
> rules, and `x = x ?? d` inside the body is not the same as `x = d` in the signature.
>
> Destructuring defaults follow the parameter rule, not the `??` rule — which is what makes the
> `({ a = 1 } = {})` idiom work, and also why a `null` from `JSON.parse` walks past every default in
> a destructured options object.

**Scored on:** "`undefined` only", and then the comparison to `??`. Most people know the fact and
haven't noticed the asymmetry.

**They'll push:** *"When are defaults evaluated?"* → At call time, every call, left to right, in
their own scope with their own TDZ — so `function f(a = b, b = 2)` throws
`Cannot access 'b' before initialization`. Which also means JavaScript doesn't have Python's
mutable-default trap: `function f(list = [])` allocates a fresh array each call.

**And then:** *"Does adding a default change anything else about the function?"* → Two things. It
makes the parameter list "non-simple", so `arguments` stops being a live view of the parameters —
legacy code that writes through `arguments[0]` breaks silently. And it makes a `"use strict"`
directive in the body a `SyntaxError`, because the defaults would have to be parsed before the
directive was known.

**Red flags:** "Defaults fire on falsy." Not knowing they're re-evaluated per call.

---

## Q7 — "How do you check whether a property exists?" · 60s

**Say:**

> Depends which question I'm asking, and there are four different ones.
>
> `obj.k !== undefined` asks "is there a usable value", and it can't tell an absent key from one
> that holds `undefined`. `"k" in obj` asks "is this name reachable at all", including inherited
> properties. `Object.hasOwn(obj, k)` asks "did *this* object declare it", which is usually the one I
> want. And `Object.keys(obj).includes(k)` is own **and enumerable**, and allocates an array.
>
> That last one is worth a scale caveat. I've measured both on a 50,000-key object: `in` is about
> 37 nanoseconds, and `Object.keys().includes()` is 19 milliseconds, because it materialises a
> 50,000-element array on every call. Both are correct — fine for a ten-key options object, wrong for
> a cache.

**Scored on:** treating it as four questions rather than one, and the scale caveat unprompted.

**They'll push:** *"Why `Object.hasOwn` rather than `obj.hasOwnProperty(k)`?"* → Because the object
might own a property called `hasOwnProperty`, or have no prototype at all — `Object.create(null)`.
The old safe spelling was `Object.prototype.hasOwnProperty.call(obj, k)`; `Object.hasOwn` in ES2022
is that, readably.

**And then:** *"Is `delete obj.k` the same as `obj.k = undefined`?"* → No. Assigning leaves the key,
so `in`, `Object.keys` and anything that serialises will still see it. That's the difference between
a `PATCH` that clears a field and one that removes it.

**Red flags:** Only knowing `!== undefined`. Calling `hasOwnProperty` directly on untrusted data.

---

## Q8 — "What happens to `undefined` in JSON?" · 60s

**Say:**

> It doesn't survive, and the two containers lose it differently. In an object, a key holding
> `undefined` is **omitted entirely** — same for functions and symbols. In an array it becomes
> **`null`**, because the array's length has to survive.
>
> So `undefined` isn't representable in JSON at all; `null` is. That's a real constraint on API
> design: if the protocol has to distinguish "unset" from "explicitly empty", JSON gives you `null`
> plus key-presence and nothing else, which is exactly why `PATCH` semantics are built on whether the
> key is there.
>
> If I need a deep copy that keeps `undefined`, `structuredClone` preserves it, key and all.

**Scored on:** the object/array asymmetry with the length reason.

**They'll push:** *"So how does this show up as a bug?"* → Usually through spread. `{ ...defaults,
retries: opts.retries }` creates the `retries` key regardless of what it holds, so an absent option
becomes an explicit `undefined` that erases the default. Spreading an override object that only
contains present keys behaves differently from spreading one built field by field.

**Red flags:** "It becomes null" as a blanket answer.

---

## Q9 — "What's the difference between `[1,,3]` and `[1,undefined,3]`?" · 60s

**Say:**

> The first has a **hole** — index `1` doesn't exist. `1 in holey` is `false` and `1 in dense` is
> `true`, and `Object.keys` shows `['0','2']` versus `['0','1','2']`. Both read as `undefined` at
> index 1, so a read can't tell them apart.
>
> The behaviour difference is in the methods. The older array methods skip holes — `map`, `forEach`,
> `filter`, `reduce` — so `holey.map(() => 9)` gives `[9, <hole>, 9]` and the callback runs twice.
> The iteration protocol doesn't skip: spread, `for...of` and `Array.from` all fill holes with
> `undefined`. So refactoring a `forEach` into a `for...of` can change how many times the body runs.
>
> There's a nice inconsistency too: on the same holey array, `includes(undefined)` is `true` and
> `indexOf(undefined)` is `-1`, because `includes` walks every index with SameValueZero and `indexOf`
> skips holes.

**Scored on:** "old methods skip, iteration doesn't" plus one concrete consequence.

**They'll push:** *"Where do holes come from in real code?"* → `new Array(n)`, mostly — which is why
`new Array(3).map((_, i) => i)` does nothing and `Array.from({length: 3}, (_, i) => i)` works. Also
`delete arr[i]`, and assigning past the end of an array.

**Red flags:** "They're the same thing." Not knowing `new Array(n)` produces holes.

---

## Q10 — "`find` returns `undefined` but `match` returns `null`. Why?" · 45s

**Say:**

> Era, not logic. Nothing in the language enforces a convention for "not found", and the standard
> library has at least three.
>
> The regex and DOM methods return `null` because they date from the original 1995 design, where
> `null` was the Java-influenced "no object" value — `match`, `exec`, `getElementById`,
> `querySelector`. The array search methods return `undefined` because they're ES5 and later —
> `find`, `at`, `Map.get`. And the index-returning methods return `-1`, which is a C convention:
> `indexOf`, `findIndex`.
>
> The practical consequence is that any helper meaning "is this missing" has to accept both, which is
> why `x == null` survives as an idiom — it's exactly `x === null || x === undefined` and nothing
> else.

**Scored on:** giving the historical reason rather than looking for a rule. Naming all three
conventions is the level marker.

**They'll push:** *"How do you defend against that at a boundary?"* → Validate, don't just type.
`JSON.parse` returns `any`, so a `null` in a field the types call a `string` passes every
compile-time check and fails at the first method call.

**Red flags:** Inventing a rationale ("`null` means the search itself failed").

---

## Q11 — "Can you tell whether an argument was passed?" · 45s

**Say:**

> Not from the parameter — `f()` and `f(undefined)` are identical from inside. The only discriminator
> is `arguments.length`, which is `0` and `1` respectively, and arrow functions don't have
> `arguments` at all, so inside one it genuinely can't be done.
>
> If the distinction matters to an API, I'd take an options object and ask with `in`, which turns
> "was it passed" into "is the key present" — a question the language can actually answer.

**Scored on:** knowing `arguments.length` is the only route, and immediately proposing the design
that avoids needing it.

**Red flags:** Suggesting a sentinel default like `f(x = Symbol())` without noticing it changes the
signature everyone reads.

---

## Rapid fire — one sentence each

- **`typeof null`?** `"object"` — a 1995 tag-bits bug, unfixable for web compat.
- **`null instanceof Object`?** `false`. The language contradicting its own `typeof`.
- **Is `undefined` a keyword?** No — a non-writable global property. `null` is a literal.
- **Can `undefined` be shadowed?** Yes, locally — which is why minifiers emit `void 0`.
- **`null == undefined`?** `true`, and nothing else is loosely equal to either.
- **`null == 0` / `null >= 0`?** `false` / `true` — `==` special-cases, `>=` coerces.
- **`undefined >= 0`?** `false` — `Number(undefined)` is `NaN`.
- **How many falsy values?** Eight. Nullish? Two.
- **`0 || 3` / `0 ?? 3`?** `3` / `0`.
- **`a ?? b || c`?** `SyntaxError` — parenthesise.
- **Does `??=` write when the value is `0`?** No — it short-circuits the assignment itself.
- **`a.b?.c.d` when `b` is null?** `undefined` — the whole chain short-circuits.
- **`(a.b?.c).d`?** `TypeError` — parentheses end the chain.
- **Does `?.` catch a throwing getter?** No, only nullish reads.
- **`a?.b = 1`?** `SyntaxError`. `delete a?.b` is legal.
- **`f(null)` with `x = 1` default?** `null` — defaults fire on `undefined` only.
- **Are defaults evaluated once?** No — per call, left to right, with their own TDZ.
- **What does a default break?** The `arguments` mapping and a `"use strict"` body directive.
- **Tell "not passed" from "passed undefined"?** `arguments.length` only; not in an arrow.
- **`JSON.stringify({a: undefined})`?** `{}`. **`JSON.stringify([undefined])`?** `[null]`.
- **Deep copy that keeps `undefined`?** `structuredClone`.
- **`1 in [1,,3]`?** `false`. **`[...[1,,3]]`?** `[1, undefined, 3]`.
- **`[1,,3].includes(undefined)` vs `.indexOf(undefined)`?** `true` vs `-1`.
- **`Map.get` on a stored `undefined`?** Indistinguishable from missing — use `.has`.
- **Best key-presence check?** `Object.hasOwn(obj, k)`; not `Object.keys().includes()` at scale.
- **`delete o.k` vs `o.k = undefined`?** The first removes the key; the second leaves it.
