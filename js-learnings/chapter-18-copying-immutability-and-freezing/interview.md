# Chapter 18 — Interview Questions: Copying, Immutability and Freezing

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack.

Each question gives you **the answer you say** (target time in the heading), what the interviewer
is scoring, the follow-up they will ask next, and the red flags that drop you a level. Written to
be *spoken*.

This topic is examined as a **live-code task** more than any other in the track — "here's an
object, copy it safely" — so the questions below lean toward code you produce on the spot, not
just definitions you recite.

Practise the escalation in `mock.md`. Use `notes.md` the morning of.

---

## Q1 — "What's the difference between a shallow and a deep copy?" · 45s

**Say:**

> A shallow copy duplicates the outer container and copies each property's *value* into it. For a
> primitive that value is the actual data, so it behaves like a real copy. For a nested object or
> array, the value stored *is* a reference — so the copy gets the same pointer the original had,
> and the two "copies" share whatever's nested. A deep copy walks the whole structure and makes an
> independent version of everything, all the way down.
>
> The one-sentence version: shallow copy stops at the first reference; nothing in the language
> walks further unless you ask it to.

**Scored on:** naming *why* it happens — "the value stored is a reference" — rather than just
reciting "shallow copies the top level". The mechanism is what makes the next few questions
answerable instead of memorised.

**They'll push:** *"Give me an example where that bites you."* → `{ ...config }` then mutating
`config.tags` — the caller's array changes, because spread copied the reference to it, not the
array.

**Red flags:** "spread makes a full copy". Confusing shallow copy with `Object.freeze` — different
operations, same "one level" shape, easy to conflate under pressure.

---

## Q2 — Live code: "Copy this object so mutating the copy can never affect the original." · 90s

```javascript
const config = {
  name: "svc",
  retries: 3,
  endpoints: { primary: "a.com", backup: "b.com" },
  tags: ["prod", "eu"],
};
```

**Say, while writing:**

> Spread alone isn't enough — `endpoints` and `tags` are nested, so I need something that goes all
> the way down. If I don't need to preserve identity for cycles or special types, the direct move
> is `structuredClone(config)` — real clone, handles nested objects and arrays natively.
>
> If I were doing this by hand, or on an engine without it: recurse, and stop recursing at
> anything that isn't a plain object or array.

```javascript
function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const key of Object.keys(value)) out[key] = deepClone(value[key]);
  return out;
}
```

> `structuredClone` is what I'd actually ship. I'd reach for the hand-written version only if I
> needed to control the recursion — skip certain keys, or handle a class instance specially, since
> `structuredClone` would silently strip its prototype.

**Scored on:** reaching for `structuredClone` first without being told to, *and* being able to
write the manual recursive version without hesitation — either alone reads as memorised; both
together reads as understood.

**They'll push:** *"What does `structuredClone` do with a `Date` inside `config`? What does the
JSON hack do?"* → `structuredClone` reconstructs a real `Date`. The JSON hack turns it into a
string — `typeof` changes on the way through, silently.

**Red flags:** reaching for `JSON.parse(JSON.stringify(config))` as the *first* answer with no
caveat. It works for this particular object and that's the trap — the interviewer picked a config
shape where it happens to succeed.

---

## Q3 — "Why not just use `JSON.parse(JSON.stringify(x))` for deep clone?" · 60s

**Say:**

> Because it round-trips through text, so anything text can't represent is silently gone, not
> errored. Functions vanish. `undefined` properties vanish. Symbol keys vanish. A `Date` survives
> as a *string* — the type changes and nothing tells you. `NaN` and `Infinity` become `null`. `-0`
> becomes `0`. `Map` and `Set` become `{}`, because they have no enumerable own properties for
> `JSON.stringify` to walk.
>
> And the one failure it doesn't hide: a circular reference throws. Every other failure in that
> list is silent, which is the actual argument against it — not that it fails, but that it fails
> quietly and hands you back something that looks fine.

**Scored on:** the word *silent*, repeated for each case rather than just listed once. Listing the
failures without flagging that they're silent is the two-year answer.

**They'll push:** *"So what do you use instead?"* → `structuredClone` for anything native — it's a
real graph walk, handles cycles, reconstructs `Map`/`Set`/`Date`/`RegExp` as their actual types.

**Red flags:** "it's fine for simple objects" with no list of what "simple" excludes. Not knowing
it throws on a cycle.

---

## Q4 — "What does `structuredClone` do that `JSON.parse(JSON.stringify(x))` can't, and where does
it still fall short?" · 60s

