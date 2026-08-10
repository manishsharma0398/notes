# Chapter 10 — `new`, Constructors, and Class Syntax Internals

> **Read this box first.** Everything below is elaboration.
>
> 1. **`new` is four steps**, and you can implement it yourself in five lines.
> 2. A "constructor" is not a kind of function. **Any function can be called with `new`** — `new` is a property of the *call site*, not the function.
> 3. `.constructor` is an **ordinary writable property** on `.prototype`. It can be wrong, and often is.
> 4. `instanceof` does **not** check "was this made by that constructor." It walks the prototype chain looking for `C.prototype`.
> 5. **`class` is not just sugar.** Seven behaviours differ from the function form, and every one of them is a bug-preventer.
> 6. A class hierarchy builds **two** prototype chains — one for instances, one for the constructors themselves (`static` inheritance).

---

## Part 1 — What `new` Actually Does

Four steps. That's the whole mechanism:

```
new F(args)

  1. Create a brand-new empty object
  2. Set its [[Prototype]] to F.prototype        ← Chapter 9's link
  3. Call F with `this` bound to that object     ← Chapter 5's binding
  4. If F returned an OBJECT, use that instead.
     Otherwise use the object from step 1.
```

You can write it yourself:

```javascript
function myNew(F, ...args) {
  const obj = Object.create(F.prototype);   // steps 1 + 2
  const result = F.apply(obj, args);        // step 3
  return typeof result === "object" && result !== null ? result : obj;  // step 4
}
```

That's not an approximation — it's what the language does, minus `new.target` and a few checks.

### Walked through with a real constructor

```javascript
function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return `${this.name} barks`; };

myNew(Dog, "Rex");
```

Substituting `F = Dog` and `args = ["Rex"]`, line by line:

```
const obj = Object.create(F.prototype)
  F.prototype IS Dog.prototype — the object Dog hands out to its instances.
  (NOT Function.prototype, which is what Dog itself inherits from.)
  → obj = {}  with  obj.[[Prototype]] = Dog.prototype
  → obj.speak already works, inherited, before the constructor has even run

const result = F.apply(obj, args)
  → runs  Dog("Rex")  with `this` = obj      (Chapter 5's explicit binding)
  → the body executes  this.name = "Rex"
  → obj is now { name: "Rex" }
  → Dog has no return statement, so result = undefined

return typeof result === "object" && ... ? result : obj
  → undefined is not an object → return obj
  → { name: "Rex" },  linked to Dog.prototype
```

```javascript
const rex = myNew(Dog, "Rex");
rex.speak();                                // "Rex barks"  — found on Dog.prototype
Object.getPrototypeOf(rex) === Dog.prototype; // true
rex instanceof Dog;                          // true
Object.keys(rex);                            // ["name"] — only what the body assigned
```

**The step people misread is the first one.** `F.prototype` is the *box the function carries for its instances*, not the function's own prototype:

```
Dog  ── .prototype ──►  Dog.prototype        ← step 2 uses THIS
 │                        speak
 │ [[Prototype]]
 ▼
Function.prototype       ← Dog's own link (call/apply/bind). Never involved in `new`.
```

Use the wrong one and you get an instance with `call`/`apply`/`bind` and no `speak` — and every constructor in the program would produce identical, useless objects.

**Nothing about `F` had to be special.** There is no "constructor function" type in JavaScript. `new` works on any ordinary function, and whether a function is a "constructor" is decided entirely by how you *call* it:

```javascript
function Dog(name) { this.name = name; }

new Dog("Rex");   // this = a new object  → { name: "Rex" }
Dog("Rex");       // this = undefined in strict mode → TypeError
```

The same function, two call sites, two completely different meanings for `this`.

### Step 4 — the return-value override

This is the step people forget, and it's occasionally load-bearing:

```javascript
function G() { this.a = 1; return { b: 2 }; }
function H() { this.a = 1; return 42; }

new G();   // { b: 2 }    ← the returned OBJECT wins; the built one is discarded
new H();   // { a: 1 }    ← a primitive return is IGNORED
```

Returning an object from a constructor silently replaces the instance. That's how the singleton and factory-inside-constructor patterns work — and how a stray `return` statement can quietly break a class.

### You can see step 4 happen in the console

Node and browser devtools print an object's **constructor name** before the braces whenever its prototype isn't plain `Object.prototype`:

```javascript
{ x: 1 }        // { x: 1 }           ← plain object, no label
new Foo()       // Foo { x: 1 }       ← label: its chain leads to Foo.prototype
```

So logging `G` and `H` shows which branch of step 4 ran, with no `instanceof` needed:

```javascript
console.log(new G());   // { b: 2 }      ← NO label
console.log(new H());   // H { a: 1 }    ← labelled

new G() instanceof G;   // false — it's the returned literal, not a G
new H() instanceof H;   // true  — the primitive was ignored, instance survived
```

`new G()` **is not a `G`**. The returned object replaced the instance, so its prototype is `Object.prototype` and the console prints no label. `new H()` kept the constructed object, so it's labelled `H`.

