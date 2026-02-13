# Chapter 5: `this` Binding (All Four Rules, Arrow Functions, Edge Cases)

---

## Mental Model

**`this` is NOT:**
- A reference to the function itself
- A reference to the function's lexical scope
- Determined by where the function is defined

**`this` IS:**
- A binding determined at **call time** (runtime)
- Determined by **HOW** the function is called
- A reference to an object (or undefined/global in certain cases)

**Key Insight:** `this` is about **call-site**, not **author-time**.

---

## The Four Binding Rules

JavaScript has **4 rules** for determining what `this` refers to. They're applied in priority order.

### Priority Order (highest to lowest):

1. **`new` Binding** — `this` = newly created object
2. **Explicit Binding** — `this` = explicitly specified (`.call()`, `.apply()`, `.bind()`)
3. **Implicit Binding** — `this` = context object (obj.method())
4. **Default Binding** — `this` = global object or undefined (strict mode)

---

## Rule 1: Default Binding (Lowest Priority)

**When:** Function called standalone, no context

```javascript
function showThis() {
  console.log(this);
}

showThis();  // global object (or undefined in strict mode)
```

**Non-strict mode:** `this` = global object (`window` in browsers, `global` in Node.js)  
**Strict mode:** `this` = `undefined`

---

## Rule 2: Implicit Binding

**When:** Function called as a method (through an object reference)

```javascript
const person = {
  name: "Alice",
  greet: function() {
    console.log(this.name);
  }
};

person.greet();  // "Alice" — this = person
```

**The call-site determines `this`:**

```javascript
const greetFn = person.greet;
greetFn();  // undefined (or error in strict) — this = global/undefined
```

**Why:** `greetFn()` is a standalone call (default binding), not `person.greet()` (implicit binding).

---

## Rule 3: Explicit Binding

**When:** Using `.call()`, `.apply()`, or `.bind()`

### `.call(thisArg, arg1, arg2, ...)`

```javascript
function greet(greeting) {
  console.log(`${greeting}, ${this.name}`);
}

const person = { name: "Bob" };

greet.call(person, "Hello");  // "Hello, Bob" — this = person
```

### `.apply(thisArg, [argsArray])`

```javascript
greet.apply(person, ["Hi"]);  // "Hi, Bob" — this = person
```

### `.bind(thisArg)`

Creates a **new function** with `this` permanently bound:

```javascript
const boundGreet = greet.bind(person);
boundGreet("Hey");  // "Hey, Bob" — this = person (always)
```

---

## Rule 4: `new` Binding (Highest Priority)

**When:** Function called with `new` keyword

```javascript
function Person(name) {
  this.name = name;
}

const alice = new Person("Alice");
console.log(alice.name);  // "Alice"
```

**What `new` does:**
1. Creates a new empty object
2. Links it to the function's prototype
3. Binds `this` to the new object
4. Executes the function
5. Returns the new object (unless function returns an object)

---

## Arrow Functions: Lexical `this`

**Arrow functions DON'T have their own `this`.**

