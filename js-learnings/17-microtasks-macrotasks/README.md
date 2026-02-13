# Chapter 17: Microtasks vs Macrotasks

## Key Difference

**Macrotasks:** setTimeout, setInterval, I/O  
**Microtasks:** Promises, queueMicrotask, MutationObserver

## Execution Order

1. Execute current task
2. Process **all** microtasks
3. Render (if needed)
4. Execute next macrotask

```javascript
console.log("1");                    // Sync

setTimeout(() => console.log("2"), 0);  // Macrotask

Promise.resolve().then(() => console.log("3"));  // Microtask

console.log("4");                    // Sync

// Output: 1, 4, 3, 2
```

## Why It Matters

**Microtasks run before next macrotask.**

```javascript
setTimeout(() => console.log("timeout"), 0);

Promise.resolve()
    .then(() => console.log("promise 1"))
    .then(() => console.log("promise 2"));

// Output: promise 1, promise 2, timeout
```

## Common Gotcha

```javascript
for (let i = 0; i < 3; i++) {
    Promise.resolve().then(() => console.log(i));
}
// All microtasks run after loop: 3, 3, 3
```

## Key Takeaways

- Microtasks have **higher priority**
- ALL microtasks drain before next macrotask
- Promises are microtasks
- setTimeout/setInterval are macrotasks

## Next: Error Handling
