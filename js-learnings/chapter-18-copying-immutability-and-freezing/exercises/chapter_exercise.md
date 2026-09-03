# Chapter 18 — Chapter Exercise: Copying, Immutability and Freezing

**Time:** 30–60 minutes. **Scope:** this chapter only.
**Worksheet:** `solution/chapter_exercise_worksheet.md` — every question duplicated with a blank
answer block underneath. Work there.

**Predict before you run.** A prediction you checked first is worth nothing. For every answer,
name the **rule** — "one level, then a shared reference", "text can't represent it", "aliasing
preserved within one clone", "locks the property, not the internal slot", "binding, not value",
"setter still ran", "the whole tree, every time".

Plain `node file.js` is enough for everything here — no flags needed this chapter.

---

## Program 1 — Shallow copy

### A · the top level vs the nested level

```javascript
const original = { count: 1, tags: ["a"] };
const copy = { ...original };
copy.count = 99;
copy.tags.push("b");
console.log(original.count, copy.count);
console.log(original.tags, copy.tags);
```

*Both console.log lines — predict exactly, then say why the two properties behaved differently
using **one sentence about what's stored where**.*

### B · array of objects

```javascript
const arr = [{ n: 1 }, { n: 2 }];
const shallow = arr.slice();
shallow[0].n = 99;
shallow.push({ n: 3 });
console.log(arr.length, shallow.length);
console.log(arr[0].n);
```

*Predict all three lines. Which change reached `arr` and which didn't — and why does `.push` on
`shallow` NOT reach `arr`, when `shallow[0].n = 99` did?*

### C · Object.assign returns what?

```javascript
const target = { a: 1 };
const result = Object.assign(target, { b: 2 });
console.log(result === target);
console.log(target);
```

*Predict both lines. This one has a different answer from spread — say what, precisely, is
different about what `Object.assign` returns.*

### D · the function that "copies" its argument

```javascript
function normalise(input) {
  const out = { ...input };
  out.meta = out.meta || {};
  out.meta.normalised = true;
  return out;
}
const a = { meta: { source: "api" } };
const b = normalise(a);
console.log(a.meta.normalised);
```

*Predict. Then rewrite `normalise` so this prints `undefined` — one line changed.*

---

## Program 2 — Freeze, seal, preventExtensions

### E · shallow freeze

```javascript
"use strict";
const obj = Object.freeze({ a: 1, nested: { b: 1 } });
obj.nested.b = 99;
try { obj.a = 99; } catch (e) { console.log(e.constructor.name); }
console.log(obj.nested.b, obj.a);
```

*Predict every line, including whether the `catch` fires.*

### F · sloppy mode, same object

```javascript
// NOT "use strict" for this one — top of a plain script
const obj = Object.freeze({ a: 1 });
obj.a = 99;
console.log(obj.a);
```

*Predict. State the one-word difference between this file and E that changes the outcome.*

### G · freeze and a Map

```javascript
"use strict";
const state = Object.freeze({ cache: new Map([["k", 1]]) });
state.cache.set("k", 2);
try { state.cache = new Map(); } catch (e) { console.log(e.constructor.name); }
console.log(state.cache.get("k"));
```

*Predict both lines. One of the two operations on `state.cache` is blocked and one isn't — say
precisely why freeze treats them differently.*

### H · seal vs freeze

```javascript
"use strict";
const sealed = Object.seal({ a: 1 });
sealed.a = 2;
try { sealed.b = 1; } catch (e) { console.log("seal:", e.constructor.name); }

const frozen = Object.freeze({ a: 1 });
try { frozen.a = 2; } catch (e) { console.log("freeze:", e.constructor.name); }
```

*Predict both `console.log` lines. Name the one capability seal has that freeze doesn't.*

### I · const is not this chapter

```javascript
const arr = Object.freeze([1, 2, 3]);
try { arr.push(4); } catch (e) { console.log(e.constructor.name, "-", e.message); }

const arr2 = [1, 2, 3];
try { arr2 = []; } catch (e) { console.log(e.constructor.name); }
```

*Predict both. These are two DIFFERENT restrictions being violated — name each one in one phrase.*

---

## Program 3 — Deep copy

### J · the JSON hack's silent failures

```javascript
const input = {
  handler: () => 1,
  when: undefined,
  count: NaN,
  zero: -0,
  seen: new Set([1, 2]),
  kept: "yes",
};
const out = JSON.parse(JSON.stringify(input));
console.log(Object.keys(out));
console.log(out.count, out.zero, out.seen);
```

*Predict `Object.keys(out)` exactly — which of the six properties survive? Then predict the second
line.*

### K · structuredClone and aliasing

