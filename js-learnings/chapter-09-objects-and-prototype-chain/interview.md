# Chapter 9 — Interview Questions: Objects and the Prototype Chain

## Q1: "What actually happens when you write `obj.x`?"

**The trap:** most candidates describe a dictionary lookup. That misses both halves of the real answer.

**Correct answer:** `obj.x` invokes `[[Get]]`, which is a loop:

1. Look for `"x"` as an **own** property of `obj`
2. Not there? Follow `obj`'s `[[Prototype]]` link and look again
3. Repeat until found, or until the link is `null` → return `undefined`

And when it *is* found, what you get depends on the **descriptor**. A data property returns its `value`. An accessor property **runs a getter function**.

Two consequences worth volunteering:

```javascript
obj.typo;      // undefined, not an error — the loop ran to null
obj.a.b;       // throws on the SECOND access: obj.a is undefined, undefined.b fails
```

```javascript
const o = { get x() { throw new Error("boom"); } };
o.x;  // a plain-looking property read that throws
```

**`obj.x` is not guaranteed to be cheap, pure, or non-throwing.** That single fact explains why `==` can execute user code (Chapter 8) and why a debugger's object inspector must read descriptors rather than values.

---

## Q2: Is writing the mirror image of reading?

**Answer:** No — and this is the question that separates people who have read the spec from people who have inferred the model.

Reading returns the first match anywhere on the chain. Writing (`[[Set]]`) also walks the chain, but to decide whether it's *allowed* to write:

```
walk the chain looking for the key
  accessor with a setter?    → call the setter. Nothing is written to obj.
  accessor with no setter?   → TypeError (strict mode)
  non-writable data property?→ TypeError (strict mode)
  otherwise                  → create/update an OWN property on obj
```

So all three of these are true:

```javascript
const proto = { count: 0 };
const a = Object.create(proto);
a.count = 5;
Object.hasOwn(a, "count");  // true  — a NEW own property
proto.count;                // 0     — the prototype is never modified
```

```javascript
const proto = { set value(v) { this._v = v; } };
const s = Object.create(proto);
s.value = 42;
Object.hasOwn(s, "value");  // false — the inherited setter ran instead
```

```javascript
"use strict";
const proto = {};
Object.defineProperty(proto, "locked", { value: 1, writable: false });
const o = Object.create(proto);
o.locked = 99;  // TypeError — vetoed by a property o doesn't even own
```

That last one is the punchline: **a property you don't own, on an object you didn't write, can block your assignment** — silently, if you're not in strict mode.

**Follow-up:** `Object.defineProperty` ignores the chain entirely. It's a direct own-property operation, so it succeeds where assignment is vetoed.

---

## Q3: "Why does JavaScript behave this way?" — Why does assignment create an own property instead of updating the prototype?

**Answer:** Because the alternative makes shared prototypes unusable.

If `instance.x = 5` wrote through to the prototype, then every instance sharing that prototype would see the change. One object's local state would silently become global state for its entire type. You could never give an instance its own value for an inherited default.

The design gives you **shared defaults with local override**, which is the entire point of prototypal inheritance:

```javascript
const defaults = { retries: 3 };
const conn = Object.create(defaults);
conn.retries = 10;      // this connection only
otherConn.retries;      // 3 — everyone else keeps the default
```

**What breaks if it worked the other way?** Every prototype would be a mutable global. Setting a property on one array would change behavior for all arrays.

**The catch the design does NOT solve** — and a good follow-up to raise yourself:

```javascript
const proto = { tags: [] };
x.tags.push("a");   // NOT an assignment — a mutation through the shared reference
y.tags;             // ["a"] — everyone sees it
```

Copy-on-write protects you from *assignment*, not from *mutation*. `x.tags` reads the shared array and `push` mutates it in place. This is Chapter 7 and Chapter 9 colliding, and it's the classic bug in prototype-based code — which is why you never put mutable objects on a shared prototype.

---

## Q4: `[[Prototype]]` vs `.prototype`

**Answer:** Different things with confusingly similar names.

- **`[[Prototype]]`** — the internal link **every object** has. It's what lookup follows. Read it with `Object.getPrototypeOf(obj)`.
- **`.prototype`** — an ordinary property that exists on **functions only**. It is *not* that function's own prototype. It's the object that will become the `[[Prototype]]` of instances created with `new`.

```javascript
function Dog(name) { this.name = name; }
const rex = new Dog("Rex");

Object.getPrototypeOf(rex) === Dog.prototype;       // true  — the link points AT it
rex.prototype;                                      // undefined — instances have none
Object.getPrototypeOf(Dog) === Function.prototype;  // true  — Dog's OWN link
```

**The phrasing that fixes it permanently:** `Dog.prototype` means *"the prototype I hand out,"* not *"my prototype."*

---

## Q5: Spot the bug

```javascript
function countWords(text) {
  const counts = {};
  for (const word of text.split(" ")) {
    counts[word] = (counts[word] || 0) + 1;
  }
  return counts;
}

console.log(countWords("a b a"));
console.log(countWords("constructor toString a"));
```

**Answer:** The second call produces garbage.

`counts["constructor"]` isn't `undefined` — it's inherited from `Object.prototype` and it's a **function**. So `(counts["constructor"] || 0)` is truthy, and Chapter 8's `+` stringifies it:

```
{
  constructor: 'function Object() { [native code] }1',
  toString:    'function toString() { [native code] }1',
  a: 1
}
```

A word count that returns the source text of a native function, as a string.

