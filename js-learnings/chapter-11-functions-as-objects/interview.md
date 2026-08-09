# Chapter 11 — Interview Questions: Functions as Objects

## Q1: "Is a function an object in JavaScript?"

**Answer:** Yes, fully. It has own properties, a `[[Prototype]]` (`Function.prototype`), and you can attach arbitrary data to it:

```javascript
function counter() {}
counter.calls = 0;
Object.keys(counter);        // ["calls"]
counter instanceof Object;   // true
```

**Then why does `typeof` say `"function"`?** Because the spec gives `typeof` a special case for objects carrying an internal **`[[Call]]`** slot — the thing that makes `()` work. It's an object with a special power, not a separate type.

**The follow-up that shows depth:** two internal slots decide a function's capabilities.

| Slot | Enables | Which functions lack it |
|---|---|---|
| `[[Call]]` | `f()` | none — all functions have it |
| `[[Construct]]` | `new f()` | arrows, methods, async functions, generators |

That's why `new (() => {})()` throws and arrows have no `.prototype` — no `[[Construct]]`, nothing to hand out.

---

## Q2: What is `fn.length`?

**The trap:** "the number of parameters."

**Correct answer:** the number of parameters **before the first one with a default value or a rest parameter**.

```javascript
function a(x, y) {}         a.length;   // 2
function b(x, ...rest) {}   b.length;   // 1
function c(x, y = 1, z) {}  c.length;   // 1   ← z is NOT counted
```

`c.length === 1` is the one people get wrong. `z` has no default, but it *follows* one, so counting has already stopped. `length` means **"arguments expected before optional ones begin."**

**Why it matters in practice:** libraries dispatch on it — Express distinguishes `(req, res)` from `(err, req, res)`, Mocha checks whether you took a `done` callback. So adding a default to an early parameter can silently change how a framework calls your function:

```javascript
(err, res) => {}         // length 2 → treated as an error-first callback
(err = null, res) => {}  // length 0 → treated as something else entirely
```

---

## Q3: `call` vs `apply` vs `bind`?

**Answer:** `call` and `apply` **invoke immediately** and differ only in how arguments are passed (listed vs. as an array). `bind` **returns a new function** and invokes nothing.

```javascript
greet.call(who, "Hi", "!");
greet.apply(who, ["Hi", "!"]);
const bound = greet.bind(who, "Hi");   // new function, partially applied
```

**The follow-up worth volunteering — the binding is permanent:**

```javascript
bound.call({ name: "Bob" });    // still uses `who`
bound.bind({ name: "Eve" })();  // still uses `who`
```

You cannot un-bind. That's deliberate: handing out `obj.method.bind(obj)` is a *promise* that it runs against `obj`. If a receiver could override it, you'd have to re-check `this` in every callback you publish.

**And a bound function is structurally odd:**

```javascript
bd.name;        // "bound target"
bd.length;      // max(0, target.length - boundArgs)
bd.prototype;   // undefined
new bd();       // still works — delegates to the target
```

Constructible with no `.prototype` of its own.

---

## Q4: Why doesn't this remove the listener?

```javascript
element.addEventListener("click", () => handleClick());
element.removeEventListener("click", () => handleClick());
```

**Answer:** Those are **two different function objects**. Every evaluation of a function expression creates a new one, so `removeEventListener` searches for a function that was never registered and silently does nothing.

```javascript
(() => {}) === (() => {});   // false
```

**The fix:** keep one reference.

```javascript
const onClick = () => handleClick();
element.addEventListener("click", onClick);
element.removeEventListener("click", onClick);
```

**Where else the same fact bites** — worth naming all three, because interviewers often follow up with one of them:

```javascript
cache.set(() => x, "v");  cache.get(() => x);   // undefined — different key
useEffect(fn, [() => x]);                        // dep "changes" every render
```

It's Chapter 7's reference semantics applied to functions: identical source text is not identical identity.

---

## Q5: "Why does JavaScript behave this way?" — Why do arrow functions exist?

**The weak answer:** "shorter syntax."

**Correct answer:** they're defined by what they **lack** — no own `this`, `arguments`, `prototype`, `new.target`, or `[[Construct]]`. Lexical `this` is the feature; the brevity is incidental.

Before arrows, "I want the *enclosing* `this` in this callback" had no syntax. You wrote:

```javascript
const self = this;                                    // the 2010 idiom
items.map(function (i) { return self.total + i; });

items.map(function (i) { return this.total + i; }.bind(this));   // or this
```

Both are conventions you have to *remember at every callback*. Miss one and `this` is `undefined` (strict) or the global object (sloppy) — a bug that often surfaces far from its cause.

Arrows turned that convention into a **syntax-level guarantee**:

```javascript
items.map((i) => this.total + i);
```