**Say:**

> It's a real clone algorithm — the same one `postMessage` uses to hand data across a worker
> boundary — so it walks the object graph once instead of serialising to text. That's what lets it
> survive a cycle: it keeps a map from source object to its clone, so the second time it reaches an
> object it's already cloned, it reuses that clone instead of recursing forever. The same mechanism
> means aliasing survives too — if two properties pointed at the same object before cloning, they
> point at the same *new* object after.
>
> It still has two real limits. It throws on a function — a closure's captured scope isn't
> something the algorithm can bound and serialise. And it silently demotes a class instance to a
> plain object: it copies the data, reconstructs known built-in types, but has never heard of your
> class, so `instanceof` comes back false and the methods are gone.

**Scored on:** the aliasing/memo-table mechanism, unprompted. Most candidates know "it handles
cycles" as a fact; explaining *how* — via a source-to-clone map — is what shows you understand the
algorithm rather than its marketing description.

**They'll push:** *"How would you clone a class instance and keep its identity?"* → Clone the
plain data, then reconstruct: `Object.assign(new Point(), structuredClone(p))`, or give the class a
static `fromClone` / a custom serialise-then-rehydrate pair if the fields aren't a 1:1 match.

**Red flags:** "structuredClone deep clones anything." Not knowing it throws on functions.

---

## Q5 — "Does `Object.freeze` make an object immutable?" · 75s

The one that separates levels in this chapter.

**Say:**

> Not fully, and there are three separate reasons, not one.
>
> First, it's shallow — same one-level rule as spread. Freezing an object locks its own
> properties; anything nested is an ordinary, mutable object.
>
> Second, it only locks *data properties* — it makes `writable` false. If a property is a
> `Map` or `Set`, freezing the object does nothing to `.set()` or `.add()`, because a `Map`'s
> entries live in an internal slot, not in an enumerable property freeze can find. `Object.freeze(
> config)` where `config.cache` is a `Map` still lets `config.cache.set(...)` run.
>
> Third, if a property is an accessor — a getter/setter pair — freeze can only stop you
> *replacing* the pair. It can't stop the setter from running, because calling a setter is a
> function call, and freeze has no opinion about what a function does when called. So a frozen
> object can still have its data change through its own setter.
>
> So the accurate claim is: `Object.freeze(x)` guarantees `x`'s own data properties can't be
> reassigned. It is not a general immutability guarantee, and treating it as one is where the bugs
> come from.

**Scored on:** producing all three reasons, not just the shallow one. Everyone gets "it's shallow"
right; the `Map`/`Set` gotcha and the accessor gotcha are what separates a senior answer.

**They'll push:** *"Write me a `deepFreeze`."* →

```javascript
function deepFreeze(value, seen = new WeakSet()) {
  const isObj = value !== null && (typeof value === "object" || typeof value === "function");
  if (!isObj || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return value;
}
```

> Needs the `WeakSet` for the same reason Chapter 17's retention code did — a cyclic structure
> would recurse forever without it. And it's worth saying out loud: this *still* doesn't close the
> `Map`/`Set` gap, because it walks properties, and a `Map`'s contents were never reachable that way.

**Red flags:** "yes, freeze makes it immutable" with no caveat. Not knowing about the strict/sloppy
mode difference (Q6). Writing `deepFreeze` without a cycle guard.

---

## Q6 — "I froze an object in a script and the write didn't throw — is freeze broken?" · 45s

**Say:**

> No — check the file's mode. A write to a frozen property throws a `TypeError` in strict mode:
> any ES module, any file with `"use strict"`, any class body. In sloppy mode the identical line
> silently does nothing — the assignment is evaluated, it just doesn't take effect, and there's no
> error to notice.
>
> That's a real trap in a mixed codebase: the same bug reproduces loudly in your test suite if it
> runs as modules and vanishes silently in a quick sloppy-mode repro script, or the reverse. "It's
> frozen, that can't be the bug" is only safe to say once you know which mode is actually running.

**Scored on:** connecting it to real debugging friction, not just reciting the strict/sloppy rule
as trivia.

**They'll push:** *"Why does the spec allow silent failure at all?"* → Sloppy mode predates
`Object.freeze` and was never revisited for it — silent failure on a disallowed write is the same
behaviour sloppy mode has always had for other restricted assignments (assigning to a
non-writable global, for instance). Freeze inherited it rather than getting its own rule.

**Red flags:** "freeze always throws". Not knowing sloppy mode exists as a live option in modern
code (CommonJS scripts still default to it).

