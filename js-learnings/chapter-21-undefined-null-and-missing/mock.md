# Chapter 21 — Mock Interview: `undefined`, `null`, and Missing

A realistic 20-minute round, written as a transcript. **I** is the interviewer, **You** is the
answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

This round is scored differently from the rest of the track. There is almost no syntax anyone
doesn't know, so **nothing here is about what an operator does** — it is about whether you treat
absence as a modelling decision. The opener is a design question dressed as a definition, minute 8
is a real config bug that ships constantly, and the whiteboard is deliberately a merge function,
because merging is where all five states collide.

One habit carries the round: **say which of the five states you mean.** "Present but holding
`undefined`" and "absent" are different words.

---

## Minute 0–3 — The opener

> **I:** `null` and `undefined`. When do you use each?

> **You:** The mechanical difference is who produced it. `undefined` is what the *language* gives
> you when nobody supplied a value — a missing property, a missing argument, an uninitialised `let`,
> a function with no `return`. `null` is what somebody *assigned*. JavaScript never produces a `null`
> on its own; every one in your program was written by you, a library, or a host API.
>
> So the rule I follow is: `undefined` means unset, `null` means deliberately empty. A field the user
> never filled in is `undefined`; a field the user cleared is `null`.
>
> And that's load-bearing rather than cosmetic. In a `PATCH` body, `{ "nickname": null }` means
> delete the nickname, and omitting the key means don't touch it. Flatten both into "missing" and the
> API can't express deletion.

⟵ *"The language produces one, you assign the other" is the mechanism; the `PATCH` example is what
turns it into an answer. Almost everyone defines both correctly and stops — that's the two-year
version of this question.*

> **I:** Would you ban `null` from a codebase, then? Some teams do.

> **You:** Not from the domain layer — I want the two to mean different things there. Where I would
> normalise is at a boundary I don't control: a JSON payload where `null` and a missing key arrive
> interchangeably from a client I can't fix. Pick one on the way in, be consistent inside.
>
> What I wouldn't do is normalise *and* keep a patch API, because those two decisions contradict each
> other.

⟵ *Answering a "would you adopt this practice" question with where it applies and where it breaks is
the shape they're listening for. Absolutes read as inexperience in both directions.*

---

## Minute 3–8 — The prediction

> **I:** What does this print?

```javascript
console.log(null == 0, null >= 0, null > 0, undefined >= 0);
```

> **You:** `false`, `true`, `false`, `false`.
>
> They look inconsistent because they're two different algorithms. `==` has a hard-coded special
> case: `null` and `undefined` are loosely equal to each other and to nothing else, and **no coercion
> is attempted** — that's why `null == 0` and `null == false` are both false.
>
> Relational operators *do* coerce, with `ToNumber`. `Number(null)` is `0`, so `null >= 0` is really
> `0 >= 0` — true — and `null > 0` is `0 > 0` — false.
>
> `undefined` differs on the last one because `Number(undefined)` is `NaN`, and every comparison
> against `NaN` is false. So `undefined >= 0` and `undefined <= 0` are both false.

⟵ *"Different algorithms", both named, is the answer. Getting the four values right and calling it a
quirk banks nothing.*

> **I:** Where would that actually bite you?

> **You:** A range check on a value that might be absent. `if (score >= 0)` passes for a `null` score
> and fails for an `undefined` one — so the same missing-data bug takes two different branches
> depending on which absence you happened to get. And a `null` out of `JSON.parse` is extremely easy
> to get, because that's the only absence JSON can carry.

⟵ *Connecting it to `JSON.parse` is the move. It turns a quiz answer into a thing that has happened
to you.*

---

## Minute 8–13 — The live debug

> **I:** A user reports that setting `retries: 0` doesn't disable retries. Here's the code.

```javascript
function createClient(opts = {}) {
  const config = {
    ...DEFAULTS,
    retries: opts.retries || DEFAULTS.retries,
    timeout: opts.timeout || DEFAULTS.timeout,
    verbose: opts.verbose || DEFAULTS.verbose,
  };
  return new Client(config);
}
```

> **You:** Two bugs, and the second one is worse than the one they reported.
>
> The reported one is `||`. It falls back on any **falsy** value — eight of them — and `0` is one.
> So `retries: 0` becomes `DEFAULTS.retries`. The same line breaks `verbose: false`, which turns an
> opt-out into an opt-in, and it would break `timeout: 0` and any empty-string option. `??` is the
> fix for all three, because it only falls back on `null` and `undefined`.
>
> The second bug is the spread. `retries: opts.retries` **creates the key regardless of what it
> holds**, so even after switching to `??`, if `opts.retries` is absent you'd be writing an explicit
> `undefined` over the spread default — except that here the `??` catches it, so it happens to be
> masked. It won't stay masked: the moment someone adds a field to this object without a fallback,
> that field silently erases its default for every caller who didn't set it.
>
> What I'd actually write is build the override from the keys that are present, or drop the spread
> and take each field through `??` explicitly. Not both patterns in the same object, because they
> disagree about what a missing key means.

