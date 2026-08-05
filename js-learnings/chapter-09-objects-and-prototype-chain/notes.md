# Chapter 9 — Objects and the Prototype Chain: Revision Notes

## The six facts

1. An object = **map of keys → descriptors** + one `[[Prototype]]` link.
2. A key is a **string or a symbol**. Nothing else.
3. **Reading** walks the chain: own → proto → … → `null`. First hit wins (**shadowing**).
4. **Writing** creates an **own** property — but the chain can intercept (setter) or veto (non-writable).
5. `[[Prototype]]` ≠ `.prototype`.
6. `Object.prototype` is the top of almost every chain — source of `toString`, `valueOf`, `hasOwnProperty`.

---

## Keys

```javascript
o[1] === o["1"]        // true — same property, stored as "1"
o[{}]                  // key is "[object Object]" — ALL objects collide
```

Everything non-symbol goes through `ToPropertyKey` (string hint) → a string.
**This is why `Map` exists** — its keys use SameValueZero, never stringified.

Symbols pass through unconverted — the only non-string key.

```javascript
Object.keys(o)         // string keys only
JSON.stringify(o)      // string keys only
Object.getOwnPropertySymbols(o)  // symbols only
Reflect.ownKeys(o)     // everything
```

Symbol keys are **collision-proof, not private**. Real privacy = `#private` fields.

**Ordering:** integer-index keys ascending → string keys in insertion order → symbols in insertion order.

---

## Descriptors

```javascript
Object.getOwnPropertyDescriptor({x: 1}, "x")
// { value: 1, writable: true, enumerable: true, configurable: true }
```

| Data property | Accessor property |
|---|---|
| `value`, `writable` | `get`, `set` (**no `value` at all**) |
| `enumerable` — shows in `Object.keys` / `for...in` / `JSON` | same |
| `configurable` — may be deleted or redefined | same |

- Literals → all flags `true`
- `Object.defineProperty` → all flags default to **`false`**
- `Object.freeze` = set `writable:false, configurable:false` on own properties → that's exactly why it's **shallow**

**`obj.x` may run code.** An accessor can be slow, impure, or throw. An inspector must read *descriptors*, not values.

---

## Reading — `[[Get]]`

```
own? → return it (run getter if accessor)
no  → follow [[Prototype]] → repeat
null → undefined
```

Missing property = `undefined`, not an error. Hence `obj.a.b` throws on the **second** access.

### Shadowing

```javascript
child.greet = ...   // shadows proto's greet
delete child.greet  // the inherited one reappears — it was never modified
```

**The Chapter 8 payoff:**

```javascript
[].valueOf === Object.prototype.valueOf              // true  — Array inherits the shrug
new Number(5).valueOf === Object.prototype.valueOf   // false — Number shadows it
```

That one lookup difference is why `[] + 1` is `"1"` and `new Number(5) + 1` is `6`.

---

## Writing — `[[Set]]` (not the mirror image)

```
walk the chain:
  accessor with setter?    → call it. NOTHING written to obj.
  accessor, no setter?     → TypeError (strict)
  non-writable data?       → TypeError (strict)
  otherwise                → create/update an OWN property
```

```javascript
a.count = 5;              // own property; proto untouched
Object.hasOwn(a,"count")  // true
Object.hasOwn(b,"count")  // false — sibling unaffected
```

**An inherited non-writable property vetoes your assignment** — the most surprising rule in the chapter. Silent in sloppy mode.

`Object.defineProperty` ignores the chain entirely — direct own-property operation.

### The shared-mutable-prototype trap

```javascript
const proto = { tags: [] };
x.tags.push("a");   // MUTATION through a shared ref → y.tags is ["a"] too
x.tags = ["b"];     // ASSIGNMENT → own property → now independent
```

Chapter 7 + Chapter 9 colliding. Never put mutable objects on a shared prototype.

---

## `[[Prototype]]` vs `.prototype`

| | What it is |
|---|---|
| `[[Prototype]]` | the internal link **every object** has; what lookup follows |
| `.prototype` | an ordinary property on **functions only**; becomes instances' `[[Prototype]]` under `new` |

```javascript
Object.getPrototypeOf(rex) === Dog.prototype   // true
rex.prototype                                  // undefined — instances have none
Object.getPrototypeOf(Dog) === Function.prototype // true — Dog's OWN link
```

Read `Dog.prototype` as **"the prototype I hand out"**, not "my prototype".

