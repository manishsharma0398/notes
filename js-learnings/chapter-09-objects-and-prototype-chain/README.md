# Chapter 9 — Objects, Property Access, and the Prototype Chain

> **Read this box first.** Everything below is elaboration. If you only hold these six facts, you have the chapter.
>
> 1. An object is a **map of keys to property descriptors**, plus one hidden link called `[[Prototype]]`.
> 2. A key can only ever be a **string or a symbol**. Everything else is converted to a string.
> 3. **Reading** a property walks the chain: own → prototype → prototype's prototype → `null`. First hit wins (**shadowing**).
> 4. **Writing** a property does *not* work symmetrically — it normally creates an **own** property, but the chain can still veto or intercept it.
> 5. `[[Prototype]]` (the link an object *uses*) and `.prototype` (a property on *functions*) are **different things** with confusingly similar names.
> 6. `Object.prototype` sits at the top of almost every chain. That is where `toString`, `valueOf`, and `hasOwnProperty` come from.

---

## The Core Mental Model

Forget "objects are key-value bags." That model is why property access surprises people.

An object is **two** things stapled together:

```
   ┌─────────────────────────────────────────────┐
   │  OWN PROPERTIES                             │
   │    "name"  → { value: "Ada", writable: true,│
   │                enumerable: true, ... }      │
   │    "id"    → { value: 7, ... }              │
   │    Symbol(tag) → { value: …, ... }          │
   ├─────────────────────────────────────────────┤
   │  [[Prototype]]  ──────────────►  another object (or null)
   └─────────────────────────────────────────────┘
```

Every key maps to a **descriptor** — a small record describing the property, not just its value. And every object carries one link to another object, which is where lookup continues when a key isn't found locally.

Those two facts generate everything else in this chapter.

---

## Part 1 — Property Keys

**A property key is a string or a symbol. There is no third option.**

Anything else you write in brackets goes through `ToPropertyKey` (Chapter 8) and comes out as a string:

```javascript
const o = {};
o[1] = "a";
o["1"];          // "a"    ← same property. o[1] and o["1"] are identical.
Object.keys(o);  // ["1"]  ← stored as a string

o[true] = 1; o[null] = 2; o[{}] = 3;
Object.keys(o);  // ["1", "true", "null", "[object Object]"]
```

### The consequence: object keys collide

Every object stringifies to `"[object Object]"`, so **all objects used as keys are the same key**:

```javascript
const k1 = { a: 1 }, k2 = { b: 2 };
const cache = {};
cache[k1] = "first";
cache[k2] = "second";
cache[k1];  // "second"  ← k1's entry was overwritten
```

`k1 !== k2` (Chapter 7 — different identities), yet they address the same property. **This is the reason `Map` exists**: `Map` keys are compared with SameValueZero and never stringified.

```javascript
const m = new Map();
m.set(k1, "first").set(k2, "second");
m.get(k1);  // "first" — keys stay distinct
```

### Symbols are the exception

Symbols pass through `ToPropertyKey` **unconverted** — they're the only non-string key type. That's what makes them collision-proof, which is exactly why the language uses them for protocol hooks like `Symbol.toPrimitive` (Chapter 8) and `Symbol.iterator`.

```javascript
const id = Symbol("id");
const user = { name: "Ada", [id]: 42 };

user[id];                        // 42
Object.keys(user);               // ["name"]        ← symbol keys are invisible here
JSON.stringify(user);            // {"name":"Ada"}  ← and here
Object.getOwnPropertySymbols(user); // [Symbol(id)] ← only this finds them
```

Symbol keys aren't *private* — they're **non-enumerable by convention of the APIs**, discoverable if you ask for them explicitly. They prevent accidents, not attacks.

### Key ordering is specified, not arbitrary

```javascript
const o = { b: 1, 2: 2, a: 3, 1: 4, [Symbol("s")]: 5 };
Reflect.ownKeys(o);  // ["1", "2", "b", "a", Symbol(s)]
```

1. **Integer-index keys** first, in ascending numeric order
2. then **string keys**, in insertion order
3. then **symbol keys**, in insertion order

Integer keys jumping the queue is why array-like objects iterate in index order regardless of how you built them.

---

## Part 2 — Descriptors: What a Property Actually Is

A property isn't a value. It's a record:

```javascript
const o = { x: 1 };
Object.getOwnPropertyDescriptor(o, "x");
// { value: 1, writable: true, enumerable: true, configurable: true }
```

**Two kinds of property:**

| Data property | Accessor property |
|---|---|
| `value` — the stored value | `get` — function called on read |
| `writable` — may it be reassigned? | `set` — function called on write |
| `enumerable` — does it show up in `Object.keys`, `for...in`, `JSON.stringify`? | same |
| `configurable` — may it be deleted or redefined? | same |

