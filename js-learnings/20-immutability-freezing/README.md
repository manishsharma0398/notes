# Chapter 20: Immutability, Freezing, and Copying

## Mutability

Objects and arrays are mutable by default.

```javascript
const obj = { x: 1 };
obj.x = 2;  // Allowed! const prevents reassignment, not mutation
```

## Object.freeze()

Makes object immutable (shallow).

```javascript
const obj = Object.freeze({ x: 1 });
obj.x = 2;  // Silently fails (throws in strict mode)
obj.y = 3;  // Can't add properties
delete obj.x;  // Can't delete
```

**Shallow:** Nested objects not frozen.

```javascript
const obj = Object.freeze({ nested: { x: 1 } });
obj.nested.x = 2;  // Works! Nested not frozen
```

## Object.seal()

Prevents add/delete, allows modification.

```javascript
const obj = Object.seal({ x: 1 });
obj.x = 2;  // OK
obj.y = 3;  // Fails
```

## Object.preventExtensions()

Prevents adding properties.

```javascript
const obj = Object.preventExtensions({ x: 1 });
obj.x = 2;  // OK
obj.y = 3;  // Fails
```

## Copying

### Shallow Copy

```javascript
const obj = { x: 1, nested: { y: 2 } };
const copy = { ...obj };  // Or Object.assign({}, obj)

copy.x = 10;  // No effect on obj
copy.nested.y = 20;  // CHANGES obj.nested.y!
```

### Deep Copy

```javascript
// Simple but limited
const deep = JSON.parse(JSON.stringify(obj));

// Better: structuredClone (modern)
const deep = structuredClone(obj);
```

**JSON limitations:**
- Loses functions
- Loses undefined
- Loses Symbols
- Cycles fail

## Immutable Patterns

```javascript
// Add property
const updated = { ...obj, newProp: "value" };

// Update nested
const updated = {
    ...obj,
    nested: {
        ...obj.nested,
        y: 20
    }
};

// Array append
const newArr = [...arr, newItem];

// Array filter
const filtered = arr.filter(x => x > 5);
```

## Key Concepts

1. **const:** Prevents reassignment, not mutation
2. **freeze:** Shallow immutability
3. **Shallow copy:** Nested objects still shared
4. **Deep copy:** structuredClone or libraries
5. **Immutable patterns:** Spread, map, filter

## Next: Numeric Edge Cases
