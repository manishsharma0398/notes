# Chapter 7: Primitive vs Reference Types

## Mental Model

JavaScript has **two fundamentally different categories of values**:

1. **Primitives** (value types): Immutable, copied by value
2. **References** (reference types): Mutable, copied by reference

This is NOT about syntax or features—it's about **how values are stored and accessed in memory**.

```
PRIMITIVE:                    REFERENCE:
┌─────────────┐              ┌─────────────┐
│ Variable    │              │ Variable    │
├─────────────┤              ├─────────────┤
│ Actual      │              │ Memory      │
│ Value       │              │ Address   ──┼──→ ┌──────────┐
└─────────────┘              └─────────────┘    │ Object   │
                                                 │ in Heap  │
                                                 └──────────┘
```

## The Seven Primitive Types

JavaScript has exactly **7 primitive types**:

1. **number** (including `NaN`, `Infinity`)
2. **string**
3. **boolean**
4. **undefined**
5. **null**
6. **symbol** (ES6+)
7. **bigint** (ES2020+)

Everything else is a **reference type** (objects, arrays, functions, dates, etc.).

## What Developers Think vs What Actually Happens

### Common Misconception

"Strings are objects because they have methods like `.toUpperCase()`"

### Reality

**Primitives are NOT objects.**

When you write `"hello".toUpperCase()`:
1. JavaScript creates a **temporary wrapper object** (String object)
2. The method is called on that object
3. The wrapper is **immediately discarded**

This is called **auto-boxing** or **primitive wrapper objects**.

## The Actual Mechanism

### Primitive Storage

Primitives are stored **directly in the variable's memory slot**.

```javascript
let a = 5;
let b = a;  // COPIES the value 5

b = 10;  // Only 'b' changes

console.log(a);  // 5
console.log(b);  // 10
```

**Memory diagram:**
```
a: [5]  ← Separate memory location
b: [10] ← Separate memory location
```

### Reference Storage

References store a **memory address** (pointer) to the actual data.

```javascript
let obj1 = { x: 5 };
let obj2 = obj1;  // COPIES the reference (address)

obj2.x = 10;  // Modifies the SAME object

console.log(obj1.x);  // 10
console.log(obj2.x);  // 10
```

**Memory diagram:**
```
obj1: [0xFF00] ──→ ┌────────┐
                    │ x: 10  │  ← Same object in heap
obj2: [0xFF00] ──→ └────────┘
```

Both variables point to the **same object in memory**.

## Immutability vs Mutability

### Primitives Are Immutable

You **cannot** modify a primitive value. You can only replace it.

```javascript
let str = "hello";
str[0] = "H";  // Silently fails (strict mode: error)
console.log(str);  // "hello" (unchanged)

str = "Hello";  // Creates NEW string, reassigns variable
```

Even string methods return NEW strings:
```javascript
let original = "hello";
let upper = original.toUpperCase();

console.log(original);  // "hello" (unchanged)
console.log(upper);     // "HELLO" (new string)
```

### References Are Mutable

You can modify the contents of reference types.

```javascript
const obj = { x: 1 };
obj.x = 2;       // ✓ Allowed (modifying content)
obj.y = 3;       // ✓ Allowed (adding property)

obj = { x: 5 };  // ✗ Error (reassigning const variable)
```

**Important**: `const` prevents **reassignment**, not **mutation**.

## Equality Comparison

### Primitives: Compare by Value

```javascript
let a = 5;
let b = 5;
console.log(a === b);  // true (same value)

let str1 = "hello";
let str2 = "hello";
console.log(str1 === str2);  // true (same value)
```

### References: Compare by Reference

```javascript
let obj1 = { x: 5 };
let obj2 = { x: 5 };
console.log(obj1 === obj2);  // false (different objects)

let obj3 = obj1;
console.log(obj1 === obj3);  // true (same reference)
```

**Key insight**: Two objects with identical contents are NOT equal unless they're the same object in memory.