---

## Q7 — "Is `const config = {...}` the same as an immutable `config`?" · 45s

**Say:**

> No, and this is one of the most common misreadings in the language. `const` locks the *binding*
> — you can never make `config` point at a different object. It says nothing about the object
> itself. `const arr = []; arr.push(1)` works fine; the array mutated, the binding didn't move.
>
> If you want the object itself to resist mutation you need `Object.freeze`, and even that's
> shallow and has the `Map`/accessor gaps from the last question. `const` and `freeze` solve two
> different problems — one about reassignment, one about mutation — and `const` alone solves
> neither of the ones people usually mean when they reach for it.

**Scored on:** the clean "binding vs value" framing, delivered fast — this should never take the
full 45 seconds if you know it cold.

**They'll push:** *"So what's the actual immutable pattern people want here?"* → `const` plus
`Object.freeze` (or `deepFreeze`) together — locks the reference *and* the referenced data, to the
extent freeze can.

**Red flags:** any answer implying `const` restricts mutation at all.

---

## Q8 — "Why doesn't `Object.freeze` just recurse by default?" · 60s

**Say:**

> Two reasons, and only one of them is about speed.
>
> The cheap one: I measured `Object.freeze` on a 100,000-object tree at 0.04 milliseconds — it's
> touching one object. A hand-written `deepFreeze` on the same tree was 82 milliseconds, because
> it's a full graph walk. Those aren't the same operation, and defaulting to the expensive one
> would make every `freeze` call an unpredictable cost depending on what happens to be reachable
> from the object.
>
> The one people miss: ownership. A deep freeze walks every reference it finds — including one to
> a shared logger, or a cache, or a config object someone else still holds and still needs to
> mutate. Freezing that reaches past the object you were actually given and locks something for
> everyone else holding a piece of it, silently. Shallow-by-default respects the boundary of "the
> object I was handed"; going further is something you opt into once you've checked what's
> actually reachable from there.

**Scored on:** giving *both* reasons, and specifically the ownership one — most candidates only
reach for the performance argument, and the ownership one is the sharper answer because it's true
even on a small object.

**They'll push:** *"Same question for spread not deep-copying — same two reasons?"* → Yes,
symmetrically: cost proportional to the whole tree, and copying reaches into objects you don't own
the same way freezing does. It's the identical trade twice.

**Red flags:** only mentioning performance. Not being able to name the ownership argument even
after the push.

---

## Q9 — "How would you check two objects are deeply equal?" · 60s

**Say:**

> Not with `===` — that's reference equality, it only asks "same pointer", never "same shape", so
> two objects built from identical data are never `===`. The cheap-looking fix, comparing
> `JSON.stringify` output, is neither cheap nor correct: it's `O(n)` same as a real walk, it's wrong
> whenever the two objects had properties inserted in a different order, and it inherits every
> silent failure from the JSON round-trip — two objects differing only in a function property
> would compare equal, because the function vanishes from both sides.
>
> A real `deepEqual` walks both structures together — same keys, recursively equal values — and it
> costs what a deep clone costs, because it's the same graph walk asking a different question.
> There's no shortcut that's both cheap and correct in the general case.

**Scored on:** naming the JSON.stringify approach specifically and explaining *why* it's wrong
(key order), not just "don't do that". That's the part people get tripped by live.

**They'll push:** *"Is there ever a cheap, correct shortcut?"* → Yes — if every update in the
program goes through a copy-on-write path (spread-based path-copying), then `===` on two
references *is* a correct cheap answer to "did this change", because that discipline keeps "same
reference" and "same data" true by construction. It's not a shortcut around the cost, it's a
different program shape that makes the expensive check unnecessary.

