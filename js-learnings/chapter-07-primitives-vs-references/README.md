# Chapter 7 — Primitive vs Reference Types

## The Core Mental Model

JavaScript has two fundamentally different kinds of values, and they behave completely differently in memory, assignment, comparison, and function calls.

```
Every value in JavaScript is either:
  ┌────────────────────┐    ┌────────────────────────────────────┐
  │     PRIMITIVE      │    │          REFERENCE TYPE            │
  │                    │    │                                    │
  │  The value IS the  │    │  The value is a POINTER to an      │
  │  data. Stored      │    │  object in the heap. Stored        │
  │  directly.         │    │  indirectly.                       │
  └────────────────────┘    └────────────────────────────────────┘
```

---

## The Seven Primitives

```javascript
let a = 42;           // number
let b = "hello";      // string
let c = true;         // boolean
let d = undefined;    // undefined
let e = null;         // null
let f = 10n;          // bigint
let g = Symbol("id"); // symbol
```

All seven are **immutable** and **stored by value**.

### `undefined` vs `null` — Two Different Primitives

Both represent "nothing" but with different semantics:

```javascript
let x;          // undefined — variable declared but not assigned
let y = null;   // null — explicitly set to "no value"
```

```
undefined = "this hasn't been given a value yet" (language-assigned)
null      = "this intentionally has no value"    (programmer-assigned)
```

They are equal with `==` but not with `===`:
```javascript
null == undefined  // true  (special rule — covered in Ch8 on coercion)
null === undefined // false (different types)
```

### Symbol — Always Unique

Every `Symbol()` call produces a **unique** value, even with the same label:

```javascript
const a = Symbol("id");
const b = Symbol("id");
a === b // false — always unique, the label is just a description
a === a // true — same reference
```

Symbols are typically used as unique object keys that won't accidentally collide with string keys.

---

## Reference Types

Everything that is not a primitive is a reference type — an object in the heap:

```javascript
let obj = { x: 1 };       // object
let arr = [1, 2, 3];       // array (object)
let fn  = function() {};    // function (object)
let map = new Map();        // Map (object)
let re  = /hello/;         // RegExp (object)
```

---

## Where Values Live in Memory

### Where exactly are they stored? — Connecting to ERs

You already know that every variable binding lives in an **Environment Record (ER)**. That hasn't changed. The difference is in **what the ER binding slot contains**:

```
ER Binding for a primitive:
  ┌──────────────┬──────────────┐
  │  name: "x"   │  value: 42   │  ← the VALUE lives directly in the binding slot
  └──────────────┴──────────────┘

ER Binding for a reference type:
  ┌──────────────┬──────────────┐
  │  name: "obj" │  value: 0xA1 │  ← a POINTER lives in the binding slot
  └──────────────┴──────────────┘
                       │
                       ▼  (HEAP)
                0xA1: { name: "Alice" }  ← the actual object lives here
```

The ER always holds the binding. The question is what type of value that slot contains — the raw data itself, or a memory address pointing to the heap.

### The "stack vs heap" mental model

You'll often hear "primitives are on the stack, objects are on the heap." This is a simplification borrowed from C/C++. In JavaScript, the truth is:

- The **ER itself** is heap-allocated — it has to be, because closures keep ERs alive after their function returns (Chapter 6).
- What "stored on the stack" really means in JS: the **value is inline in the ER binding slot**.
- What "stored on the heap" means: **the object data is separate**, and the binding slot holds only a pointer to it.

```
Everything lives in JS engine memory (heap):
│
├── Global ER
│     ├── x:   42       ← primitive: value is inline in the slot
│     └── obj: 0xA1     ← reference: pointer to a heap object
│
├── makeCounter's ER (kept alive by closure)
│     └── count: 3      ← primitive, inline
│
└── HEAP OBJECTS
      ├── 0xA1: { name: "Alice" }
      ├── 0xB3: [1, 2, 3]
      └── 0xC7: function() {...}
```

So when you read "primitive on the stack" — think: *the value is stored inline in the ER binding*. When you read "object on the heap" — think: *the object data is separate; the ER binding holds a pointer to it*.

### Primitives — value stored inline in the ER binding

```javascript
let x = 42;
let y = x; // y's binding slot gets a COPY of the value 42
```

```
ER binding │ Value
───────────│───────
x          │  42
y          │  42   ← independent copy, no shared reference
```

Changing `y` has zero effect on `x`:
```javascript
y = 99;
console.log(x); // 42 — x's slot still holds 42
```

### Reference types — pointer stored in ER binding, object in the heap

