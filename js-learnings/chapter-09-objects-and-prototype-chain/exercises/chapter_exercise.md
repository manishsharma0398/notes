# Chapter 9 Exercise — Objects, Property Access, and the Prototype Chain

## Overview

This exercise applies only Chapter 9 concepts: property keys, descriptors, the `[[Get]]` chain walk, `[[Set]]` and its asymmetry, shadowing, `[[Prototype]]` vs `.prototype`, and the enumeration APIs.

**Rule: do not run the code before answering.** Deriving the answer is the skill; running first teaches nothing. Verify afterwards.

For every answer, name the **mechanism** — "walked the chain to depth 1", "created an own property", "vetoed by a non-writable inherited property", "enumerable: false so `Object.keys` skips it".

**Estimated time:** 30–60 minutes

---

## Program 1 — Output Tracer

```javascript
"use strict";

const proto = { x: 1 };
const obj = Object.create(proto);

console.log(obj.x);                   // << A
console.log(Object.hasOwn(obj, "x")); // << B
obj.x = 2;
console.log(proto.x);                 // << C
console.log(Object.hasOwn(obj, "x")); // << D
delete obj.x;
console.log(obj.x);                   // << E
```

```javascript
"use strict";

const proto = {};
Object.defineProperty(proto, "locked", { value: 1, writable: false });
const o = Object.create(proto);

try {
  o.locked = 99;
  console.log("assigned");            // << F  (this line, or the catch line?)
} catch (e) {
  console.log(e.constructor.name);
}
console.log(o.locked);                // << G
```

```javascript
"use strict";

const proto = { list: [] };
const a = Object.create(proto);
const b = Object.create(proto);

a.list.push(1);
console.log(b.list.length);            // << H
a.list = [9];
console.log(b.list.length);            // << I
console.log(Object.hasOwn(b, "list")); // << J
```

```javascript
"use strict";

const o = { 2: "a", 1: "b", z: "c", a: "d" };
console.log(Object.keys(o));       // << K

o[Symbol("k")] = "e";
console.log(Object.keys(o).length); // << L
console.log(JSON.stringify(o));     // << M
```

```javascript
"use strict";

const proto = { inh: 1 };
const o = Object.create(proto, {
  vis: { value: 1, enumerable: true },
  hid: { value: 2 },
});

const forIn = [];
for (const k in o) forIn.push(k);

console.log(Object.keys(o));                 // << N
console.log(forIn);                          // << O
console.log(Object.getOwnPropertyNames(o));  // << P
console.log("inh" in o, Object.hasOwn(o, "inh")); // << Q
```

```javascript
"use strict";

function F() {}
const f = new F();

console.log(Object.getPrototypeOf(f) === F.prototype);        // << R
console.log(f.prototype);                                      // << S
console.log(Object.getPrototypeOf(F) === Function.prototype);  // << T
console.log(F.prototype.constructor === F);                    // << U
```

**H and I are the pair worth the most thought.** One line is a mutation and one is an assignment. Say which is which before you answer either.

---

## Program 2 — True/False Reasoning

For each statement, write True or False and explain why in one sentence.

1. `Object.keys(obj)` includes inherited properties
2. `"toString" in {}` is `true`
3. Assigning to an inherited property modifies the prototype
4. `Object.freeze(o)` makes `o.nested.x = 5` fail
5. Symbol-keyed properties are private
6. `obj[1]` and `obj["1"]` refer to the same property
7. `` `${Object.create(null)}` `` works fine
8. A getter property's descriptor has a `value` field
9. `Object.defineProperty(o, "k", { value: 1 })` creates an enumerable property
10. A prototype chain can contain a cycle
11. `delete obj.x` where `x` is inherited removes it from the prototype
12. `for...in` includes symbol keys

---

## Program 3 — Descriptor Detective

```javascript
"use strict";

const base = { shared: "from base" };

const thing = Object.create(base, {
  normal:   { value: 1, writable: true, enumerable: true, configurable: true },
  readonly: { value: 2, enumerable: true },
  invisible:{ value: 3, writable: true, configurable: true },
  computed: {
    get() { return "computed!"; },
    enumerable: true,
  },
});
```

For each key, fill in the grid — **without running the code**:

| key | own? | enumerable? | writable? | in `Object.keys`? | in `for...in`? | in `JSON.stringify`? | `thing.key` gives |
|---|---|---|---|---|---|---|---|
| `normal` | | | | | | | |
| `readonly` | | | | | | | |
| `invisible` | | | | | | | |
| `computed` | | | | | | | |
| `shared` | | | | | | | |

Then predict these:

```javascript
thing.readonly = 99;   // << V   what happens?
thing.computed = 99;   // << W   what happens?
Object.keys(thing);    // << X
Reflect.ownKeys(thing); // << Y
```

**Remember:** `Object.defineProperty` (and the descriptor form of `Object.create`) default every unlisted flag to `false`.

---

## Program 4 — Build the Chain Tools

Three functions. No libraries.

