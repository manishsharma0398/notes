# Chapter 19: Memory Management and Garbage Collection

## Memory Lifecycle

1. **Allocate:** Create variables/objects
2. **Use:** Read/write
3. **Release:** Garbage collect when unreachable

## Garbage Collection

JavaScript uses **mark-and-sweep** algorithm.

**Process:**
1. Mark roots (global, stack)
2. Mark reachable objects
3. Sweep unmarked (unreachable)

## Reachability

Object is kept if reachable from root.

```javascript
let obj = { data: "keep me" };  // Reachable
obj = null;  // Now unreachable, can be GC'd
```

## Memory Leaks

**Common causes:**

### 1. Global Variables
```javascript
function leak() {
    leaked = "global";  // Forgot 'let'
}
```

### 2. Forgotten Timers
```javascript
setInterval(() => {
    // Never cleared
}, 1000);
```

### 3. Closures
```javascript
function outer() {
    const big = new Array(1000000);
    return function() {
        console.log(big[0]);  // Keeps big alive
    };
}
```

### 4. Event Listeners
```javascript
element.addEventListener('click', handler);
// Forgot to removeEventListener
```

## WeakMap and WeakSet

Don't prevent garbage collection.

```javascript
const map = new WeakMap();
let obj = {};
map.set(obj, "value");
obj = null;  // obj can be GC'd even though in WeakMap
```

## Best Practices

1. **Avoid globals:** Use local scope
2. **Clear timers:** clearTimeout/clearInterval
3. **Remove listeners:** removeEventListener
4. **Use WeakMap/WeakSet** for caches
5. **Break circular references**

## Key Concepts

- **GC is automatic** but understanding helps
- **Reachability** determines if kept
- **Leaks** happen from forgotten references
- **WeakMap/WeakSet** for memory-friendly caches

## Next: Immutability and Freezing