**Red flags:** proposing `JSON.stringify` comparison as *the* answer with no caveat. Not knowing
`Object.is` exists (fine not to explain it fully — that's Chapter 19 — but should recognise the name).

---

## Q10 — Live debug: "This reducer mutated state it shouldn't have. Find it." · 90s

```javascript
function reducer(state, action) {
  switch (action.type) {
    case "ADD_TAG": {
      const next = { ...state };
      next.user.tags.push(action.tag);
      return next;
    }
    case "SET_NAME": {
      const next = Object.freeze({ ...state });
      next.user.name = action.name;
      return next;
    }
    default:
      return state;
  }
}
```

**Say:**

> Both branches have the same root cause: `{ ...state }` only copies the top level, and `user` is
> nested, so `next.user` and `state.user` are the same object in both cases.
>
> `ADD_TAG` pushes onto `next.user.tags` — that's `state.user.tags`, the array everyone still
> holding a reference to the old `state` is looking at. It mutated the previous state in place.
>
> `SET_NAME` looks like it should be safer — it even calls `Object.freeze` — but freeze is shallow
> too, so it only locked `next`'s own properties. `next.user` isn't own-property-protected past one
> level, and `next.user.name = action.name` writes straight through to `state.user`, unfrozen,
> because `Object.freeze({ ...state })` never touched `state.user` at all.
>
> Fix: copy every level actually written to. `next.user = { ...state.user, tags: [...state.user.tags,
> action.tag] }` for the first, and the equivalent nested spread for the second — or drop straight
> to `structuredClone(state)` and mutate the clone if the shape's not worth hand-spreading.

**Scored on:** catching that *both* branches share one cause, and specifically explaining why the
`Object.freeze` in the second branch didn't help — that's the part that reads as understanding
rather than pattern-matching "spread bug, add more spreads".

**They'll push:** *"How would you catch this in review before it ships?"* → Any reducer or "pure"
update function that writes through more than one property access (`next.user.tags.push`,
`next.a.b = ...`) is the smell — a real copy-on-write update never has a write more than one level
past the freshest spread.

**Red flags:** fixing only the first branch. Saying `Object.freeze` should have prevented the
second bug without explaining why it didn't.

---

## Q11 — "What would break if `Object.freeze` worked recursively by default?" · 60s

**Say:**

> Take the ownership case from Q8 concretely: a request handler builds a config object that
> includes a reference to the app's shared logger, and freezes the config before handing it to a
> plugin, meaning to lock the plugin's *own* settings. If freeze recursed, it would walk into the
> logger too — an object the handler doesn't own and has no business locking — and freeze it for
> every other part of the program still holding that same logger reference. The bug wouldn't even
> be local to the freeze call; it would show up later, somewhere completely unrelated, as "why can't
> I set the log level any more".
>
> More generally: reachability isn't ownership. Two objects can be reachable from each other
> without either one being "part of" the other — Chapter 17 makes the identical point about memory
> roots. A recursive-by-default freeze conflates the two, and there's no way to un-make that
> mistake afterward, because freeze has no inverse.

**Scored on:** the reachability-is-not-ownership framing, and connecting the irreversibility back
in as the reason the mistake would be unrecoverable rather than just annoying.

**They'll push:** *"Is there language machinery that WOULD know the difference?"* → Not natively.
You'd need something like a `Proxy` that tracks which objects are "inside" a boundary versus merely
referenced across it, or a convention — private fields, a documented ownership boundary — the
language has no automatic answer.

**Red flags:** "nothing would break, deep freeze is strictly safer". Not connecting it to
irreversibility.

---

## Rapid fire

One sentence each.

- **Is spread a deep copy?** No — one level. Nested values are shared references.
- **What does `Object.assign({}, x)` copy?** The same one level as spread. Identical shape.
- **Does `JSON.parse(JSON.stringify(x))` throw on a function?** No — it silently drops it.
- **Does it throw on anything?** Yes — a circular reference.
- **What does `structuredClone` do with a `Date`?** Reconstructs a real `Date`. JSON gives you a string.
- **Does `structuredClone` preserve aliasing?** Yes, within one call — same source clones to same target.
- **Does `structuredClone` clone a class instance faithfully?** No — strips the prototype, becomes a plain object.
- **Is `Object.freeze` recursive?** No.
- **Does freezing an object stop a `Map` inside it from being mutated?** No — `Map` entries aren't properties.
- **Does freezing an object stop an accessor's setter running?** No — that's a function call.
- **Does a frozen write throw?** Only in strict mode. Sloppy mode silently no-ops.
- **Does `const` prevent mutation?** No — it prevents reassigning the binding, nothing else.
- **Can a frozen array be pushed to?** No — push tries to add an index, which is blocked.
- **Is `Object.freeze` reversible?** No. No inverse exists.
- **Why isn't deep freeze the default?** Cost of the whole tree, plus it reaches past objects you don't own.
- **Is `===` a deep-equal check?** No — reference equality only.
- **Is `JSON.stringify` comparison a safe deep-equal?** No — wrong on key order, inherits every JSON failure.
- **What does a real `deepEqual` cost?** The same as a deep clone — a full graph walk.
- **When is `===` a legitimate cheap "did this change" check?** When updates go through copy-on-write, by construction.
- **What's the fast alternative to deep-cloning a big tree on every change?** Path-copying — spread only the route to the change.
