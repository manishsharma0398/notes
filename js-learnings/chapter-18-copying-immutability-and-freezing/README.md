# Chapter 18 — Copying, Immutability and Freezing

Why `{ ...config }` is not a copy of `config`, what `structuredClone` actually promises over the
`JSON.parse(JSON.stringify(x))` hack, how far `Object.freeze` really reaches, and why none of
these ever walk your whole object graph unless you make them.

Chapter 17 asked *"who points at this, and how long does that live?"* to explain leaks. This
chapter asks the same question to explain a different bug: *"who else points at this, and did I
mean to let them?"* Both chapters are about references outliving your mental model of them — one
keeps memory alive by accident, this one lets mutation travel by accident.

> **Read this box first.** Six facts.
>
> 1. **Every copy operation in JS stops at one level.** Spread, `Object.assign`, `.slice()`,
>    `Array.from` all copy the outer container and re-point every property at the *same* nested
>    values the original had. Nothing walks the graph unless you tell it to.
> 2. **`JSON.parse(JSON.stringify(x))` round-trips through text**, so anything text can't
>    represent is silently gone: functions, `undefined`, symbol keys, `Map`/`Set`/`RegExp`
>    contents, `NaN`/`Infinity` (→ `null`), `-0` (→ `0`). It also throws on a cycle.
> 3. **`structuredClone` is a real clone algorithm**, not a text round-trip. It handles cycles and
>    preserves shared references *within one clone call* — but it throws on a function, and
>    silently demotes a class instance to a plain object.
> 4. **`Object.freeze` is shallow, by the same rule as fact 1**, and it locks *data properties*
>    only: a `Map` or `Set` inside a frozen object is still fully mutable through its methods, and
>    an accessor property's setter still runs.
> 5. **`const` freezes a binding, not a value.** A `const` array is still `.push()`-able.
> 6. **Deep clone and deep freeze both cost time proportional to the whole tree**, because both
>    have to visit every node. Changing one leaf and copying only the path to it is ~120x cheaper
>    on a 100k-object tree, and it's the same mechanism every "only re-render what changed" system
>    is built on.

---

## How this chapter is examined

The "what's the difference between shallow and deep copy" question is the warm-up. The round is
decided on the live-code task — you are handed an object, asked to copy it safely, and the
interviewer watches whether you reach for the shallow idiom out of habit or reason about what's
actually nested. **The moment you say "structuredClone" without being asked, you've signalled you
know the modern answer; the moment you can also say what it doesn't cover, you've signalled you've
used it.**

| Asked directly, almost every time | Read for mechanism, rarely asked alone |
|---|---|
| "What's the difference between shallow and deep copy?" (Parts 1–2) | The structured clone algorithm's memo table (Part 3) |
| "Live-code: copy this object so mutating the copy is safe" (Parts 2–3) | `Reflect.ownKeys` vs `Object.keys` in a deep-freeze recipe (Part 4) |
| "What does `Object.freeze` actually freeze?" (Part 4) | Accessor-property freeze semantics (Part 4) |
| "Is `const` the same as immutable?" (Part 5) | `Object.seal` / `preventExtensions` distinctions (Part 4) |
| "Why doesn't `Object.freeze` recurse?" (Parts 4, 7) | `Object.is` vs `===` on `NaN`/`-0` (Part 6) |
| *"This state update mutated something it shouldn't have. Find it."* (Parts 2, 7) | |
| "How would you deep-clone an object without a library?" (Part 3) | |

**The spoken answers, timed, are in `interview.md`. The 20-minute round is in `mock.md`.**

Every number and output block in this file came from the files in `examples/`, on Node 22.17.1.

---

## The model

One sentence, and the rest of the chapter is what follows from it:

> **Nothing in JavaScript walks your object graph for you. Copying stops at the first reference.
> Freezing stops at the first reference. Equality stops at the first reference. Depth is always
> something you ask for — never something you get by default.**

```
   const original = { count: 1, nested: { count: 1 } };
   const spread    = { ...original };

        original                         spread
      ┌──────────┐                    ┌──────────┐
      │ count: 1 │                    │ count: 2 │   ← a NEW binding. diverged.
      │ nested ──┼───┐            ┌───┼── nested │   ← the SAME binding. shared.
      └──────────┘   │            │   └──────────┘
                      ▼            ▼
                    ┌──────────────────┐
                    │  { count: 1 }    │   ← one object. write through either
                    └──────────────────┘      name and both "copies" see it.
```