```javascript
const shared = { value: 1 };
const state = { a: shared, b: shared };
const cloned = structuredClone(state);
console.log(cloned.a === cloned.b);
console.log(cloned.a === shared);
cloned.a.value = 99;
console.log(shared.value, cloned.b.value);
```

*Predict all three lines. The first two look like they could contradict each other — explain why
they don't.*

### L · structuredClone and class instances

```javascript
class Money {
  #cents;
  constructor(cents) { this.#cents = cents; }
  get dollars() { return this.#cents / 100; }
}
const price = new Money(500);
const clone = structuredClone(price);
console.log(clone instanceof Money);
try { console.log(clone.dollars); } catch (e) { console.log(e.constructor.name); }
```

*Predict both lines. `Money` uses a private field — does that change anything about what
`structuredClone` does here, or is this the same failure as a class with public fields?*

---

## True / false — with the mechanism

Answer each with **true or false plus one sentence of mechanism**. A bare true/false scores zero.

1. `{ ...obj }` protects every property of `obj` from being observed as mutated through the copy.
2. `Array.prototype.slice()` and the spread operator produce copies with identical mutation
   behaviour for a nested value.
3. `JSON.parse(JSON.stringify(x))` never throws.
4. A `Date` survives `JSON.parse(JSON.stringify(x))` as a `Date`.
5. `structuredClone` can clone an object containing a `WeakMap`.
6. `structuredClone` preserves `===` between two properties that pointed at the same object
   before cloning.
7. `Object.freeze(x)` prevents any code from ever changing data reachable from `x`.
8. `Object.freeze` returns a new object, leaving the original unfrozen.
9. A frozen array's `.length` can still change.
10. `Object.freeze(new Map())` prevents `.set()` from succeeding on that map.
11. An object with only accessor (getter/setter) properties becomes fully immutable when frozen.
12. `const x = {}` prevents `x.y = 1`.
13. `Object.seal(x)` allows adding new properties to `x`.
14. Comparing two objects with `JSON.stringify(a) === JSON.stringify(b)` is a correct deep-equal
    for any two objects with no functions, symbols, or special types in them.
15. Deep-cloning an entire state tree to update one field costs roughly the same as copying just
    the objects on the path to that field.

---

## Build these

Four primitives. All four are small; the value is in the invariant each one enforces.

### 1. `deepClone(value)` — without `structuredClone`

```javascript
function deepClone(value, seen = new WeakMap()) {
  // handle: primitives, Array, plain Object, Date, Map, Set, and a cycle.
  // seen: a source object you've already cloned should produce the SAME
  // clone the second time, exactly like structuredClone's memo table.
}
```

**Success criteria**

- [ ] A primitive comes back unchanged (`===`, not just `deepEqual`).
- [ ] A plain object and an array are cloned recursively — mutating the clone never touches the
      original, at any depth.
- [ ] `Date`, `Map`, `Set` are cloned as their real types, not as plain objects.
- [ ] Two properties that pointed at the same source object point at the same cloned object
      (test with `===`), the way `structuredClone` does.
- [ ] A self-referencing object clones without a stack overflow, and the clone's self-reference
      points at the clone, not the original.
- [ ] A comment naming the one thing your version does that `structuredClone` refuses to
      (functions), OR the one thing it doesn't handle that `structuredClone` does — pick one and
      justify it.

### 2. `deepFreeze(value)` — and prove what it does not cover

```javascript
function deepFreeze(value, seen = new WeakSet()) {
  // freeze value and everything reachable from it, exactly once each.
}
```

**Success criteria**

- [ ] A write three levels deep throws in strict mode after `deepFreeze`.
- [ ] A cyclic structure freezes without infinite recursion.
- [ ] An array reachable from `value` is frozen too — pushing to it throws.
- [ ] A demonstration (not just a comment) that a `Map` or `Set` reachable from `value` is STILL
      mutable after `deepFreeze` — show the `.set()`/`.add()` succeeding.
- [ ] A comment stating what you'd have to change about the function to close that gap, and why
      you didn't (or did) do it.

### 3. `deepEqual(a, b)` — order-independent, cycle-safe

```javascript
function deepEqual(a, b, seen = new WeakMap()) {
  // structural equality: same keys, recursively equal values.
  // must NOT depend on property insertion order.
}
```

**Success criteria**

- [ ] Two objects with the same keys in different insertion order compare equal.
- [ ] Two objects that differ in exactly one nested value compare unequal, and you can say which
      value differs from a short call site, not by stepping through with a debugger.
