# Chapter 18: Error Handling Semantics

## try/catch

```javascript
try {
    throw new Error("Oops");
} catch (err) {
    console.log(err.message);  // "Oops"
} finally {
    console.log("Always runs");
}
```

**Rules:**
- `catch` handles errors
- `finally` always executes
- Can have try/catch, try/finally, or all three

## Error Types

**Built-in:**
- `Error` - Generic
- `TypeError` - Wrong type
- `ReferenceError` - Undefined variable
- `SyntaxError` - Parse error
- `RangeError` - Invalid range

```javascript
throw new TypeError("Expected string");
```

## Async Error Handling

**Promises:**
```javascript
fetch('/api')
    .catch(err => console.error(err));
```

**async/await:**
```javascript
async function getData() {
    try {
        const res = await fetch('/api');
    } catch (err) {
        console.error(err);
    }
}
```

## Error Propagation

Errors bubble up until caught.

```javascript
function a() { throw new Error("fail"); }
function b() { a(); }
function c() {
    try {
        b();
    } catch (e) {
        console.log("Caught in c");
    }
}
c();  // "Caught in c"
```

## Custom Errors

```javascript
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}

throw new ValidationError("Invalid input");
```

## Key Concepts

1. **try/catch:** Synchronous error handling
2. **finally:** Always executes
3. **Promises:** Use `.catch()`
4. **async/await:** Use try/catch
5. **Errors bubble up** until caught

## Next: Memory Management