Every idiom in this chapter is a position on that one axis — how many levels of "first reference"
it's willing to walk past before it stops:

| Depth walked | Operations |
|---|---|
| **Zero** — the reference itself | `const b = a;` — not a copy at all, a second name |
| **One level** | spread, `Object.assign`, `.slice()`, `Array.from`, `Object.freeze`, `Object.seal`, `===` |
| **All of it, but only what text can hold** | `JSON.parse(JSON.stringify(x))` |
| **All of it, faithfully, with limits** | `structuredClone`, a hand-written `deepFreeze` / `deepEqual` |

**Nothing here is a bug in the language.** Walking one level is nearly free; walking everything is
proportional to the size of the tree (Part 7 measures it: ~120x for a copy, ~2000x for a freeze,
on a 100k-node tree). The language defaults to the cheap operation and makes the expensive one
something you opt into on purpose — the identical trade Chapter 17 made for allocation itself.

---

## Part 1 — Primitives copy, references alias

`examples/01_shallow_vs_reference.js`:

```
1. primitive: a = 10  b = 11  (a is untouched)
2. reference: obj1.n = 11  obj2.n = 11  (same object, obj1 === obj2: true )
```

This is Chapter 7's distinction, and it's the whole chapter compressed to two lines. `b = a` on a
primitive duplicates a *value* — there are now two independent 10s, and nothing you do to `b`
reaches `a`. `obj2 = obj1` duplicates a *reference* — there is still exactly one object, and `obj1`
and `obj2` are two names for it. `obj2.n += 1` doesn't write through a copy, it writes through one
of two names for the same storage.

**Every "copy" idiom in this chapter is built out of assignment**, so every one of them inherits
this fact at whatever level it stops walking. That's the whole mechanism — there is no separate
"copy" operation in the language more primitive than "assign a value", and assigning an object
value has only ever meant one thing: copy the pointer.

---

## Part 2 — Shallow copy: exactly one level, no further

Same file, continued:

```
3. spread, top level diverged:      original.count = 1  spread.count = 2
   spread, nested level shared:      original.nested.count = 2  spread.nested.count = 2
   original.nested === spread.nested: true
4. [...arr][0] is the SAME object as arr[0]: true
   four idioms, four different top-level arrays, same nested objects: true true true true — but true true true true
```

`{ ...original }` creates a *new outer object* and, for each property, copies whatever value was
stored there. For `count: 1`, the value is a primitive, so the new object gets its own `1` — this
is Part 1's primitive case, and it's why `spread.count += 1` doesn't touch `original`. For
`nested: {...}`, the value stored is a reference, and copying a reference is Part 1's other case:
`spread.nested` and `original.nested` are two names for the same object.

**`Object.assign({}, x)`, `x.slice()`, `Array.from(x)` and `[...x]` are the identical operation
with different syntax.** All four allocate a new top-level container and copy each property's
*value* into it — and for a nested object or array, the value stored *is* the reference.

The bug in the form it actually ships in:

```javascript
function withDefaultTags(config) {
  const merged = { ...config };        // "I copied it, it's safe to mutate"
  merged.tags = merged.tags || [];
  merged.tags.push("default");         // mutates the CALLER's array
  return merged;
}
```

```
5. caller's array, mutated through a 'copy': [ 'prod', 'default' ]
   result.tags === callerConfig.tags: true
```

The `{ ...config }` line reads as "now I have my own copy, I can do what I want with it" — and for
every top-level primitive field that's true. `tags` is not a top-level primitive field; it's a
reference, spread copied the reference, and `.push` mutated the one array both objects point at.

**The sentence to say:** *shallow copy doesn't mean "copies the shallow parts and skips the deep
ones" — it means "copies exactly one level and aliases everything below it".*

---

## Part 3 — Deep copy: the JSON hack, and what replaced it

`examples/02_deep_clone_json_vs_structured.js`. Same object, both approaches:

```
1. JSON.parse(JSON.stringify(weird)):
   {"date":"2020-01-01T00:00:00.000Z","nan":null,"inf":null,"negZero":0,"map":{},"set":{},"regex":{},"arrayWithHole":[1,null,3],"kept":"survives"}
```

