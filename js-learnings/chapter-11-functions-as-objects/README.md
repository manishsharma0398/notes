# Chapter 11 — Functions as Objects

> **Read this box first.** Everything below is elaboration.
>
> 1. A function **is an object**. It has properties, a `[[Prototype]]`, and you can attach your own data to it.
> 2. `typeof` says `"function"` only because it carries an internal **`[[Call]]`** slot. It's an object with a special power, not a separate type.
> 3. `name` and `length` are **inferred at creation**, non-writable, and `length` deliberately lies about rest and default parameters.
> 4. `bind` returns a **new function whose `this` is permanent** — you cannot re-bind it.
> 5. **Every evaluation of a function expression creates a new function object.** Two identical arrows are never `===`.
> 6. Arrows are not "short functions" — they *lack* `this`, `arguments`, `prototype`, and `new.target`. That's the feature.

---

## Part 1 — A Function Is an Object

Not "function-like." Not "almost an object." An object:

```javascript
function counter() {}

counter.calls = 0;                  // attach whatever you want
counter.reset = () => { counter.calls = 0; };

Object.keys(counter);               // ["calls", "reset"]
counter instanceof Object;          // true
Object.getPrototypeOf(counter) === Function.prototype;  // true
```

So why does `typeof` disagree?

```javascript
typeof counter;   // "function"
typeof {};        // "object"
```

Because the spec gives `typeof` a special case for objects that have an internal **`[[Call]]`** slot — the thing that makes `()` work. Two internal slots decide everything:

| Slot | Meaning | Test |
|---|---|---|
| `[[Call]]` | can be invoked: `f()` | `typeof f === "function"` |
| `[[Construct]]` | can be constructed: `new f()` | has a `.prototype` (usually) |

An arrow function has `[[Call]]` but no `[[Construct]]`, which is exactly why `new (() => {})()` throws and why arrows carry no `.prototype` (Chapter 10).

**Attaching state to a function is a real technique**, not a curiosity:

```javascript
function fib(n) {
  if (n in fib.cache) return fib.cache[n];
  return (fib.cache[n] = n < 2 ? n : fib(n - 1) + fib(n - 2));
}
fib.cache = Object.create(null);   // the cache lives ON the function (Ch 9 dictionary)
```

This is also how `React.memo`, `fn.displayName`, and every "static property on a function" pattern works.

---

## Part 2 — `name` and `length` Are Inferred, and `length` Lies

### `name` is inferred from the assignment target

```javascript
const f1 = function () {};      f1.name;     // "f1"   ← inferred, not anonymous
const f2 = () => {};            f2.name;     // "f2"
const o = { m() {} };           o.m.name;    // "m"
const named = function real() {}; named.name; // "real" ← explicit wins
```

The engine reads the *variable or property being assigned to*. This is why stack traces are usually readable even though almost nobody names their function expressions.

It's a real property with real flags:

```javascript
Object.getOwnPropertyDescriptor(f1, "name");
// { value: "f1", writable: false, enumerable: false, configurable: true }
```

**Non-writable but configurable** — so `f.name = "x"` silently fails (throws in strict mode), while `Object.defineProperty(f, "name", …)` works. That combination matters when you write wrappers: a naive wrapper loses the name, and `defineProperty` is the only way to restore it.

### `length` counts *declared parameters before the first default or rest*

```javascript
function a(x, y) {}        a.length;   // 2
function b(x, ...rest) {}  b.length;   // 1   ← rest doesn't count
function c(x, y = 1, z) {} c.length;   // 1   ← counting STOPS at the first default
function d(...rest) {}     d.length;   // 0
```

`c.length` being `1` surprises everyone: `z` has no default, but it comes *after* one, so it isn't counted. `length` means **"how many arguments does this expect before optional ones begin"** — not "how many parameters does it have."

Libraries dispatch on this (`fn.length === 2 ? withCallback : withoutCallback`), which is why adding a default to an early parameter can silently change a function's behaviour inside a framework.

---

## Part 3 — `call`, `apply`, `bind`

All three live on `Function.prototype`, so every function inherits them (Chapter 9).

