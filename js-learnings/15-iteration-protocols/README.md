# Chapter 15: Iteration Protocols (Symbol.iterator, Generators)

---

## Mental Model

**Stop thinking:** "Loops just work"  
**Start thinking:** "Objects can define their own iteration behavior"

**Key Insight:** JavaScript has a **protocol** (interface) that objects can implement to become iterable.

---

## The Iteration Protocol

**Two protocols:**

1. **Iterable Protocol:** Object has `[Symbol.iterator]()` method
2. **Iterator Protocol:** Object has `next()` method returning `{value, done}`

```javascript
const iterable = {
    [Symbol.iterator]() {
        let i = 0;
        return {
            next() {
                if (i < 3) {
                    return { value: i++, done: false };
                }
                return { done: true };
            }
        };
    }
};

for (const val of iterable) {
    console.log(val);  // 0, 1, 2
}
```

---

## Built-in Iterables

**Already iterable:**
- Arrays
- Strings
- Maps
- Sets
- TypedArrays
- Arguments object
- NodeList

```javascript
// Array
for (const item of [1, 2, 3]) {
    console.log(item);
}

// String
for (const char of "abc") {
    console.log(char);  // 'a', 'b', 'c'
}

// Map
const map = new Map([['a', 1], ['b', 2]]);
for (const [key, value] of map) {
    console.log(key, value);
}
```

---

## Generator Functions

**Simplified way to create iterators.**

```javascript
function* numberGen() {
    yield 1;
    yield 2;
    yield 3;
}

const gen = numberGen();
console.log(gen.next());  // { value: 1, done: false }
console.log(gen.next());  // { value: 2, done: false }
console.log(gen.next());  // { value: 3, done: false }
console.log(gen.next());  // { done: true }
```

**With for...of:**

```javascript
for (const num of numberGen()) {
    console.log(num);  // 1, 2, 3
}
```

---

## Generator Syntax

```javascript
// Function declaration
function* gen() { yield 1; }

// Function expression
const gen = function*() { yield 1; };

// Method in object
const obj = {
    *gen() { yield 1; }
};

// Method in class
class MyClass {
    *gen() { yield 1; }
}
```

---

## yield Keyword

**Pauses execution and returns value.**

```javascript
function* example() {
    console.log("Start");
    yield 1;
    console.log("After first yield");
    yield 2;
    console.log("Done");
}

const gen = example();
gen.next();  // Logs "Start", returns { value: 1, done: false }
gen.next();  // Logs "After first yield", returns { value: 2, done: false }
gen.next();  // Logs "Done", returns { done: true }
```

---

## yield* (Delegation)

**Delegate to another iterable.**

```javascript
function* inner() {
    yield 2;
    yield 3;
}

function* outer() {
    yield 1;
    yield* inner();
    yield 4;
}

console.log([...outer()]);  // [1, 2, 3, 4]
```

---

## Infinite Sequences

```javascript
function* fibonacci() {
    let [a, b] = [0, 1];
    while (true) {
        yield a;
        [a, b] = [b, a + b];
    }
}

const fib = fibonacci();
console.log(fib.next().value);  // 0
console.log(fib.next().value);  // 1
console.log(fib.next().value);  // 1
console.log(fib.next().value);  // 2
console.log(fib.next().value);  // 3
```

---

## Generator.return() and .throw()

```javascript
function* gen() {
    try {
        yield 1;
        yield 2;
    } finally {
        console.log("Cleanup");
    }
}

const g = gen();
g.next();           // { value: 1, done: false }
g.return(99);       // Logs "Cleanup", returns { value: 99, done: true }

// throw()
function* errorGen() {
    try {
        yield 1;
    } catch (e) {
        console.log("Caught:", e);
    }
}

const g2 = errorGen();
g2.next();
g2.throw(new Error("test"));  // Logs "Caught: Error: test"
```

---

## Practical Use Cases

### 1. Lazy Evaluation

```javascript
function* range(start, end) {
    for (let i = start; i < end; i++) {
        yield i;
    }
}

// Only computes values as needed
for (const num of range(0, 1000000)) {
    if (num > 5) break;
    console.log(num);  // 0, 1, 2, 3, 4, 5
}
```

### 2. Custom Iterables

```javascript
class Tree {
    constructor(value, left, right) {
        this.value = value;
        this.left = left;
        this.right = right;
    }
    
    *[Symbol.iterator]() {
        if (this.left) yield* this.left;
        yield this.value;
        if (this.right) yield* this.right;
    }
}

const tree = new Tree(2,
    new Tree(1),
    new Tree(3)
);

console.log([...tree]);  // [1, 2, 3] (in-order)
```

### 3. Async Operations (with async generators)

```javascript
async function* asyncGenerator() {
    yield await Promise.resolve(1);
    yield await Promise.resolve(2);
}

(async () => {
    for await (const val of asyncGenerator()) {
        console.log(val);  // 1, 2
    }
})();
```

---

## Spread and Destructuring

```javascript
function* gen() {
    yield 1;
    yield 2;
    yield 3;
}

// Spread
const arr = [...gen()];  // [1, 2, 3]

// Destructuring
const [a, b, c] = gen();  // a=1, b=2, c=3
```

---

## Key Takeaways

1. **Iterable protocol:** `[Symbol.iterator]()` returns iterator
2. **Iterator protocol:** `next()` returns `{value, done}`
3. **Generators:** Functions with `*` that use `yield`
4. **Lazy evaluation:** Values computed on demand
5. **yield*:** Delegates to another iterable
6. **Infinite sequences:** Possible with generators
7. **for...of** works with any iterable

---

## Next Chapter Preview

**Asynchronous JavaScript Foundations:** Event loop, callbacks, promises, and async/await mechanics.