Read that output against the input object, which had `fn`, `undef`, a symbol key, `date`, `nan`,
`inf`, `negZero`, `map`, `set`, `regex`, and `arrayWithHole`. **The failure catalog:**

| Input | Round-trips as | Silent? |
|---|---|---|
| function | *gone* — the key doesn't exist in the output | yes |
| `undefined` (object property) | *gone* — the key doesn't exist | yes |
| symbol key | *gone* — never visited | yes |
| `undefined` (array element) | `null` — arrays can't skip a slot | yes |
| `Date` | a **string**, not a `Date` | yes — `typeof` changes |
| `NaN`, `Infinity` | `null` | yes |
| `-0` | `0` | yes |
| `Map`, `Set` | `{}` — no enumerable own properties to walk | yes |
| `RegExp` | `{}` | yes |
| a cycle | **throws** `TypeError: Converting circular structure to JSON` | no — at least this one tells you |

Every row except the last one is silent. That is the actual case against the JSON hack: it isn't
that it fails, it's that most of its failures produce a plausible-looking object with no error.

### `structuredClone` — a real clone algorithm, not a text round-trip

```
3. structuredClone handles the cycle. clone.self === clone: true
4. structuredClone preserves type: true true true true true
   regex source/flags survive: x gi
5. structuredClone on a function throws: DOMException - () => 1 could not be cloned.
6. structuredClone of a class instance: { x: 3, y: 4 }
   pClone instanceof Point: false  pClone.dist is a function: false
```