```javascript
let obj1 = { name: "Alice" };
let obj2 = obj1; // obj2's binding slot gets a COPY of the POINTER, not the object
```

```
ER binding │ Pointer │ HEAP
───────────│─────────│────────────────────────
obj1       │  0xA1  ─┼─────────────────────► 0xA1: { name: "Alice" }
obj2       │  0xA1  ─┘                        (same heap object)
```

Both binding slots hold the same address. There is one object. Mutating through one is visible through the other:

```javascript
obj2.name = "Bob";
console.log(obj1.name); // "Bob" — same heap object
```

---

## Assignment: Value Copy vs Pointer Copy

```javascript
// Primitive — value is copied
let a = 10;
let b = a;  // b = 10 (independent)
b = 20;
console.log(a); // 10

// Reference — pointer is copied, object is shared
let arr1 = [1, 2, 3];
let arr2 = arr1;  // arr2 = pointer to same array
arr2.push(4);
console.log(arr1); // [1, 2, 3, 4] — same array
```

---

## Function Arguments — JavaScript is Always "Pass by Value"

This is one of the most misunderstood things in JavaScript.

**JavaScript is pass by value. Always.**

But for reference types, the "value" being passed is the **pointer**.

### With primitives — caller is unaffected

```javascript
function increment(n) {
  n++;
  return n;
}

let x = 5;
increment(x);
console.log(x); // 5 — x is unchanged
```

`n` gets a copy of `5`. The function modifies its own copy. `x` is untouched.

### With reference types — the shared object can be mutated

```javascript
function addItem(arr, item) {
  arr.push(item); // mutates the heap object that both arr and the caller point to
}

const items = [1, 2];
addItem(items, 3);
console.log(items); // [1, 2, 3] — the heap object was mutated
```

`arr` (inside the function) gets a copy of the pointer. Both `arr` and `items` point to the **same heap object**. Calling `arr.push()` mutates that shared object.

### But reassigning the parameter does NOT affect the caller

```javascript
function replace(arr) {
  arr = [99]; // reassigns the LOCAL binding — the caller's pointer is unaffected
}

const items = [1, 2, 3];
replace(items);
console.log(items); // [1, 2, 3] — items still points to the original array
```

`arr = [99]` only changes what the local variable `arr` points to. The caller's `items` still points to the original array.

```
Before replace():
  items  → 0x1: [1, 2, 3]
  arr    → 0x1: [1, 2, 3]  (copy of pointer)

After arr = [99]:
  items  → 0x1: [1, 2, 3]  (unchanged)
  arr    → 0x2: [99]        (new allocation, arr now points here)
```

---

## Primitives Are Immutable

You cannot change a primitive value. You can only replace the binding with a new value.

```javascript
let str = "hello";
str[0] = "H"; // silently fails in sloppy, TypeError in strict
console.log(str); // "hello" — unchanged
```

String methods do not mutate — they always return a new string:

```javascript
let s = "hello";
let t = s.toUpperCase();
console.log(s); // "hello" — unchanged
console.log(t); // "HELLO" — new string
```

This is why strings can safely be shared — no one can mutate them through a reference.

---

## Autoboxing — How Primitives Have Methods

Primitives have no methods. Yet you can call `.toUpperCase()` on a string and `.toFixed()` on a number. How?

When you access a property or method on a primitive, JavaScript **temporarily wraps it in its object counterpart**, executes the method on the wrapper, and discards the wrapper immediately.

```javascript
"hello".toUpperCase()  
// JS does this internally:
// 1. wrap:   new String("hello")  → temporary String object
// 2. call:   tempObj.toUpperCase() → "HELLO"
// 3. discard: tempObj is gone
// result:   "HELLO"
```

The primitive `"hello"` is never modified. You get a new string back.

### The three autoboxing wrappers

| Primitive | Temporary Wrapper |
|---|---|
| `string` | `String` object |
| `number` | `Number` object |
| `boolean` | `Boolean` object |

`undefined`, `null`, `symbol`, and `bigint` do **not** autobox. Accessing a property on `undefined` or `null` throws a `TypeError`.

### Never use `new String()`, `new Number()`, `new Boolean()`

These create **wrapper objects**, not primitives. They cause type confusion:

```javascript
typeof "hello"           // "string"   ← primitive
typeof new String("hello") // "object"   ← wrapper object

"hello" === new String("hello")    // false — different types!
new Boolean(false) == false        // true (coercion)
if (new Boolean(false)) { ... }    // ← this runs! object is truthy
```

`new Boolean(false)` is a truthy object that wraps `false`. Using it in an `if` condition will always run the block. This is one of JavaScript's most dangerous traps.

