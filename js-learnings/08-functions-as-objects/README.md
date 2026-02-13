# Chapter 8: Functions as Objects

## Mental Model

In JavaScript, **functions are first-class objects**. This isn't just a saying—it's a fundamental language design:

```
FUNCTION = CALLABLE OBJECT

┌─────────────────────────┐
│   Function Object       │
├─────────────────────────┤
│ [[Call]] internal slot  │ ← Makes it callable
│ prototype property      │ ← For constructor use
│ name                    │ ← Function name
│ length                  │ ← Parameter count
│ Custom properties...    │ ← Can add more!
└─────────────────────────┘
```

**Key insight**: Every function is an object, but not every object is a function. What makes a function special is the `[[Call]]` internal method.

## What Developers Think vs What Actually Happens

### Common Misconception

"Functions and objects are different things in JavaScript"

### Reality

**Functions ARE objects.** They can:
- Have properties assigned to them
- Be passed as arguments
- Be returned from other functions
- Be stored in variables and data structures
- Have methods called on them

The only difference: functions have an internal `[[Call]]` slot that makes them invocable with `()`.

## The Actual Mechanism

### Functions as First-Class Citizens

"First-class" means functions can be:

1. **Assigned to variables**
```javascript
const greet = function() { return "Hello"; };
```

2. **Passed as arguments**
```javascript
function executeCallback(callback) {
  return callback();
}
```

3. **Returned from functions**
```javascript
function createMultiplier(x) {
  return function(y) { return x * y; };
}
```

4. **Stored in data structures**
```javascript
const operations = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
};
```

### The [[Call]] Internal Slot

What makes an object a function:

```javascript
typeof function(){} // "function"
typeof {}           // "object"

// Both are objects, but only functions have [[Call]]
```

**Under the hood:**
- When you write `myFunc()`, JavaScript invokes the `[[Call]]` internal method
- The `[[Call]]` method:
  1. Creates a new execution context
  2. Binds `this`
  3. Executes the function body
  4. Returns the result (or `undefined`)

## Built-in Function Properties

Every function has these properties:

### 1. `name`

The function's name (if it has one).

```javascript
function foo() {}
console.log(foo.name); // "foo"

const bar = function() {};
console.log(bar.name); // "bar" (inferred from variable)

const obj = {
  method() {}
};
console.log(obj.method.name); // "method"

const anonymous = function() {};
console.log(anonymous.name); // "anonymous" (inferred)
```

### 2. `length`

The number of **declared parameters** (not including rest parameters or defaults).

```javascript
function fn(a, b, c) {}
console.log(fn.length); // 3

function fnWithDefault(a, b = 5) {}
console.log(fnWithDefault.length); // 1 (only a)

function fnWithRest(a, ...rest) {}
console.log(fnWithRest.length); // 1 (rest not counted)
```

### 3. `prototype`

Only **function declarations and function expressions** have a `prototype` property (not arrow functions).

```javascript
function Constructor() {}
console.log(Constructor.prototype); // {}

const arrow = () => {};
console.log(arrow.prototype); // undefined
```

**Why it exists**: For constructor functions to set up inheritance.

### 4. `__proto__` (or `[[Prototype]]`)

Points to `Function.prototype`, giving functions access to:
- `call()`
- `apply()`
- `bind()`
- `toString()`

```javascript
function myFunc() {}
console.log(myFunc.__proto__ === Function.prototype); // true
```

## Function Methods

### 1. `call(thisArg, ...args)`

Invokes the function with a specific `this` value.

```javascript
function greet(greeting) {
  return `${greeting}, ${this.name}!`;
}

const person = { name: "Alice" };
console.log(greet.call(person, "Hello")); // "Hello, Alice!"
```

**What happens:**
1. Sets `this` to `person`
2. Passes `"Hello"` as first argument
3. Executes the function
4. Returns the result

### 2. `apply(thisArg, argsArray)`

Like `call`, but takes arguments as an array.

