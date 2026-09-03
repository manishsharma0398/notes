# Chapter 18 Worksheet — Copying, Immutability and Freezing

Work entirely in this file. Each question has its answer block **directly underneath it** — no
scrolling. **Predict before running.** A prediction you checked first is worth nothing.

For every answer, name the **rule** — "one level, then a shared reference", "text can't represent
it", "aliasing preserved within one clone", "locks the property, not the internal slot",
"binding, not value", "setter still ran", "the whole tree, every time".

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

```
line 1:

line 2:

why the two properties behaved differently (one sentence, what's stored where):

rule:
```

---

### B · array of objects

```javascript
const arr = [{ n: 1 }, { n: 2 }];
const shallow = arr.slice();
shallow[0].n = 99;
shallow.push({ n: 3 });
console.log(arr.length, shallow.length);
console.log(arr[0].n);
```

```
line 1 (both lengths):

line 2 (arr[0].n):

which change reached arr and which didn't:

why doesn't shallow.push reach arr, when shallow[0].n = 99 did:
```

---

### C · Object.assign returns what?

```javascript
const target = { a: 1 };
const result = Object.assign(target, { b: 2 });
console.log(result === target);
console.log(target);
```

```
line 1:

line 2:

what's different about Object.assign vs spread here:
```

---

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

```
prediction:

one-line fix so this prints undefined:

```

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

```
does the catch fire? what does it print if so:

final console.log line:

rule:
```

---

### F · sloppy mode, same object

```javascript
// NOT "use strict" for this one — top of a plain script
const obj = Object.freeze({ a: 1 });
obj.a = 99;
console.log(obj.a);
```

```
prediction:

the one-word difference between this file and E that changes the outcome:
```

---

### G · freeze and a Map

```javascript
"use strict";
const state = Object.freeze({ cache: new Map([["k", 1]]) });
state.cache.set("k", 2);
try { state.cache = new Map(); } catch (e) { console.log(e.constructor.name); }
console.log(state.cache.get("k"));
```

```
does the catch fire?

final console.log line:

why freeze treats .set() and the reassignment of state.cache differently:
```

---

### H · seal vs freeze

```javascript
"use strict";
const sealed = Object.seal({ a: 1 });
sealed.a = 2;
try { sealed.b = 1; } catch (e) { console.log("seal:", e.constructor.name); }

const frozen = Object.freeze({ a: 1 });
try { frozen.a = 2; } catch (e) { console.log("freeze:", e.constructor.name); }
```

```
"seal:" line printed?

"freeze:" line printed?

the one capability seal has that freeze doesn't:
```

---

### I · const is not this chapter

```javascript
const arr = Object.freeze([1, 2, 3]);
try { arr.push(4); } catch (e) { console.log(e.constructor.name, "-", e.message); }

const arr2 = [1, 2, 3];
try { arr2 = []; } catch (e) { console.log(e.constructor.name); }
```

```
first catch — prediction:

second catch — prediction:

name each of the two DIFFERENT restrictions being violated:
```

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

```
Object.keys(out) — exactly which of the six properties survive:

second console.log line:
```

---

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

```
line 1:

line 2:

line 3:

why lines 1 and 2 don't contradict each other:
```

---

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

```
line 1:

line 2:

does the private field change anything here, or is this the same failure as a public-field class:
```

---

## True / false — with the mechanism

```
1.  { ...obj } protects every property of obj from being observed as mutated through the copy.
    T/F:            mechanism:

2.  Array.prototype.slice() and the spread operator produce copies with identical mutation
    behaviour for a nested value.
    T/F:            mechanism:

3.  JSON.parse(JSON.stringify(x)) never throws.
    T/F:            mechanism:

4.  A Date survives JSON.parse(JSON.stringify(x)) as a Date.
    T/F:            mechanism:

5.  structuredClone can clone an object containing a WeakMap.
    T/F:            mechanism:

6.  structuredClone preserves === between two properties that pointed at the same object before
    cloning.
    T/F:            mechanism:

7.  Object.freeze(x) prevents any code from ever changing data reachable from x.
    T/F:            mechanism:

8.  Object.freeze returns a new object, leaving the original unfrozen.
    T/F:            mechanism:

9.  A frozen array's .length can still change.
    T/F:            mechanism:

10. Object.freeze(new Map()) prevents .set() from succeeding on that map.
    T/F:            mechanism:

11. An object with only accessor (getter/setter) properties becomes fully immutable when frozen.
    T/F:            mechanism:

12. const x = {} prevents x.y = 1.
    T/F:            mechanism:

13. Object.seal(x) allows adding new properties to x.
    T/F:            mechanism:

14. Comparing two objects with JSON.stringify(a) === JSON.stringify(b) is a correct deep-equal
    for any two objects with no functions, symbols, or special types in them.
    T/F:            mechanism:

15. Deep-cloning an entire state tree to update one field costs roughly the same as copying just
    the objects on the path to that field.
    T/F:            mechanism:
```

