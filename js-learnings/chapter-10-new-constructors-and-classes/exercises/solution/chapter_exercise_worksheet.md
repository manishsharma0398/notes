# Chapter 10 Worksheet — `new`, Constructors, and Class Internals

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, name the **mechanism** — "step 4 of `new` replaced the instance", "class methods are non-enumerable", "the static chain", "`instanceof` checks the chain, not the origin".

---

## Program 1 — Output Tracer

```javascript
"use strict";

function F() {
  this.a = 1;
}
F.prototype.b = 2;
const f = new F();

console.log(Object.keys(f)); // << A
console.log(f.b); // << B
console.log(Object.hasOwn(f, "b")); // << C
console.log(f.constructor === F); // << D
```

Answer:

```
A: ["a"]
Why: b is created inside .prototype and Object.keys cannot walk the prototype chain it only lists own properties that too if their keys are string and they enumerable descriptor is set to true

B: 2
Why: b not found in f so it will walk the protype chain until it finds the property, if not found anywhere it returns undefined

C: false
Why: b is an inherited property from prototype not f own's property

D: true
Why: js backlinks the actual function on .prototype as constructor: function
```

```javascript
"use strict";

function G() {
  this.x = 1;
  return { y: 2 };
}
function H() {
  this.x = 1;
  return "str";
}

console.log(JSON.stringify(new G())); // << E
console.log(JSON.stringify(new H())); // << F
```

Answer:

```
E: {"y":2}
Why: The return value is an object, so step 4 uses it instead of the instance. The object new built (with x: 1) is discarded — which is why x doesn't appear at all, and why new G() instanceof G is false.

F: {"x":1}
Why: when calling a function with new keyword, the primitive return is ignored and new keeps the object it built.
```

```javascript
"use strict";

function C() {}
const c1 = new C();
const c2 = Object.create(C.prototype);

console.log(c1 instanceof C); // << G
console.log(c2 instanceof C); // << H
C.prototype = {};
console.log(c1 instanceof C); // << I
```

Answer:

```
G: true
Why: c1 proptype is in C prototype' schain.

H: true
Why: c2's prototype is in C's prototype chain

I: false
Why: c1 proptype still points to C's old prototype object

Why do G, H and I differ? (one sentence)
Answer: becasue instanceof doesn't ask who built that object it asks where they C.protype right now is on that object's chain
```

```javascript
"use strict";

class K {
  m() {}
}
function L() {}
L.prototype.m = function () {};

const kk = [];
for (const k in new K()) kk.push(k);
const ll = [];
for (const k in new L()) ll.push(k);

console.log(kk); // << J
console.log(ll); // << K
```

Answer:

```
J: []
Why: class methods are not enumerable

K: ["m"]
Why:methods in L are enumerable, and for in can list inherited properties also

```

```javascript
"use strict";

class P {
  static s = "p";
}
class Q extends P {}

console.log(Q.s); // << L
console.log(Object.getPrototypeOf(Q) === P); // << M
console.log(Object.getPrototypeOf(Q.prototype) === P.prototype); // << N
```

Answer:

```
L: "p"
Why: s is not found in Q so through static chain it looks on P where it finds s.

M: true
Why: Q's [[Prototype]] is P

N: true
Why: extends create two chains - stactic and prototype chain.From prototyoe chain: Q.prototype -> P.prototype -> Object.prototype -> null
```

```javascript
"use strict";

class R {
  #p = 1;
  pub = 2;
}
const r = new R();

console.log(Reflect.ownKeys(r)); // << O
console.log(JSON.stringify(r)); // << P
```

Answer:

```
O: ["pub"]
Why: # are private members only accessed by methods in the class

P: {"pub":2}
Why: same as above
```

```javascript
"use strict";

class S {}
try {
  S();
} catch (e) {
  console.log(e.constructor.name); // << Q
}
```

Answer:

```
Q: TypeError
Why: Class cannot be invoked without new

```

---

## Program 2 — True/False Reasoning

