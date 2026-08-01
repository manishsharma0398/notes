# Chapter 7 — Primitives vs References: Revision Notes

## The Two Kinds of Values

| | Primitive | Reference Type |
|---|---|---|
| What's in the ER binding slot | The value itself | A pointer to the heap |
| Assignment copies | The value | The pointer |
| Mutation possible? | No (immutable) | Yes |
| Equality (`===`) | By value | By identity (pointer) |
| Types | string, number, boolean, undefined, null, bigint, symbol | All objects (plain objects, arrays, functions, Map, Set, etc.) |

---

## Where Values Are Stored (Connecting to ERs)

Every variable binding lives in an **Environment Record (ER)** — that's always true (Chapters 2–3).

```
ER binding (primitive):  name: "x" │ value: 42      ← value is inline
ER binding (reference):  name: "o" │ value: 0xA1    ← pointer to heap object
                                           │
                                           ▼
                                    HEAP: { name: "Alice" }
```

- "Primitive on the stack" = value is **inline in the ER binding slot**
- "Object on the heap" = **object data is separate**; binding holds a pointer
- The ER itself is heap-allocated (closures keep ERs alive after the function returns)

---

## `undefined` vs `null`

```
undefined = language-assigned: "not given a value yet"
null      = programmer-assigned: "intentionally no value"

null == undefined   // true  (coercion — Ch8)
null === undefined  // false (different types)
```

---

## Symbol — Always Unique

```javascript
Symbol("id") === Symbol("id") // false — every call creates a unique value
const s = Symbol("id");
s === s                       // true — same reference
```

---

## Key Rules

### Assignment
```javascript
// Primitive: independent copy
let a = 5; let b = a; b = 9; // a = 5, b = 9

// Reference: shared pointer
let x = {}; let y = x; y.n = 1; // x.n = 1 too
```

### Function arguments — always pass by value
```javascript
// Primitive: caller unchanged
function f(n) { n = 99; }
let v = 1; f(v); // v = 1

// Reference: heap object can be mutated through the pointer copy
function g(arr) { arr.push(1); }
let a = []; g(a); // a = [1]

// But reassigning the local binding doesn't affect the caller:
function h(arr) { arr = [99]; }
let b = []; h(b); // b = [] — unchanged
```

### `const` ≠ immutable
```javascript
const obj = {};
obj.x = 1; // ✅ mutation allowed
obj = {};  // ❌ TypeError — rebinding not allowed
```

### `Object.freeze()` — true (shallow) immutability
```javascript
const cfg = Object.freeze({ port: 3000 });
cfg.port = 9000; // silently fails (strict: TypeError)
cfg.port         // 3000 — unchanged

// Shallow only — nested objects are NOT frozen:
const o = Object.freeze({ inner: { x: 1 } });
o.inner.x = 99; // ✅ — inner is not frozen
```

### Reference equality
```javascript
{} === {}       // false (different heap objects)
[] === []       // false
null === null   // true (null is a primitive)

const a = {};
const b = a;
a === b          // true (same pointer)
```

---

## Autoboxing — How Primitives Have Methods

When you call `.toUpperCase()` on a string literal, JS temporarily wraps it in a `String` object, calls the method, discards the wrapper:

```javascript
"hello".toUpperCase() // → "HELLO"
// Internally: new String("hello").toUpperCase() — wrapper immediately discarded
```

Wrappers that autobox: `String`, `Number`, `Boolean`  
Does NOT autobox: `undefined`, `null` (TypeError if you access a property on them)

### Never use wrapper constructors with `new`
```javascript
typeof "hello"              // "string"  — primitive
typeof new String("hello")  // "object"  — wrapper object (WRONG)

if (new Boolean(false)) {}  // ← RUNS! Object is truthy even though it wraps false
```

---

## `typeof` Quick Reference

```javascript
typeof 42          // "number"
typeof "hi"        // "string"
typeof true        // "boolean"
typeof undefined   // "undefined"
typeof null        // "object"  ← BUG! null is a primitive
typeof {}          // "object"
typeof []          // "object"
typeof function(){} // "function"
typeof Symbol()    // "symbol"
typeof 10n         // "bigint"
```

