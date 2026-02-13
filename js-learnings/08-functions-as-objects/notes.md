# Chapter 8 Revision Notes: Functions as Objects

## Core Concept

In JavaScript, **functions are first-class objects**—they ARE objects with a special `[[Call]]` internal method that makes them callable.

```
Function = Callable Object + [[Call]] method
```

## First-Class Citizens

Functions can be:
1. **Assigned** to variables
2. **Passed** as arguments
3. **Returned** from functions
4. **Stored** in data structures
5. **Have properties** added to them

## Built-in Function Properties

### 1. `name` (read-only)
- Function's name
- Inferred from variable name if anonymous
- Bound functions: `"bound originalName"`

### 2. `length` (read-only)
- Number of parameters **before** first default value
- Does NOT count rest parameters `(...args)`
```javascript
function fn(a, b = 5, c) {} // length: 1
function fn2(a, ...rest) {} // length: 1
```

### 3. `prototype`
- Only on function declarations/expressions (NOT arrow functions)
- Used when function called with `new`
- Has `constructor` property pointing back to function

### 4. `__proto__` or `[[Prototype]]`
- Points to `Function.prototype`
- Gives access to `call()`, `apply()`, `bind()`, `toString()`

## Function Methods

### 1. `call(thisArg, ...args)`
- Invokes **immediately**
- Sets `this` explicitly
- Arguments passed individually
```javascript
fn.call(context, arg1, arg2)
```

### 2. `apply(thisArg, argsArray)`
- Invokes **immediately**
- Sets `this` explicitly
- Arguments as array
```javascript
fn.apply(context, [arg1, arg2])
```

### 3. `bind(thisArg, ...partialArgs)`
- Returns **new function**
- Permanently binds `this`
- Can partially apply arguments
- Once bound, `this` cannot be changed
```javascript
const bound = fn.bind(context, arg1)
```

## Functions as Constructors

### What `new` does:
1. Creates new empty object
2. Sets `object.__proto__ = Constructor.prototype`
3. Calls constructor with `this` = new object
4. Returns object (unless constructor explicitly returns object)

### Important:
- **Arrow functions** cannot be constructors (no `prototype`, no `[[Construct]]`)
- Explicit object return overrides default behavior
- Primitive return is ignored

### `new.target`
- `undefined` if called as function
- Constructor reference if called with `new`

## Higher-Order Functions

**Definition**: Functions that take or return other functions

### Common Patterns:
- **Map**: Transform elements
- **Filter**: Select elements
- **Reduce**: Accumulate values
- **Compose**: Combine functions
- **Curry**: Transform `f(a,b,c)` → `f(a)(b)(c)`
- **Memoize**: Cache results
- **Throttle/Debounce**: Control execution frequency

## Custom Properties on Functions

Since functions are objects:
```javascript
function fn() {}
fn.customProp = "value";
fn.cache = {};
fn.config = {};
```

**Use cases:**
- Memoization caches
- Configuration objects
- Static methods
- Namespacing

## The `[[Call]]` Internal Slot

What makes an object a function:
```javascript
typeof function(){} // "function"
typeof {}           // "object"
```

When you call `fn()`, JavaScript invokes `[[Call]]`:
1. Creates execution context
2. Binds `this`
3. Executes function body
4. Returns result or `undefined`

## Common Patterns

### 1. IIFE (Module Pattern)
```javascript
const module = (function() {
    let private = "private";
    return {
        public() { return private; }
    };
})();
```

### 2. Factory Function
```javascript
function create(config) {
    return {
        method() { /* uses config */ }
    };
}
```

### 3. Partial Application
```javascript
const multiply = (a, b, c) => a * b * c;
const double = multiply.bind(null, 2);
```

### 4. Function Composition
```javascript
const compose = (f, g) => x => f(g(x));
```

### 5. Memoization
```javascript
function memoize(fn) {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (!cache.has(key)) {
            cache.set(key, fn(...args));
        }
        return cache.get(key);
    };
}
```

## What JavaScript Cannot Do

1. **Call non-functions**: Objects without `[[Call]]` cannot be invoked
2. **Make arrow functions constructors**: No `prototype`, no `[[Construct]]`
3. **Unbind a bound function**: Once bound, `this` is locked
4. **Change function arity**: `length` is read-only
5. **Override `[[Call]]` directly**: Can't make regular object callable (without Proxy)

## Arrow Functions vs Regular Functions

| Feature | Regular | Arrow |
|---------|---------|-------|
| `this` binding | Dynamic | Lexical |
| `arguments` object | Yes | No |
| Can be constructor | Yes | No |
| `prototype` property | Yes | No |
| Can use `super` | In methods | In  methods |
| `new.target` | Yes | No |

## Performance Implications

**Fast:**
- Direct function calls
- Monomorphic functions (same types)
- Function declarations

**Slower:**
- `call()` / `apply()` (slight overhead)
- Excessive `bind()` (creates new functions)
- `new Function()` (dynamic creation)
- `arguments` object access

## Interview Traps

1. **What makes functions "first-class"?**
   - They're objects + callable

2. **Why `arrow.prototype === undefined`?**
   - Arrow functions can't be constructors

3. **Does `bind()` invoke the function?**
   - No, returns new function

4. **Can you bind a bound function?**
   - Yes, but first binding wins

5. **What's the difference between `call` and `apply`?**
   - Only how arguments are passed

## Mental Model Diagram

```
FUNCTION OBJECT:
┌─────────────────────────┐
│ [[Call]] → executable   │
│ name → "funcName"       │
│ length → param count    │
│ prototype → {}          │
│ __proto__ → Function.p  │
│ customProp → ...        │
└─────────────────────────┘
         │
         ├─ Can be called: fn()
         ├─ Can be passed: map(arr, fn)
         ├─ Can be returned: () => fn
         ├─ Can have properties: fn.cache
         └─ Can be constructor: new fn()

CALL METHODS:
call(this, a, b)     → immediate, individual args
apply(this, [a,b])   → immediate, array args
bind(this, a)        → returns new function
```

## Key Takeaways

1. Functions ARE objects (with `[[Call]]`)
2. They have built-in properties: `name`, `length`, `prototype`
3. They inherit from `Function.prototype`
4. Can add custom properties for state/config
5. `call`/`apply` invoke immediately, `bind` returns new function
6. Arrow functions cannot be constructors
7. Higher-order functions are fundamental to JavaScript
8. First-class functions enable powerful patterns
