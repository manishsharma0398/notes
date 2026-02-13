# Chapter 8 Interview Questions: Functions as Objects

## Question 1: Explain First-Class Functions

**Q:** What does it mean that functions are "first-class citizens" in JavaScript? How does this differ from other languages?

**A:**

Functions are first-class citizens because they're **objects with the special `[[Call]]` internal method**. This means:

1. **Assignable**: Can store in variables/properties
2. **Passable**: Can pass as arguments to other functions
3. **Returnable**: Can return from functions
4. **Storable**: Can put in arrays, objects, Maps, Sets
5. **Extensible**: Can add properties and methods to them

**The key distinction**: Functions ARE objects, not a separate entity. They just have the additional `[[Call]]` internal slot that makes them invocable.

**Mechanism:**
```javascript
function fn() {}
console.log(typeof fn);  // "function"
console.log(fn instanceof Object); // true
fn.customProperty = 42;  // Valid! It's an object
```

When you write `fn()`, JavaScript invokes the `[[Call]]` internal method, which:
1. Creates a new execution context
2. Binds `this`
3. Executes the function body
4. Returns the result

**Contrast with other languages:**
- In C, functions are just memory addresses (pointers)
- In Java (pre-lambdas), you needed interfaces/classes to pass behavior
- JavaScript treats functions as data that can also execute

---

## Question 2: Function.length Edge Cases

**Q:** Explain the exact rules for how JavaScript determines a function's `length` property. Why is `length` designed this way?

**A:**

**Rules for `function.length`:**
1. Counts parameters **before the first parameter with a default value**
2. Does NOT count rest parameters (`...args`)
3. Does NOT count parameters after the first default
4. Is read-only (cannot be changed)

**Examples:**
```javascript
function fn1(a, b, c) {}
console.log(fn1.length); // 3

function fn2(a, b = 5, c) {}
console.log(fn2.length); // 1 (stops at first default)

function fn3(a, ...rest) {}
console.log(fn3.length); // 1 (rest not counted)

function fn4(a = 1, b, c) {}
console.log(fn4.length); // 0 (first param has default)
```

**Why this design?**

The `length` property represents the **expected arity** (number of required arguments). Parameters with defaults are optional, so they don't count toward expected arity.

**Practical use:**
```javascript
function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) {
            // We have enough arguments
            return fn.apply(this, args);
        } else {
            // Need more arguments
            return (...args2) => curried(...args.concat(args2));
        }
    };
}
```

The `fn.length` check tells us when we've received enough arguments to invoke the original function.

---

## Question 3: call vs apply vs bind

**Q:** Walk through the exact differences between `call`, `apply`, and `bind`. When is each one appropriate?

**A:**

### call(thisArg, arg1, arg2, ...)
- **Invokes immediately**
- Arguments passed **individually**
- Returns function's result

```javascript
function greet(greeting, punctuation) {
    return `${greeting}, ${this.name}${punctuation}`;
}

const person = { name: 'Alice' };
const result = greet.call(person, 'Hello', '!');
// "Hello, Alice!"
```

### apply(thisArg, [arg1, arg2, ...])
- **Invokes immediately**
- Arguments passed as **array**
- Returns function's result

```javascript
const args = ['Hello', '!'];
const result = greet.apply(person, args);
// "Hello, Alice!"
```

### bind(thisArg, arg1, arg2, ...)
- **Does NOT invoke**
- Returns **new function** with `this` permanently bound
- Can partially apply arguments
- Once bound, cannot be re-bound

```javascript
const boundGreet = greet.bind(person, 'Hello');
const result = boundGreet('!');  // "Hello, Alice!"

// bind returns new function
console.log(boundGreet === greet); // false

// Cannot re-bind
const obj2 = { name: 'Bob' };
const rebound = boundGreet.bind(obj2);
rebound('?'); // Still "Hello, Alice!" (not Bob)
```

### When to use each:

**`call`**: When you know arguments upfront and want immediate execution
```javascript
Array.prototype.slice.call(arrayLike, 0);
```

**`apply`**: When you have arguments in an array
```javascript
Math.max.apply(null, [1, 2, 3, 4, 5]);
// Modern: Math.max(...array)
```

**`bind`**: When you need to preserve `this` for later execution
```javascript
// Event handlers
button.addEventListener('click', this.handleClick.bind(this));

// Partial application
const double = multiply.bind(null, 2);
```

**Performance**: Direct calls > `call` ≈ `apply` > `bind` (creates new function)

---

## Question 4: Arrow Functions as Constructors

**Q:** Why can't arrow functions be used as constructors? What exactly is missing?

**A:**

Arrow functions **cannot** be constructors because they lack three things:

