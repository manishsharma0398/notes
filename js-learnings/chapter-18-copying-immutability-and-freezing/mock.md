# Chapter 18 — Mock Interview: Copying, Immutability and Freezing

A realistic 20-minute round on copying and freezing, written as a transcript. **I** is the
interviewer, **You** is the answer that scores. The `⟵` notes say what is being scored.

**Calibrated for:** advanced round, 3.5–4 years, JS/Node full-stack. The escalation is the usual
one: definition → prediction → debug a real failure → build something → what you'd change.

This topic is examined more as **live code** than any other chapter so far — expect to be typing,
not just talking, from minute three onward.

---

## Minute 0–3 — The opener

> **I:** What's the difference between a shallow and a deep copy in JS?

> **You:** A shallow copy — spread, `Object.assign`, `.slice()` — duplicates the outer container
> and copies each property's *value* in. For a primitive that value is the data itself, so it
> behaves like a real copy. For a nested object, the value stored is a reference, so the "copy"
> gets the same pointer the original had. A deep copy walks the whole structure and makes an
> independent version of everything underneath.
>
> One sentence for the whole thing: nothing in the language walks your object graph for you by
> default — copying stops at the first reference unless you go further on purpose.

⟵ *"Stops at the first reference" is the reframe the rest of the round hangs off. An interviewer
who hears it here moves faster through everything that follows.*

> **I:** Does `structuredClone` fix that?

> **You:** For depth, yes — it walks all the way down. It's not a fix for everything, though:
> it throws on a function, and it turns a class instance into a plain object, silently dropping
> the prototype.

⟵ *A fast, correct answer with the caveat attached unprompted. Take it and move on — there's no
more credit sitting in the opener.*

---

## Minute 3–8 — The prediction

> **I:** What does this print, and what's wrong with it?

```javascript
function addDefaultRegion(user) {
  const updated = { ...user };
  updated.settings.regions = updated.settings.regions || [];
  updated.settings.regions.push("default");
  return updated;
}

const user = { name: "a", settings: { theme: "dark", regions: ["eu"] } };
const result = addDefaultRegion(user);

console.log(user.settings.regions);
console.log(result.settings.regions);
console.log(user.settings.regions === result.settings.regions);
```

> **You:** `["eu", "default"]`, `["eu", "default"]`, `true`.
>
> `{ ...user }` only copies `name` and `settings` at the top level. `settings` is a reference, so
> `updated.settings` and `user.settings` are the *same object* — the function reads like it built
> an independent `updated`, but `updated.settings.regions.push` writes straight through to the
> caller's `settings.regions` array. The function's own name is the trap: it reads as "add a
> default", and what it actually does is mutate the argument while also returning something that
> looks like a copy.

⟵ *The level marker: naming that `updated.settings` and `user.settings` are literally the same
object, not just "kind of linked". Saying "spread doesn't deep copy" without following it to the
concrete `===` claim is the two-year version of this answer.*

> **I:** Fix it with one line changed.

> **You:**
> ```javascript
> const updated = { ...user, settings: { ...user.settings } };
> ```
> Now `settings` is its own object too — one more level of spread, one level deeper into the
> object that actually gets mutated. `regions` is still shared at this point, so if two calls both
> `.push`ed onto it you'd still see the shared-array bug — but this fixes the specific mutation
> shown here, which only writes to `settings.regions` as a whole property, not into the array
> itself. If a caller might also push directly into `regions`, that needs its own spread too.

⟵ *Fixing exactly what's shown, then flagging the next layer of the same bug unprompted, is the
senior move — it shows you're reasoning about the general shape, not patching the specific line.*

---

## Minute 8–13 — The live debug

> **I:** This reducer mutated old state. Find both bugs — there are two, and they're not the same
> shape.

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

> **You:** Same root cause, different symptom.
>
> `ADD_TAG`: `{ ...state }` only copies the top level, `user` is nested, so `next.user` is
> `state.user` — the same object. `.push` mutates that shared array. Every other part of the
> program still holding the old `state` sees the tag appear in it too.
>
> `SET_NAME` looks safer because it wraps the spread in `Object.freeze`, and that's the part
> that's actually interesting: freeze is shallow, same as spread. `Object.freeze({ ...state })`
> locks `next`'s own properties — `next.user` can't be *reassigned* — but `next.user` still points
> at `state.user`, which was never frozen at all. `next.user.name = action.name` walks straight
> past the freeze and writes to the original.