They **inherit `this` from the enclosing lexical scope** (where they're defined).

```javascript
const obj = {
  name: "Charlie",
  regularFunc: function() {
    console.log(this.name);  // "Charlie"
    
    const arrow = () => {
      console.log(this.name);  // "Charlie" — inherits from regularFunc
    };
    
    arrow();
  }
};

obj.regularFunc();
```

**Arrow functions ignore all 4 binding rules:**

```javascript
const obj = {
  name: "Dave",
  arrow: () => {
    console.log(this.name);  // undefined (global this, not obj)
  }
};

obj.arrow();  // Implicit binding doesn't work
```

**Why:** Arrow was defined in global scope, not inside obj, so `this` = global.

---

## Binding Priority Demonstration

```javascript
function test() {
  console.log(this.value);
}

const obj1 = { value: 1, test };
const obj2 = { value: 2 };

// Implicit binding
obj1.test();  // 1

// Explicit overrides implicit
obj1.test.call(obj2);  // 2

// new overrides explicit
const bound = test.bind(obj1);
const instance = new bound();  // undefined (new object has no value property)
```

**Priority:** new > explicit > implicit > default

---

## Common Patterns & Edge Cases

### Pattern 1: Losing `this` in Callbacks

```javascript
const obj = {
  value: 42,
  getValue: function() {
    return this.value;
  }
};

setTimeout(obj.getValue, 100);  // undefined — lost this
```

**Why:** `setTimeout` calls the function standalone (default binding).

**Fix 1: Arrow function wrapper**
```javascript
setTimeout(() => obj.getValue(), 100);  // 42
```

**Fix 2: `.bind()`**
```javascript
setTimeout(obj.getValue.bind(obj), 100);  // 42
```

---

### Pattern 2: Event Handlers

```javascript
const button = {
  value: "Click me",
  handleClick: function() {
    console.log(this.value);
  }
};

// Using the method directly
element.addEventListener('click', button.handleClick);  // undefined
// `this` = the DOM element, not button object

// Fix: bind
element.addEventListener('click', button.handleClick.bind(button));  // "Click me"
```

---

### Pattern 3: Arrow Functions as Methods

```javascript
const obj = {
  value: 10,
  getValue: () => {
    return this.value;  // Wrong! this = global
  }
};

obj.getValue();  // undefined
```

**Why:** Arrow inherits `this` from where it's defined (global scope), not obj.

**Rule:** Don't use arrow functions as object methods (unless you specifically want lexical `this`).

---

### Edge Case 1: `this` in Nested Functions

```javascript
const obj = {
  value: 5,
  outer: function() {
    function inner() {
      console.log(this.value);  // undefined (default binding)
    }
    inner();
  }
};

obj.outer();
```

**Why:** `inner()` is standalone call (default binding), not implicit.

**Fix: Arrow function**
```javascript
outer: function() {
  const inner = () => {
    console.log(this.value);  // 5 — inherits from outer
  };
  inner();
}
```

---

### Edge Case 2: `call`/`apply`/`bind` on Arrow Functions

```javascript
const arrow = () => console.log(this.value);

const obj = { value: 100 };

arrow.call(obj);   // Ignored — arrow uses lexical this
arrow.bind(obj)(); // Ignored — arrow uses lexical this
```

**Arrow functions CANNOT have `this` changed.**

---

### Edge Case 3: Constructor Returning Object

```javascript
function Person(name) {
  this.name = name;
  return { name: "Override" };  // Explicit return
}

const p = new Person("Alice");
console.log(p.name);  // "Override"
```

**Why:** If constructor returns an object, that's used instead of the `this` object.

---

### Edge Case 4: `this` in Class Methods

```javascript
class Counter {
  constructor() {
    this.count = 0;
  }
  
  increment() {
    this.count++;
  }
}

const counter = new Counter();
const inc = counter.increment;
inc();  // TypeError: Cannot read property 'count' of undefined
```

**Why:** Class methods run in strict mode → default binding = undefined.

**Fix: Bind in constructor**
```javascript
constructor() {
  this.count = 0;
  this.increment = this.increment.bind(this);
}
```

**Or: Use arrow function (field)**
```javascript
increment = () => {
  this.count++;
};
```

---

## What JavaScript CANNOT Do

### 1. Cannot Use Lexical Scope for `this`

```javascript
function outer() {
  const value = 10;
  
  function inner() {
    console.log(this.value);  // Can't access outer's local variable
  }
  
  inner();
}
```

**Why:** `this` is NOT a scope reference. It's an object reference determined by call-site.

---

### 2. Cannot Change Arrow Function `this`

```javascript
const arrow = () => console.log(this);
arrow.call({ value: 1 });  // Ignored — uses lexical this
```

**Why:** Arrow functions lock `this` at definition time.

---

## Key Takeaways

1. **`this` is determined by call-site**, not author-time
2. **Four rules (priority):** new > explicit > implicit > default
3. **Implicit binding:** `obj.method()` → `this = obj`
4. **Explicit binding:** `.call()`, `.apply()`, `.bind()` → `this = specified`
5. **new binding:** Creates new object, `this = new object`
6. **Default binding:** Standalone call → `this = global` (or undefined in strict)
7. **Arrow functions:** Lexical `this`, ignore all 4 rules
8. **Common trap:** Losing `this` in callbacks

---

## Next Chapter Preview

**Closures:** Deep dive into how closures work, memory retention, common patterns, and performance implications.
