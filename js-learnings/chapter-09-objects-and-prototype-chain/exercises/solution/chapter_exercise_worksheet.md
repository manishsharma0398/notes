# Chapter 9 Worksheet — Objects, Property Access, and the Prototype Chain

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, name the **mechanism** — "walked the chain to depth 1", "created an own property", "vetoed by a non-writable inherited property", "enumerable: false so `Object.keys` skips it".

---

## Program 1 — Output Tracer

```javascript
"use strict";

const proto = { x: 1 };
const obj = Object.create(proto);

console.log(obj.x); // << A
console.log(Object.hasOwn(obj, "x")); // << B
obj.x = 2;
console.log(proto.x); // << C
console.log(Object.hasOwn(obj, "x")); // << D
delete obj.x;
console.log(obj.x); // << E
```

```javascript
"use strict";

const proto = {};
Object.defineProperty(proto, "locked", { value: 1, writable: false });
const o = Object.create(proto);

try {
  o.locked = 99;
  console.log("assigned"); // << F
} catch (e) {
  console.log(e.constructor.name);
}
console.log(o.locked); // << G
```

```javascript
"use strict";

const proto = { list: [] };
const a = Object.create(proto);
const b = Object.create(proto);

a.list.push(1);
console.log(b.list.length); // << H
a.list = [9];
console.log(b.list.length); // << I
console.log(Object.hasOwn(b, "list")); // << J
```

```javascript
"use strict";

const o = { 2: "a", 1: "b", z: "c", a: "d" };
console.log(Object.keys(o)); // << K

o[Symbol("k")] = "e";
console.log(Object.keys(o).length); // << L
console.log(JSON.stringify(o)); // << M
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

console.log(Object.keys(o)); // << N
console.log(forIn); // << O
console.log(Object.getOwnPropertyNames(o)); // << P
console.log("inh" in o, Object.hasOwn(o, "inh")); // << Q
```

```javascript
"use strict";

function F() {}
const f = new F();

console.log(Object.getPrototypeOf(f) === F.prototype); // << R
console.log(f.prototype); // << S
console.log(Object.getPrototypeOf(F) === Function.prototype); // << T
console.log(F.prototype.constructor === F); // << U
```

Answer:

````
A: 1
Why: since, obj don't have a property x, js engine walks the [[Prototype]] path which is proto object here and it finds it defined there.Hence, it returns 1

B: false
Why: x is not obj's own proerty i.e it is not declared lcoally there. x is available on obj through inheritance

C: 1
Why: obj.x =2 as here we assign x lcoally to the obj object

D: true
Why: obj.x =2 assign the value locally to x instead of updating in proto

E: 1
Why: delete can only delete from the object properties locally. SO, proto.x is untouched and next lookup walks up and finds it.

F: TypeError
Why: Although, locked is not obj's own property and on the inheritance chain it is defined as writable:false therefore, it will not be allowed to overwritten and hence, we get Error becasue we are in strict mode, else it would have failed silently

G: 1
Why: As, our assignment operation failed the obj don't have a property locked, js engine walks the [[Prototype]] path which is proto object here and it finds it defined there. Hence, it returns 1

```javascript
"use strict";

const proto = { list: [] };
const a = Object.create(proto);
const b = Object.create(proto);

a.list.push(1);
console.log(b.list.length); // << H
a.list = [9];
console.log(b.list.length); // << I
console.log(Object.hasOwn(b, "list")); // << J
````

H: 1
Why: js engine sees there is no list property defined in a object.So, it goes to [[Prototype]] (proto) and checks there it finds the list, so the operation is done on that list. In the same manner .length is also done on the proto's list so we get 1.

I: 1
Why: a.list = [9] creates a property on a. so proto.list is untouched — it's still the array [1] that H pushed into. b has no own list, so it still resolves to that array → length 1.

Is H a mutation or an assignment? Is I?
Answer: H is a mutation, I is an assignment

J: False
Why: because list is not a property of b, it is inherited from proto

```javascript
"use strict";

const o = { 2: "a", 1: "b", z: "c", a: "d" };
console.log(Object.keys(o)); // << K

o[Symbol("k")] = "e";
console.log(Object.keys(o).length); // << L
console.log(JSON.stringify(o)); // << M
```

K: ["1", "2", "z", "a"]
Why: It follows the order for keys: 1. ascending numbers 2. string as insertion order 3. symbol as insertion order

L: 4
Why: Object.keys() only count string keys

M: {"1": "b", "2": "a", "z": "c", "a": "d"}
Why: it stringifies the o in the order and symbols are excluded

```javascript
"use strict";

