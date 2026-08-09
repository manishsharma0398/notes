# Chapter 10 — `new`, Constructors, Classes: Revision Notes

## The six facts

1. **`new` is four steps** — implementable in five lines.
2. Any function works with `new`. **"Constructor" describes a call site, not a type.**
3. `.constructor` is an ordinary writable property. It can be wrong.
4. `instanceof` walks the chain for `C.prototype` — it does **not** check origin.
5. **`class` is not just sugar** — seven real differences.
6. `extends` builds **two** chains: instances *and* constructors.

---

## `new F(args)`

```
1. create a new empty object
2. set its [[Prototype]] to F.prototype
3. call F with `this` = that object
4. F returned an OBJECT? use it. Otherwise use the object from step 1.
```

```javascript
function myNew(F, ...args) {
  const obj = Object.create(F.prototype);
  const r = F.apply(obj, args);
  return typeof r === "object" && r !== null ? r : obj;
}
```

### Step 4 — the return override

```javascript
function G() { this.a = 1; return { b: 2 }; }  // new G() → { b: 2 }  ← object WINS
function H() { this.a = 1; return 42; }        // new H() → { a: 1 }  ← primitive IGNORED
```

Powers the singleton/factory patterns; also how a stray `return` silently breaks a constructor.

### `new.target`

```javascript
function K() { return new.target === undefined ? "plain" : "with new"; }
```

Replaced the old `if (!(this instanceof K))` hack, which `call`/`apply` can fool.

---

## `.constructor` lies

```javascript
function F() {}
F.prototype.constructor === F;            // true — auto-created back-link
Object.hasOwn(new F(), "constructor");    // false — it's on the prototype
```

It's a **writable** property, so:

```javascript
A.prototype = { hello() {} };   // whole-object replacement
new A().constructor === A;      // false — link destroyed
new A().constructor === Object; // true  — inherited from Object.prototype

A.prototype.constructor = B;    // or just lie
```

Hence the ES5 repair line: `Child.prototype.constructor = Child;`

**Never type-check with `.constructor`.**

---

## `instanceof`

> Is `C.prototype` anywhere on the object's prototype chain?

```javascript
Object.create(C.prototype) instanceof C;   // true — never built by `new C()`

const real = new C();
C.prototype = {};
real instanceof C;                          // false — the QUESTION changed
```

**Hookable** via `Symbol.hasInstance`:

```javascript
class Even { static [Symbol.hasInstance](n) { return n % 2 === 0; } }
4 instanceof Even;   // true — no prototypes involved
```

**Cross-realm failure** — why `Array.isArray` exists:

```javascript
foreignArray instanceof Array;  // false — different realm's Array.prototype
Array.isArray(foreignArray);    // true  — checks an internal slot
```

---

## `class` is not just sugar — the seven

| # | Difference | Bug it prevents |
|---|---|---|
| 1 | body is always **strict mode** | sloppy-mode `this` leaks |
| 2 | **TDZ**, not hoisted | use-before-definition |
| 3 | methods are **non-enumerable** | methods leaking into `for...in` |
| 4 | calling without `new` **throws** | silent global pollution |
| 5 | `this` is **TDZ until `super()`** | reading a half-built object |
| 6 | `super` uses **`[[HomeObject]]`** | infinite recursion in 3-level chains |
| 7 | `#private` is **not a property** | fake privacy via `_` or symbols |

```javascript
class C { m() {} }              Object.getOwnPropertyDescriptor(C.prototype,"m").enumerable  // false
F.prototype.m = function(){};   Object.getOwnPropertyDescriptor(F.prototype,"m").enumerable  // true
```

```javascript
class Pr { #s = 1; reveal() { return this.#s; } }
Reflect.ownKeys(new Pr());   // []  ← invisible to ALL reflection
new Pr().reveal();           // 1
```

**Fields vs methods:** class fields are per-instance **own** properties; methods live on the **prototype** (shared).

---

## `extends` builds TWO chains

```
INSTANCE                          STATIC
new Q()                           Q
  ↓                                 ↓
Q.prototype                       P
  ↓                                 ↓
P.prototype                       Function.prototype
  ↓                                 ↓
Object.prototype                  Object.prototype
```

```javascript
Object.getPrototypeOf(Q.prototype) === P.prototype;  // true
Object.getPrototypeOf(Q) === P;                      // true ← statics inherit
```

The ES5 pattern only built the first chain — `OldDog.kingdom` was `undefined` until you added `Object.setPrototypeOf(OldDog, OldAnimal)` by hand.

**`super`** resolves from the method's `[[HomeObject]]`, not from `this` — which is why three-level chains (`C→B→A`) don't recurse infinitely.

**Subclassing built-ins** (`Error`, `Array`) works because `super()` lets the base allocate the instance with its internal slots. That's the real reason for the `this` TDZ.

---

## What JavaScript cannot do

| Cannot | Why |
|---|---|
| Call a class without `new` | The old failure was silent: sloppy mode bound `this` to the global object and created globals. Now it fails at the call site with the cause named. |
| Touch `this` before `super()` | In a derived class the **base** allocates the instance — required for subclassing `Error`/`Array`, which need engine-level allocation. `this` genuinely doesn't exist yet. |
| Access `#private` dynamically | Private names are resolved **lexically at compile time**; the syntax is only meaningful inside the class body. That unforgeability is exactly what symbols couldn't provide. |
| Return a primitive from a constructor | `new` is defined to produce an object. Otherwise `new Foo() instanceof Foo` could be false and `typeof new Foo()` could be `"number"`. |

---

## Practical rules

1. Use `class` — all seven differences are bug-preventers.
2. Never type-check with `.constructor`.
3. `Array.isArray`, not `instanceof Array` (realms).
4. Never `return` from a constructor unless you mean the override.
5. `super()` first in a derived constructor.
6. `#private` for real privacy.
7. Remember `static` inherits.

---

## Interview quick-fire

- **"What does `new` do?"** → Four steps: create object, link to `F.prototype`, call `F` with `this` bound to it, return it unless `F` returned an object.
- **"Is a constructor a special function?"** → No. Any function. `new` is a property of the call site.
- **"What does `instanceof` actually check?"** → Whether `C.prototype` is on the chain. Not origin — `Object.create(C.prototype)` passes.
- **"Why does `Array.isArray` exist?"** → `instanceof` compares against one realm's `Array.prototype`; arrays from iframes/workers fail. `isArray` checks an internal slot.
- **"Is `class` just sugar?"** → No — strict mode, TDZ, non-enumerable methods, `new` enforcement, `this` TDZ, `[[HomeObject]]`, `#private`.
- **"Why can't you use `this` before `super()`?"** → The base constructor allocates the instance; required for subclassing built-ins.
- **"Why is `#private` real when symbol keys aren't?"** → Private names are lexical, not properties — invisible to `Reflect.ownKeys` and proxy traps.
- **"Does `static` inherit?"** → Yes. `extends` links the constructors too — a second chain the ES5 pattern lacked.
- **"Can `.constructor` be wrong?"** → Routinely. It's a writable property destroyed by whole-prototype replacement.
