# Chapter 18 — Copying, Immutability and Freezing: Revision Notes

*This is the file to read the morning of an interview. Mechanism only, no prose.*
*Spoken answers with timings: `interview.md`. Full 20-minute round: `mock.md`.*

## The six facts

1. **Every copy op stops at one level.** Spread, `Object.assign`, `.slice()`, `Array.from` copy
   the outer container; nested values are the SAME reference in both.
2. **`JSON.parse(JSON.stringify(x))` round-trips through TEXT.** Drops functions, `undefined`,
   symbol keys silently. `Date`→string, `Map`/`Set`/`RegExp`→`{}`, `NaN`/`Infinity`→`null`,
   `-0`→`0`. Throws on a cycle.
3. **`structuredClone` is a real graph walk.** Handles cycles, preserves shared refs within one
   call. Throws on a function. Strips the prototype from a class instance.
4. **`Object.freeze` is shallow and locks DATA properties only.** Nested objects mutable. A
   `Map`/`Set` inside is still mutable via its methods. An accessor's setter still runs.
5. **`const` freezes the BINDING, not the value.** `const arr = []` — `arr.push()` still works.
6. **Deep clone/freeze cost the whole tree.** ~120x slower than path-copying at 100k objects.

---

## The one sentence

> **Nothing walks your object graph for you. Copying, freezing, equality all stop at the first
> reference. Depth is something you ask for, never something you get by default.**

```
depth walked:
  zero    — const b = a;                    not a copy, a second name
  one     — spread / assign / slice / from / freeze / seal / ===
  all*    — JSON.parse(JSON.stringify(x))   *only what text can hold
  all     — structuredClone / deepFreeze / deepEqual (hand-written)
```

---

## Primitives vs references (Part 1)

```javascript
let a = 10; let b = a; b += 1;        // a untouched — VALUE duplicated
const o1 = {n:10}; const o2 = o1; o2.n += 1;   // o1.n changed — REFERENCE duplicated
```

Every "copy" idiom is built from assignment. Assignment on a primitive duplicates a value.
Assignment on an object duplicates a pointer. There is no third thing.

---

## Shallow copy (Part 2)

```javascript
const spread = { ...original };
spread.count += 1;          // NEW binding — original untouched
spread.nested.count += 1;   // SAME object — original mutated too
```

- `{ ...x }`, `Object.assign({}, x)`, `x.slice()`, `Array.from(x)`, `[...x]` — identical shape,
  different syntax. All copy the outer container, alias everything nested.
- **The bug:** `{ ...config }` then `merged.tags.push(...)` mutates the caller's array.
- Say: *shallow copy means "one level, alias below it" — not "copies what's safe to copy".*

---

## Deep copy (Part 3)

### JSON round-trip failure catalog

| Input | Becomes |
|---|---|
| function | gone (silent) |
| `undefined` (prop) | gone (silent) |
| symbol key | gone (silent) |
| `undefined` (array elem) | `null` |
| `Date` | string |
| `NaN` / `Infinity` | `null` |
| `-0` | `0` |
| `Map` / `Set` / `RegExp` | `{}` |
| cycle | **throws** (the only loud one) |

### `structuredClone`

- Real clone algorithm (same one `postMessage` uses). Handles cycles.
- **Preserves aliasing WITHIN one call**: `state.a === state.b` → `clone.a === clone.b`, still
  true, still a NEW object. JSON round-trip breaks this — duplicates into two separate objects.
- **Throws on a function** — a closure's context (Ch17) isn't boundedly serialisable.
- **Strips the prototype from a class instance** — `structuredClone(new Point())` →
  `{x, y}`, `instanceof Point` is `false`, no methods.

**Say:** *structuredClone clones the graph's shape; JSON.stringify clones values and throws the
shape away.*

---

## Freeze / seal / preventExtensions (Part 4)

| | add | delete/reconfigure | write existing value |
|---|---|---|---|
| `preventExtensions` | ✗ | ok | ok |
| `seal` | ✗ | ✗ | ok |
| `freeze` | ✗ | ✗ | ✗ |

- **`Object.freeze` returns the SAME reference**, mutates in place. Not a frozen copy.
- **Shallow**: `Object.freeze({a:{b:1}})` — `.a.b = 2` still works.
- **Strict mode throws** (`TypeError`) on a frozen write; **sloppy mode silently no-ops the exact
  same line**. Check the file's mode before trusting "it's frozen, can't be the bug".
- **Frozen array**: `.push()` throws (adds an index = not extensible). Index write throws too.
- **Idempotent**, `Object.isFrozen` to check. **Primitives are always frozen** — `isFrozen(5)` is
  `true`, `freeze(5)` is a no-op returning `5`.
- **`Map`/`Set` gotcha**: freeze locks own PROPERTIES. Map/Set entries live in an internal slot
  (`[[MapData]]`), mutated via `.set()`/`.add()`/`.delete()` — not property assignment. Freezing a
  Map does NOT stop `.set()`. `deepFreeze` doesn't fix this either — it walks properties too.
- **Accessor loophole**: freeze sets `writable:false` on DATA properties. An accessor property has
  no writable slot — freeze only blocks *replacing* the getter/setter. The setter still runs and
  can mutate whatever backing state it wants.

