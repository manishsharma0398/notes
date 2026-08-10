# Chapter 10 — Interview Questions: `new`, Constructors, Classes

## Q1: "What does `new` actually do?"

**Answer:** Four steps.

1. Create a new empty object
2. Set its `[[Prototype]]` to `F.prototype`
3. Call `F` with `this` bound to that object
4. If `F` returned an **object**, return that instead; otherwise return the object from step 1

The strongest way to answer is to write it:

```javascript
function myNew(F, ...args) {
  const obj = Object.create(F.prototype);
  const result = F.apply(obj, args);
  return typeof result === "object" && result !== null ? result : obj;
}
```

**The follow-up most people miss — step 4:**

```javascript
function G() { this.a = 1; return { b: 2 }; }
new G();   // { b: 2 }  ← the instance you built is discarded
```

That's how singletons and factory-in-constructor patterns work, and how a stray `return` silently breaks a class.

---

## Q2: Is a "constructor function" a special kind of function?

**Answer:** No. There is no constructor type in JavaScript. **`new` is a property of the call site, not of the function.**

```javascript
function Dog(name) { this.name = name; }

new Dog("Rex");   // this = a new object
Dog("Rex");       // this = undefined (strict) → TypeError
```

The capital letter is a naming convention with no semantic weight. The only thing `new` requires is that the function be constructible — which excludes arrow functions, methods, and generators, since those have no `[[Construct]]` slot.

**Follow-up: how would you detect it inside the function?** `new.target`. Before ES6 the hack was `if (!(this instanceof Dog)) return new Dog(...)`, which `Dog.call(objectWithDogPrototype)` defeats — it mutates the decoy instead of constructing.

---

## Q3: What does `instanceof` actually check?

**The trap:** "whether the object was created by that constructor." It isn't.

**Correct answer:** whether `C.prototype` appears anywhere on the object's prototype chain.

Two consequences that prove it:

```javascript
Object.create(C.prototype) instanceof C;   // true — never went near `new C()`

const real = new C();
C.prototype = {};
real instanceof C;                          // false — the object didn't change, the question did
```

It reads `C.prototype` at call time, so moving the target moves the answer.

**Follow-up: why does `Array.isArray` exist?** Because `instanceof` compares against *this realm's* `Array.prototype`. An array from an iframe, worker, or `vm` context has a different `Array.prototype` on its chain:

```javascript
foreign instanceof Array;   // false
Array.isArray(foreign);     // true — checks an internal slot, realm-proof
```

**Second follow-up:** `instanceof` is overridable via `Symbol.hasInstance`, so it can lie in both directions.

---

## Q4: "Is `class` just syntactic sugar over constructor functions?"

**Answer:** No — and this is the question where "yes" marks you as having read a blog post rather than the spec. Seven differences:

1. **Always strict mode** — no pragma, no opt-out
2. **TDZ, not hoisted** — `new D()` before `class D {}` is a `ReferenceError`
3. **Methods are non-enumerable** — `F.prototype.m = …` is enumerable and leaks into `for...in`
4. **Calling without `new` throws** — the function form fails silently or confusingly
5. **`this` is in the TDZ until `super()`** in a derived constructor
6. **`super` uses `[[HomeObject]]`**, not `this`
7. **`#private` fields are not properties** — invisible to all reflection

Every one prevents a real bug class. The strongest single example is #3, because it fixes a Chapter 9 problem:

```javascript
class C { m() {} }
function F() {} F.prototype.m = function () {};

for (const k in new C()) …   // []          ← nothing leaks
for (const k in new F()) …   // ["m"]       ← the method shows up
```

---

## Q5: "Why does JavaScript behave this way?" — Why can't you touch `this` before `super()`?

**Answer:** Because in a derived class, **the base constructor is what allocates the instance.**

This isn't bureaucracy — it's what makes subclassing built-ins possible:

```javascript
class MyError extends Error {
  constructor(msg) {
    super(msg);          // Error allocates an object with Error's internal slots
    this.name = "MyError";
  }
}
new MyError("boom").stack;   // a real stack trace
```

`Error` and `Array` need engine-level allocation — a real `stack`, a real exotic `length`. A subclass cannot produce those itself. So the base runs first and *hands back* the object that becomes `this`.

Before ES6 this was impossible. `function MyError() { Error.call(this); }` produced an object that was not really an `Error` — no stack, and `MyArray`'s `length` never updated.

**What breaks if it worked differently?** If `this` existed before `super()`, either subclassing built-ins would be impossible, or you'd get a half-initialised object whose internal slots appear midway through the constructor. The TDZ makes the ordering constraint visible instead of silently corrupting.

---

## Q6: Spot the bug

```javascript
function Repository(items) {
  this.items = items;
  return items;
}

const repo = new Repository([1, 2, 3]);
console.log(repo.items);
```

