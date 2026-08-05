# Chapter 9 Worksheet — Objects, Property Access, and the Prototype Chain

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, name the **mechanism** — "walked the chain to depth 1", "created an own property", "vetoed by a non-writable inherited property", "enumerable: false so `Object.keys` skips it".

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
  console.log("assigned");            // << F
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
console.log(Object.keys(o));        // << K

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

console.log(Object.keys(o));                      // << N
console.log(forIn);                               // << O
console.log(Object.getOwnPropertyNames(o));       // << P
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

Answer:

```
A:
Why:

B:
Why:

C:
Why:

D:
Why:

E:
Why:

F:
Why:

G:
Why:

H:
Why:

I:
Why:

Is H a mutation or an assignment? Is I?
Answer:

J:
Why:

K:
Why:

L:
Why:

M:
Why:

N:
Why:

O:
Why:

P:
Why:

Q:
Why:

R:
Why:

S:
Why:

T:
Why:

U:
Why:
```

---

## Program 2 — True/False Reasoning

```
1. Object.keys(obj) includes inherited properties
Answer:
Why:

2. "toString" in {} is true
Answer:
Why:

3. Assigning to an inherited property modifies the prototype
Answer:
Why:

4. Object.freeze(o) makes o.nested.x = 5 fail
Answer:
Why:

5. Symbol-keyed properties are private
Answer:
Why:

6. obj[1] and obj["1"] refer to the same property
Answer:
Why:

7. `${Object.create(null)}` works fine
Answer:
Why:

8. A getter property's descriptor has a value field
Answer:
Why:

9. Object.defineProperty(o, "k", { value: 1 }) creates an enumerable property
Answer:
Why:

10. A prototype chain can contain a cycle
Answer:
Why:

11. delete obj.x where x is inherited removes it from the prototype
Answer:
Why:

12. for...in includes symbol keys
Answer:
Why:
```

---

## Program 3 — Descriptor Detective

```javascript
"use strict";

const base = { shared: "from base" };

const thing = Object.create(base, {
  normal:    { value: 1, writable: true, enumerable: true, configurable: true },
  readonly:  { value: 2, enumerable: true },
  invisible: { value: 3, writable: true, configurable: true },
  computed: {
    get() { return "computed!"; },
    enumerable: true,
  },
});
```

Fill in the grid:

```
key         own?   enumerable?  writable?   Object.keys?  for...in?  JSON?   thing.key gives
─────────────────────────────────────────────────────────────────────────────────────────────
normal
readonly
invisible
computed
shared
```

```
V: thing.readonly = 99;   what happens?
Why:

W: thing.computed = 99;   what happens?
Why:

X: Object.keys(thing)
Why:

Y: Reflect.ownKeys(thing)
Why:
```

---

## Program 4 — Build the Chain Tools

```javascript
"use strict";

function getPrototypeChain(obj) {
  // Write your implementation here
}

function lookupDepth(obj, key) {
  // Write your implementation here
}

function safeDescribe(obj) {
  // Write your implementation here
  // HARD CONSTRAINT: never invoke a getter
}

// Tests:
console.log(getPrototypeChain([]).length);                  // 2
console.log(getPrototypeChain(Object.create(null)).length); // 0
console.log(lookupDepth([1], "length"), lookupDepth([1], "push"), lookupDepth([1], "nope"));
// 0 1 -1

const proto = { inherited: "yes", get danger() { throw new Error("invoked!"); } };
const o = Object.create(proto);
o.own = 1;
Object.defineProperty(o, "quiet", { value: 2, enumerable: false });

const d = safeDescribe(o);
console.log(d.own);       // { where: "own", value: 1 }
console.log(d.quiet);     // { where: "own", value: 2 }
console.log(d.inherited); // { where: "proto", value: "yes", depth: 1 }
console.log(d.danger);    // { where: "proto", getter: true }  ← no exception
```

Your implementation:

```javascript
function getPrototypeChain(obj) {
  // Write here
}

function lookupDepth(obj, key) {
  // Write here
}

function safeDescribe(obj) {
  // Write here
}
```

```
Test results:

Did safeDescribe throw "invoked!" on your first attempt? If so, what caused it:
```

Self-assessment:

```
- [ ] getPrototypeChain returns [] for a null-prototype object
- [ ] lookupDepth returns -1 for a missing key, 0 for own
- [ ] safeDescribe finds non-enumerable properties
- [ ] safeDescribe finds symbol keys
- [ ] safeDescribe reports inherited properties with the correct depth
- [ ] safeDescribe never invokes a getter (the danger test passes)
- [ ] A shadowed key appears ONCE, at the depth lookup would find it
- [ ] Bonus: option to stop the walk at Object.prototype
```

---