`deepFreeze` recipe (needs a `WeakSet` for cycles, same as Ch17's retention bookkeeping):

```javascript
function deepFreeze(v, seen = new WeakSet()) {
  const isObj = v !== null && (typeof v === "object" || typeof v === "function");
  if (!isObj || seen.has(v)) return v;
  seen.add(v);
  Object.freeze(v);
  for (const k of Reflect.ownKeys(v)) deepFreeze(v[k], seen);
  return v;
}
```

---

## `const` is not this chapter (Part 4)

`const arr = [1,2,3]; arr.push(4);` — allowed. `const` locks the BINDING (`arr = []` throws), not
the value. `const config = {...}` reads like "can't change" and guarantees nothing about mutation.

---

## Equality (Part 5)

- `===` on objects = reference equality. `{a:1} === {a:1}` is `false`, always.
- `JSON.stringify(a) === JSON.stringify(b)` as deep-equal: **wrong on key insertion order**, plus
  inherits the whole JSON failure catalog.
- A real `deepEqual` walks both structures — costs the same as a deep clone, same graph walk,
  different question.
- `Object.is` patches `===`'s two edge cases: `Object.is(NaN,NaN)` → `true` (`===` says `false`);
  `Object.is(-0,0)` → `false` (`===` says `true`). Full mechanism in Ch19.
- **The one legitimate shortcut**: if every update goes through copy-on-write (path-copying),
  `===` on a reference IS a correct, cheap "did this change" — by construction.

---

## What JS cannot do (Part 6)

- **No `Object.deepCopy` / `Object.deepFreeze` built in.** One level by default, always.
- **Can't clone a function.** `structuredClone` throws — a closure's context graph (Ch17) has no
  principled place to stop.
- **Can't make a `Map`/`Set` read-only.** No `ReadonlyMap`. Need a wrapper or a `Proxy`.
- **Can't un-freeze.** No inverse. The one genuinely irreversible op in this chapter.
- **No persistent/structurally-shared data structure as a language primitive** (unlike
  Clojure/Elm). Path-copying (Part 7) is the hand-rolled version.

**Why shallow-by-default:** a deep operation would reach past the object you were actually
given — freezing/cloning a shared logger reference inside a config object would lock/copy it for
everyone else holding it too. Shallow respects the boundary of what you were handed.

**Why irreversible:** if freeze could be undone, it would be a suggestion, not a guarantee — code
relying on "this won't change" would be reasoning about something that could flip mid-program.

---

## The scale caveat (Part 7)

100k-object tree (20 slices × 5,000 items), changing ONE field of ONE item:

```
structuredClone(whole tree)     139.69 ms
JSON round-trip                  69.25 ms
path-copy (spread the route)      1.14 ms     ← ~120x faster

Object.freeze (top level)         0.04 ms
deepFreeze (full traversal)      82.14 ms     ← ~2000x
```

- Deep clone/freeze cost = whole tree, always — full graph walk, doesn't care how much changed.
- **Path-copying**: spread only the objects on the route from root to the change. Cost = DEPTH of
  the change, not size of the tree. Everything off that path is reused by reference (proven:
  untouched siblings are `===` to the originals).
- This is the plain-data-structure mechanism behind every "only re-render what changed" system:
  if updates always produce a new ref for what changed and reuse the old ref for what didn't,
  `===` on a branch answers "did anything change under here" in O(1), no walk needed.
- **Scale caveat to say out loud:** deep-cloning "to be safe" is the two-year instinct, and it's
  the one that's two orders of magnitude slower exactly where it matters — large trees, frequent
  updates.

---

## Interview quick-fire

One sentence each. Hesitate on any of these and it goes back in this file.

- **Is `{ ...obj }` a deep copy?** No — one level. Nested objects are shared references.
- **Safest built-in deep clone?** `structuredClone`. Not functions, not class instances (loses
  the prototype).
- **Why does `JSON.parse(JSON.stringify(x))` "lose" data?** It round-trips through text; anything
  text can't represent (functions, `undefined`, symbols, `Map`/`Set`) is silently dropped.
- **Does `structuredClone` preserve aliasing?** Yes, within one call — same source object clones
  to the same target object. JSON round-trip does not.
- **Is `Object.freeze` recursive?** No. Shallow, same as spread.
- **Does freezing a `Map` stop `.set()`?** No — freeze locks properties; Map entries aren't
  properties.
- **Does freeze stop an accessor's setter?** No — it's a function call, not a data write.
- **Is `const` the same as immutable?** No — binding vs value. `const arr = []; arr.push(1)` works.
- **Does a frozen write throw?** Only in strict mode. Sloppy mode silently no-ops.
- **Can you compare objects for deep equality cheaply?** No — it costs what a deep clone costs.
  `JSON.stringify` comparison is wrong on key order too.
- **Can you un-freeze an object?** No. No inverse exists.
- **Why isn't deep clone/freeze the default?** Cost is proportional to the whole tree, and it
  would reach past objects you don't own.
- **What's the fast alternative to deep-cloning a big tree on every update?** Path-copying —
  spread only the route to the change, reuse everything else by reference.