⟵ *Catching that both branches share one cause is the pass mark. Explaining precisely why the
`Object.freeze` in the second branch gave no protection — rather than just noting "still buggy" —
is what separates a candidate who pattern-matched from one who traced the reference.*

> **I:** Fix both.

> **You:**
> ```javascript
> case "ADD_TAG": {
>   return {
>     ...state,
>     user: { ...state.user, tags: [...state.user.tags, action.tag] },
>   };
> }
> case "SET_NAME": {
>   return { ...state, user: { ...state.user, name: action.name } };
> }
> ```
> Copy every level you actually write to, and stop as soon as you stop writing — `state.settings`,
> if there is one, doesn't need touching in either branch because nothing in either branch writes
> to it. That's path-copying: the cost is proportional to how deep the change goes, not to the
> size of `state`.

⟵ *"Copy every level you actually write to, stop as soon as you stop writing" is the sentence.
It's also the exact mechanism Part 7 measured — this is where that number would come up if asked.*

> **I:** How would you catch this in review, generally, not just for this file?

> **You:** Any update function where a write happens more than one property access past the
> freshest spread — `next.user.tags.push`, `next.a.b = x` — is the smell. A real copy-on-write
> update never writes further than one level past whatever it most recently spread.

⟵ *A reviewable rule, not just "look harder next time". This is the answer that scales past one
bug.*

---

## Minute 13–18 — The whiteboard

> **I:** Write me a function that updates a value at an arbitrary nested path, immutably — no
> library.

> **You:** `setIn(obj, path, value)`. The mechanism is exactly what we just did by hand in the
> reducer, generalised: spread every object on the route from the root to the target, and share
> everything else untouched.

```javascript
function setIn(obj, path, value) {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  const current = obj?.[key];
  return {
    ...obj,
    [key]: setIn(current ?? {}, rest, value),
  };
}
```

```javascript
const state = { user: { name: "a", settings: { theme: "dark" } }, count: 1 };
const next = setIn(state, ["user", "settings", "theme"], "light");
```

> Three things I'd point out about it. **Only the objects on the path are new** — `next.count` and
> `next.user` are new too, because every level between root and target has to be re-created, but
> anything hanging off `user` that isn't `settings` would be untouched and still `===` to the
> original if there were more siblings. **It doesn't handle arrays specially**, which is a real
> gap — spreading an array with `{ ...arr, [i]: value }` produces an *object* with numeric keys,
> not an array, so a real version needs an `Array.isArray` branch that spreads into `[...arr]` and
> assigns the index. And **it doesn't guard against `path` being empty at the top or against
> `obj` being a primitive partway down** — I'd want those to throw with a clear message rather than
> silently building a nonsense structure.

⟵ *The array gap is the thing most candidates miss live — spreading an array by index without the
`Array.isArray` check is a classic bug in exactly this function, and catching it yourself before
being asked reads very well.*

> **I:** Why not just `structuredClone(state)` then mutate the clone?

> **You:** Correctness-wise that's fine and arguably simpler to read. The reason to reach for
> `setIn` instead is the identity guarantee: `structuredClone` makes a full independent copy, so
> *everything* in the result is a new reference, even branches nothing touched. `setIn` only
> creates new references on the path to the change — so `next.someOtherSlice === state
> .someOtherSlice` stays true, and anything comparing by `===` to decide "did this part change"
> gets a correct, free answer for the untouched branches. `structuredClone` throws that guarantee
> away — everything looks changed by reference even when nothing changed by value.

⟵ *This is the sentence that shows you understand *why* path-copying exists as a technique, not
just that it's the fashionable answer — `structuredClone` isn't wrong, it solves a different
problem.*

---

## Minute 18–20 — The closer

> **I:** If someone asked you to make this whole store deeply immutable, what would you actually
> do, and what would you warn them about?

> **You:** I'd `deepFreeze` it after every update, with a `WeakSet` guard for cycles the same way
> Chapter 17's retention code needed one. And I'd warn them about exactly what it doesn't cover:
> anything in the tree that's a `Map` or a `Set` is still mutable through its own methods, because
> freeze locks properties and a `Map`'s contents aren't properties. And it's not free — on a large
> tree, deep freeze is a full traversal, proportional to the whole structure, not to what changed.
> I measured it once: about two thousand times slower than freezing just the top level on a
> hundred-thousand-object tree. Fine to do once at a boundary; not something to run after every
> single update on a big store.