An accessor property has **no value at all** — reading it *runs code*:

```javascript
const temp = {
  celsius: 25,
  get fahrenheit() { return this.celsius * 9 / 5 + 32; },
  set fahrenheit(f) { this.celsius = (f - 32) * 5 / 9; },
};

temp.fahrenheit;      // 77   ← a function call that looks like a field read
temp.fahrenheit = 212;
temp.celsius;         // 100
```

This is worth internalizing: **`obj.x` is not guaranteed to be cheap, pure, or even non-throwing.** It might be a getter doing real work. That's why Chapter 8's `==` can execute arbitrary code, and why a debugger's object inspector must be careful not to trigger getters.

Literals create everything as `writable: true, enumerable: true, configurable: true`. `Object.defineProperty` defaults every flag to **`false`**:

```javascript
const o = {};
Object.defineProperty(o, "hidden", { value: 1 });
Object.getOwnPropertyDescriptor(o, "hidden");
// { value: 1, writable: false, enumerable: false, configurable: false }
Object.keys(o);  // []  ← invisible
o.hidden = 99;   // TypeError in strict mode; silently ignored otherwise
```

That asymmetry is deliberate: `defineProperty` is the low-level, explicit API, so it makes you opt *in* to every capability.

---

## Part 3 — Reading: The Prototype Chain

`obj.key` runs `[[Get]]`, which is a loop:

```
look for "key" as an OWN property of obj
   found? → return it (run the getter if it's an accessor)
   not found? → move to obj's [[Prototype]] and look again
      … repeat …
   reached null? → return undefined
```

```
const arr = [1, 2]
        │
        ▼
     the array          own: "0", "1", "length"
        │ [[Prototype]]
        ▼
  Array.prototype       own: push, map, join, …
        │ [[Prototype]]
        ▼
  Object.prototype      own: toString, valueOf, hasOwnProperty, …
        │ [[Prototype]]
        ▼
       null             ← end of the chain
```

```javascript
arr.push;             // found on Array.prototype
arr.hasOwnProperty;   // found on Object.prototype — two levels up
arr.nope;             // undefined — walked to null
```

**A missing property is not an error.** It's `undefined`, because the loop ran to the end and found nothing. That's why typos are silent, and why `obj.a.b` throws only at the *second* access — `obj.a` is `undefined`, and `undefined.b` is the actual error.

### Shadowing

If the same key exists at two levels, **lookup stops at the first**:

```javascript
const parent = { greet: () => "from parent" };
const child = Object.create(parent);
child.greet = () => "from child";

child.greet();    // "from child"  ← own property shadows the inherited one
delete child.greet;
child.greet();    // "from parent" ← the inherited one was never modified
```

**This is the mechanism behind Chapter 8's `valueOf` puzzle.** `Object.prototype.valueOf` returns the object itself (a "no answer" shrug). Some types shadow it with something useful; most don't:

```javascript
[].valueOf === Object.prototype.valueOf;            // true  — Array does NOT shadow it
new Number(5).valueOf === Object.prototype.valueOf; // false — Number DOES
```

That single difference is why `[] + 1` is `"1"` and `new Number(5) + 1` is `6`. Nothing about `+` differs; the lookup found a different function.

---

## Part 4 — Writing: Not the Mirror Image

Here is the part almost everyone gets wrong. **Assignment does not simply "write where reading would have read."**

`obj.key = v` runs `[[Set]]`, which walks the chain **first**, then usually writes locally:

```
walk the chain looking for "key"
  ├─ found an ACCESSOR with a setter?     → call the setter. NOTHING is written to obj.
  ├─ found an accessor with NO setter?    → fail (TypeError in strict mode)
  ├─ found a NON-WRITABLE data property?  → fail (TypeError in strict mode)
  └─ otherwise                            → create/update an OWN property on obj
```

So three surprises follow:

**1. Assignment normally creates an own property, leaving the prototype untouched:**

```javascript
const proto = { count: 0 };
const a = Object.create(proto);
const b = Object.create(proto);

a.count = 5;
a.count;                        // 5     — own property
b.count;                        // 0     — proto is untouched
Object.hasOwn(a, "count");      // true
Object.hasOwn(b, "count");      // false
```

**2. But an inherited *setter* intercepts, and no own property appears:**

```javascript
const proto = { set value(v) { this._v = v; } };
const o = Object.create(proto);
o.value = 42;
Object.hasOwn(o, "value");  // false ← the setter ran instead
Object.hasOwn(o, "_v");     // true  ← the setter created this
```

**3. And an inherited *non-writable* property blocks the write entirely:**

```javascript
"use strict";
const proto = {};
Object.defineProperty(proto, "locked", { value: 1, writable: false });
const o = Object.create(proto);
o.locked = 99;   // TypeError — even though `locked` is not o's own property
```