```javascript
function greet(greeting, punct) { return `${greeting}, ${this.name}${punct}`; }
const who = { name: "Ada" };

greet.call(who, "Hi", "!");      // "Hi, Ada!"     — args listed
greet.apply(who, ["Hey", "?"]);  // "Hey, Ada?"    — args as an array
const bound = greet.bind(who, "Yo");
bound(".");                      // "Yo, Ada."     — new function, partially applied
```

`call` and `apply` **invoke immediately**. `bind` **returns a new function** — that's the whole difference.

### The binding is permanent

```javascript
bound.call({ name: "Bob" }, "!");   // "Yo, Ada!"   ← still Ada
```

You cannot re-bind a bound function. `call`, `apply`, and a second `bind` are all ignored for `this`. This is a deliberate guarantee: once you hand out a bound function, the receiver can't hijack it. It's why `this.handleClick = this.handleClick.bind(this)` was safe in class components.

### A bound function is a different animal

```javascript
function target(x, y, z) {}
const bd = target.bind(null, 1);

bd.name;        // "bound target"   ← prefixed
bd.length;      // 2                ← max(0, target.length - boundArgs)
bd.prototype;   // undefined        ← has none
new bd();       // works! — delegates to target, using TARGET's .prototype
```

That last pair is the exception noted in Chapter 10: constructible, yet no `.prototype` of its own.

---

## Part 4 — Function Identity: A New Object Every Time

**Every evaluation of a function expression creates a brand-new function object.**

```javascript
const make = () => (x) => x;
make() === make();   // false — two separate objects with identical source
```

Chapter 7's reference semantics, applied to functions. And it is the cause of an entire family of real bugs:

```javascript
// 1. The listener that can never be removed
element.addEventListener("click", () => handle());
element.removeEventListener("click", () => handle());   // different object — no-op

// 2. The effect that runs forever
useEffect(() => { … }, [() => x]);   // new function each render → dependency always "changed"

// 3. The cache that never hits
cache.set(() => x, "value");
cache.get(() => x);   // undefined — different key (Chapter 8: Map uses SameValueZero)
```

All three are the same fact wearing different hats: identical source text does not mean identical object. To remove a listener, cache a result, or compare dependencies, you must keep a **reference** to the one function you created.

---

## Part 5 — Arrows Are Not Shorthand

The common description — "arrow functions are a shorter syntax" — gets it backwards. Arrows are defined by what they **don't have**:

| Regular function | Arrow |
|---|---|
| own `this` (set by the call site) | **no own `this`** — resolved lexically |
| own `arguments` | **no own `arguments`** — lexical |
| `.prototype` | **none** |
| `[[Construct]]` — works with `new` | **none** — `new` throws |
| own `new.target` | **none** — lexical |

```javascript
function outer(a, b) {
  const arrow = () => arguments;           // outer's arguments
  function normal() { return arguments; }  // its own
  return [Array.from(arrow()), Array.from(normal(9))];
}
outer(1, 2);   // [[1, 2], [9]]
```

The arrow didn't get an empty `arguments` — it has **none at all**, so the identifier resolved up the scope chain (Chapter 3) to `outer`'s, exactly like any other free variable.

Same for `this`:

```javascript
const obj = {
  tag: "obj",
  method() { return this.tag; },   // "obj"  — call-site binding
  arrow: () => this,                // NOT obj — lexical, from the enclosing scope
};
```

**This is the point, not a limitation.** Before arrows, "I want the *outer* `this`" required `const self = this` or `.bind(this)` at every callback. Arrows made lexical `this` a syntax-level guarantee — which is why an arrow is right for a callback and wrong for a method.

---

## Part 6 — `new Function` Has No Closure

### What it even is

A constructor that builds a function **from strings, at runtime**:

```javascript
const add = new Function("a", "b", "return a + b");
add(2, 3);        // 5
add.toString();   // "function anonymous(a,b) { return a + b }"
```

The last argument is the body; the ones before it are parameter names. Nothing here is a function literal — it's all text the engine parses when that line runs.

### The point

**A normal function closes over where it's written. A built one is compiled as if written at the top of the program.**

```javascript
function outer() {
  const secret = 42;
  const literal = () => secret;                  // written inside outer
  const built = new Function("return secret");   // built inside outer
  literal();   // 42
  built();     // ReferenceError: secret is not defined
}
```