⟵ *Naming the `Map`/`Set` gap unprompted here, at the closer, after already using it earlier in
the round, shows it's a fact you actually hold rather than one you happened to recall once.*

> **I:** One thing you'd change about how JS handles this?

> **You:** I wouldn't change `Object.freeze` being shallow — that's the right default for the
> reason we already covered: going deep by default means reaching past objects the caller doesn't
> own. What I'd actually want is a native `deepFreeze` and a native `deepEqual` in the standard
> library, because both are five-line functions everybody ends up writing slightly differently,
> and neither one's *correctness* is in question — it's genuinely just missing convenience, not a
> design gap the way un-recursive freeze is.

⟵ *Distinguishing "this is a deliberate design trade I wouldn't touch" from "this is just a
missing convenience" is the strongest way to close — it shows you can tell the two apart, which is
exactly what the whole round has been testing.*

---

## The scoring sheet

| Question | 2-year answer | 4-year answer | Senior answer |
|---|---|---|---|
| Shallow vs deep copy | "shallow copies less" | "shallow copies one level" | "…because the value stored for a nested property IS a reference" |
| The prediction | "spread doesn't work right" | names `updated.settings === user.settings` | fixes it, then flags the next layer (`regions`) unprompted |
| The reducer debug | finds the `ADD_TAG` bug | finds both bugs | explains precisely why `Object.freeze` gave zero protection in `SET_NAME` |
| Fixing the reducer | spreads everything defensively | copies exactly what's written to | names it as path-copying and its cost model |
| `setIn` | works for objects only, doesn't say so | works for objects, flags the array gap | flags the array gap AND the empty-path/primitive-path edge cases unprompted |
| `structuredClone` vs `setIn` | "structuredClone is easier" | "setIn only touches the path" | "…so untouched branches stay `===`, which `structuredClone` throws away" |
| Deep freeze | "freeze it" | "deepFreeze with a cycle guard" | + names the `Map`/`Set` gap and the traversal cost, unprompted |
| One thing to change | "freeze should be deep by default" | "nothing, it's fine" | keeps freeze shallow on purpose, wants `deepFreeze`/`deepEqual` as *convenience*, not a redesign |

**The sentences that raise your level most:**

- "The value stored for a nested property is a reference — that's the whole mechanism."
- "Copy every level you actually write to, and stop as soon as you stop writing."
  *(names path-copying without being told the term)*
- "Freeze is shallow, same rule as spread — it locked `next`, not `next.user`."
- "A `Map`'s contents aren't properties, so freezing the object around it does nothing to `.set()`."
- "`structuredClone` throws away the identity of everything that didn't change."
- "Reachable isn't the same as owned — that's why deep-by-default would be wrong, not just slow."

**Red flags — each of these visibly drops you a level:**

- "Spread makes a full copy." → One level, full stop.
- Reaching for `JSON.parse(JSON.stringify(x))` as the default deep clone with no caveat.
- "`Object.freeze` makes it immutable." → Shallow, plus the `Map`/accessor gaps.
- Fixing only one branch of the two-branch reducer bug.
- Claiming `Object.freeze({ ...state })` protects `state.user` in any way.
- "`const` prevents mutation."
- `setIn` presented as array-safe with no acknowledgment of the object-key bug.
- Proposing deep-by-default freeze as a strict improvement with no downside named.

---

## Drill it

Say these out loud, timed, until they're boring:

```
[ ] shallow vs deep, "stops at the first reference"          (45s)
[ ] the nested-mutation prediction, both blanks + the fix    (90s)
[ ] the two-branch reducer debug, both bugs, both fixes       (90s)
[ ] why Object.freeze({...state}) didn't protect state.user  (45s)
[ ] setIn from scratch, then name the array gap yourself      (8 min)
[ ] setIn vs structuredClone — the identity argument          (45s)
[ ] deepFreeze from scratch, with the WeakSet guard            (3 min)
[ ] the Map/Set freeze gap, unprompted                         (30s)
[ ] deep clone/freeze cost vs path-copying — the ~120x number (45s)
[ ] one thing you'd change, one you wouldn't                   (60s)
```
