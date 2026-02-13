# Chapter 9 Revision Notes: Value vs Reference Semantics

## Core Concept

JavaScript has **two different semantics** based on data type:

```
PRIMITIVES          OBJECTS
Value Semantics  →  Reference Semantics
Copy the VALUE   →  Copy the REFERENCE
```

## Mental Model

**Primitives**: The variable HOLDS the actual value
**Objects**: The variable HOLDS a pointer to the value

```
Primitive:  [box contains: 42]
Object:     [box contains: →] ───→ { value: 42 }
```

## The Key Insight

**JavaScript is ALWAYS pass-by-value**, but:
- For primitives: value = actual data
- For objects: value = memory address (reference)

This is called **"pass-by-value of the reference"** or **"pass-by-sharing"**

## Assignment Behavior

### Primitives
```javascript
let a = 5;
let b = a;  // COPIES the value 5
b = 10;     // Only b changes
```

### Objects
```javascript
let obj1 = { x: 5 };
let obj2 = obj1;  // COPIES the reference
obj2.x = 10;      // BOTH see the change
```

## Parameter Passing

### Primitives: Pass Copy of Value
```javascript
function fn(x) {
    x = 999;  // Modifies LOCAL copy only
}

let num = 42;
fn(num);
console.log(num);  // 42 (unchanged)
```

### Objects: Pass Copy of Reference
```javascript
function fn(obj) {
    obj.value = 999;  // Modifies shared object
}

let myObj = { value: 42 };
fn(myObj);
console.log(myObj.value);  // 999 (changed!)
```

### The Gotcha: Reassignment
```javascript
function fn(obj) {
    obj = { value: 999 };  // Reassigns LOCAL parameter
}

let myObj = { value: 42 };
fn(myObj);
console.log(myObj.value);  // 42 (unchanged!)
```

**Why?** Reassignment changes where the parameter points, not the original variable.

## Comparison Behavior

### Primitives: Compare by Value
```javascript
let a = 5;
let b = 5;
console.log(a === b);  // true (same value)
```

### Objects: Compare by Reference
```javascript
let obj1 = { x: 5 };
let obj2 = { x: 5 };
console.log(obj1 === obj2);  // false (different objects)

let obj3 = obj1;
console.log(obj1 === obj3);  // true (same reference)
```

## Mutation

### Primitives: IMMUTABLE
```javascript
let str = "hello";
str[0] = "H";  // Fails (can't mutate primitives)

// Methods return NEW values
str.toUpperCase();  // Returns "HELLO", str unchanged
```

### Objects: MUTABLE
```javascript
const obj = { x: 1 };
obj.x = 2;      // ✓ Mutation allowed
obj.y = 3;      // ✓ Adding property allowed
delete obj.x;   // ✓ Deleting allowed

// obj = {};    // ✗ Reassignment blocked by const
```

## const Behavior

**const prevents REASSIGNMENT, not MUTATION**

```javascript
const num = 42;
// num = 100;  // ✗ Error

const obj = { x: 1 };
obj.x = 100;   // ✓ Allowed (mutation)
// obj = {};   // ✗ Error (reassignment)
```

## Copying Strategies

### Shallow Copy
Copies top level only; nested objects shared.

**Methods:**
- `{...obj}` - Object spread
- `Object.assign({}, obj)`
- `[...arr]` - Array spread
- `arr.slice()`

```javascript
const copy = { ...original };
copy.name = "New";        // Independent
copy.nested.x = 100;      // Shared! Affects original
```

### Deep Copy
Copies all levels; completely independent.

**Methods:**
- `structuredClone(obj)` - ✓ **RECOMMENDED** (ES2022)
- `JSON.parse(JSON.stringify(obj))` - Has limitations
- Custom recursive clone

```javascript
const deepCopy = structuredClone(original);
deepCopy.nested.x = 100;  // Independent
```

### structuredClone() Advantages
- ✓ Handles nested structures
- ✓ Preserves Date, RegExp, Map, Set
- ✓ Handles circular references
- ✗ Doesn't copy functions
- ✗ Not in older browsers

### JSON Method Limitations
- ✗ Loses functions
- ✗ Loses undefined
- ✗ Dates become strings
- ✗ No circular references
- ✗ No RegExp, Map, Set

## Array Methods