```

1. Only functions written to be constructors can be used with new
   Answer:
   Why:

2. new F() always returns the object that F built
   Answer:
   Why:

3. instanceof checks whether the object was created by that constructor
   Answer:
   Why:

4. .constructor reliably identifies an object's type
   Answer:
   Why:

5. class is purely syntactic sugar over constructor functions
   Answer:
   Why:

6. Class methods appear in for...in over an instance
   Answer:
   Why:

7. Calling a class without new returns undefined
   Answer:
   Why:

8. static members are inherited by subclasses
   Answer:
   Why:

9. A #private field appears in Object.getOwnPropertyNames
   Answer:
   Why:

10. You can read this before calling super() in a derived constructor
    Answer:
    Why:

11. arr instanceof Array is true for any array from any context
    Answer:
    Why:

12. Class fields (count = 0) live on the prototype, like methods
    Answer:
    Why:

```

---

## Program 3 — Constructor Detective

```javascript
"use strict";

function Base() {}
Base.prototype.hello = function () {
  return "hi";
};

function Derived() {}
Derived.prototype = Object.create(Base.prototype);

const d = new Derived();
```

```
R: d.hello()
Why:

S: d instanceof Derived
Why:

T: d instanceof Base
Why:

U: d.constructor === Derived
Why:

V: d.constructor === Base
Why:

W: What single line repairs U?
Answer:
```

```javascript
class MBase {
  hello() {
    return "hi";
  }
}
class MDerived extends MBase {}
const m = new MDerived();
```

```
X: m.constructor === MDerived
Why:

Y: MDerived.hello          (the CLASS, not an instance)
Why (which chain would need to contain it?):

Z: Object.getPrototypeOf(MDerived) === MBase
Why:
```

---

## Program 4 — Implement the Internals

Constraints: no `new` inside `myNew`; no `instanceof` inside `myInstanceof`; `describeCallable` must never call the function it inspects.

```javascript
"use strict";

function myNew(F, ...args) {
  // Write your implementation here
}

function myInstanceof(obj, Ctor) {
  // Write your implementation here
}

function describeCallable(fn) {
  // Write your implementation here
}

// Tests:
function Dog(name) {
  this.name = name;
}
Dog.prototype.speak = function () {
  return `${this.name} barks`;
};

const b = myNew(Dog, "Rex");
console.log(b.speak(), Object.getPrototypeOf(b) === Dog.prototype); // "Rex barks" true

function ReturnsObject() {
  this.a = 1;
  return { b: 2 };
}
console.log(JSON.stringify(myNew(ReturnsObject))); // {"b":2}

function ReturnsPrimitive() {
  this.a = 1;
  return 42;
}
console.log(JSON.stringify(myNew(ReturnsPrimitive))); // {"a":1}

console.log(myInstanceof(new Dog("x"), Dog)); // true
console.log(myInstanceof(Object.create(Dog.prototype), Dog)); // true
console.log(myInstanceof({}, Dog)); // false
console.log(myInstanceof(5, Dog)); // false
console.log(myInstanceof([], Object)); // true

class Animal {
  static kingdom = "A";
  speak() {}
}
class Cat extends Animal {
  meow() {}
}
console.log(describeCallable(Cat));
// { isClass: true, hasPrototype: true, methodNames: ["meow"],
//   staticNames: [], parent: Animal }
```

Your implementation:

```javascript
function myNew(F, ...args) {
  // Write here
}

function myInstanceof(obj, Ctor) {
  // Write here
}

function describeCallable(fn) {
  // Write here
}
```

```
Test results:

Anything that surprised you while implementing:
```

Self-assessment:

```
- [ ] myNew matches real new on all three constructors (own keys, prototype, instanceof)
- [ ] myNew's step-4 check accepts a returned FUNCTION as well as an object
- [ ] myInstanceof returns false for primitives without throwing
- [ ] myInstanceof(Object.create(C.prototype), C) is true
- [ ] describeCallable never invokes fn
- [ ] describeCallable detects a class vs an ordinary function
- [ ] describeCallable reports the static-chain parent
- [ ] No `new` in myNew, no `instanceof` in myInstanceof
- [ ] Bonus: myNew throws TypeError for an arrow function
```

---

```

```