**Answer:** `TypeError: Cannot read properties of undefined` — actually, `repo.items` is `undefined`.

`return items` returns an **array**, which is an object, so step 4 of `new` **replaces the instance with it**. `repo` is the array `[1,2,3]`, not a `Repository`:

```javascript
repo instanceof Repository;  // false
Array.isArray(repo);         // true
repo.items;                  // undefined
```

The author almost certainly added `return items` for convenience when the function was called plainly, without realising it hijacks `new`.

**The fix:** delete the `return`. And note the class form makes this class of mistake much rarer, because a class constructor with a stray return is more visibly wrong.

---

## Q7: "Why doesn't this alternative exist?" — Why can't `#private` fields be accessed dynamically?

**Answer:** There is no `obj["#secret"]`, no `Reflect` access, no proxy trap. That's the entire design.

Symbols were the previous attempt at privacy and they failed, for a reason worth stating precisely: `Object.getOwnPropertySymbols` and `Reflect.ownKeys` enumerate them (Chapter 9). Reflection APIs *must* see all properties — debuggers, serializers, and test frameworks depend on it — so anything that is a property can never be truly private.

So private names had to be **not properties**. They're resolved **lexically at compile time**; `this.#secret` is only meaningful inside the class body that declares it, and the name doesn't exist as a runtime value at all:

```javascript
class Pr { #secret = 1; }
Reflect.ownKeys(new Pr());   // []  — nothing to find
```

**The cost, which is the honest part of the answer:** you cannot pass a private name around, compute it, or access it generically. Privacy and reflection are genuinely in tension, and the committee chose privacy for this feature while leaving properties fully reflectable.

**Follow-up — the brand check:** `#secret in obj` works as an ergonomic test for "was this object built by this class," and it can't be forged.

---

## Q8: What does this print?

```javascript
class Animal {
  static kingdom = "Animalia";
}
class Dog extends Animal {}

console.log(Dog.kingdom);
console.log(Object.getPrototypeOf(Dog) === Animal);
console.log(Object.getPrototypeOf(Dog.prototype) === Animal.prototype);
```

**Answer:** `"Animalia"`, `true`, `true`

**What it proves:** `extends` builds **two** prototype chains — one for instances (`Dog.prototype → Animal.prototype`) and one for the **constructors themselves** (`Dog → Animal`). The second is what makes `static` members inherit.

**The historical contrast worth volunteering:**

```javascript
function OldDog() {}
OldDog.prototype = Object.create(OldAnimal.prototype);
OldDog.prototype.constructor = OldDog;

OldDog.kingdom;  // undefined — the ES5 pattern only built the FIRST chain
```

You had to add `Object.setPrototypeOf(OldDog, OldAnimal)` by hand, and almost nobody did — which is why "statics don't inherit" was widely believed to be a JavaScript rule rather than a gap in one pattern.

---

## Q9: Why is `.constructor` unreliable?

**Answer:** Because it's an ordinary writable data property on `.prototype`, not an engine-maintained fact.

```javascript
function A() {}
A.prototype = { hello() {} };     // whole-object replacement
new A().constructor === A;         // false — link destroyed
new A().constructor === Object;    // true  — inherited from Object.prototype

A.prototype.constructor = B;       // or just lie outright
```

The first case is the common one: every pre-ES6 inheritance snippet replaced `.prototype` wholesale, which is why they all carried a repair line:

```javascript
Child.prototype.constructor = Child;
```

Miss it and `instance.constructor` silently reports `Object`. Use `instanceof`, `Symbol.toStringTag`, or duck typing instead — `.constructor` is documentation.

---

## Q10: Trap — predict the output

```javascript
class Parent {
  greet() { return "parent"; }
}
class Child extends Parent {
  greet() { return "child + " + super.greet(); }
}

const detached = new Child().greet;
console.log(detached.call(new Child()));
```

**Answer:** `"child + parent"`

**What it tests:** `super` does **not** mean `this.__proto__.greet`. Each method secretly records the object it was defined in — its `[[HomeObject]]` — and `super.greet()` starts its lookup from *that object's* prototype. So even torn off and re-invoked with `call`, `Child.prototype.greet` still knows its home is `Child.prototype` and finds `Parent.prototype.greet`.

**Why it can't be `this`-based** — a three-level chain would recurse forever:

```javascript
class A { who() { return "A"; } }
class B extends A { who() { return "B←" + super.who(); } }
class C extends B { who() { return "C←" + super.who(); } }

new C().who();   // "C←B←A"
```

If `super` resolved from `this`, `B`'s `super.who()` would look up from `this`'s chain — which still starts at `C.prototype` — and find `B.who` again, forever. Anchoring to the *definition site* rather than the *call site* is what makes multi-level inheritance terminate.