```javascript
"use strict";

function getPrototypeChain(obj) {
  // TODO: return an ARRAY of every object in obj's prototype chain,
  //       starting with obj's immediate prototype and ending with the last
  //       one before null. Do not include obj itself.
  //
  //   getPrototypeChain([])  → [Array.prototype, Object.prototype]
  //   getPrototypeChain(Object.create(null)) → []
}

function lookupDepth(obj, key) {
  // TODO: return how many prototype levels the engine walks to find `key`.
  //       0 = own property, 1 = on the immediate prototype, etc.
  //       Return -1 if the property does not exist anywhere on the chain.
  //
  //   lookupDepth([1], "length")         → 0
  //   lookupDepth([1], "push")           → 1
  //   lookupDepth([1], "hasOwnProperty") → 2
  //   lookupDepth([1], "nope")           → -1
}

function safeDescribe(obj) {
  // TODO: return a plain object mapping every key reachable on obj
  //       (own AND inherited, including non-enumerable, including symbols)
  //       to a short description:
  //
  //         own data property        → { where: "own",    value: <the value> }
  //         inherited data property  → { where: "proto",  value: <the value>, depth: n }
  //         accessor property        → { where: ...,      getter: true }   ← NEVER call it
  //
  //   HARD CONSTRAINT: you must not invoke any getter. Reading obj[key]
  //   on an accessor property runs user code, which may be slow, may mutate
  //   state, or may throw. Use Object.getOwnPropertyDescriptor.
  //
  //   Keys shadowed lower on the chain must appear ONCE, at the depth where
  //   lookup would actually find them.
}
```

**Tests:**

```javascript
console.log(getPrototypeChain([]).length);                     // 2
console.log(getPrototypeChain(Object.create(null)).length);    // 0
console.log(lookupDepth([1], "length"), lookupDepth([1], "push"), lookupDepth([1], "nope"));
// 0 1 -1

const proto = { inherited: "yes", get danger() { throw new Error("invoked!"); } };
const o = Object.create(proto);
o.own = 1;
Object.defineProperty(o, "quiet", { value: 2, enumerable: false });

const d = safeDescribe(o);
console.log(d.own);        // { where: "own", value: 1 }
console.log(d.quiet);      // { where: "own", value: 2 }   ← non-enumerable, still found
console.log(d.inherited);  // { where: "proto", value: "yes", depth: 1 }
console.log(d.danger);     // { where: "proto", getter: true }  ← and NO exception thrown
```

If your `safeDescribe` throws `"invoked!"`, you read a value where you should have read a descriptor. That's the whole point of the exercise.

**Bonus:** make `safeDescribe` stop at `Object.prototype` by default (an option flag), because otherwise every object reports `toString`, `valueOf`, `hasOwnProperty`, and friends — which is noise, not information.

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A–E: reading walks the chain; writing creates an **own** property. `delete` removes only the own one.
- F, G: the write is checked against the chain *before* anything is written. What does a non-writable inherited data property do to `[[Set]]`?
- H, I: one of these lines is a mutation of a shared object and one is an assignment. They behave completely differently, and only one creates an own property.
- K: key ordering is specified — integer-like keys come first, ascending.
- N–Q: five APIs, five different questions. Check the table in the README.
- R–U: `.prototype` is a property on the *function*; `[[Prototype]]` is the link on the *instance*.

**Program 2**
- 4: what exactly does `freeze` change? Look at a descriptor before and after.
- 11: can `delete` reach through the prototype chain at all?

**Program 3**
- Only `normal` and `computed` were given `enumerable: true`. Everything else defaults to `false`.
- `computed` has a getter but no setter — what does `[[Set]]` do with that in strict mode?
- `shared` lives on `base`, so it is not own — but `for...in` doesn't care about own.

**Program 4**
- `getPrototypeChain`: `let p = Object.getPrototypeOf(obj); while (p !== null) { push; p = Object.getPrototypeOf(p); }`
- `lookupDepth`: same loop, but start at `obj` itself and count, checking `Object.hasOwn` at each level.
- `safeDescribe`: walk the chain, and at each level use `Reflect.ownKeys` (it returns strings *and* symbols, enumerable *and* not). Skip a key you've already recorded — the first level that has it is where lookup would stop.
- Use `Object.getOwnPropertyDescriptor(level, key)` and check `desc.get` before touching `desc.value`. An accessor descriptor has no `value` field at all.

</details>

---

## What to Verify

- [ ] Program 1: All 21 outputs (A–U) with a named mechanism for each
- [ ] Program 1: You identified which of H / I is a mutation and which is an assignment
- [ ] Program 2: All 12 True/False answers with one-sentence reasons
- [ ] Program 3: The grid is filled in completely, plus V–Y
- [ ] Program 4: `getPrototypeChain` and `lookupDepth` pass their tests
- [ ] Program 4: `safeDescribe` finds own, inherited, non-enumerable, and symbol keys
- [ ] Program 4: `safeDescribe` does **not** throw on the `danger` getter