**Safe null check:** `value === null`  
**Safe object (not null) check:** `typeof value === "object" && value !== null`  
**Array check:** `Array.isArray(value)` (because `typeof [] === "object"`)

---

## Shallow vs Deep Copy

```javascript
// Shallow — nested refs still shared
const copy = { ...original };

// Deep — fully independent
const deep = structuredClone(original);  // modern
const deep2 = JSON.parse(JSON.stringify(original)); // older, limited
```

---

## Interview Quick-Fire

- **"Is JS pass by value or reference?"** → Always pass by value. For objects, the value IS the pointer.
- **"Why can I mutate an array in a function?"** → The pointer is copied — both caller and function point to the same heap array.
- **"Why doesn't reassigning a parameter affect the caller?"** → Reassignment changes the local binding, not the caller's pointer.
- **"Why is `typeof null === 'object'`?"** → Historical bug from 1995 — null had a `0` type tag, same as objects.
- **"Are two `{}` objects with the same keys equal?"** → No — `===` compares pointers, not content.
- **"How does `.toUpperCase()` work on a string primitive?"** → Autoboxing — JS wraps the primitive in a `String` object temporarily.
- **"Is `new Boolean(false)` falsy?"** → No — it's a truthy object even though it wraps `false`. Never use wrapper constructors.
- **"Where are primitives stored vs objects?"** → Both via ER bindings. Primitive value is inline in the binding slot. Object data is in the heap; binding holds a pointer.


---

## Key Rules

### Assignment
```javascript
// Primitive: independent copy
let a = 5; let b = a; b = 9; // a = 5, b = 9

// Reference: shared pointer
let x = {}; let y = x; y.n = 1; // x.n = 1 too
```

### Function arguments — always pass by value
```javascript
// Primitive: caller unchanged
function f(n) { n = 99; }
let v = 1; f(v); // v = 1

// Reference: heap object can be mutated through the pointer copy
function g(arr) { arr.push(1); }
let a = []; g(a); // a = [1]

// But reassigning the local binding doesn't affect the caller:
function h(arr) { arr = [99]; }
let b = []; h(b); // b = [] — unchanged
```

### `const` ≠ immutable
```javascript
const obj = {};
obj.x = 1; // ✅ mutation allowed
obj = {};  // ❌ TypeError — rebinding not allowed
```

### Reference equality
```javascript
{} === {}       // false (different heap objects)
[] === []       // false
null === null   // true (null is a primitive)

const a = {};
const b = a;
a === b          // true (same pointer)
```

---

## `typeof` Quick Reference

```javascript
typeof 42          // "number"
typeof "hi"        // "string"
typeof true        // "boolean"
typeof undefined   // "undefined"
typeof null        // "object"  ← BUG! null is a primitive
typeof {}          // "object"
typeof []          // "object"
typeof function(){} // "function"
typeof Symbol()    // "symbol"
typeof 10n         // "bigint"
```

**Safe null check:** `value === null` (not `typeof value === "object"`)

---

## Shallow vs Deep Copy

```javascript
// Shallow — nested refs still shared
const copy = { ...original };

// Deep — fully independent
const deep = structuredClone(original);  // modern
const deep2 = JSON.parse(JSON.stringify(original)); // older, limited
```

---

## Interview Quick-Fire

- **"Is JS pass by value or reference?"** → Always pass by value. For objects, the value IS the pointer.
- **"Why can I mutate an array in a function?"** → The pointer is copied — both caller and function point to the same heap array.
- **"Why doesn't reassigning a parameter affect the caller?"** → Reassignment changes the local binding, not the caller's pointer.
- **"Why is `typeof null === 'object'`?"** → Historical bug from 1995 — null had a `0` type tag, same as objects.
- **"Are two `{}` objects with the same keys equal?"** → No — `===` compares pointers, not content.