---

## Object Mutation vs Reassignment — The `const` Confusion

`const` prevents reassignment of the binding, not mutation of the object:

```javascript
const obj = { x: 1 };
obj.x = 99;        // ✅ — mutates the heap object, binding is unchanged
obj = { x: 99 };   // ❌ TypeError — tries to reassign the binding
```

```
const means: this variable CANNOT point to a different address.
It says nothing about what's at that address.
```

```javascript
const arr = [1, 2, 3];
arr.push(4);     // ✅ — mutates the array in the heap
arr = [1, 2, 3]; // ❌ TypeError — tries to change what arr points to
```

---

## Equality: `===` Behaves Differently for Each Kind

### Primitives: compared by value

```javascript
5 === 5           // true
"hello" === "hello" // true
```

Two separate primitive values that are equal compare as equal.

### Reference types: compared by identity (pointer)

```javascript
const a = { x: 1 };
const b = { x: 1 };
a === b // false — different objects in the heap, different pointers

const c = a;
a === c // true — same pointer, same heap object
```

This is the key interview trap: two objects with identical contents are NOT equal unless they are literally the same object.

```javascript
[1, 2, 3] === [1, 2, 3] // false — two different arrays
```

---

## `typeof null === "object"` — The Historical Bug

```javascript
typeof null // "object"
```

This is a bug from JavaScript's very first version (1995). In the original C implementation, values were stored with a type tag. The `null` value had a type tag of `0`, which was the same tag as objects. The bug was preserved for backward compatibility.

The spec explicitly acknowledges this. `null` is **not** an object — it is a primitive. To check for null correctly:

```javascript
// Correct:
value === null

// Wrong (returns true for both null and objects):
typeof value === "object"

// Safe null/object check:
typeof value === "object" && value !== null

// Also useful: Array.isArray() — because typeof [] === "object"
Array.isArray([1, 2, 3]); // true
Array.isArray({ a: 1 });  // false
```

---

## Copying Reference Types Correctly

### Shallow copy (one level deep)

```javascript
const original = { a: 1, b: { c: 2 } };

// Option 1: spread
const copy1 = { ...original };

// Option 2: Object.assign
const copy2 = Object.assign({}, original);

// These are shallow — nested objects are still shared:
copy1.b === original.b // true — same nested object
copy1.b.c = 99;
console.log(original.b.c); // 99 — both point to the same nested object
```

### Deep copy (all levels)

```javascript
const deepCopy = JSON.parse(JSON.stringify(original)); // works for plain data
// Caveat: loses functions, undefined, Dates become strings, symbols are dropped

// Modern:
const deepCopy2 = structuredClone(original); // handles more types correctly
```

### `Object.freeze()` — True (Shallow) Immutability

To prevent mutation of an object's top-level properties:

```javascript
const config = Object.freeze({ host: "localhost", port: 3000 });
config.port = 9000;  // silently fails in sloppy, TypeError in strict
console.log(config.port); // 3000 — unchanged
```

`freeze` is **shallow** — nested objects are not frozen:

```javascript
const obj = Object.freeze({ inner: { x: 1 } });
obj.inner.x = 99;      // ✅ — inner is not frozen
console.log(obj.inner.x); // 99 — mutation succeeded
obj.inner = {};        // ❌ — reassigning the property is blocked
```

---

## ASCII Diagram — Stack vs Heap

```
VARIABLE BINDINGS (ER / stack frame)     HEAP
─────────────────────────────────────    ─────────────────────────
x     │   42          (primitive)
str   │  "hello"      (primitive)
bool  │   true        (primitive)

obj1  │   0xA1   ─────────────────────►  0xA1: { name: "Alice" }
obj2  │   0xA1   ─────────────────────►  (same)

arr   │   0xB3   ─────────────────────►  0xB3: [1, 2, 3]

fn    │   0xC7   ─────────────────────►  0xC7: function() {...}
```

Primitives live directly in the binding.  
Reference types have a pointer in the binding and data in the heap.

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "JavaScript passes objects by reference" | JS passes the **pointer by value** — you get a copy of the address |
| "Reassigning a parameter changes the caller's variable" | No — reassigning changes the local binding, not the caller's pointer |
| "`const` makes objects immutable" | `const` prevents rebinding, not mutation of the heap object |
| "`null` is an object" | `null` is a primitive — `typeof null === "object"` is a historical bug |
| "Two objects with the same content are equal" | Reference equality compares pointers — same content ≠ same identity |
| "Strings are mutable like arrays" | Strings are immutable primitives — all string methods return new strings |
