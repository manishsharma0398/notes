# Chapter 16: Asynchronous JavaScript Foundations

## Mental Model

**Synchronous:** One thing at a time, blocking  
**Asynchronous:** Non-blocking, continues execution

## Event Loop

JavaScript is single-threaded but can handle async operations via the **event loop**.

**Components:**
1. **Call Stack:** Function execution
2. **Web APIs:** setTimeout, fetch, DOM events
3. **Callback Queue:** Completed async operations
4. **Event Loop:** Moves callbacks to stack when empty

## Callbacks

```javascript
setTimeout(() => {
    console.log("After 1 second");
}, 1000);
```

**Callback Hell:**
```javascript
getData(function(a) {
    getMoreData(a, function(b) {
        getEvenMore(b, function(c) {
            // Deeply nested
        });
    });
});
```

## Promises

Better async handling.

```javascript
const promise = new Promise((resolve, reject) => {
    setTimeout(() => resolve("Done"), 1000);
});

promise.then(result => console.log(result));
```

**States:** Pending → Fulfilled / Rejected

**Chaining:**
```javascript
fetch('/api')
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err));
```

## async/await

Syntactic sugar over promises.

```javascript
async function getData() {
    try {
        const res = await fetch('/api');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error(err);
    }
}
```

**Rules:**
- `async` function always returns promise
- `await` pauses execution until promise resolves
- Only works inside `async` functions

## Key Concepts

1. **Non-blocking:** Async doesn't stop execution
2. **Event loop:** Manages async operations
3. **Promises:** Handle async results
4. **async/await:** Cleaner promise syntax

## Next: Microtasks vs Macrotasks