### 1. No `prototype` property
```javascript
const Arrow = () => {};
console.log(Arrow.prototype); // undefined

function Regular() {}
console.log(Regular.prototype); // {} (object)
```

### 2. No `[[Construct]]` internal method
When you use `new`, JavaScript invokes `[[Construct]]`:
- Creates new object
- Sets `__proto__`
- Calls function with `this` = new object

Arrow functions don't have `[[Construct]]`, so `new` throws:
```javascript
new Arrow(); // TypeError: Arrow is not a constructor
```

### 3. No dynamic `this` binding
Arrow functions have **lexical `this`**—they capture `this` from their enclosing scope:
```javascript
const obj = {
    value: 42,
    arrow: () => {
        console.log(this.value); // 'this' is NOT obj!
    },
    regular: function() {
        console.log(this.value); // 'this' is obj
    }
};
```

**Why this design?**

Arrow functions were designed for **short, non-method functions** where lexical `this` is desirable:
```javascript
class Component {
    constructor() {
        this.data = [];
    }
    
    process() {
        // Arrow function captures 'this' from process()
        this.data.forEach(item => {
            this.render(item); // 'this' is the Component
        });
    }
}
```

If arrow functions could be constructors, their lexical `this` would conflict with constructor semantics.

---

## Question 5: Function Properties and Mutation

**Q:** Explain this behavior:

```javascript
function fn() {}
fn.cache = {};

const ref = fn;
ref.cache.foo = 'bar';

console.log(fn.cache.foo); // What does this print and why?
```

**A:**

This prints `"bar"` because **functions are objects passed by reference**.

**What happens:**
1. `fn` is a function object with `[[Call]]` method and other properties
2. `fn.cache = {}` adds a property to the function object
3. `const ref = fn` copies the **reference** (memory address), not the function
4. `ref` and `fn` point to the **same function object** in memory
5. Mutating `ref.cache` mutates the same object that `fn.cache` points to

**Memory diagram:**
```
Memory Address: 0xFF00
┌─────────────────┐
│ Function Object │
├─────────────────┤
│ [[Call]]: ...   │
│ name: "fn"      │
│ cache: {...}    │ ← Both fn and ref point here
└─────────────────┘
     ↑       ↑
     fn      ref
```

**Key principle**: Variables don't store the function itself—they store a **reference** to it.

**Implications:**
```javascript
const copy = fn;
console.log(copy === fn); // true (same object)
console.log(fn.bind() === fn); // false (bind creates NEW function)

// Each new function is a separate object
function create() {
    return function() {};
}
console.log(create() === create()); // false
```

---

## Question 6: The Currying Mechanism

**Q:** Implement a `curry` function that transforms `f(a, b, c)` into `f(a)(b)(c)` and explain how it works.

**A:**

```javascript
function curry(fn) {
    return function curried(...args) {
        // If we have enough arguments, call the original function
        if (args.length >= fn.length) {
            return fn.apply(this, args);
        } else {
            // Otherwise, return a function that collects more arguments
            return function(...args2) {
                return curried.apply(this, args.concat(args2));
            };
        }
    };
}

// Usage:
function add(a, b, c) {
    return a + b + c;
}

const curriedAdd = curry(add);
console.log(curriedAdd(1)(2)(3));     // 6
console.log(curriedAdd(1, 2)(3));     // 6
console.log(curriedAdd(1)(2, 3));     // 6
console.log(curriedAdd(1, 2, 3));     // 6
```

**How it works:**

1. **Closure**: `curried` closes over `fn` and accumulated `args`
2. **Arity check**: Uses `fn.length` to know when we have enough arguments
3. **Recursion**: Each call returns `curried` again until enough args
4. **Concatenation**: Each call accumulates arguments via `args.concat(args2)`

**Step-by-step for `curriedAdd(1)(2)(3)`:**

```javascript
// Call 1: curriedAdd(1)
args = [1]
args.length (1) < fn.length (3) → return curried

// Call 2: curried(2)
args = [1, 2]  // concatenated
args.length (2) < fn.length (3) → return curried

// Call 3: curried(3)
args = [1, 2, 3]
args.length (3) >= fn.length (3) → fn.apply(this, [1, 2, 3])
// Returns: 6
```

**Why this is useful:**

Partial application and function composition:
```javascript
const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

const add10 = curriedAdd(10);
const add10And20 = add10(20);

console.log(add10And20(5)); // 35
```

---

## Question 7: Higher-Order Function Patterns

**Q:** Implement a `compose` function that takes multiple functions and returns their composition. Explain the execution order.

**A:**