A property you don't own, on an object you didn't write, can veto your assignment. This is the single most surprising rule in the chapter, and it's why "just assign it" is not a safe assumption when the prototype chain is unfamiliar.

**The mutable-shared-state trap** follows directly from (1):

```javascript
const proto = { tags: [] };
const x = Object.create(proto);
const y = Object.create(proto);

x.tags.push("a");    // NOT an assignment — a mutation through the shared reference
y.tags;              // ["a"]  ← same array (Chapter 7)

x.tags = ["b"];      // an assignment — creates an own property
y.tags;              // ["a"]  ← now they're independent
```

Reading `x.tags` walks up to the prototype and returns the *shared* array. `push` mutates that shared object. Only assignment breaks the sharing.

---

## Part 5 — `[[Prototype]]` vs `.prototype`

Two different things. The naming is a historical mistake and it confuses everyone once.

**`[[Prototype]]`** — the internal link *every object* has, the one lookup follows. You reach it with:

```javascript
Object.getPrototypeOf(obj);      // the modern, correct way
obj.__proto__;                   // legacy accessor on Object.prototype (Annex B)
Object.setPrototypeOf(obj, p);   // works, but see the warning below
```

**`.prototype`** — an ordinary property that exists on **functions only**. It is *not* that function's own prototype link. It is the object that will become the `[[Prototype]]` of instances the function creates with `new`.

```javascript
function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return `${this.name} barks`; };

const rex = new Dog("Rex");

Object.getPrototypeOf(rex) === Dog.prototype;  // true  ← the link points AT it
rex.prototype;                                 // undefined — instances have no .prototype
Object.getPrototypeOf(Dog) === Function.prototype; // true — Dog's OWN link is elsewhere
```

Read it as: **`Dog.prototype` is "the prototype I hand out", not "my prototype".**

### `Object.create` — the direct way

```javascript
const proto = { greet() { return "hi"; } };
const o = Object.create(proto);      // make an object whose [[Prototype]] is proto
Object.getPrototypeOf(o) === proto;  // true

const dict = Object.create(null);    // NO prototype at all
dict.toString;                       // undefined
`${dict}`;                           // TypeError — no toString to call (Chapter 8!)
```

`Object.create(null)` gives you a true dictionary: no inherited keys, no `"constructor"` collision, no `"__proto__"` special case. It's the correct structure for a user-keyed lookup table.

### Why you should not use `Object.setPrototypeOf`

It works, but it is a **serious performance hazard**. Engines optimize property access by assuming an object's "shape" (hidden class) — including its prototype — is stable. Mutating the prototype after creation invalidates every inline cache that ever touched that object, and V8 documents it as putting code into a slow path permanently.

Set the prototype at creation time (`Object.create`, `new`, `class`) instead of changing it later.

### Chains cannot loop

```javascript
const a = {}, b = Object.create(a);
Object.setPrototypeOf(a, b);  // TypeError: Cyclic __proto__ value
```

The engine refuses, because lookup is a loop with only one exit condition — reaching `null`. A cycle would mean a missing property spins forever. The guarantee that every chain terminates is what makes `undefined` a safe answer.

---

## Part 6 — Which Keys Do You Actually Get?

Six ways to ask, and they answer six different questions:

| API | Own? | Inherited? | Non-enumerable? | Symbols? |
|---|---|---|---|---|
| `Object.keys(o)` | ✔ | ✘ | ✘ | ✘ |
| `for...in` | ✔ | **✔** | ✘ | ✘ |
| `Object.getOwnPropertyNames(o)` | ✔ | ✘ | **✔** | ✘ |
| `Object.getOwnPropertySymbols(o)` | ✔ | ✘ | ✔ | **✔ only** |
| `Reflect.ownKeys(o)` | ✔ | ✘ | **✔** | **✔** |
| `key in o` | ✔ | **✔** | ✔ | ✔ |

```javascript
const proto = { inherited: 1 };
const o = Object.create(proto, {
  visible: { value: 2, enumerable: true },
  hidden:  { value: 3, enumerable: false },
});

Object.keys(o);                     // ["visible"]
[...(function*(){ for (const k in o) yield k; })()];  // ["visible", "inherited"]
Object.getOwnPropertyNames(o);      // ["visible", "hidden"]
"inherited" in o;                   // true
Object.hasOwn(o, "inherited");      // false
```

**`for...in` walking the prototype chain is the one that bites.** It's why the defensive `hasOwnProperty` check inside `for...in` loops exists in older code, and why `Object.keys` is almost always what you actually wanted.

### `in` vs `hasOwnProperty` vs `hasOwn`