**What breaks if arrows had their own `this`?** They'd be a pure abbreviation with no semantic value, and the `self = this` dance would still be necessary. The absence *is* the feature.

**Follow-up: can you `bind` an arrow?** No — `bind` sets `this`, and an arrow has no `this` slot to set. The call is silently a no-op for binding. That's the strongest proof that arrows aren't "functions with a different default."

---

## Q6: Spot the bug

```javascript
const counter = {
  count: 0,
  increment: () => {
    this.count++;
    return this.count;
  },
};

console.log(counter.increment());
```

**Answer:** `NaN` — and in strict mode it may throw instead.

`increment` is an **arrow**, so `this` is not `counter`. It resolves lexically to the enclosing scope's `this` (in a module, `undefined`; in a script, `globalThis`). `this.count` is `undefined`, and `undefined++` is `NaN`.

**The fix — a method, not an arrow:**

```javascript
increment() { this.count++; return this.count; }
```

**The rule to state:** arrow for a **callback** that needs the enclosing `this`; method for a **method** that needs the call-site receiver. Arrows as object methods can never see their own object — that's not a limitation to work around, it's the definition.

---

## Q7: What does this print, and why?

```javascript
function outer(a, b) {
  const arrow = () => arguments;
  function normal() { return arguments; }
  return [Array.from(arrow()), Array.from(normal(9))];
}
console.log(outer(1, 2));
```

**Answer:** `[[1, 2], [9]]`

**What it proves:** the arrow did not receive an *empty* `arguments` — it has **none at all**, so the identifier `arguments` was resolved up the scope chain like any other free variable (Chapter 3) and found `outer`'s.

This is the same mechanism as arrow `this`. Both are absences filled in by ordinary lexical lookup, not special values.

---

## Q8: "Why doesn't this alternative exist?" — Why can't you intercept a function call?

**Answer:** There is no `[[Call]]` hook on ordinary functions — no way to say "run this before every invocation of `f`."

The reasoning is the same one that appears in Chapters 8 and 9, and being able to connect all three is the point:

| Operation | No user hook, because… | Opt-in alternative |
|---|---|---|
| `===` | inline caches assume identity is effect-free | none — deliberately |
| property access | inline caches assume reads are predictable | `Proxy` `get` trap |
| function call | calls are the hottest operation; a hook defeats inlining | `Proxy` `apply` trap |

In each case the language keeps the fast path unhookable and offers a **separate object** that declares itself interceptable. You pay only where you opt in.

**Follow-up: so how does instrumentation work?** You wrap:

```javascript
const wrapped = (...args) => { log(args); return fn(...args); };
```

And a *good* wrapper restores `name` and `length` with `defineProperty`, because those are non-writable but configurable — and libraries dispatch on both (Q2).

---

## Q9: Trap — predict the output

```javascript
function target(x, y, z) {}
const bound = target.bind(null, 1);

console.log(bound.name);
console.log(bound.length);
console.log(bound.prototype);
console.log(target.name === bound.name);
```

**Answer:** `"bound target"`, `2`, `undefined`, `false`

**What it tests:** that `bind` produces a genuinely different function object with derived metadata, not a thin alias.

- `name` gets a `"bound "` prefix — which is why stack traces show `bound handleClick`
- `length` is `max(0, 3 - 1)` — the bound argument is already supplied
- `prototype` is `undefined` — yet `new bound()` still works, delegating to the target

The last point is the interesting one: **constructibility and having a `.prototype` are separate things.** Chapter 10's rule ("constructible functions have `.prototype`") has exactly two exceptions — bound functions (constructible, no `.prototype`) and generator functions (has `.prototype`, not constructible).

---

## Q10: What's the cost of a class-field arrow?

```javascript
class Button {
  handleMethod() { return this.label; }
  handleArrow = () => this.label;
}
```

**Answer:** `handleArrow` survives extraction (`const { handleArrow } = btn; handleArrow()` works) because it's created per instance and captures that instance's `this`. `handleMethod` loses `this` when torn off.

**The cost, which is the real question:** `handleArrow` is a **class field**, so it's an **own property on every instance** (Chapter 9) — a separate function object allocated per object. `handleMethod` lives once on `Button.prototype` and is shared by all instances.

```javascript
new Button().handleArrow !== new Button().handleArrow;   // true — two objects
new Button().handleMethod === new Button().handleMethod; // true — one, shared
```

With ten instances that's irrelevant. With ten thousand rows in a table it's ten thousand extra function objects, and it also breaks prototype-based patching and makes the method invisible to `Object.getOwnPropertyNames(Button.prototype)`.

**The judgement to state:** use the field-arrow form when a method is *routinely* passed as a callback; use a prototype method otherwise, and `bind` at the call site if you need it occasionally.
