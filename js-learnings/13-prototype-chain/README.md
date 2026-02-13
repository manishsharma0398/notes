# Chapter 13: Prototype Chain

---

## Mental Model

**Stop thinking:** "JavaScript has classes"  
**Start thinking:** "JavaScript has objects linked to other objects"

**The Prototype Chain is:**
- A linked list of objects
- JavaScript's **inheritance mechanism**
- How property lookup works when a property isn't found on the object itself

**Key Insight:** Every object has an internal link to another object (its prototype). Property access walks this chain.

---

## What is the Prototype Chain?

Every object in JavaScript has an **internal prototype link** (`[[Prototype]]`).

When you access a property:
1. Check the object itself
2. If not found, check its `[[Prototype]]`
3. If not found, check that object's `[[Prototype]]`
4. Continue until you reach `null`
5. If still not found → `undefined`

```javascript
const obj = { a: 1 };

// obj's prototype chain:
// obj → Object.prototype → null
```

---

## `[[Prototype]]` vs `.prototype`

### `[[Prototype]]` (Internal Link)

**Every object has this.**

It's an **internal property** that points to the object's prototype.

**Access it via:**
- `Object.getPrototypeOf(obj)` ✅ (recommended)
- `obj.__proto__` ⚠️ (deprecated, but widely supported)

```javascript
const obj = {};
console.log(Object.getPrototypeOf(obj) === Object.prototype);  // true
```

---

### `.prototype` (Constructor Property)

**Only functions have this.**

It's a **regular property** that holds the object that will become the `[[Prototype]]` of instances created with `new`.

```javascript
function Person() {}

Person.prototype.greet = function() {
  console.log("Hello");
};

const alice = new Person();
// alice's [[Prototype]] is Person.prototype
```

**Critical Distinction:**
- `[[Prototype]]`: Internal link (what object inherits from)
- `.prototype`: Property on functions (used when creating instances)

---

## How the Chain is Created

### Method 1: Object Literals

```javascript
const obj = { a: 1 };
// obj.[[Prototype]] = Object.prototype
```

---

### Method 2: Constructor Functions

```javascript
function Person(name) {
  this.name = name;
}

const alice = new Person("Alice");
// alice.[[Prototype]] = Person.prototype
```

**What `new` does:**
1. Create empty object: `{}`
2. Set `[[Prototype]]`: `object.[[Prototype]] = Person.prototype`
3. Call constructor with `this` = new object
4. Return the object

---

### Method 3: `Object.create()`

```javascript
const proto = { type: "animal" };
const dog = Object.create(proto);
// dog.[[Prototype]] = proto
```

**Most direct way** to set the prototype.

---

## Property Lookup Process

**Example:**

```javascript
function Animal(name) {
  this.name = name;
}

Animal.prototype.speak = function() {
  console.log(`${this.name} makes a sound`);
};

const dog = new Animal("Rex");
dog.speak();
```

**Lookup for `dog.speak`:**
1. Check `dog` object → No `speak` property
2. Check `dog.[[Prototype]]` (which is `Animal.prototype`) → **Found `speak`!**
3. Execute `speak` with `this = dog`

**Chain:**
```
dog
  name: "Rex"
  [[Prototype]] → Animal.prototype
                    speak: function
                    [[Prototype]] → Object.prototype
                                      toString: function
                                      [[Prototype]] → null
```

---

## Shadowing

When an object has a property with the same name as one in its prototype chain, it **shadows** the prototype property.

```javascript
function Person() {}
Person.prototype.age = 25;

const alice = new Person();
console.log(alice.age);  // 25 (from prototype)

alice.age = 30;  // Create own property
console.log(alice.age);  // 30 (own property shadows prototype)

delete alice.age;
console.log(alice.age);  // 25 (back to prototype)
```

**Important:** Assignment creates/updates own property, doesn't modify prototype.

---

## Methods on Prototypes vs Own Properties

**Best Practice:** Methods on prototype, data on instance.

```javascript
// GOOD: Methods on prototype
function Counter() {
  this.count = 0;  // Data on instance
}

Counter.prototype.increment = function() {  // Method on prototype
  this.count++;
};

const c1 = new Counter();
const c2 = new Counter();

// c1 and c2 SHARE the same increment function (memory efficient)
console.log(c1.increment === c2.increment);  // true
```

**Why:**
- **Memory efficiency:** One function shared by all instances
- **Inheritance:** All instances automatically get prototype updates
- **Data encapsulation:** Each instance has its own data

---

## Inheritance via Prototype Chain

```javascript
function Animal(name) {
  this.name = name;
}

Animal.prototype.eat = function() {
  console.log(`${this.name} is eating`);
};

function Dog(name, breed) {
  Animal.call(this, name);  // Call parent constructor
  this.breed = breed;
}

// Set up prototype chain: Dog.prototype → Animal.prototype
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;  // Restore constructor reference

Dog.prototype.bark = function() {
  console.log(`${this.name} barks`);
};

const rex = new Dog("Rex", "Labrador");
rex.eat();   // From Animal.prototype
rex.bark();  // From Dog.prototype
```