⟵ *Finding the reported bug is the entry fee. The scored part is noticing that `{ ...DEFAULTS, k:
opts.k }` is a second, latent bug of a different kind — and saying it's currently masked rather than
absent.*

> **I:** So `??` everywhere?

> **You:** No — I'd say `??` is the right default and `||` still has a correct use. Where falsy
> genuinely means absent for that type, `||` is saying what I mean. A form field or a query
> parameter is the clear case: `""` and "not filled in" are the same thing to the user, so
> `input.value || fallback` is right and `??` would let an empty string through as a real answer.

⟵ *This is the question the round is built around. "Always use `??`" is a rule someone told you;
naming the case where `||` is correct shows you know what each one tests.*

> **I:** One more on that file — `opts = {}` in the signature. Does that cover `createClient(null)`?

> **You:** No. **A default parameter fires only on `undefined`** — `null` is a value, so it goes
> straight through and the first `opts.retries` throws. That's narrower than `??`, which catches
> both, so the signature and the body disagree about what counts as absent. If `null` is a realistic
> input here — and it is, if this ever gets called with something out of `JSON.parse` — the guard has
> to be `opts ?? {}` or a check inside.

⟵ *The default-vs-`??` asymmetry is the sharpest thing in this chapter and almost nobody volunteers
it. Two features added for the same reason with different rules.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me a `merge(defaults, overrides)` for config objects. Deep, one level of nesting is
> enough.

> **You:** Before I write it — the whole difficulty here is that "the caller didn't set this" and
> "the caller set this to nothing" have to be answered, and there are five states to tell apart. So
> the first decision is what an explicit `undefined` in `overrides` means. I'll say it means "not
> provided", so it's ignored, and `null` means "deliberately clear this", so it wins. That matches
> the `PATCH` convention, and it's the decision I'd want written in a comment.

```javascript
const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function merge(defaults, overrides) {
  const out = { ...defaults };

  for (const key of Reflect.ownKeys(overrides)) {
    if (!Object.hasOwn(overrides, key)) continue;

    const next = overrides[key];
    if (next === undefined) continue;              // "not provided" — keep the default

    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(next)
      ? merge(prev, next)                          // both plain objects — recurse
      : next;                                      // null, primitive, array — overwrite
  }

  return out;
}
```

> Four decisions worth calling out:
>
> **`next === undefined` and `continue`, not `??`.** `??` would treat `null` as absent, and I've just
> decided `null` means "clear it". This is the line where the convention lives.
>
> **`typeof v === "object" && v !== null`.** `typeof null` is `"object"`, so the null check isn't
> optional — without it `merge` recurses into `null` and throws. That one line is the `typeof`
> bug showing up in real code.
>
> **`Array.isArray` excluded.** Merging arrays by index is almost never what a config wants —
> `["a"]` over `["a","b","c"]` should give you one element, not three. Replace, don't merge.
>
> **`Reflect.ownKeys` plus `hasOwn`.** Own keys only, so nothing inherited leaks in, and symbols are
> included — a plain `for...in` gives you neither. If the caller passed `Object.create(null)`, this
> still works, which `overrides.hasOwnProperty(k)` wouldn't.

⟵ *Stating the `undefined`-vs-`null` policy before writing a line is the strongest move available
here. The `typeof null` guard and the array exclusion are the two things most candidates miss, and
both produce real bugs rather than style complaints.*

> **I:** What if I want an override to be able to *delete* a key entirely, not set it to null?

> **You:** Then `null` isn't enough — you need a value that can't collide with real data, so a
> sentinel: `export const DELETE = Symbol("delete")`, and `if (next === DELETE) { delete out[key];
> continue; }`.
>
> A symbol rather than a string because a string sentinel is a value someone can legitimately
> configure, and because it survives being passed around without anyone accidentally matching it. It
> won't survive JSON, though — so if these overrides ever arrive over the wire, deletion has to be
> expressed as key-presence instead, which is exactly what `PATCH` does and why it does it.

⟵ *Reaching for a symbol is good; noticing it can't cross a JSON boundary and connecting that back
to why `PATCH` is designed the way it is, is the senior answer.*

> **I:** Any performance concern?

> **You:** One shape to avoid rather than a real cost here. Config merges run once at startup, so
> this is fine. The thing I'd flag in review is `Object.keys(obj).includes(k)` as a presence check
> anywhere hot — I've measured it against `in` on a 50,000-key object: 37 nanoseconds versus 19
> milliseconds, because it materialises the whole key array every call. Both are correct. Fine for a
> ten-key options object, wrong for a cache.

⟵ *The scale caveat, offered against a question that didn't quite ask for it, and correctly scoped
to "not a problem here, but here's where it is". That's the habit, not the number.*

---

## Minute 18–20 — The closer

> **I:** Last thing. What does `?.` protect you from?