Both were *created* inside `outer`. Only the literal can *see* `outer`. The built one's scope chain is just **its own scope → global** — everything in between is missing.

It can still see globals, because that's the one scope it does get:

```javascript
globalThis.appName = "myApp";
new Function("return appName")();   // "myApp"
```

So Chapter 3's rule — *scope is determined by where code is written, not where it runs* — has one escape hatch, and this is it. The string wasn't "written" anywhere, so the engine gives it the only scope it can name: global.

### Why it's a hazard

**Security.** Any string reaching it is executed. This is `eval` with a different spelling:

```javascript
new Function("return " + userInput)();   // userInput runs as code
```

**Performance.** The engine parses and compiles that string *every time the line runs*. Real function literals are compiled once, ahead of time, and can be optimised. A `new Function` inside a loop recompiles on every iteration.

**Tooling.** Minifiers rename variables but can't see inside your strings, so code that worked in dev breaks after a build. Browsers with a strict Content-Security-Policy block it outright (`unsafe-eval`).

### The legitimate uses

Real ones exist, and they're all **code generators** — where producing source text *is* the job:

- template compilers (Vue's template → render function)
- JSON-schema validators like Ajv, which compile a schema into a fast validator once and reuse it
- ORMs generating query builders

The pattern is always: **compile once at startup, call many times.** That amortises the compile cost and keeps the generated string under your control, not a user's.

For anything else, a real function literal is faster, safer, debuggable, and can actually close over its surroundings.

---

## What JavaScript Cannot Do — And Why

**You cannot un-bind a bound function.** `call`, `apply`, and further `bind`s are ignored for `this`.

*Why?* Binding would be worthless as a safety guarantee if the receiver could undo it. Handing out `obj.method.bind(obj)` is a promise that it will run against `obj`; making it revocable would mean re-checking `this` in every callback you publish.

**You cannot give an arrow function its own `this`.** No flag, no `bind`.

*Why?* Because "has no `this` of its own" is the entire feature, not an oversight. If `bind` worked on arrows, the lexical guarantee would be conditional and you'd be back to auditing every callback.

**You cannot intercept a plain function call.** There is no `[[Call]]` hook on ordinary functions.

*Why?* Same reasoning as `===` (Chapter 8) and property access (Chapter 9): calls are the hottest operation in the engine, and a user-code hook on every one would defeat inlining. The opt-in answer is the same too — a `Proxy` with an `apply` trap, which is a *separate object* that declares itself interceptable.

**You cannot recover a function's true source if it's native.** `Function.prototype.toString` returns `"function () { [native code] }"` for built-ins.

*Why?* Built-ins often aren't implemented in JavaScript at all — there is no source text to return. The spec standardised the placeholder so code that parses `toString` output fails predictably rather than differently in every engine.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Functions and objects are different types" | A function **is** an object with a `[[Call]]` slot. `typeof` has a special case for it. |
| "`fn.length` is the number of parameters" | It stops counting at the first default or rest parameter. |
| "Anonymous function expressions have no name" | `name` is inferred from the assignment target. |
| "`bind` sets `this` until you change it" | The binding is **permanent**. `call`/`apply`/re-`bind` cannot override it. |
| "Two identical arrow functions are equal" | Every evaluation creates a new object. `(() => {}) === (() => {})` is `false`. |
| "Arrows are just shorter syntax" | They lack `this`, `arguments`, `prototype`, `new.target`, and `[[Construct]]`. |
| "An arrow's `this` is `undefined`" | It has no `this` at all; the identifier resolves lexically, like any free variable. |
| "`new Function` is like a function literal" | It compiles in **global scope** and closes over nothing local. |

---

## Practical Rules

1. **Keep a reference** to any function you'll need to remove, compare, or cache.
2. **Arrows for callbacks, methods for methods.** Never an arrow as an object method you intend to call with `this`.
3. **Preserve `name` and `length` in wrappers** with `Object.defineProperty` — libraries dispatch on both.
4. **Don't rely on `fn.length`** for anything after you've added a default parameter.
5. **Never `new Function`** outside a code generator.
6. **`bind` once, store the result.** Binding in a render or a loop creates a new object every time.
7. **Function properties are legitimate** for caches, counters, and metadata — the function is an object, use it.