```javascript
Object.create(proto)   // make an object linked to proto
Object.create(null)    // NO prototype — true dictionary; `${dict}` throws
```

**Never `Object.setPrototypeOf`** — invalidates inline caches, permanent slow path. Set the prototype at creation.

**Chains can't loop** — `TypeError: Cyclic __proto__ value`. Lookup's only exit is `null`.

---

## Enumeration — six questions

| API | Own | Inherited | Non-enum | Symbols |
|---|---|---|---|---|
| `Object.keys` | ✔ | ✘ | ✘ | ✘ |
| `for...in` | ✔ | **✔** | ✘ | ✘ |
| `getOwnPropertyNames` | ✔ | ✘ | **✔** | ✘ |
| `getOwnPropertySymbols` | ✔ | ✘ | ✔ | **only** |
| `Reflect.ownKeys` | ✔ | ✘ | **✔** | **✔** |
| `in` | ✔ | **✔** | ✔ | ✔ |

`for...in` walking the chain is the one that bites — hence the defensive `hasOwnProperty` checks in old code.

### `Object.hasOwn`, not `hasOwnProperty`

```javascript
Object.create(null).hasOwnProperty("x")        // TypeError — nothing to inherit
({hasOwnProperty: () => "lied"}).hasOwnProperty("x")  // "lied" — shadowable
Object.prototype.hasOwnProperty.call(o, "x")   // the old fix: borrow the original
Object.hasOwn(o, "x")                          // ES2022 — that pattern, standardized
```

### `JSON.stringify` drops

`undefined` values, functions, symbol keys, non-enumerable properties. Which is why JSON round-tripping is a lossy deep copy (Chapter 7).

---

## What JavaScript cannot do

| Cannot | Why |
|---|---|
| Use a non-string/symbol key | Property lookup is the hottest operation in the language; engines rely on interned strings + pointer equality. Arbitrary keys → a user-defined hash/equality call on every access. `Map` is the opt-in alternative. |
| Create a prototype cycle | Lookup terminates only at `null`. A cycle = infinite loop on a missing property, with no correct value to return. |
| Intercept access on a plain object | Same reasoning as `===` in Ch 8 — every inline cache would need a guard. `Proxy` is the answer: a separate object that declares itself interceptable, so ordinary objects stay fast. |
| Make symbol keys private | Symbols prevent collisions, not access; reflection APIs must see everything. Real privacy = `#private` fields, which aren't properties at all. |

---

## Practical rules

1. `Object.keys`/`entries`, not `for...in`
2. `Object.hasOwn(o, k)`, never `o.hasOwnProperty(k)`
3. `Object.create(null)` for user-keyed dictionaries
4. Never `Object.setPrototypeOf`
5. `Map` when keys aren't strings
6. Never put mutable objects on a shared prototype
7. Assume `obj.x` may run code

---

## Interview quick-fire

- **"What happens on `obj.x`?"** → `[[Get]]`: own property, else follow `[[Prototype]]` until found or `null`; accessor properties run a getter.
- **"Is writing the reverse of reading?"** → No. Reading returns the first hit on the chain; writing creates an **own** property — unless an inherited setter intercepts or an inherited non-writable property vetoes it.
- **"`[[Prototype]]` vs `.prototype`?"** → The link every object has, vs a property on functions that becomes instances' link under `new`.
- **"Why does `for...in` show extra keys?"** → It enumerates enumerable string keys **including inherited ones**.
- **"`in` vs `hasOwnProperty`?"** → `in` walks the chain; `hasOwn` doesn't. Prefer `Object.hasOwn` — the method form breaks on null-prototype objects and can be shadowed.
- **"Why does `Map` exist?"** → Object keys are stringified, so all objects collapse to `"[object Object]"`. Map keys use SameValueZero.
- **"Are symbol keys private?"** → No — collision-proof only. `Reflect.ownKeys` finds them.
- **"Why is `Object.freeze` shallow?"** → It only flips `writable`/`configurable` on **own** properties. It never touches values, so nested objects keep their own descriptors.
- **"Why avoid `setPrototypeOf`?"** → It invalidates the object's shape assumptions and every inline cache that touched it — a permanent deoptimization.
- **"Why can't prototype chains have cycles?"** → Lookup's only exit is `null`; a cycle makes a missing-property read non-terminating.
- **"Why can't you intercept property access?"** → It would defeat inline caching on the hottest path in the engine. `Proxy` makes interception opt-in on a separate object instead.