> **You:** Exactly one thing: reading a property of `null` or `undefined`. Nothing else.
>
> The part people get wrong is the scope. It short-circuits the **entire remaining chain**, not the
> next access — if `a.b` is null, `a.b?.c.d.e` is `undefined`, no error. So `a?.b?.c?.d` is
> unnecessary, and writing it says you think each `?.` guards its own link. It does stop at a
> parenthesis: `(a.b?.c).d` throws.
>
> And it doesn't make the *result* safe. `a.b?.c + 1` is `NaN`. You've converted a loud failure at
> the read into a quiet one somewhere downstream, which is sometimes a worse trade.

⟵ *"Whole chain" plus "the result isn't safe" is the full-credit answer. The second half is what
separates using the operator from understanding it.*

> **I:** Anything you'd change about how we use it?

> **You:** I'd look for chains like `user?.profile?.settings?.theme?.color`. That's not defensive
> programming, it's four statements that we don't know the shape of our data. I'd ask which one can
> actually be missing — usually one — and make the rest plain accesses, so the next time someone
> restructures that payload we get an exception instead of an `undefined` colour rendering as
> transparent.

⟵ *Ending on a code-review position with a named symptom beats a list of best practices. "An
`undefined` colour rendering as transparent" is the sentence that makes it real.*

---

## The levels table

**"`??` versus `||`?"**

| Level | Answer |
|---|---|
| **2yr** | "`??` only checks null and undefined, `\|\|` checks falsy. Use `??`." |
| **4yr** | "`\|\|` falls back on eight falsy values, `??` on two nullish ones. The gap is `0`, `\"\"`, `false`, `NaN` — all legitimate config values, so `retries: 0` silently becomes the default and `verbose: false` becomes an opt-in." |
| **Senior** | The 4yr answer, plus: "But `\|\|` is correct where falsy genuinely means absent for that type — a form field, where `\"\"` and 'not filled in' are the same thing. And they can't be mixed without parentheses: that's a parse error, not a lint rule, because `(0 ?? 1) \|\| 2` and `0 ?? (1 \|\| 2)` genuinely differ." |

**"`null` vs `undefined`?"**

| Level | Answer |
|---|---|
| **2yr** | "`undefined` means a variable hasn't been assigned; `null` is an empty value you set yourself." |
| **4yr** | "The language produces `undefined` — missing property, missing argument, no return. It never produces `null`; every one was assigned. So `undefined` means unset, `null` means deliberately empty." |
| **Senior** | The 4yr answer, plus where it pays: "In a `PATCH`, `null` means delete the field and an absent key means don't touch it — flatten them and the API can't express deletion. And I'd normalise at boundaries I don't control, but not in the domain layer, because those two decisions contradict each other." |

**"What does `?.` protect you from?"**

| Level | Answer |
|---|---|
| **2yr** | "It stops errors when something is undefined." |
| **4yr** | "Reading a property of null or undefined, and only that. It short-circuits the whole remaining chain, not just the next access — so `a?.b?.c?.d` is unnecessary." |
| **Senior** | The 4yr answer, plus the limits: "It doesn't catch a throwing getter, it stops at a parenthesis, and it doesn't make the result safe — `a.b?.c + 1` is `NaN`, so you've moved a loud failure downstream. Long chains are a signal we don't know our data's shape, not a safety measure." |

---

## The sentences that raise your level most

Said unprompted, each of these is worth more than a correct answer:

1. **"The language produces `undefined`; it never produces `null`."** — the whole of Q1.
2. **"`null` means delete the field, an absent key means don't touch it."** — makes it a design rule.
3. **"`==` special-cases nullish and coerces nothing; `>=` coerces with `ToNumber`."**
4. **"`||` is correct where falsy genuinely means absent for that type."** — the anti-rule answer.
5. **"That's a parse error, not a lint rule."** — about `a ?? b || c`.
6. **"`??=` short-circuits the assignment, so no write happens."**
7. **"A default parameter is `!== undefined`, not `??`."** — the asymmetry nobody volunteers.
8. **"`?.` short-circuits the whole chain, and a parenthesis ends it."**
9. **"It converts a loud failure at the read into a quiet one downstream."**
10. **"Fine for a ten-key options object, wrong for a cache."** — the scale caveat.

---

## Red flags in this round

- **"They're basically the same, just use whichever."** Ends the opener at two years.
- **"Always use `??`."** A rule, not an understanding — and the follow-up is designed to find it.
- **Listing the falsy values wrong.** There are eight; `-0` and `0n` are the ones people forget.
- **Not knowing `a ?? b || c` is a `SyntaxError`.** Guessing a precedence is worse than saying you'd
  parenthesise.
- **`a?.b?.c?.d?.e` written out** as if each link needs its own guard.
- **"`?.` prevents errors."** It prevents exactly one error and creates a downstream `undefined`.
- **Saying a default parameter fires on falsy,** or that it behaves like `??`.
- **Forgetting `v !== null` in a `typeof v === "object"` check.** The `typeof null` bug isn't trivia;
  it's the crash in your merge function.
- **`obj.hasOwnProperty(k)` on data you didn't build.** Use `Object.hasOwn`.
- **"`JSON.stringify` turns `undefined` into `null`"** as a blanket claim — only in arrays.
- **Treating an array hole as `undefined`.** `map` skips one and not the other.
