# Chapter 7: Primitive vs Reference Types - Revision Notes

## Two Categories of Values

**Primitives**: Immutable, stored by value, compared by value
**References**: Mutable, stored by reference (memory address), compared by reference

## The Seven Primitive Types

1. `number` (including `NaN`, `Infinity`)
2. `string`
3. `boolean`
4. `undefined`
5. `null`
6. `symbol` (ES6+)
7. `bigint` (ES2020+)

Everything else is a **reference type** (objects, arrays, functions, dates, etc.).

## Memory Model

### Primitives
```
let a = 5;
let b = a;  // COPIES the value

Memory:
  a: [5]  ← Separate location
  b: [5]  ← Separate location
```

### References
```
let obj1 = { x: 5 };
let obj2 = obj1;  // COPIES the reference

Memory:
  obj1: [0xFF00] ──→ { x: 5 }  ← Same object
  obj2: [0xFF00] ──┘
```

## Immutability vs Mutability

### Primitives: Immutable
- Cannot modify the value itself
- Operations create NEW values
- Example: `str.toUpperCase()` returns NEW string

### References: Mutable
- Can modify object contents
- `const` prevents reassignment, NOT mutation
- Example: `obj.x = 10` modifies existing object

## Equality Comparison

### Primitives: By Value
```javascript
5 === 5              // true
"hello" === "hello"  // true
```

### References: By Reference
```javascript
{x:5} === {x:5}  // false (different objects)
let a = {x:5};
let b = a;
a === b          // true (same reference)
```

## Function Arguments

### Primitives: Pass by Value
```javascript
function modify(x) {
  x = 100;  // Only modifies local copy
}
let num = 5;
modify(num);  // num still 5
```

### References: Pass by Reference (of the address)
```javascript
function modify(obj) {
  obj.x = 100;  // Modifies original
}
let o = {x:5};
modify(o);  // o.x is now 100
```

### Reassignment Gotcha
```javascript
function reassign(obj) {
  obj = {x:999};  // Only reassigns LOCAL variable
}
let o = {x:5};
reassign(o);  // o still {x:5}
```

## Copying

### Shallow Copy
Copies top level only; nested objects still shared.

```javascript
let copy = {...original};        // Object
let copy = [...original];        // Array
let copy = Object.assign({}, original);
```

**Problem**: Nested objects are still referenced!

### Deep Copy
Copies all levels, creating independent structures.

```javascript
// Modern
let copy = structuredClone(original);

// Older (has limitations)
let copy = JSON.parse(JSON.stringify(original));
```

## Primitive Wrapper Objects (Auto-boxing)

When you call methods on primitives:
```javascript
"hello".toUpperCase()
// Internally: new String("hello").toUpperCase()
// Wrapper created, method called, wrapper discarded
```

**Don't use wrapper constructors directly:**
```javascript
new String("hello")  // ✗ Creates object, not primitive
String("hello")      // ✓ Converts to primitive
```

## Common Pitfalls

### 1. Unexpected Mutation
```javascript
arr.push(4);  // Mutates original
arr.sort();   // Mutates original
obj.x = 10;   // Mutates original
```

### 2. Shallow Copy Trap
```javascript
let copy = {...obj};
copy.nested.x = 10;  // Also changes original.nested.x!
```

### 3. Comparison Trap
```javascript
[1,2,3] === [1,2,3]  // false (different arrays)
```

### 4. const Doesn't Prevent Mutation
```javascript
const obj = {x:1};
obj.x = 2;  // Allowed! (mutation)
obj = {};   // Error! (reassignment)
```

### 5. Default Object Parameters
```javascript
function foo(opts = {}) {
  opts.x = 1;  // Mutates default!
}
```

## Type Checking

```javascript
// Primitives
typeof 5              // "number"
typeof "hi"           // "string"
typeof true           // "boolean"
typeof undefined      // "undefined"
typeof null           // "object" (BUG!)
typeof Symbol()       // "symbol"
typeof 10n            // "bigint"

// References
typeof {}             // "object"
typeof []             // "object" (not "array"!)
typeof function(){}   // "function"

// Better checks
Array.isArray([])     // true
```

## null vs undefined

### undefined
- Type: `undefined`
- Means: not assigned, missing value
- Automatic: uninitialized variables, missing function parameters

### null
- Type: `object` (historical bug)
- Means: intentionally empty, no object
- Manual: explicitly set by programmer

```javascript
undefined == null     // true
undefined === null    // false
```

## Mutating vs Non-Mutating Array Methods

### Mutating (modify original)
- `push`, `pop`, `shift`, `unshift`
- `splice`, `sort`, `reverse`
- `fill`, `copyWithin`

### Non-Mutating (return new)
- `map`, `filter`, `reduce`
- `slice`, `concat`
- `join`, `toString`

## Quick Reference

| Aspect | Primitives | References |
|--------|-----------|-----------|
| Storage | Direct value | Memory address |
| Assignment | Copies value | Copies reference |
| Comparison | By value | By reference |
| Mutation | Impossible | Possible |
| Function args | Pass value | Pass reference |
| `const` | Prevents change | Prevents reassignment only |

## Interview-Ready Explanation

> "JavaScript has two value categories: primitives and references. Primitives (number, string, boolean, undefined, null, symbol, bigint) are immutable and stored directly in variables. When assigned, they're copied by value. References (objects, arrays, functions) are mutable and stored in heap memory with variables holding memory addresses. When assigned, the reference is copied, so multiple variables can point to the same object. This affects equality—primitives compare by value, references by address—and function arguments, where primitives pass a copy but references allow mutation of the original object."