---

## Build these

### 1. `deepClone(value)` — without `structuredClone`

```javascript
function deepClone(value, seen = new WeakMap()) {
  // handle: primitives, Array, plain Object, Date, Map, Set, and a cycle.
}
```

```
what your version does that structuredClone refuses (functions), OR what it doesn't handle that
structuredClone does — pick one and justify it:


```

- [ ] a primitive comes back unchanged (`===`)
- [ ] object/array cloned recursively; mutating the clone never touches the original
- [ ] `Date`, `Map`, `Set` cloned as their real types
- [ ] two properties pointing at the same source object point at the same clone (`===`)
- [ ] a self-referencing object clones without a stack overflow, self-reference points at the clone
- [ ] the comment above written

---

### 2. `deepFreeze(value)` — and prove what it does not cover

```javascript
function deepFreeze(value, seen = new WeakSet()) {
  // freeze value and everything reachable from it, exactly once each.
}
```

```
what you'd change to close the Map/Set gap, and why you didn't (or did):


```

- [ ] a write three levels deep throws in strict mode after `deepFreeze`
- [ ] a cyclic structure freezes without infinite recursion
- [ ] an array reachable from `value` is frozen too — pushing throws
- [ ] a demonstration that a `Map`/`Set` reachable from `value` is STILL mutable
- [ ] the comment above written

---

### 3. `deepEqual(a, b)` — order-independent, cycle-safe

```javascript
function deepEqual(a, b, seen = new WeakMap()) {
  // structural equality: same keys, recursively equal values.
}
```

```
which two-line difference from === lets NaN compare equal to NaN:

the trick for the cycle case — what you return instead of recursing, and when:

why this function's cost is the same shape as deepClone's:
```

- [ ] same keys, different insertion order → compare equal
- [ ] one differing nested value → compare unequal, and you can name which value
- [ ] `NaN` compares equal to `NaN`
- [ ] two same-shaped cycles compare equal without recursing forever
- [ ] the comments above written

---

### 4. `setIn(obj, path, value)` — path-copying, the fast alternative

```javascript
function setIn(obj, path, value) {
  // return a new object where the value at `path` is `value`, sharing
  // every reference NOT on that path with the original.
}
```

```
what an empty path should do, and why:

benchmark: setIn vs structuredClone-then-mutate on 1,000+ nested entries — both numbers:


```

- [ ] only the path changes; a sibling and any other top-level key stay `===`
- [ ] works when a key in the path doesn't exist yet
- [ ] an array segment produces a real array (`Array.isArray`), not an object with a `"2"` key
- [ ] the benchmark above run and recorded

---

## The 45-second answer

Write it out, then say it out loud, timed. This is the one that carries the chapter.

```
why did Object.freeze(state) not protect state.user.name in a shallow-copied reducer:




```

---

## What to verify

- [ ] All twelve predictions written down **before** running anything
- [ ] For each, the **rule** named, not just the printed value
- [ ] A and D explained with the same one-sentence mechanism despite looking different
- [ ] E, F and G distinguish three different reasons a write can fail: shallow depth, sloppy mode,
      internal-slot vs property
- [ ] K's two `===` lines explained as answering two different questions, not contradicting
- [ ] All fifteen true/false answered with mechanism
- [ ] All four primitives pass their success criteria, with the comments they ask for
- [ ] `setIn`'s benchmark numbers recorded, with the gap explained in one sentence
- [ ] The 45-second answer above, said out loud, timed
