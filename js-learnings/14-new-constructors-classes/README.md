# Chapter 14: `new`, Constructors, and Class Syntax Internals

---

## Mental Model

**Stop thinking:** "Classes are like Java/C++ classes"  
**Start thinking:** "Classes are syntactic sugar over prototypes and constructor functions"

**Key Insight:** JavaScript's `class` syntax is just a cleaner way to write the same prototype-based inheritance we already have.

---

## What Does `new` Do?

When you call `new Constructor()`, JavaScript:

1. **Creates empty object:** `{}`
2. **Sets prototype:** `object.[[Prototype]] = Constructor.prototype`
3. **Binds `this`:** Calls `Constructor.call(object, ...args)`
4. **Returns object:** Unless constructor explicitly returns an object

```javascript
function Person(name) {
    this.name = name;
}

const alice = new Person("Alice");

// Equivalent to:
const alice = {};
Object.setPrototypeOf(alice, Person.prototype);
Person.call(alice, "Alice");
// Return alice (unless Person returns an object)
```

---

## Constructor Functions

**Pattern:**

```javascript
function Person(name, age) {
    // 'this' is the new object
    this.name = name;
    this.age = age;
}

// Methods on prototype (shared)
Person.prototype.greet = function() {
    console.log(`Hi, I'm ${this.name}`);
};

const bob = new Person("Bob", 30);
bob.greet();  // "Hi, I'm Bob"
```

**Why methods on prototype?**
- Memory efficient (one function shared by all instances)
- Updates affect all instances

---

## Constructor Return Value

**Default:** Returns the new object

**Override:** Constructor can return a different object

```javascript
function Custom() {
    this.x = 1;
    return { y: 2 };  // Override!
}

const obj = new Custom();
console.log(obj);  // { y: 2 }
console.log(obj.x);  // undefined
```

**Return non-object:** Ignored, returns `this`

```javascript
function Test() {
    this.x = 1;
    return 42;  // Primitive → ignored
}

const obj = new Test();
console.log(obj);  // { x: 1 }
```

---

## ES6 Classes (Syntactic Sugar)

**Class syntax:**

```javascript
class Person {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }
    
    greet() {
        console.log(`Hi, I'm ${this.name}`);
    }
    
    static species() {
        return "Homo sapiens";
    }
}

const alice = new Person("Alice", 25);
```

**Under the hood:**

```javascript
function Person(name, age) {
    this.name = name;
    this.age = age;
}

Person.prototype.greet = function() {
    console.log(`Hi, I'm ${this.name}`);
};

Person.species = function() {
    return "Homo sapiens";
};
```

**Differences from constructor functions:**
1. **Must use `new`:** `Person()` throws TypeError
2. **Not hoisted:** Can't use before declaration
3. **Strict mode:** Class body in strict mode
4. **Methods non-enumerable:** `greet` is non-enumerable

---

## Class Inheritance

```javascript
class Animal {
    constructor(name) {
        this.name = name;
    }
    
    speak() {
        console.log(`${this.name} makes a sound`);
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);  // MUST call super first
        this.breed = breed;
    }
    
    speak() {
        console.log(`${this.name} barks`);
    }
}

const rex = new Dog("Rex", "Labrador");
rex.speak();  // "Rex barks"
```

**What `extends` does:**

1. `Dog.prototype.[[Prototype]] = Animal.prototype`
2. `Dog.[[Prototype]] = Animal` (for static inheritance)

**What `super` does:**

- In constructor: Calls parent constructor
- In method: Accesses parent method

---

## Super Mechanics

### In Constructor

```javascript
class Child extends Parent {
    constructor() {
        // Can't use 'this' before super()
        super();  // MUST call
        this.x = 1;  // Now OK
    }
}
```

**Why:** `this` binding happens in parent constructor when using `extends`.

### In Methods

```javascript
class Parent {
    greet() {
        return "Hello";
    }
}

class Child extends Parent {
    greet() {
        return super.greet() + ", from child";
    }
}
```

`super.greet()` calls `Parent.prototype.greet` with `this = child instance`.

---

## Static Methods and Properties

```javascript
class MyClass {
    static staticMethod() {
        return "static";
    }
    