```javascript
function sum(a, b, c) {
  return a + b + c;
}

console.log(sum.apply(null, [1, 2, 3])); // 6
```

**Use case**: When you have arguments in an array.

```javascript
const numbers = [5, 1, 8, 3, 2];
console.log(Math.max.apply(null, numbers)); // 8

// Modern alternative: spread operator
console.log(Math.max(...numbers)); // 8
```

### 3. `bind(thisArg, ...partialArgs)`

Returns a **new function** with `this` bound permanently.

```javascript
const person = {
  name: "Bob",
  greet() {
    return `Hello, ${this.name}`;
  }
};

const greetBob = person.greet.bind(person);
console.log(greetBob()); // "Hello, Bob"

// Even if we extract it:
const extracted = person.greet;
console.log(extracted()); // "Hello, undefined" (loses this)

const bound = person.greet.bind(person);
console.log(bound()); // "Hello, Bob" (this is locked)
```

**Partial application:**
```javascript
function multiply(a, b) {
  return a * b;
}

const double = multiply.bind(null, 2);
console.log(double(5)); // 10 (2 * 5)
console.log(double(10)); // 20 (2 * 10)
```

### 4. `toString()`

Returns the function's source code as a string.

```javascript
function add(a, b) {
  return a + b;
}

console.log(add.toString());
// "function add(a, b) {
//   return a + b;
// }"
```

**Quirk**: Native functions return `"function functionName() { [native code] }"`

## Custom Properties on Functions

Since functions are objects, you can add custom properties:

```javascript
function counter() {
  counter.count = (counter.count || 0) + 1;
  return counter.count;
}

counter.count = 0; // Initialize

console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
console.log(counter.count); // 3 (accessing the property)
```

**Use case: Memoization**
```javascript
function fibonacci(n) {
  if (!fibonacci.cache) {
    fibonacci.cache = {};
  }
  
  if (fibonacci.cache[n]) {
    return fibonacci.cache[n];
  }
  
  if (n <= 1) return n;
  
  const result = fibonacci(n - 1) + fibonacci(n - 2);
  fibonacci.cache[n] = result;
  return result;
}

console.log(fibonacci(10)); // 55
console.log(fibonacci.cache); // {2: 1, 3: 2, 4: 3, ...}
```

## Functions as Constructors

When called with `new`, functions become constructors:

```javascript
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return `Hello, I'm ${this.name}`;
};

const alice = new Person("Alice");
console.log(alice.greet()); // "Hello, I'm Alice"
```

**What `new` does:**
1. Creates a new empty object
2. Sets the object's `[[Prototype]]` to `Constructor.prototype`
3. Calls the constructor with `this` bound to the new object
4. Returns the object (unless constructor explicitly returns an object)

### Arrow Functions Cannot Be Constructors

```javascript
const ArrowFunc = (name) => {
  this.name = name;
};

// This throws: TypeError: ArrowFunc is not a constructor
// const instance = new ArrowFunc("test");
```

**Why**: Arrow functions don't have:
- Their own `this` binding
- A `prototype` property
- The `[[Construct]]` internal method

## Higher-Order Functions

Functions that take functions as arguments or return functions.

### Functions as Arguments

```javascript
function map(array, fn) {
  const result = [];
  for (let item of array) {
    result.push(fn(item));
  }
  return result;
}

const numbers = [1, 2, 3, 4];
const doubled = map(numbers, x => x * 2);
console.log(doubled); // [2, 4, 6, 8]
```

### Functions Returning Functions

```javascript
function createLogger(prefix) {
  return function(message) {
    console.log(`[${prefix}] ${message}`);
  };
}

const infoLog = createLogger("INFO");
const errorLog = createLogger("ERROR");

infoLog("Application started"); // [INFO] Application started
errorLog("Something broke");    // [ERROR] Something broke
```

### Function Composition

```javascript
function compose(f, g) {
  return function(x) {
    return f(g(x));
  };
}

const addOne = x => x + 1;
const double = x => x * 2;