```javascript
({}).constructor;  // [Function: Object]
({}).toString;     // [Function: toString]
```

Any object used as a lookup table keyed by **user-controlled strings** hits this. It's a real bug class — historically an exploitable one in Node libraries via `__proto__`.

**The fix:**

```javascript
const counts = Object.create(null);  // no prototype, no inherited keys
```

Or use a `Map`, which never consults a prototype and doesn't stringify keys.

**Follow-up — why is `Object.create(null)` the right structure here?** Because a dictionary keyed by external data must have **no** pre-existing keys. `{}` arrives with a dozen inherited names already meaningful.

---

## Q6: "Why doesn't this alternative exist?" — Why can't you intercept property access on a plain object?

**Answer:** There is no `Symbol.get`, and the old non-standard `__noSuchMethod__` was removed.

Property access is the hottest operation in the language. Engines make it fast with **inline caches**: at each access site they record the object's shape and the property's offset, so a repeat access is a shape check plus a memory read. That optimization requires property access to be predictable and effect-free.

If any `obj.x` could run user code:

- every access site would need a deoptimization guard
- accesses couldn't be reordered, hoisted, or eliminated
- a property read could throw, so every site needs exception handling

The cost lands on **every property access in every program** to serve a small number of interception use cases.

**What replaced it:** `Proxy` (ES2015). A proxy is a **separate object** that explicitly declares itself interceptable. Ordinary objects keep the fast path; you pay the cost only on the objects you opt in. That's the same trade the language made with `===` (Chapter 8) — keep the hot path unhookable, and provide an explicit opt-in mechanism beside it.

---

## Q7: Why is `Object.freeze` shallow?

**Answer:** Because of what freezing actually *does*. It isn't a deep operation that got truncated — it's a descriptor operation, and descriptors are per-object.

`Object.freeze(o)` sets `writable: false` and `configurable: false` on `o`'s **own** properties, and marks `o` non-extensible. That's it.

```javascript
const o = Object.freeze({ a: 1, nested: { b: 2 } });
Object.getOwnPropertyDescriptor(o, "a");
// { value: 1, writable: false, enumerable: true, configurable: false }
```

The descriptor for `nested` is frozen — you can't *reassign* `o.nested`. But the descriptor's `value` is a **reference** (Chapter 7), and the object it points at has its own, untouched descriptors. Nothing about freezing `o` says anything about that other object.

**Follow-up:** why doesn't `Object.freeze` recurse by default? Because it would have to traverse an arbitrary object graph, handle cycles, and decide whether to cross into objects you don't own (`Object.prototype`?). The spec keeps it a single-object primitive and leaves deep freezing to library code — which is exactly what you write in the Chapter 7 cumulative exercise.

---

## Q8: What does this print, and why?

```javascript
const proto = { greet() { return "hi"; } };
const obj = Object.create(proto);

console.log(Object.keys(obj));
console.log("greet" in obj);
console.log(obj.greet());
console.log(JSON.stringify(obj));
```

**Answer:** `[]`, `true`, `"hi"`, `{}`

**What it proves:** an object can behave as if it has properties while owning none. `Object.keys` and `JSON.stringify` report only **own enumerable string-keyed** properties; `in` and actual access walk the whole chain.

This is why serializing an object can silently lose its behavior *and* its inherited data, and why "the object is empty" is not a conclusion you can draw from `Object.keys(obj).length === 0`.

**Follow-up:** which API would show `greet`? `for...in` (it enumerates inherited enumerable keys), or walking the chain yourself with `Object.getPrototypeOf` + `Reflect.ownKeys`.

---

## Q9: Why should you never use `Object.setPrototypeOf`?

**Answer:** It works correctly and it destroys performance permanently.

Engines assign every object a hidden class ("shape") describing its layout — **including its prototype**. Inline caches key off that shape. Changing an object's prototype after creation invalidates the shape, invalidates every inline cache that has ever seen that object, and V8 explicitly documents it as moving affected code onto a slow path that it does not recover from.

The correct approaches all set the prototype **at creation time**, when the engine can assign a stable shape:

```javascript
Object.create(proto)     // direct
new Ctor()               // via Ctor.prototype
class B extends A {}     // via the class hierarchy
```

**The follow-up worth knowing:** `obj.__proto__ = x` is the same operation wearing a friendlier name — `__proto__` is an accessor on `Object.prototype` (standardized only in Annex B for web compatibility) whose setter calls `SetPrototypeOf`. Same deoptimization, plus it silently does nothing on null-prototype objects.

---

## Q10: Trap — predict the output

```javascript
const proto = { items: [], name: "default" };
const a = Object.create(proto);
const b = Object.create(proto);

a.items.push("x");
a.name = "custom";

console.log(a.items, b.items);
console.log(a.name, b.name);
console.log(Object.hasOwn(a, "items"), Object.hasOwn(a, "name"));
```

**Answer:**

```
[ 'x' ] [ 'x' ]
custom default
false true
```

**The explanation to give:**

- `a.items.push("x")` is a **mutation**, not an assignment. Reading `a.items` walks to the prototype and returns the shared array; `push` mutates that one object, so `b` sees it. No own property is created — `hasOwn(a, "items")` is `false`.
- `a.name = "custom"` is an **assignment**. It creates an own property on `a`, shadowing the prototype's. `b` still sees the default, and `hasOwn(a, "name")` is `true`.

Two lines that look symmetrical do completely different things. This is the single most valuable thing to be able to explain from this chapter, because it requires holding Chapter 7 (mutation vs reassignment) and Chapter 9 (the chain) at the same time.