- [ ] `NaN` compares equal to `NaN` (say which two-line difference from `===` this requires).
- [ ] Two objects forming a cycle, both cycles the "same shape", compare equal without recursing
      forever. This is the hard part — write down the trick before coding it.
- [ ] A comment on why this function's cost is fundamentally the same shape as `deepClone`'s.

### 4. `setIn(obj, path, value)` — path-copying, the fast alternative

```javascript
function setIn(obj, path, value) {
  // return a new object where the value at `path` (an array of keys) is
  // `value`, sharing every reference NOT on that path with the original.
}
```

**Success criteria**

- [ ] `setIn(state, ["a", "b"], 1)` changes only `result.a.b` — `result.a.c` (a sibling) is `===`
      to `state.a.c`, and any OTHER top-level key of `state` is `===` between `state` and `result`.
- [ ] Works when a key in the path doesn't exist yet in `obj` (creates the intermediate objects).
- [ ] Handles an array segment of the path correctly — `setIn(state, ["list", 2], x)` produces a
      real array at `result.list`, not an object with a `"2"` key. Prove it with
      `Array.isArray`.
- [ ] `path` of length 0 is defined behaviour — decide what it should do and write one sentence
      justifying the choice.
- [ ] A benchmark, however rough, comparing `setIn` against `structuredClone`-then-mutate on a
      state object with at least 1,000 nested entries. Record both numbers.

---

## Hints

Read one at a time.

**A/B** — Ask what `{ ...x }` or `.slice()` actually put into the new container for each property:
a copy of a primitive, or a copy of a pointer. `.push` on the shallow-copied *array* only affects
that array's own storage — ask whether `shallow` and `arr` are the same array or two arrays
sharing elements.

**C** — Read what `Object.assign`'s documentation says it *returns*, not just what it does to its
first argument.

**D** — The bug is that `out.meta` is a reference. The fix has the same shape as every other fix
in this chapter: give the mutation something of its own to write into.

**E/F** — The write is identical in both files. What differs is not the object, not the freeze —
it's a property of the *file*.

**G** — Ask what freeze actually locks: is a `Map`'s data reachable as an enumerable own property
of the `Map` object, or does it live somewhere freeze can't see?

**H** — Both throw on one operation and allow another. List all four operations (add, delete,
write, read) against both restrictions and find the one row where they differ.

**I** — One of these is a property-level restriction (an object refusing a write). The other is a
binding-level restriction (a variable refusing reassignment). They are unrelated mechanisms that
happen to both throw `TypeError`.

**J** — Go property by property. For each, ask: can JSON text represent this value at all? If the
answer is no, the property doesn't survive — full stop, no partial representation.

**K** — There are two separate facts in tension here: "the clone preserves aliasing" and "the
clone is not the original". Neither one is about the other — one is about the relationship
*between the two clone results*, the other is about the relationship *between a clone and the
source*.

**L** — Private fields are still data the constructor set on the instance; ask whether
`structuredClone` even gets far enough to care that they're private, or whether it fails for a
more basic reason first.

**Build 1** — `seen` needs to be checked and populated as you recurse, in that order — check first
so a cycle terminates, populate before recursing into children so a value that refers to itself
(or to something being cloned above it) finds its clone already there.

**Build 2** — `Reflect.ownKeys` reaches non-enumerable and symbol keys that `Object.keys` misses.
Whether you need that here depends on what you're trying to demonstrate — decide and say why.

**Build 3** — For the cycle case: the same trick `structuredClone` uses for cloning applies here
too, just answering a different question. If you've seen `(a, b)` before at this exact pair, what
should you return instead of recursing?

**Build 4** — Immutability at each level means you cannot mutate your way down the path — you have
to build the return value from the bottom up (or write recursively and let the recursive call
return the fresh nested value, same shape as `deepFreeze`'s recursion but building instead of
locking).

---

## What to verify

- [ ] All twelve predictions in Programs 1–3 written down **before** running anything.
- [ ] For each, the **rule** named, not just the printed value.
- [ ] A and D both explained with the same one-sentence mechanism, even though the code looks
      different — say what makes them the same bug.
- [ ] E, F and G distinguish three DIFFERENT reasons a write can fail to do what freeze "should"
      do: shallow depth, sloppy mode, and internal-slot vs property.
- [ ] K's two `===` lines explained as answering two different questions, not as contradicting.
- [ ] All fifteen true/false answered with mechanism.
- [ ] All four primitives pass their success criteria, with the comments they ask for.
- [ ] `setIn`'s benchmark numbers recorded, and you can say in one sentence why the gap exists.
- [ ] You can say out loud, in under 45 seconds, why `Object.freeze(state)` did not protect
      `state.user.name` in a shallow-copied reducer.