const addOneThenDouble = compose(double, addOne);
console.log(addOneThenDouble(5)); // 12 ((5 + 1) * 2)
```

## Immediately Invoked Function Expressions (IIFE)

Functions can be invoked immediately upon creation:

```javascript
(function() {
  console.log("I run immediately!");
})();

// With arguments
(function(name) {
  console.log(`Hello, ${name}!`);
})("World");

// Arrow IIFE
(() => {
  console.log("Arrow IIFE");
})();
```

**Use case**: Creating private scope before ES6 modules.

## What JavaScript Cannot Do

### You Cannot:

1. **Call non-functions**
   ```javascript
   const obj = {};
   // obj(); // TypeError: obj is not a function
   ```

2. **Make arrow functions into constructors**
   ```javascript
   const Func = () => {};
   // new Func(); // TypeError
   ```

3. **Access the execution context directly**
   - You can't inspect the call stack programmatically (except via `Error.stack`)

4. **Dynamically change function arity**
   - `function.length` is read-only

5. **Override `[[Call]]` directly**
   - You can't make a regular object callable (without Proxy)

## Performance Implications

### Fast

- Direct function calls
- Functions with consistent argument types (JIT optimization)
- Regular function declarations

### Slower (relatively)

- `call()` and `apply()` (slight overhead)
- Dynamic function creation (`new Function()`)
- Excessive `bind()` (creates new functions)
- Accessing `arguments` object (in older engines)

## Common Pitfalls

### Pitfall 1: Losing `this` Context

```javascript
const obj = {
  name: "Object",
  method() {
    return this.name;
  }
};

const extracted = obj.method;
console.log(extracted()); // undefined (lost this)

// Fix: bind
const bound = obj.method.bind(obj);
console.log(bound()); // "Object"
```

### Pitfall 2: Arrow Functions in Methods

```javascript
const obj = {
  name: "Object",
  method: () => {
    return this.name; // this is NOT obj!
  }
};

console.log(obj.method()); // undefined
// Arrow functions don't have their own 'this'
```

### Pitfall 3: Modifying Function Properties

```javascript
function func() {}
func.customProp = "value";

const copy = func;
copy.customProp = "newValue";

console.log(func.customProp); // "newValue" (same object!)
```

### Pitfall 4: `bind` Creates New Function

```javascript
function compare(a, b) {
  return a === b;
}

console.log(compare.bind(null) === compare); // false
console.log(compare.bind(null) === compare.bind(null)); // false

// Each bind() creates a NEW function
```

## Interview Insight

When asked "Why are functions called first-class citizens in JavaScript?", a precise answer is:

> "Functions are first-class citizens because they're objects with the special `[[Call]]` internal method. This means they can be:
>
> 1. Assigned to variables and properties
> 2. Passed as arguments to other functions
> 3. Returned from functions
> 4. Stored in data structures
> 5. Have properties and methods added to them
>
> The key difference from regular objects is the `[[Call]]` internal slot, which allows them to be invoked with parentheses. This enables powerful patterns like higher-order functions, callbacks, closures, and functional programming paradigms. Functions can also act as constructors when called with `new`, and they inherit methods from `Function.prototype` like `call`, `apply`, and `bind` for explicit `this` binding."

## Visual Summary

```
FUNCTION ANATOMY:

function myFunc(a, b) { return a + b; }
   │      │     │
   │      │     └─ length: 2
   │      └─ name: "myFunc"  
   └─ [[Call]]: executable code

FUNCTION IS AN OBJECT:

myFunc
├── [[Call]] → internal method
├── name → "myFunc"
├── length → 2
├── prototype → {}
├── __proto__ → Function.prototype
│   ├── call()
│   ├── apply()
│   ├── bind()
│   └── toString()
└── (can add custom properties)

FUNCTION USES:

1. Regular call:     myFunc(1, 2)
2. Method call:      obj.method()
3. Constructor:      new MyFunc()
4. call/apply:       myFunc.call(context, args)
5. bind:             const bound = myFunc.bind(context)
6. Higher-order:     map(arr, myFunc)
```
