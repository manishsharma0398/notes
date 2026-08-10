# Chapter 10 Exercise — `new`, Constructors, and Class Internals

## Overview

Applies only Chapter 10 concepts: the four steps of `new`, the return-value override, `new.target`, `.constructor`, `instanceof`, the seven class differences, and the two chains built by `extends`.

**Rule: do not run the code before answering.** Verify afterwards.

For every answer, name the **mechanism** — "step 4 of `new` replaced the instance", "class methods are non-enumerable", "the static chain", "`instanceof` checks the chain, not the origin".

**Estimated time:** 30–60 minutes

---

## Program 1 — Output Tracer

```javascript
"use strict";

function F() { this.a = 1; }
F.prototype.b = 2;
const f = new F();

console.log(Object.keys(f));          // << A
console.log(f.b);                     // << B
console.log(Object.hasOwn(f, "b"));   // << C
console.log(f.constructor === F);     // << D
```

```javascript
"use strict";

function G() { this.x = 1; return { y: 2 }; }
function H() { this.x = 1; return "str"; }

console.log(JSON.stringify(new G()));  // << E
console.log(JSON.stringify(new H()));  // << F
```

```javascript
"use strict";

function C() {}
const c1 = new C();
const c2 = Object.create(C.prototype);

console.log(c1 instanceof C);   // << G
console.log(c2 instanceof C);   // << H
C.prototype = {};
console.log(c1 instanceof C);   // << I
```

```javascript
"use strict";

class K { m() {} }
function L() {}
L.prototype.m = function () {};

const kk = []; for (const k in new K()) kk.push(k);
const ll = []; for (const k in new L()) ll.push(k);

console.log(kk);   // << J
console.log(ll);   // << K
```

```javascript
"use strict";

class P { static s = "p"; }
class Q extends P {}

console.log(Q.s);                                                 // << L
console.log(Object.getPrototypeOf(Q) === P);                      // << M
console.log(Object.getPrototypeOf(Q.prototype) === P.prototype);  // << N
```

```javascript
"use strict";

class R { #p = 1; pub = 2; }
const r = new R();

console.log(Reflect.ownKeys(r));   // << O
console.log(JSON.stringify(r));    // << P
```

```javascript
"use strict";

class S {}
try {
  S();
} catch (e) {
  console.log(e.constructor.name);  // << Q
}
```

**G, H, I are the set to slow down on.** Two of them look like they should disagree and don't; one looks stable and isn't.

---

## Program 2 — True/False Reasoning

1. Only functions written to be constructors can be used with `new`
2. `new F()` always returns the object that `F` built
3. `instanceof` checks whether the object was created by that constructor
4. `.constructor` reliably identifies an object's type
5. `class` is purely syntactic sugar over constructor functions
6. Class methods appear in `for...in` over an instance
7. Calling a class without `new` returns `undefined`
8. `static` members are inherited by subclasses
9. A `#private` field appears in `Object.getOwnPropertyNames`
10. You can read `this` before calling `super()` in a derived constructor
11. `arr instanceof Array` is `true` for any array from any context
12. Class fields (`count = 0`) live on the prototype, like methods

---

## Program 3 — Constructor Detective

```javascript
"use strict";

function Base() {}
Base.prototype.hello = function () { return "hi"; };

function Derived() {}
Derived.prototype = Object.create(Base.prototype);

const d = new Derived();
```

Answer these **without running**:

```
R: d.hello()                          →
S: d instanceof Derived               →
T: d instanceof Base                  →
U: d.constructor === Derived          →
V: d.constructor === Base             →
W: What single line repairs U?        →
```

Then the modern equivalent:

```javascript
class MBase { hello() { return "hi"; } }
class MDerived extends MBase {}
const m = new MDerived();
```

```
X: m.constructor === MDerived         →
Y: MDerived.hello                     →    (the CLASS, not an instance)
Z: Object.getPrototypeOf(MDerived) === MBase  →
```

**Y is the one to think about.** `hello` is defined in `MBase`'s body — is it reachable from the constructor?

---

## Program 4 — Implement the Internals