## Function Arguments

### Pass-by-Value (Primitives)

```javascript
function modify(x) {
  x = 100;  // Only modifies local copy
}

let num = 5;
modify(num);
console.log(num);  // 5 (unchanged)
```

**What happens:**
1. `modify` receives a **copy** of the value
2. Modifying the parameter doesn't affect the original

### Pass-by-Reference (References)

**More precisely: Pass-by-Value of the Reference**

```javascript
function modify(obj) {
  obj.x = 100;  // Modifies the original object
}

let myObj = { x: 5 };
modify(myObj);
console.log(myObj.x);  // 100 (changed!)
```

**What happens:**
1. The **reference** (memory address) is copied
2. Both the original and the copy point to the **same object**
3. Modifications through either reference affect the same object

### The Gotcha: Reassignment

```javascript
function reassign(obj) {
  obj = { x: 999 };  // Reassigns local variable only
}

let myObj = { x: 5 };
reassign(myObj);
console.log(myObj.x);  // 5 (unchanged!)
```

**Why?**
- The reference was **copied** into the parameter
- Reassigning the parameter changes the **local copy**, not the original variable

## Arrays Are References

Arrays are objects, so they're reference types.

```javascript
let arr1 = [1, 2, 3];
let arr2 = arr1;  // Copies reference

arr2.push(4);

console.log(arr1);  // [1, 2, 3, 4]
console.log(arr2);  // [1, 2, 3, 4]
```

Both variables point to the **same array**.

## Copying Objects and Arrays

### Shallow Copy

Copies **top-level properties only**.

```javascript
// Object shallow copy
let original = { x: 1, nested: { y: 2 } };
let copy = { ...original };  // or Object.assign({}, original)

copy.x = 10;  // Doesn't affect original
console.log(original.x);  // 1

copy.nested.y = 20;  // AFFECTS original!
console.log(original.nested.y);  // 20
```

**Why?** The nested object is still referenced.

```javascript
// Array shallow copy
let arr1 = [1, 2, [3, 4]];
let arr2 = [...arr1];  // or arr1.slice()

arr2[0] = 10;  // Doesn't affect arr1
arr2[2][0] = 30;  // AFFECTS arr1!

console.log(arr1);  // [1, 2, [30, 4]]
```

### Deep Copy

Copies **all levels**, creating completely independent structures.

```javascript
// Modern: structuredClone (ES2022)
let original = { x: 1, nested: { y: 2 } };
let deepCopy = structuredClone(original);

deepCopy.nested.y = 20;
console.log(original.nested.y);  // 2 (unchanged)
```

**Older methods**:
```javascript
// JSON method (limitations: loses functions, undefined, symbols, etc.)
let deepCopy = JSON.parse(JSON.stringify(original));

// Manual recursive copy
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(deepClone);
  }
  
  const clone = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  return clone;
}
```

## Primitive Wrapper Objects (Auto-boxing)

When you call methods on primitives, JavaScript temporarily wraps them in objects.

```javascript
let str = "hello";
str.toUpperCase();  // Temporary String object created
```

**Under the hood:**
```javascript
// What actually happens:
new String("hello").toUpperCase();  // Wrapper created and discarded
```