**A related trap in the same experiment:** calling `G()` or `H()` *without* `new` throws in strict mode (`this` is `undefined`), but in a sloppy-mode sandbox `this` is the global object — so `this.a = 1` silently creates a **global variable** and nothing appears to go wrong. That silent damage is exactly what difference #4 below prevents.

### `new.target` — "was I called with `new`?"

```javascript
function K() {
  return new.target === undefined ? "called plainly" : "called with new";
}
K();       // "called plainly"
new K();   // "called with new"
```

It exists because before ES6 there was no reliable way to detect the difference. The old hack — `if (!(this instanceof K)) return new K()` — breaks under `call`/`apply`. `new.target` is the honest check, and it's what makes classes able to refuse a plain call.

---

## Part 2 — `.constructor` Is Just a Property

When you declare a function, JavaScript automatically creates its `.prototype` object and puts a `constructor` back-link on it:

```javascript
function F() {}
F.prototype.constructor === F;      // true
new F().constructor === F;          // true — found on F.prototype, not own
Object.hasOwn(new F(), "constructor");  // false
```

It's how `instance.constructor` works. But note what it *is*: an ordinary, writable, non-enumerable data property. **Nothing enforces that it's correct.**

```javascript
function A() {}
function B() {}
A.prototype = { hello() {} };        // whole-object replacement
new A().constructor === A;           // false! — the back-link was thrown away
new A().constructor === Object;      // true  — inherited from Object.prototype

A.prototype.constructor = B;         // and you can simply lie
new A().constructor === B;           // true
```

**Never trust `.constructor` for type checks.** It is documentation, not a guarantee — a convention that breaks the moment anyone replaces a prototype object wholesale (which older inheritance patterns did constantly).

---

## Part 3 — `instanceof` Checks the Chain, Not the Origin

```javascript
obj instanceof C
```

does **not** mean "was `obj` created by `C`." It means:

> Is `C.prototype` anywhere on `obj`'s prototype chain?

```javascript
function C() {}
const c = new C();
c instanceof C;   // true — C.prototype is on c's chain

const fake = Object.create(C.prototype);   // never went near `new C()`
fake instanceof C;                          // true — same chain, so same answer
```

And because it reads `C.prototype` *at call time*, moving the target moves the answer:

```javascript
const real = new C();
C.prototype = {};        // point C at a different object
real instanceof C;       // false — its chain still holds the OLD prototype
```

The instance didn't change. The question did.

### `Symbol.hasInstance` — the hook