```javascript
"use strict";

function myNew(F, ...args) {
  // TODO: implement the four steps of `new`
  //   1. create a new object
  //   2. link it to F.prototype
  //   3. call F with `this` bound to it
  //   4. return F's result if it's an object, else the new object
  //
  // Do NOT use the `new` keyword anywhere in this function.
}

function myInstanceof(obj, Ctor) {
  // TODO: implement `instanceof` without using the operator
  //   - walk obj's prototype chain
  //   - return true if you ever land on Ctor.prototype
  //   - return false at the end of the chain
  //   - primitives have no chain → false
  //   - Ctor must be a function → TypeError otherwise (that's what the real one does)
}

function describeCallable(fn) {
  // TODO: return a report about a function/class WITHOUT calling it:
  //   {
  //     isClass:        was it declared with `class`?
  //     hasPrototype:   does it have a .prototype property?
  //     methodNames:    non-constructor own keys of .prototype
  //     staticNames:    own keys of the function itself (minus length/name/prototype)
  //     parent:         Object.getPrototypeOf(fn) — the STATIC chain link, or null
  //   }
  //
  // For isClass: Function.prototype.toString gives you the source text.
  //   Arrow functions and methods are NOT constructible — worth detecting too.
}
```

**Tests:**

```javascript
function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return `${this.name} barks`; };

const a = new Dog("Rex");
const b = myNew(Dog, "Rex");
console.log(b.speak(), Object.getPrototypeOf(b) === Dog.prototype);  // "Rex barks" true

function ReturnsObject() { this.a = 1; return { b: 2 }; }
console.log(JSON.stringify(myNew(ReturnsObject)));   // {"b":2}

function ReturnsPrimitive() { this.a = 1; return 42; }
console.log(JSON.stringify(myNew(ReturnsPrimitive))); // {"a":1}

console.log(myInstanceof(a, Dog));                    // true
console.log(myInstanceof(Object.create(Dog.prototype), Dog)); // true
console.log(myInstanceof({}, Dog));                   // false
console.log(myInstanceof(5, Dog));                    // false
console.log(myInstanceof([], Object));                // true — Object.prototype IS on the chain

class Animal { static kingdom = "A"; speak() {} }
class Cat extends Animal { meow() {} }
console.log(describeCallable(Cat));
// { isClass: true, hasPrototype: true, methodNames: ["meow"],
//   staticNames: [], parent: Animal }
```

**Then verify `myNew` properly:** for each of the constructors above, assert your version produces an object structurally identical to the real `new` — same own keys, same prototype, same `instanceof` result.

**Bonus:** make `myNew` throw a `TypeError` for a non-constructible target (an arrow function), matching the real behaviour.

---

## Hints

<details>
<summary>Hints (read only if stuck)</summary>

**Program 1**
- A–D: which of `a`, `b`, `constructor` is *own*? Only one was assigned by the constructor body.
- E, F: step 4. Objects replace the instance; primitives don't.
- G–I: `instanceof` reads `C.prototype` at call time and looks for it on the chain. Neither "was it built by C" nor "does it look like a C" is the question.
- J, K: one of these two ways of adding a method produces an enumerable property.
- L–N: `extends` builds two links, not one.
- O, P: is `#p` a property at all?

**Program 2**
- 7: what does a class do when called without `new` — return something, or refuse?
- 11: think about an array from an iframe or `vm` context.
- 12: are fields shared between instances, or per-instance?

**Program 3**
- `Derived.prototype = Object.create(Base.prototype)` throws away the auto-created `.prototype` object — and with it, something that was on it.
- V: if the back-link is gone, where does lookup find `constructor` instead?
- Y: `hello` is an instance method. Which of the two chains would have to contain it for `MDerived.hello` to work?

**Program 4**
- `myNew`: `Object.create(F.prototype)` does steps 1 and 2 in one call. `F.apply(obj, args)` is step 3.
- Step 4's test must accept objects *and functions* — `typeof result === "object"` misses a returned function, which also counts.
- `myInstanceof`: `let p = Object.getPrototypeOf(obj); while (p !== null) { if (p === Ctor.prototype) return true; p = Object.getPrototypeOf(p); }`
- `Object.getPrototypeOf` throws on `null`/`undefined` but coerces primitives — guard first.
- `describeCallable`: `Function.prototype.toString.call(fn).startsWith("class")` is the practical class test. For method names, `Reflect.ownKeys(fn.prototype).filter(k => k !== "constructor")`.
- Arrow functions have **no `.prototype` property at all** — that's the cleanest way to spot a non-constructible function.

</details>

---

## What to Verify

- [ ] Program 1: All 17 outputs (A–Q) with a named mechanism
- [ ] Program 1: You can explain why G, H, and I differ
- [ ] Program 2: All 12 True/False with one-sentence reasons
- [ ] Program 3: R–Z, including the repair line in W
- [ ] Program 4: `myNew` matches real `new` on all three constructors
- [ ] Program 4: `myInstanceof` handles primitives and `Object.create` cases
- [ ] Program 4: `describeCallable` never calls the function it inspects
- [ ] Program 4: No `new` keyword inside `myNew`, no `instanceof` inside `myInstanceof`