**You can create wrappers explicitly** (but shouldn't):
```javascript
let strPrimitive = "hello";
let strObject = new String("hello");

console.log(typeof strPrimitive);  // "string"
console.log(typeof strObject);     // "object"

console.log(strPrimitive === strObject);  // false
console.log(strPrimitive == strObject);   // true (coercion)
```

## Special Case: null and undefined

### undefined

- Type: `undefined`
- Only value: `undefined`
- Represents "not assigned" or "missing value"

```javascript
let x;
console.log(x);  // undefined

function foo() {}
console.log(foo());  // undefined (no return value)
```

### null

- Type: `object` (historical bug!)
- Only value: `null`
- Represents "intentionally empty" or "no object"

```javascript
let obj = null;  // Explicitly no object

console.log(typeof null);  // "object" (BUG in spec!)
console.log(null === undefined);  // false
console.log(null == undefined);   // true
```

**Why `typeof null === "object"`?**

Historical bug from JavaScript's first implementation. Fixing it would break millions of websites, so it's part of the spec forever.

## What JavaScript Cannot Do

### You Cannot:

1. **Modify primitive values in place**
   - All primitive operations create new values

2. **Make primitives behave like references**
   - Primitives are always copied by value

3. **Prevent object mutation** (without tools)
   - `Object.freeze()` can help, but it's shallow
   - `const` only prevents reassignment, not mutation

4. **Change the type of a value**
   - You can only create new values of different types

## Performance Implications

### Primitives: Fast

- Stored on the **stack** (usually)
- Direct access
- Cheap to copy and compare

### References: Slower (Relatively)

- Stored on the **heap**
- Indirect access via pointer
- Comparison only checks reference, not content
- Copying requires walking the structure (for deep copies)

## Common Pitfalls

### Pitfall 1: Unexpected Mutation

```javascript
function addItem(arr, item) {
  arr.push(item);  // Mutates original!
}

let myArray = [1, 2, 3];
addItem(myArray, 4);
console.log(myArray);  // [1, 2, 3, 4] - mutated!
```

**Fix**: Return a new array
```javascript
function addItem(arr, item) {
  return [...arr, item];
}
```

### Pitfall 2: Shallow Copy Trap

```javascript
let obj = { user: { name: "Alice" } };
let copy = { ...obj };

copy.user.name = "Bob";
console.log(obj.user.name);  // "Bob" - oops!
```

### Pitfall 3: Comparison Gotcha

```javascript
console.log([1, 2, 3] === [1, 2, 3]);  // false

const arr = [1, 2, 3];
console.log(arr === arr);  // true (same reference)
```

### Pitfall 4: Default Parameters

```javascript
function process(options = {}) {
  options.processed = true;  // Mutates the default!
}

process();
process();  // Default object was mutated in first call!
```

**Fix**: Create new object each call
```javascript
function process(options) {
  options = options || {};  // Or use nullish coalescing
  // ...
}
```

## Type Checking

```javascript
// Primitives
typeof 5              // "number"
typeof "hello"        // "string"
typeof true           // "boolean"
typeof undefined      // "undefined"
typeof null           // "object" (BUG!)
typeof Symbol()       // "symbol"
typeof 10n            // "bigint"

// References
typeof {}             // "object"
typeof []             // "object" (not "array"!)
typeof function(){}   // "function"

// Better array check
Array.isArray([])     // true
Array.isArray({})     // false
```

## Interview Insight

When asked "What's the difference between primitives and references?", a precise answer is:

> "Primitives are immutable values stored directly in the variable's memory location and are copied by value. JavaScript has seven primitive types: number, string, boolean, undefined, null, symbol, and bigint. 
>
> References are mutable objects stored in heap memory, with variables holding memory addresses (pointers) to the actual data. When you assign a reference type, you copy the reference, not the object itself, so multiple variables can point to the same object.
>
> This has critical implications: primitives are compared by value, while references are compared by address. Modifying an object through one reference affects all variables pointing to that object. Function arguments follow the same pattern—primitives pass a copy of the value, while references pass a copy of the memory address."

## Visual Summary

```
ASSIGNMENT:
  Primitives: let b = a  →  Copy VALUE
  References: let b = a  →  Copy REFERENCE

COMPARISON:
  Primitives: a === b    →  Compare VALUES
  References: a === b    →  Compare REFERENCES (same object?)

MUTATION:
  Primitives: IMPOSSIBLE  →  Creates new value
  References: POSSIBLE    →  Modifies object in place

FUNCTION ARGS:
  Primitives: Pass copy of VALUE
  References: Pass copy of REFERENCE (points to same object)
```