```javascript
"toString" in {};                  // true  — inherited from Object.prototype
Object.hasOwn({}, "toString");     // false — own only
({}).hasOwnProperty("toString");   // false
```

Use `Object.hasOwn(o, k)` (ES2022). The older `o.hasOwnProperty(k)` breaks in two real cases:

```javascript
const dict = Object.create(null);
dict.hasOwnProperty("x");          // TypeError — no prototype, no method

const shadowed = { hasOwnProperty: () => "hijacked" };
shadowed.hasOwnProperty("x");      // "hijacked" — it's just a property; anyone can shadow it
```

Which is why you used to see `Object.prototype.hasOwnProperty.call(obj, key)` — borrowing the original function rather than trusting the object to supply it. `Object.hasOwn` is that pattern, standardized.

---

## What JavaScript Cannot Do — And Why

**You cannot use a non-string, non-symbol property key.** `Map` exists precisely because this is a hard limit.

*Why?* Property keys are the most performance-critical lookup in the language, and engines rely on interning strings and symbols to make it a hash lookup with pointer-equality comparison. Arbitrary keys would require calling a user-defined equality/hash for every property access in every program.

**You cannot create a cycle in a prototype chain.** The engine throws.

*Why?* Lookup terminates only by reaching `null`. A cycle turns a missing-property read into an infinite loop, and there'd be no correct value to return. Guaranteeing termination is what lets `obj.missing` safely be `undefined`.

**You cannot intercept property access on a plain object.** No `Symbol.get`, no `__noSuchMethod__`.

*Why not, and what replaced it?* The same reasoning as `===` in Chapter 8: if any `obj.x` could run user code, every inline cache in the engine would need a guard, and no property read could be optimized or reordered. The considered answer was `Proxy` (ES2015) — a *separate object* that explicitly declares itself interceptable, so ordinary objects stay fast and the cost is paid only where you opt in.

**You cannot make a property truly private with symbols.** `Object.getOwnPropertySymbols` and `Reflect.ownKeys` will find them.

*Why?* Symbols were designed to prevent *collisions*, not to enforce *access control* — and reflection APIs (debuggers, serializers, test frameworks) must be able to see everything. Genuine privacy required a different mechanism with different rules: `#private` class fields, which are not properties at all and are invisible to every reflection API.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Objects are just key-value bags" | Keys map to **descriptors**. A property can be a getter that runs code, or be non-writable, or be invisible to `Object.keys`. |
| "`obj.x` is a cheap field read" | It may walk several prototype levels and may invoke a getter. |
| "Assignment writes where reading reads" | Reading walks the chain; writing normally creates an **own** property — but an inherited setter or non-writable property can intercept or veto it. |
| "`Foo.prototype` is `Foo`'s prototype" | It's the prototype `Foo` *hands to instances*. `Foo`'s own prototype is `Function.prototype`. |
| "`for...in` gives an object's keys" | It gives **enumerable string keys including inherited ones**. `Object.keys` gives own ones. |
| "Symbol keys are private" | They're collision-proof, not private. `Reflect.ownKeys` finds them. Use `#private` fields for real privacy. |
| "Setting a property on an instance changes the prototype" | No — it shadows it. But *mutating* an inherited object (`x.tags.push(…)`) does affect everyone, because that's a mutation, not an assignment. |
| "`{}` and `Object.create(null)` are the same" | `{}` inherits `toString`, `valueOf`, `hasOwnProperty`. `Object.create(null)` inherits nothing — and throws on string conversion. |
| "`delete obj.x` frees memory" | It removes the property binding. The value is collected only if nothing else references it. |

---

## ASCII Diagram — Read vs Write

```
   READ:  obj.key                      WRITE:  obj.key = v
   ──────────────────                  ─────────────────────
   own property?                       walk the chain first:
     yes → return it                     accessor with setter? → call it, STOP
     no  ↓                               accessor, no setter?  → TypeError (strict)
   [[Prototype]]                         non-writable data?    → TypeError (strict)
     own property?                       otherwise             ↓
       yes → return it                 create/update an OWN property on obj
       no  ↓
   [[Prototype]]  …
     null → undefined                 (the prototype is never modified by assignment)
```

---

## Practical Rules

1. **`Object.keys` / `Object.entries`, not `for...in`.** Own properties are almost always what you mean.
2. **`Object.hasOwn(o, k)`**, never `o.hasOwnProperty(k)`.
3. **`Object.create(null)` for dictionaries** keyed by user data — no inherited keys to collide with.
4. **Never `Object.setPrototypeOf`.** Set the prototype when the object is created.
5. **Use `Map` when keys aren't strings.** Objects stringify keys; `Map` doesn't.
6. **Never put mutable objects on a shared prototype** — every instance shares that one array until someone assigns over it.
7. **Assume `obj.x` may run code.** It can be a getter.