### Mutating (modify original)
- `push()`, `pop()`
- `shift()`, `unshift()`
- `splice()`
- `sort()`, `reverse()`
- `fill()`

### Non-Mutating (return new array)
- `map()`, `filter()`, `reduce()`
- `slice()`, `concat()`
- `flat()`, `flatMap()`

## Freezing Objects

### Object.freeze()
Makes object immutable (shallow).

```javascript
const frozen = Object.freeze({ x: 1, nested: { y: 2 } });

frozen.x = 100;  // ✗ Fails (frozen)
frozen.nested.y = 100;  // ✓ Works (nested not frozen)
```

### Deep Freeze
```javascript
function deepFreeze(obj) {
    Object.freeze(obj);
    Object.values(obj).forEach(value => {
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    });
    return obj;
}
```

### Object.seal()
- Can modify existing properties
- Cannot add/delete properties

## Common Gotchas

### 1. Default Parameter Mutation
```javascript
const defaultOptions = { timeout: 1000 };

function fn(options = defaultOptions) {
    options.modified = true;  // Mutates default!
}
```

**Fix:** Create new default each time

### 2. Array.fill() with Objects
```javascript
const arr = Array(3).fill({ value: 0 });
arr[0].value = 999;  // ALL elements change!
```

**Fix:** Use `map()` to create unique objects

### 3. Sort Mutation
```javascript
const sorted = numbers.sort();  // Mutates original!
```

**Fix:** `[...numbers].sort()`

### 4. Object.assign() is Shallow
```javascript
Object.assign(target, { nested: { x: 1 } });
// Replaces entire 'nested', doesn't merge!
```

## Immutable Update Patterns

### Objects
```javascript
// BAD: obj.x = 10

// GOOD: Create new object
const newObj = { ...obj, x: 10 };
```

### Arrays
```javascript
// Adding
const newArr = [...arr, newItem];

// Removing
const newArr = arr.filter((_, i) => i !== indexToRemove);

// Updating
const newArr = arr.map((item, i) => 
    i === index ? newValue : item
);
```

### Nested
```javascript
const newState = {
    ...state,
    user: {
        ...state.user,
        address: {
            ...state.user.address,
            city: "New City"
        }
    }
};
```

## Best Practices

1. **Defensive Copying**: Copy inputs/outputs to prevent mutations
2. **Immutable Updates**: Use spread, don't mutate
3. **Freeze Constants**: `Object.freeze()` for configs
4. **Avoid Shared State**: Each component owns its data
5. **Document Mutability**: Comment if function mutates parameters

## Interview Quick Reference

**Q: Pass-by-value or pass-by-reference?**
**A:** Always pass-by-value. For objects, the value IS the reference.

**Q: Why `{} === {}` is false?**
**A:** Compares references, not contents. Different objects in memory.

**Q: Why does function mutation affect original object?**
**A:** Parameter gets copy of reference → same object → mutation visible.

**Q: Why doesn't reassignment affect original?**
**A:** Reassigns local variable, doesn't change what original points to.

**Q: What does `const` prevent?**
**A:** Reassignment, NOT mutation.

## Visual Summary

```
ASSIGNMENT:
Primitive:  a = b  →  [a: 5] [b: 5] (independent)
Object:     a = b  →  [a: →]─┬─[b: →]  both point to { }
                              │
PARAMETER PASSING:              │
Primitive:  fn(x)  →  x gets copy of value
Object:     fn(x)  →  x gets copy of reference (shares object)

REASSIGNMENT:
function fn(obj) {
    obj = {};      →  Changes where obj points
}                     Original unchanged

MUTATION:
function  fn(obj) {
    obj.x = 999;   →  Modifies shared object
}                     Original changed!

COPYING:
Shallow: {...obj}  →  Top-level only, nested shared
Deep:    structuredClone(obj)  →  All levels copied
```

## Key Takeaways

1. **Two semantics**: Value (primitives) vs Reference (objects)
2. **Always pass-by-value**: But value = reference for objects
3. **Mutation affects all references** to same object
4. **Reassignment breaks the link**, doesn't affect original
5. **Comparison**: Primitives by value, objects by reference
6. **const**: Prevents reassignment, NOT mutation
7. **Shallow copy**: `{...obj}`, shares nested
8. **Deep copy**: `structuredClone()`, fully independent
9. **Immutable patterns**: Create new, don't mutate
10. **Defensive copying**: Protect from unexpected mutations