const proto = { inh: 1 };
const o = Object.create(proto, {
  vis: { value: 1, enumerable: true },
  hid: { value: 2 },
});

const forIn = [];
for (const k in o) forIn.push(k);

console.log(Object.keys(o)); // << N
console.log(forIn); // << O
console.log(Object.getOwnPropertyNames(o)); // << P
console.log("inh" in o, Object.hasOwn(o, "inh")); // << Q
```

all descriptors, are set to false if not specified, opposite of Object literals.

N: ["vis"]
Why: Object.keys() list own string properties that are enumerable: true

O: ["vis", "inh"]
Why: for in lists own and inherited properties that are enumerable:true

P: ["vis", "hid"]
Why: vis and hid are the properties of o; inh is not, inh is on proto. getOwnPropertyNames shows enumerable:false properties also

Q: true, false
Why: key in object can walk through the prototype chain. inh is not a local propert of o, it is in it's proto

```javascript
"use strict";

function F() {}
const f = new F();

console.log(Object.getPrototypeOf(f) === F.prototype); // << R
console.log(f.prototype); // << S
console.log(Object.getPrototypeOf(F) === Function.prototype); // << T
console.log(F.prototype.constructor === F); // << U
```

R: true
Why: f's [[Prototype]] is F.prototype

S: undefined
Why: as F is function its [[Prototype]] points to Function.prototype while f doesn't have any prototype

T: true
Why:

U: true
Why:

```

---

## Program 2 — True/False Reasoning

```

1. Object.keys(obj) includes inherited properties
   Answer: False
   Why: it only includes own properties whose keys are strings and whose enumerable is set to true.

2. "toString" in {} is true
   Answer: True
   Why: walks through the Oject.protototype and finds there

3. Assigning to an inherited property modifies the prototype
   Answer: False
   Why: assignment creates an own property; the prototype is untouched

4. Object.freeze(o) makes o.nested.x = 5 fail
   Answer: False
   Why: only freezes top level, can't re-assign the o's property nested but can mutate it

5. Symbol-keyed properties are private
   Answer: False
   Why: They prevent collisions

6. obj[1] and obj["1"] refer to the same property
   Answer: True
   Why: 1 gets converted to string (type coercion)

7. `${Object.create(null)}` works fine
   Answer: False
   Why: it work likes a dictionary, as the proto will be null, but it is wrapped in temperal literals so toPrimitive({}) doesn't have proto we can't convert to string i.e. primitive

8. A getter property's descriptor has a value field
   Answer: False
   Why: no value field at all for getter

9. Object.defineProperty(o, "k", { value: 1 }) creates an enumerable property
   Answer: False
   Why: descriptor are set to false, if created using defineProperty unless explicitly set to true

10. A prototype chain can contain a cycle
    Answer: False
    Why: it will be a infinite loop

11. delete obj.x where x is inherited removes it from the prototype
    Answer: no
    Why: cannot delete inherited properties

12. for...in includes symbol keys
    Answer: False
    Why: for..in includes own and inherited properties and strings property keys only

````

---

## Program 3 — Descriptor Detective

```javascript
"use strict";

const base = { shared: "from base" };

const thing = Object.create(base, {
  normal: { value: 1, writable: true, enumerable: true, configurable: true },
  readonly: { value: 2, enumerable: true },
  invisible: { value: 3, writable: true, configurable: true },
  computed: {
    get() {
      return "computed!";
    },
    enumerable: true,
  },
});
````

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
console.log(getPrototypeChain([]).length); // 2
console.log(getPrototypeChain(Object.create(null)).length); // 0
console.log(
  lookupDepth([1], "length"),
  lookupDepth([1], "push"),
  lookupDepth([1], "nope"),
);
// 0 1 -1

const proto = {
  inherited: "yes",
  get danger() {
    throw new Error("invoked!");
  },
};
const o = Object.create(proto);
o.own = 1;
Object.defineProperty(o, "quiet", { value: 2, enumerable: false });

const d = safeDescribe(o);
console.log(d.own); // { where: "own", value: 1 }
console.log(d.quiet); // { where: "own", value: 2 }
console.log(d.inherited); // { where: "proto", value: "yes", depth: 1 }
console.log(d.danger); // { where: "proto", getter: true }  ← no exception
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
