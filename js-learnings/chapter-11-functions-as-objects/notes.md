# Chapter 11 — Functions as Objects: Revision Notes

## The six facts

1. A function **is an object** — properties, `[[Prototype]]`, your own data.
2. `typeof` says `"function"` because of an internal **`[[Call]]`** slot.
3. `name` and `length` are **inferred**, non-writable, configurable — and `length` lies.
4. `bind` returns a new function whose `this` is **permanent**.
5. **Every evaluation creates a new function object.**
6. Arrows lack `this`, `arguments`, `prototype`, `new.target`, `[[Construct]]`.

---

## Functions are objects

```javascript
function counter() {}
counter.calls = 0;              // attach anything
Object.keys(counter);           // ["calls"]
counter instanceof Object;      // true
Object.getPrototypeOf(counter) === Function.prototype;  // true
```

| Internal slot | Meaning | Symptom |
|---|---|---|
| `[[Call]]` | invocable `f()` | `typeof f === "function"` |
| `[[Construct]]` | constructible `new f()` | has `.prototype` (usually) |

Arrows: `[[Call]]` yes, `[[Construct]]` no.

**Engine-created own properties:** `length`, `name`, `prototype`.

```
length, name : writable FALSE, configurable TRUE  → assignment fails, defineProperty works
prototype    : writable TRUE, configurable FALSE
```

**Attaching state is a real technique** — caches, counters, `displayName`, static config.

---

## `name` is inferred

```javascript
const f1 = function () {};   f1.name;   // "f1"  ← from the assignment target
const f2 = () => {};         f2.name;   // "f2"
({ m() {} }).m.name;                    // "m"
(function real() {}).name;              // "real" — explicit wins
((fn) => fn.name)(function () {});       // ""    — no target to infer from
```

## `length` stops at the first default or rest

```javascript
(x, y) => {}        // 2
(x, ...r) => {}     // 1   rest never counts
(x, y = 1, z) => {} // 1   STOPS at the default — z not counted
(...r) => {}        // 0
```

Means *"arguments expected before optional ones begin."* Libraries dispatch on it, so adding an early default can silently change how a framework calls you.

**Wrappers lose both** unless you restore them:

```javascript
Object.defineProperty(wrapped, "name",   { value: fn.name,   configurable: true });
Object.defineProperty(wrapped, "length", { value: fn.length, configurable: true });
```

---

## `call` / `apply` / `bind`

```javascript
greet.call(who, "Hi", "!");       // invoke, args listed
greet.apply(who, ["Hi", "!"]);    // invoke, args as array
const bound = greet.bind(who, "Yo");  // NEW function, partially applied
```

### The binding is permanent

```javascript
bound.call({ name: "Bob" });   // still uses `who`
bound.bind({ name: "Eve" });   // still uses `who`
```

You cannot un-bind. That permanence is the guarantee.

### Bound functions are odd

```javascript
bd.name;        // "bound target"
bd.length;      // max(0, target.length - boundArgs)
bd.prototype;   // undefined — none
new bd();       // works — delegates to the target, uses TARGET's .prototype
```

### Borrowing

```javascript
Array.prototype.join.call(arrayLike, "-");
Object.prototype.hasOwnProperty.call(obj, k);   // Ch 9
```

---

## Identity: a new object per evaluation

```javascript
(() => {}) === (() => {});   // false
```

Three bugs, one fact:

```javascript
el.addEventListener("click", () => h());
el.removeEventListener("click", () => h());   // no-op — different object

cache.set(() => 1, "v");  cache.get(() => 1);  // undefined

useEffect(fn, [() => x]);                      // dependency "changes" every render
```

**Keep a reference** to anything you'll remove, cache, or compare.

---

## Arrows lack things — that's the feature

| Regular | Arrow |
|---|---|
| own `this` (call site) | **lexical** |
| own `arguments` | **lexical** |
| `.prototype` | none |
| `[[Construct]]` | none — `new` throws |
| own `new.target` | lexical |

```javascript
function outer(a, b) {
  const arrow = () => arguments;           // outer's
  function normal() { return arguments; }  // its own
}
outer(1, 2);   // arrow → [1,2], normal(9) → [9]
```

`bind` **cannot** give an arrow a `this`.

**Right tool:** arrow for callbacks needing the enclosing `this`; method when you want the call-site receiver. An arrow as an object method can never see the object.

**Class field arrows** are auto-bound and survive extraction — but they're **per-instance own properties**, not shared on the prototype.

---

## `new Function` has no closure

```javascript
const f = (() => { const secret = 42; return new Function("return typeof secret"); })();
f();   // "undefined" — compiled in GLOBAL scope
```

`eval`-class hazard. Legitimate only for code generators.

---

## What JavaScript cannot do

| Cannot | Why |
|---|---|
| Un-bind a bound function | Binding would be worthless as a guarantee if the receiver could undo it. |
| Give an arrow its own `this` | "No own `this`" *is* the feature; a conditional guarantee is no guarantee. |
| Intercept a plain function call | Calls are the hottest engine operation; a hook would defeat inlining. Opt in with a `Proxy` `apply` trap. |
| Get a native function's source | Built-ins often aren't written in JS. `toString` returns `[native code]` so parsers fail predictably. |

---

## Practical rules

1. Keep a reference to anything you'll remove, compare, or cache.
2. Arrows for callbacks, methods for methods.
3. Preserve `name`/`length` in wrappers via `defineProperty`.
4. Don't rely on `fn.length` after adding a default.
5. Never `new Function` outside a code generator.
6. `bind` once, store the result.
7. Function properties are legitimate — the function is an object.

---

## Interview quick-fire

- **"Is a function an object?"** → Yes — properties, prototype, everything. `typeof` special-cases the `[[Call]]` slot.
- **"What's `fn.length`?"** → Parameters before the first default or rest. `(x, y = 1, z)` is `1`.
- **"`call` vs `apply` vs `bind`?"** → First two invoke (listed vs array args); `bind` returns a new, **permanently** bound function.
- **"Can you re-bind a bound function?"** → No. `call`/`apply`/`bind` are all ignored for `this`.
- **"Why doesn't `removeEventListener` work with an inline arrow?"** → Every evaluation creates a new function object; you're removing a different one.
- **"Arrow vs regular function?"** → Arrows have no own `this`, `arguments`, `prototype`, `new.target`, or `[[Construct]]`. Lexical `this` is the point.
- **"Can `bind` fix an arrow's `this`?"** → No — it has none to set.
- **"Why do class-field arrows survive extraction?"** → They're per-instance own properties capturing the instance's `this`; the cost is one copy per instance.
- **"Does `new Function` close over local scope?"** → No — global scope only.