```javascript
function compose(...fns) {
    return function(value) {
        return fns.reduceRight((acc, fn) => fn(acc), value);
    };
}

// Usage:
const addOne = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const composed = compose(square, double, addOne);
console.log(composed(3));
// Execution: addOne(3) → double(4) → square(8) → 64
```

**Execution order:**

`compose` executes **right to left** (like mathematical function composition):

```
composed(3)
= square(double(addOne(3)))
= square(double(4))
= square(8)
= 64
```

**Why `reduceRight`?**

```javascript
fns.reduceRight((acc, fn) => fn(acc), value)
//              ↑          ↑   ↑      ↑
//              accumulator  current  initial
```

**Step by step:**
1. Initial: `acc = 3`
2. Process `addOne`: `acc = addOne(3) = 4`
3. Process `double`: `acc = double(4) = 8`
4. Process `square`: `acc = square(8) = 64`

**Alternative: `pipe` (left to right)**

```javascript
function pipe(...fns) {
    return function(value) {
        return fns.reduce((acc, fn) => fn(acc), value);
    };
}

const piped = pipe(addOne, double, square);
console.log(piped(3));
// Execution: addOne(3) → double(4) → square(8) → 64
```

**Real-world use:**

```javascript
const processData = compose(
    formatOutput,    // 4. Format
    filterInvalid,   // 3. Filter
    transform,       // 2. Transform
    validate         // 1. Validate (runs first)
);

const result = processData(rawData);
```

---

## Question 8: Memoization Trade-offs

**Q:** You're implementing memoization for a recursive function. What are the trade-offs and when should you NOT use memoization?

**A:**

**Basic memoization:**
```javascript
function memoize(fn) {
    const cache = new Map();
    
    return function(...args) {
        const key = JSON.stringify(args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
```

### Benefits:
1. **Avoids redundant computation** (huge win for recursion)
2. **Time-memory tradeoff** (faster execution, more memory)
3. **Consistent results** for pure functions

### Trade-offs:

**1. Memory consumption**
```javascript
const memoFib = memoize(fibonacci);
memoFib(1000);  // Cache grows to 1000 entries

// Solution: LRU cache with size limit
function memoizeLRU(fn, maxSize = 100) {
    const cache = new Map();
    
    return function(...args) {
        const key = JSON.stringify(args);
        
        if (cache.has(key)) {
            // Move to end (most recently used)
            const value = cache.get(key);
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        
        const result = fn.apply(this, args);
        
        if (cache.size >= maxSize) {
            // Delete least recently used (first entry)
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
        
        cache.set(key, result);
        return result;
    };
}
```

**2. Key serialization overhead**
```javascript
JSON.stringify(args)  // Expensive for large/complex objects

// Solution: Custom key function
function memoizeWith(fn, keyFn) {
    const cache = new Map();
    
    return function(...args) {
        const key = keyFn(...args);
        // ...
    };
}

const memoized = memoizeWith(expensiveFn, (id) => id);
```

**3. Only works for pure functions**
```javascript
// BAD: Impure function (depends on external state)
let multiplier = 2;
function impure(x) {
    return x * multiplier;
}

const memoized = memoize(impure);
console.log(memoized(5));  // 10

multiplier = 3;
console.log(memoized(5));  // Still 10! (cached)
```

### When NOT to use memoization:

1. **Impure functions** (side effects, external dependencies)
2. **Rarely repeated inputs** (cache never hits)
3. **Large result sets** (memory cost > computation cost)
4. **Functions with object arguments** (serialization overhead)
5. **Time-sensitive computations** (cached value may be stale)

### Better approach for recursion:

Instead of memoizing the wrapper, memoize internally:
```javascript
function fibonacci(n, cache = {}) {
    if (n in cache) return cache[n];
    if (n <= 1) return n;
    
    cache[n] = fibonacci(n - 1, cache) + fibonacci(n - 2, cache);
    return cache[n];
}
```

---

## Question 9: IIFE and Module Pattern

**Q:** Explain the IIFE (Module) pattern and why it was necessary before ES6 modules. What problem does it solve?

**A:**

**IIFE (Immediately Invoked Function Expression):**
```javascript
const module = (function() {
    // Private state
    let privateVar = 'secret';
    let counter = 0;
    
    // Private function
    function privateHelper() {
        return privateVar.toUpperCase();
    }
    
    // Public API
    return {
        increment() {
            counter++;
            return counter;
        },
        getSecret() {
            return privateHelper();
        }
    };
})();

module.increment();  // 1
module.getSecret();  // "SECRET"
module.privateVar;   // undefined (truly private!)
```

### Problems it solves:

**1. No variable leakage (pre-ES6)**
```javascript
// Before IIFE (global pollution)
var helper = function() { /* ... */ };
var data = [];
var count = 0;

// With IIFE (encapsulated)
var module = (function() {
    var helper = function() { /* ... */ };  // Private
    var data = [];  // Private
    var count = 0;  // Private
    
    return { /* public API */ };
})();
```