**Chain:**
```
rex
  name: "Rex"
  breed: "Labrador"
  [[Prototype]] → Dog.prototype
                    bark: function
                    constructor: Dog
                    [[Prototype]] → Animal.prototype
                                      eat: function
                                      [[Prototype]] → Object.prototype
                                                        toString: function
                                                        [[Prototype]] → null
```

---

## Common Prototype Operations

### Check if property is own or inherited

```javascript
const obj = { a: 1 };

obj.hasOwnProperty('a');         // true (own property)
obj.hasOwnProperty('toString');  // false (inherited)
```

---

### Get prototype

```javascript
Object.getPrototypeOf(obj);  // ✅ Recommended
obj.__proto__;               // ⚠️ Works but deprecated
```

---

### Set prototype (avoid after creation!)

```javascript
Object.setPrototypeOf(obj, proto);  // ⚠️ Slow, avoid in hot paths
```

**Performance:** Changing prototype after creation is **extremely slow**. Set it at creation time.

---

### Check if object is in prototype chain

```javascript
Animal.prototype.isPrototypeOf(rex);  // true
Object.prototype.isPrototypeOf(rex);  // true
Dog.prototype.isPrototypeOf(rex);     // true
```

---

## The End of the Chain

**All chains end at `null`.**

```javascript
Object.getPrototypeOf(Object.prototype);  // null
```

**Exception:** Objects created with `Object.create(null)` have **no prototype**.

```javascript
const obj = Object.create(null);
console.log(Object.getPrototypeOf(obj));  // null
```

These are **truly empty** objects (no inherited properties like `toString`).

---

## Constructor Property

Every function's `.prototype` has a `.constructor` property pointing back to the function.

```javascript
function Person() {}

console.log(Person.prototype.constructor === Person);  // true

const alice = new Person();
console.log(alice.constructor === Person);  // true (inherited from prototype)
```

**Important:** `alice.constructor` is NOT on `alice` itself, it's inherited from `Person.prototype`.

---

## Edge Cases & Traps

### Trap 1: Forgotten `new`

```javascript
function Person(name) {
  this.name = name;
}

const alice = Person("Alice");  // Forgot 'new'
console.log(alice);       // undefined
console.log(window.name); // "Alice" (or error in strict mode)
```

**Why:** Without `new`, `this = global` (or undefined in strict mode).

---

### Trap 2: Replacing `.prototype`

```javascript
function Person() {}
Person.prototype.greet = function() { console.log("Hello"); };

const alice = new Person();

// This BREAKS the chain for existing instances
Person.prototype = { newMethod: function() {} };

alice.greet();  // Still works (alice points to OLD prototype)

const bob = new Person();
bob.greet();    // Error: greet is not a function
```

**Why:** Replacing `.prototype` doesn't affect existing instances. They still point to the old prototype object.

---

### Trap 3: Modifying Object.prototype (DON'T!)

```javascript
Object.prototype.myMethod = function() {
  console.log("Don't do this!");
};

// Now EVERY object has this method
const obj = {};
obj.myMethod();  // Works, but pollutes global prototype
```

**Why dangerous:**
- Affects ALL objects in your codebase
- Can break libraries
- Shows up in `for...in` loops

---

### Trap 4: `instanceof` and Prototype Chain

```javascript
function Animal() {}
function Dog() {}
Dog.prototype = Object.create(Animal.prototype);

const rex = new Dog();

console.log(rex instanceof Dog);     // true
console.log(rex instanceof Animal);  // true
console.log(rex instanceof Object);  // true
```

`instanceof` checks if `.prototype` of constructor is **anywhere** in the chain.

---

## Class Syntax (Syntactic Sugar)

ES6 classes are **syntactic sugar** over prototypes.

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  
  eat() {
    console.log(`${this.name} is eating`);
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }
  
  bark() {
    console.log(`${this.name} barks`);
  }
}
```

**Under the hood:**
- `eat` → `Animal.prototype.eat`
- `bark` → `Dog.prototype.bark`
- `Dog.prototype.[[Prototype]]` → `Animal.prototype`

**Same prototype chain**, cleaner syntax.

---

## What JavaScript CANNOT Do

### 1. Cannot Have Multiple Inheritance

```javascript
// This doesn't work:
// Dog.prototype = both Animal.prototype AND Mammal.prototype
```

**Why:** Each object has **one** `[[Prototype]]` link. Can't have two.

**Workaround:** Mixins (copying properties, not true inheritance).

---

### 2. Cannot Make Prototype Chain Circular

```javascript
const a = {};
const b = { };
Object.setPrototypeOf(a, b);
Object.setPrototypeOf(b, a);  // TypeError: Cyclic __proto__ value
```

**Why:** Would create infinite lookup loop.

---

## Key Takeaways

1. **Prototype chain = linked list of objects** for inheritance
2. **`[[Prototype]]`** = internal link (what object inherits from)
3. **`.prototype`** = property on functions (for `new`)
4. **Property lookup walks the chain** until found or null
5. **Shadowing:** Own property hides prototype property
6. **Methods on prototype, data on instance** (best practice)
7. **All chains end at `null`** (or start with `Object.create(null)`)
8. **Classes are syntactic sugar** over prototypes

---

## Next Chapter Preview

**`new`, Constructors, and Class Syntax Internals:** Deep dive into what `new` does, constructor patterns, and how ES6 classes work under the hood.