    static staticProp = "value";
}

MyClass.staticMethod();  // "static"
MyClass.staticProp;      // "value"
```

**Static members:**
- On the constructor function itself (not prototype)
- NOT inherited by instances
- Inherited by subclasses

---

## Private Fields (ES2022)

```javascript
class Counter {
    #count = 0;  // Private field
    
    increment() {
        this.#count++;
    }
    
    getCount() {
        return this.#count;
    }
}

const c = new Counter();
c.increment();
console.log(c.getCount());  // 1
console.log(c.#count);      // SyntaxError
```

**Private fields:**
- Prefixed with `#`
- Truly private (not accessible outside class)
- Not on prototype (on instance)

---

## Public Field Initialization

```javascript
class MyClass {
    x = 1;  // Public field
    y = this.x + 1;  // Can reference other fields
    
    constructor() {
        // Fields initialized BEFORE constructor body
        console.log(this.x);  // 1
    }
}
```

**Execution order:**
1. Initialize fields
2. Run constructor body

---

## Getters and Setters

```javascript
class Person {
    constructor(firstName, lastName) {
        this._firstName = firstName;
        this._lastName = lastName;
    }
    
    get fullName() {
        return `${this._firstName} ${this._lastName}`;
    }
    
    set fullName(name) {
        [this._firstName, this._lastName] = name.split(' ');
    }
}

const person = new Person("John", "Doe");
console.log(person.fullName);  // "John Doe"
person.fullName = "Jane Smith";
console.log(person._firstName);  // "Jane"
```

---

## Common Patterns

### Factory Pattern

```javascript
class User {
    constructor(data) {
        this.name = data.name;
        this.email = data.email;
    }
    
    static fromJSON(json) {
        return new User(JSON.parse(json));
    }
}

const user = User.fromJSON('{"name":"Alice","email":"a@b.com"}');
```

### Singleton Pattern

```javascript
class Singleton {
    static #instance;
    
    constructor() {
        if (Singleton.#instance) {
            return Singleton.#instance;
        }
        Singleton.#instance = this;
    }
}

const a = new Singleton();
const b = new Singleton();
console.log(a === b);  // true
```

---

## Edge Cases & Traps

### Trap 1: Forgetting `new`

```javascript
class Person {
    constructor(name) {
        this.name = name;
    }
}

Person("Alice");  // TypeError: Class constructor cannot be invoked without 'new'
```

**Good!** Classes enforce `new`.

### Trap 2: `this` in Methods

```javascript
class Counter {
    count = 0;
    
    increment() {
        this.count++;
    }
}

const c = new Counter();
const fn = c.increment;
fn();  // Error: Cannot read property 'count' of undefined
```

**Fix:** Arrow function or bind

```javascript
class Counter {
    count = 0;
    
    increment = () => {  // Arrow function
        this.count++;
    }
}
```

### Trap 3: Calling `super()` Twice

```javascript
class Child extends Parent {
    constructor() {
        super();
        super();  // Error!
    }
}
```

### Trap 4: Accessing `this` Before `super()`

```javascript
class Child extends Parent {
    constructor() {
        this.x = 1;  // ReferenceError!
        super();
    }
}
```

---

## Class vs Constructor Function

| Feature | Class | Constructor Function |
|---------|-------|---------------------|
| Must use `new` | Yes ✓ | No (silently fails) |
| Hoisted | No | Yes |
| Strict mode | Always | Only if declared |
| Method enumerable | No | Yes |
| `super` | Yes ✓ | Manual |

---

## Key Takeaways

1. **`new` creates object, sets prototype, binds `this`, returns object**
2. **Classes are syntactic sugar** over prototypes
3. **`extends` sets up prototype chain**
4. **`super()` must be called** before using `this` in derived constructor
5. **Private fields** with `#` are truly private
6. **Static members** are on constructor, not instances
7. **Arrow functions in classes** preserve `this` binding

---

## Next Chapter Preview

**Iteration Protocols:** Deep dive into `Symbol.iterator`, iterables, iterators, and generators.