`structuredClone` implements the [structured clone
algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
— the same one `postMessage` uses to hand data to a worker. It walks the object graph once,
reconstructing `Map`, `Set`, `Date`, `RegExp`, typed arrays and `ArrayBuffer` as their real types,
and it survives a cycle because it is a graph walk, not a serialisation to text.

**It still has two hard limits, and both are structural, not oversights:**

- **Functions throw.** A closure's captured scope is Chapter 17's shared context object — cloning
  a function would mean cloning the graph reachable from that context, which can include the
  module's top-level scope, open sockets, timers. The algorithm has no way to know where that
  graph ends, so it refuses rather than clone something unbounded.
- **Class instances lose their prototype.** The algorithm copies own data properties and
  reconstructs *known* built-in types. It has never heard of `Point`, so the clone is a plain
  object with `x` and `y` and no `dist` method — `instanceof Point` is `false`. This is the trap in
  a live-code round: `structuredClone(someClassInstance)` compiles, runs, and quietly hands back
  something that is not the type you had.

### The fact both hacks obscure: aliasing

```
7. JSON round trip: state.a === state.b was true. clone.a === clone.b: false
   structuredClone (same call):        clone.a === clone.b: true
   but clone.a is a NEW object, not the original: false
```

`state.a` and `state.b` pointed at the *same* object before cloning. The JSON round-trip visits
each property independently and produces two separate plain objects — the aliasing is gone.
`structuredClone` keeps a map from "source object already cloned" to "here is its clone", so the
same source object encountered twice in one call produces the *same* clone both times — the
aliasing survives, just now pointing at a new object instead of the original. That memo table is
exactly the mechanism that makes cycles survive, too: a cycle is just aliasing where the second
encounter is the object currently being cloned.

**The sentence to say:** *`structuredClone` clones the graph's shape, not just its values —
`JSON.stringify` clones values and throws the shape away.*

---

## Part 4 — Freeze, seal, preventExtensions: three depths of "no"

`examples/03_freeze_seal_prevent_extensions.js` and `examples/04_freeze_gotchas.js`.

### The three levels

| | blocks adding | blocks deleting/reconfiguring | blocks writing existing values |
|---|---|---|---|
| `Object.preventExtensions` | ✓ | | |
| `Object.seal` | ✓ | ✓ | |
| `Object.freeze` | ✓ | ✓ | ✓ |

```
8. seal blocks adding a property: TypeError
9. seal blocks deleting a property: TypeError
   seal still allows changing an existing value: sealed.a = 2
10. preventExtensions blocks adding a property: TypeError
    preventExtensions allows delete and write. result: {}
```

Each level is strictly the one below it plus one more restriction. None of them is recursive —
all three stop at the object you passed in, for the same reason spread does.

### freeze: the mechanics people get wrong

```
1. Object.freeze returns the same reference: true
2. freeze is shallow: shallow.nested.b = 99 (the write succeeded)
3. strict-mode write to a frozen own property throws: TypeError
6. push on a frozen array throws: TypeError - Cannot add property 3, object is not extensible
11. re-freezing an already-frozen object: no error. isFrozen: true
12. Object.freeze(5) returns: 5  Object.isFrozen(5): true
```

- **`Object.freeze` mutates in place and returns the same object.** It is not `Object.frozen(x)`
  producing a new frozen copy — there is no copy involved anywhere in this operation.
- **A frozen array can't `push`** — pushing adds an index, and freeze forbids adding properties —
  and can't have an existing index reassigned either.
- **Freeze is idempotent**, and `Object.isFrozen` tells you where you stand.
- **Primitives are always "frozen".** There was never a reference to lock, so
  `Object.isFrozen(5)` is `true` by definition and `Object.freeze(5)` is a no-op that returns `5`.

### Strict mode is not cosmetic here

`examples/04_freeze_gotchas.js`, run without `"use strict"` at the top of the file:

```
1. sloppy mode, write to frozen prop: no error, value is 1
   this is the trap: the exact same line throws in strict mode (see example 03, case 3)
```

Same line, two behaviours. Strict mode — any ES module, any file with `"use strict"`, any class
body — throws a `TypeError` the moment you write to a frozen property. Sloppy mode swallows it and
the value simply doesn't change. **"It's frozen, that can't be the bug" is only safe to say once
you know which mode the file that's misbehaving actually runs in.**

### The Map/Set gotcha — freeze locks properties, not internal state

```
3. Object.freeze(map), then map.set/delete: [ [ 'b', 2 ] ]
   Object.freeze(set), then set.add: [ 1, 2, 3 ]
6. deepFreeze(obj) where obj holds a Map — map is still mutable: [ [ 'level', 'trace' ] ]
```

A `Map`'s entries live in an internal slot the spec calls `[[MapData]]`, mutated by calling
`.set()`/`.delete()` — not by assigning a property. `Object.freeze` locks *own properties*: it
makes `writable: false` on data properties it finds by enumerating keys. A `Map` has no enumerable
properties holding its entries, so freezing the `Map` object touches nothing that
`.set` and `.delete` actually use. **`deepFreeze` doesn't close this gap either** — it walks
*properties*, and a `Map`'s contents were never reachable that way.

### The accessor loophole

```
13. frozen object, but the setter still ran. backingStore = 999   obj.value reads: 999
```

Freezing a data property sets `writable: false`. An accessor property (`get`/`set`) has no
`writable` slot — freeze can only set `configurable: false` on it, which stops you *replacing* the
getter/setter pair. It says nothing about what the setter *does* when called, because calling a
setter is a function call, exactly like calling `.set()` on a `Map`. **`Object.freeze(obj)`
guarantees `obj`'s own data properties can't change value. It does not guarantee `obj` is
immutable** — those are the same claim only when every property is a plain data property.

### `const` is not this chapter

```javascript
const arr = [1, 2, 3];
arr.push(4);   // allowed
```

```
2. const array, still mutable via push: [ 1, 2, 3, 4 ]
   reassigning a const binding throws: TypeError
```

`const` is a Chapter 3 fact wearing this chapter's clothes: it freezes the *binding* — you cannot
make `arr` point at a different array — and says nothing about the array itself. `const` and
`Object.freeze` solve different problems and people reach for the wrong one constantly: `const
config = {...}` reads like "config can't change" and guarantees nothing of the sort.

---

## Part 5 — Equality is the same walk, seen from the other side

`examples/05_equality.js`:

```
1. structurally identical objects, ===: false
2. same data, different key order. JSON.stringify(x) === JSON.stringify(y): false
3. a real deepEqual, order-independent: true
```

`===` on objects is reference equality — it answers "is this the same pointer", never "does this
have the same shape". Two objects built from identical data are never `===`. The instinctive cheap
fix, comparing `JSON.stringify` output, inherits Part 3's whole failure catalog *and* is sensitive
to key insertion order, which carries no meaning at all. **A real `deepEqual` has to walk both
structures**, which means it costs time proportional to size — same as a deep clone, because it's
the same graph walk asking a different question.

```
4. NaN === NaN: false    Object.is(NaN, NaN): true
5. -0 === 0: true    Object.is(-0, 0): false
```

`Object.is` is `===` with those two cases patched — worth knowing exists here, covered properly
(with the IEEE-754 mechanism behind both) in Chapter 19.

**The one legitimate shortcut:** if every update in your program goes through a copy-on-write path
— Part 7's structural sharing — then `===` on two references *is* a correct, cheap answer to "did
this change", because a copy-on-write discipline keeps "same reference" and "same data" true by
construction. That's not a coincidence; it's the entire reason the discipline is worth adopting.

---

## Part 6 — What JavaScript cannot do, and why

**1. Nothing copies deeply by default, and nothing freezes deeply by default.** There is no
`Object.deepCopy` or `Object.deepFreeze` in the language. You get a one-level primitive and build
depth yourself, on purpose, every time.

**2. You cannot clone a function.** `structuredClone` throws rather than attempt it. Chapter 17
already explains why: a function's identity includes the context object it closes over, and that
context can point at anything reachable in its scope — there is no principled place to stop
without a rule as arbitrary as "everything" or "nothing".

**3. You cannot make a `Map` or `Set` read-only.** `Object.freeze` has no effect on `[[MapData]]`,
and there is no `ReadonlyMap` in the language. The only way to get one is a wrapper that doesn't
expose the mutating methods, or a `Proxy` that intercepts them.

**4. You cannot un-freeze an object.** `Object.freeze` has no inverse. Once `writable` and
`configurable` are `false` on a property, nothing — not even a `Proxy`, not even native code — can
set them back to `true`. It is the one genuinely irreversible operation in this chapter.

**5. The language has no persistent (structurally-shared) data structure as a primitive.** Chapter
8's languages with immutable-by-default data — Clojure, Elm — give you data structures that share
unchanged structure between versions efficiently, as the *only* way to hold data. JS has none of
that built in; Part 7's path-copying is the same idea, hand-rolled, one call site at a time.

### What would break if these worked differently

If `Object.freeze` walked the whole graph by default, it would freeze past the object you were
actually given — a config object holding a reference to a shared logger would freeze the logger
for every other holder of it, silently, because freeze cannot tell "part of this object's own
tree" from "something this object merely points at". **Shallow-by-default is what lets an
operation respect the boundary of the object you were handed** without knowing anything about who
else might be holding pieces of it. The same argument holds for a hypothetical deep spread: it
would reach past ownership boundaries no one asked it to cross.

And if freezing were reversible, it would stop being a guarantee. Code that received a frozen
object and relied on it staying that way — caching a value keyed on "this won't change", handing
it across a module boundary as a documented invariant — would be reasoning about something that
could be true one line and false the next. **Irreversibility is what makes freeze a promise
instead of a suggestion.**

---

## Part 7 — The scale caveat: deep operations cost the whole tree

`examples/06_scale_structural_sharing.js` — a 20-slice, 5,000-item-per-slice store, 100,000 entity
objects, changing one field of one item:

```
1. structuredClone(whole store)                        139.69 ms
2. JSON.parse(JSON.stringify(store))                    69.25 ms
3. path-copy: spread store -> slice -> items -> item     1.14 ms

4. an UNTOUCHED sibling slice is the exact same object: true
5. an UNTOUCHED item in the TOUCHED slice is the exact same object: true
6. the CHANGED item is a new object: true
7. the ORIGINAL is untouched: item10

8. Object.freeze(store) — top level only                 0.04 ms
9. deepFreeze(store) — full traversal                   82.14 ms
```

**~120x for the copy, ~2,000x for the freeze**, on the same tree, for a change that touched one
value. Deep clone and deep freeze both have a cost proportional to the *whole structure*, because
both are a full graph walk — that cost doesn't care how much of the tree actually changed.

**Path-copying — spreading only the objects on the route from the root to the change — pays for
the *depth* of the change, not the size of the store**, and it reuses everything off that path by
reference. Line 4 and 5 aren't a speed claim, they're the actual proof: the untouched slice and the
untouched sibling item are the *same objects*, not equal copies of them.

This is the mechanism, stated with no framework attached, behind every "only re-render what
changed" system: if an update always produces a new reference for anything that changed and
*reuses* the old reference for anything that didn't, then `===` on a branch is a correct, O(1)
answer to "did anything under here change" — without walking it. **Fine for a handful of fields
you update by hand; the moment updates are frequent or the tree is large, reach for path-copying on
purpose rather than deep-cloning out of caution** — deep-cloning "to be safe" is the two-year
instinct, and it is the one two orders of magnitude slower on exactly the trees where it matters.

---

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| A function mutates its input despite `{ ...arg }` at the top | Nested value — spread only copied the top level (Part 2) |
| A cloned object round-trips through an API and a `Date` becomes a string | `JSON.stringify` — dates aren't representable in JSON (Part 3) |
| `structuredClone(x)` throws `DataCloneError`/`DOMException` | `x` contains a function somewhere in its graph (Part 3) |
| A cloned class instance fails `instanceof` or is missing its methods | `structuredClone` strips the prototype (Part 3) |
| "It's frozen, this can't be the bug" — and it was | Sloppy-mode file: the write silently no-oped instead of throwing (Part 4) |
| A frozen config object's cache/log level still changes at runtime | The mutated part is a `Map`/`Set`, not a data property (Part 4) |
| A frozen object's derived value still updates | An accessor's setter ran — freeze didn't stop the function call (Part 4) |
| `const state = {...}` and a reviewer assumes it can't change | `const` locks the binding, not the object (Part 4) |
| A deep-equal check returns `false` for what looks like identical data | Key insertion order, if it's a `JSON.stringify` comparison (Part 5) |
| A state-update path is slow and gets slower as the app grows | Deep-cloning the whole tree on every change instead of path-copying (Part 7) |

---

## Common misconceptions

| What people think | What's actually true |
|---|---|
| `{ ...obj }` is a copy of `obj` | It's a copy of the top level. Every nested object/array is shared. |
| `Array.prototype.slice()` deep-copies an array | Same as spread — one level. |
| `JSON.parse(JSON.stringify(x))` is a safe deep clone | Silently drops functions, `undefined`, symbols; mangles `Date`/`NaN`/`-0`; throws on cycles. |
| `structuredClone` is a drop-in deep clone for anything | Throws on functions; strips the prototype from class instances. |
| `Object.freeze` makes an object fully immutable | It's shallow, and it doesn't touch `Map`/`Set` internals or accessor setters. |
| `const obj = {}` means `obj` can't change | `const` locks the binding. The object is exactly as mutable as before. |
| A frozen array can still be pushed to, just not reassigned | `push` also throws — it tries to add an index. |
| Comparing `JSON.stringify(a) === JSON.stringify(b)` is a safe deep-equal | Wrong on key order, and inherits every `JSON.stringify` failure. |
| `===` on two objects checks their contents | It checks identity. Two objects with identical data are never `===`. |
| Deep cloning "to be safe" has no real cost | Proportional to the whole tree — ~120x slower than path-copying at 100k objects. |
| `Object.freeze` can be undone if you change your mind | It cannot. No inverse exists. |

---

## Rules worth keeping

1. **Spread/assign/slice copy one level. Ask what's nested before you rely on "I copied it".**
2. **Reach for `structuredClone` over the JSON hack** — but know its two limits: no functions, no
   class identity.
3. **`Object.freeze` protects data properties on the object you called it on, and nothing else** —
   not nested objects, not a `Map`/`Set`'s contents, not what an accessor's setter does.
4. **`const` is about the binding. `Object.freeze` is about the value. Neither substitutes for
   the other.**
5. **Check strict mode before trusting "it's frozen, it can't have changed".** Sloppy mode fails
   silently on the identical line that throws under strict.
6. **A deep-equal check costs what a deep clone costs.** There is no cheap correct shortcut;
   `JSON.stringify` comparison is neither cheap nor correct.
7. **Deep clone and deep freeze cost the whole tree, every time.** Reach for path-copying — copy
   only what's on the route to the change — once the tree is large or the change is frequent.
8. **Freezing is irreversible.** Treat it as a promise you're making about the object's future, not
   a toggle.

---

## Where to go next

- `notes.md` — condensed, for revision
- `interview.md` — the questions with timed spoken answers and the rapid-fire bank
- `mock.md` — a full 20-minute round as a transcript
- `examples/` — six runnable files; `06_scale_structural_sharing.js` is the one with the numbers
  worth remembering
- `exercises/chapter_exercise.md` — prediction programs, then primitives to build
- `exercises/cumulative_exercise.md` — an immutable, structurally-shared store, benchmarked against
  a naive one

Chapter 19 is numeric edge cases: why `0.1 + 0.2` isn't `0.3`, why `NaN` isn't equal to itself,
the two zeros, and what to actually do about money.