`instanceof` is one of the few operators you *can* override, via a well-known symbol (Chapter 9's protocol pattern):

```javascript
class Even {
  static [Symbol.hasInstance](n) { return n % 2 === 0; }
}
4 instanceof Even;   // true
5 instanceof Even;   // false
```

This is how `Array.isArray`-style checks and some libraries implement duck typing. It also means `instanceof` can lie in the other direction — which, along with cross-realm failures (an array from an `<iframe>` is not `instanceof` your `Array`), is why `Array.isArray` exists as a separate function.

---

## Part 4 — `class` Is Not Just Sugar

You'll read "classes are just syntactic sugar over constructor functions" everywhere. It's a useful first approximation and it's **wrong in seven ways**, each of which prevents a real bug.

### 1. Class bodies are always strict mode

No pragma needed, no way to opt out.

### 2. Class declarations are not hoisted — they're in the TDZ

```javascript
new D();      // ReferenceError: Cannot access 'D' before initialization
class D {}
```

Compare with `function F() {}`, which hoists fully. Classes follow `let`/`const` rules (Chapter 4), so you cannot use one before its declaration is evaluated.

### 3. Methods are non-enumerable

```javascript
class C { m() {} }
Object.getOwnPropertyDescriptor(C.prototype, "m").enumerable;   // false

function F() {}
F.prototype.m = function () {};
Object.getOwnPropertyDescriptor(F.prototype, "m").enumerable;   // true
```

This is a direct fix for Chapter 9's `for...in` problem. Methods added the old way **leak into every `for...in` loop** over an instance; class methods never do.

### 4. Calling a class without `new` throws

```javascript
class C {}
C();   // TypeError: Class constructor C cannot be invoked without 'new'
```

With a function you'd get silent damage instead: `this` is `undefined` in strict mode (a `TypeError` deep inside the body), or — pre-strict — the **global object**, so `Dog("Rex")` would create a global `name`.

### 5. In a derived constructor, `this` is in the TDZ until `super()` runs

```javascript
class R extends P {
  constructor() {
    this.x = 1;   // ReferenceError — `this` doesn't exist yet
    super();
  }
}
```

Because in a derived class the **parent** creates the instance. Until `super()` returns, there is no `this` to touch. The function form has no such protection — you can read a half-initialised object all you like.

### 6. `super` works via `[[HomeObject]]`, not `this`

Each method records the object it was defined in, and `super.m()` looks up from *that* object's prototype. This is why `super` works correctly even after a method is extracted, and why it can't be replicated with `this` alone.

### 7. Private fields are not properties

```javascript
class Pr {
  #secret = 1;
  reveal() { return this.#secret; }
}
Reflect.ownKeys(new Pr());   // []  ← nothing there at all
new Pr().reveal();           // 1   ← but the method can read it
```

`#secret` is invisible to `Reflect.ownKeys`, `Object.getOwnPropertyNames`, `JSON.stringify`, and every proxy trap. It is not a property with a hidden name — it is a different mechanism entirely, which is why it achieves what symbols could not (Chapter 9).

---

## Part 5 — `extends` Builds TWO Chains

This is the part that surprises people who thought they understood prototypes.

```javascript
class P { static s() {} ; m() {} }
class Q extends P {}
```

```
INSTANCE chain                          STATIC chain
──────────────                          ────────────
new Q()                                 Q
  │ [[Prototype]]                         │ [[Prototype]]
  ▼                                       ▼
Q.prototype                             P
  │ [[Prototype]]                         │ [[Prototype]]
  ▼                                       ▼
P.prototype        m                    Function.prototype
  │ [[Prototype]]                         │
  ▼                                       ▼
Object.prototype                        Object.prototype
```

```javascript
Object.getPrototypeOf(Q.prototype) === P.prototype;  // true — instance chain
Object.getPrototypeOf(Q) === P;                      // true — STATIC chain
typeof Q.s;                                          // "function" — inherited statically
```

`extends` links the constructors to each other as well as the prototypes. That second link is what makes `static` members inherit — something the classic `Child.prototype = Object.create(Parent.prototype)` pattern never did without an extra manual step.

---

## What JavaScript Cannot Do — And Why

**You cannot call a class without `new`.** No flag, no workaround.

*Why?* Because the failure mode was catastrophic and silent. In sloppy mode, `Dog("Rex")` bound `this` to the **global object** and quietly created global variables; in strict mode you got a confusing `TypeError` at whatever line first touched `this`. Classes make the error immediate, at the call site, with the actual cause named. It's the same philosophy as the TDZ in Chapter 4: fail loudly at the point of the mistake.

**You cannot touch `this` before `super()` in a derived constructor.**

*Why?* In a derived class the base constructor is what allocates the instance — subclassing built-ins like `Array` and `Error` requires this, because those need engine-level allocation that a subclass cannot perform. So `this` genuinely does not exist yet; the TDZ makes that visible rather than handing you a half-built object.

**You cannot access a private field dynamically.** There is no `obj["#secret"]`, no `Reflect` access, no proxy trap.

*Why?* Because that's the entire point. Symbols failed at privacy precisely because reflection could enumerate them (Chapter 9). Private names are resolved **lexically at compile time** — the syntax is only meaningful inside the class body — which is what makes them unforgeable. The cost is that they're not first-class values you can pass around.

**You cannot make a constructor return a primitive.** `return 42` from a constructor is silently ignored.

*Why?* `new` is defined to produce an object. Allowing a primitive would mean `new Foo() instanceof Foo` could be `false` and `typeof new Foo()` could be `"number"`, breaking every assumption built on top of `new`. Objects are allowed through because factory and singleton patterns genuinely need it; primitives have no such use case.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Constructor functions are a special kind of function" | Any function works with `new`. "Constructor" describes a *call site*, not a type. |
| "`class` is pure syntactic sugar" | Seven real differences: strict mode, TDZ, non-enumerable methods, `new` enforcement, `this` TDZ, `[[HomeObject]]`, `#private`. |
| "`instanceof` checks what created the object" | It checks whether `C.prototype` is on the chain. `Object.create(C.prototype)` passes. |
| "`.constructor` reliably identifies the type" | It's a writable property that whole-prototype replacement destroys and anyone can overwrite. |
| "`new` returns the object you built" | Unless the constructor returns a *different* object, which silently replaces it. |
| "`extends` links the prototypes" | It links **two** chains — instances *and* the constructors themselves, which is how `static` inherits. |
| "Private fields are properties with a `#` prefix" | They aren't properties at all — invisible to `Reflect.ownKeys` and every proxy trap. |
| "`super` is `this.__proto__.method`" | It uses the method's `[[HomeObject]]`, which is why it survives extraction and rebinding. |

---

## Practical Rules

1. **Use `class`.** The seven differences are all bug-preventers; the function form's flexibility is rarely worth them.
2. **Never type-check with `.constructor`.** Use `instanceof`, or a `Symbol.toStringTag` / duck-typing check.
3. **Be wary of `instanceof` across realms** (iframes, workers, `vm`). `Array.isArray` exists for exactly this reason.
4. **Never `return` from a constructor** unless you specifically intend the override.
5. **Call `super()` first** in a derived constructor, before anything else.
6. **`#private` for real privacy**, `_underscore` only as a convention.
7. **Remember `static` inherits.** `Child.someStatic` resolves up the constructor chain.