**2. True privacy**
```javascript
const counter = (function() {
    let count = 0;  // Truly private—no way to access
    
    return {
        increment: () => ++count,
        decrement: () => --count,
        get: () => count
    };
})();

delete counter.increment;  // Can delete method
// But can't access or modify 'count' directly
```

**3. Dependency injection**
```javascript
const app = (function($, _) {
    // Can use jQuery and lodash
    // without polluting global scope
    
    return {
        init() {
            $('.element').click(/* ... */);
            _.debounce(/* ... */);
        }
    };
})(jQuery, lodash);
```

### Why less needed with ES6:

**Block scope with `let`/`const`:**
```javascript
{
    let private = 'value';
    // ...
}
// private is not accessible here
```

**ES6 modules:**
```javascript
// module.js
let privateVar = 'secret';

export function publicFn() {
    return privateVar;
}

// main.js
import { publicFn } from './module.js';
```

### Still useful for:

1. **One-time initialization**
```javascript
const config = (function() {
    const env = detectEnvironment();
    const settings = loadSettings(env);
    return settings;
})();
```

2. **Singleton pattern**
```javascript
const Database = (function() {
    let instance;
    
    function createConnection() {
        // ...
    }
    
    return {
        getInstance() {
            if (!instance) {
                instance = createConnection();
            }
            return instance;
        }
    };
})();
```

---

## Question 10: Function Execution Context

**Q:** When a function is called, what exactly happens under the hood? Walk through the execution context creation.

**A:**

When you call a function, JavaScript creates an **Execution Context** with specific phases:

### Phase 1: Creation

**1. Create Variable Environment:**
- Scan for `var` declarations (hoisted, initialized to `undefined`)
- Scan for function declarations (hoisted, fully initialized)
- Create `arguments` object (for non-arrow functions)

**2. Create Lexical Environment:**
- Scan for `let` and `const` (hoisted, but in "temporal dead zone")
- Set outer environment reference (lexical scope chain)

**3. Determine `this` binding:**
- Regular function: dynamic (depends on how called)
- Arrow function: lexical (captured from enclosing scope)
- Method: the object before the dot
- Constructor: the new object
- `call`/`apply`/`bind`: explicit value

### Phase 2: Execution

Execute the function body line by line, resolving variables through scope chain.

### Example Walkthrough:

```javascript
function outer(x) {
    var a = 10;
    let b = 20;
    
    function inner(y) {
        var c = 30;
        console.log(a + b + c + x + y);
    }
    
    inner(5);
}

outer(100);
```

**Step 1: Call `outer(100)`**
```
Execution Context: outer
├─ Variable Environment:
│  ├─ a: undefined (hoisted)
│  └─ inner: <function> (hoisted)
├─ Lexical Environment:
│  ├─ x: 100 (parameter)
│  ├─ b: <uninitialized> (TDZ)
│  └─ Outer Reference: Global
└─ this: (global or undefined in strict)
```

**Step 2: Execute `outer` body**
- `var a = 10` → a: 10
- `let b = 20` → b: 20 (exits TDZ)
- Function declaration already hoisted

**Step 3: Call `inner(5)`**
```
Execution Context: inner
├─ Variable Environment:
│  ├─ c: undefined
│  └─ arguments: [5]
├─ Lexical Environment:
│  ├─ y: 5
│  └─ Outer Reference: outer's environment
└─ this: (same as outer)
```

**Step 4: Execute `inner` body**
- `var c = 30` → c: 30
- `console.log(a + b + c + x + y)`

**Scope chain lookup:**
1. Find `c`: inner environment → 30 ✓
2. Find `y`: inner environment → 5 ✓
3. Find `a`: not in inner, check outer → 10 ✓
4. Find `b`: not in inner, check outer → 20 ✓
5. Find `x`: not in inner, check outer → 100 ✓

Result: `10 + 20 + 30 + 100 + 5 = 165`

**Key insights:**

1. **Each function call creates a NEW execution context**
2. **Outer reference is determined lexically** (where function was defined, not called)
3. **Variables are resolved through scope chain**
4. **Context is destroyed after function returns** (unless closure retains reference)

**With arrow function:**
```javascript
const obj = {
    name: 'Object',
    method() {
        const arrow = () => {
            console.log(this.name);  // 'this' from method()
        };
        arrow();
    }
};
```

Arrow function's context creation **skips `this` binding**—it uses lexical `this` from `method()`.

---

These questions cover the deep mechanics of functions as objects in JavaScript, suitable for senior-level technical interviews.
