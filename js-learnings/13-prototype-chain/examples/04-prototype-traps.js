/**
 * Example 4: Prototype Traps and Edge Cases
 * Demonstrates common mistakes and subtle behaviors
 */

console.log("=== Example 4: Prototype Traps ===\n");

// TRAP 1: Forgetting 'new'
console.log("--- Trap 1: Forgotten 'new' ---");

function Person(name) {
    this.name = name;
}

Person.prototype.greet = function () {
    console.log(`Hello, I'm ${this.name}`);
};

// Correct: using 'new'
const alice = new Person("Alice");
alice.greet();  // Works

// WRONG: forgetting 'new'
const bob = Person("Bob");
console.log("bob:", bob);  // undefined

/**
 * Without 'new':
 * - this = global (or undefined in strict mode)
 * - Function returns undefined (no explicit return)
 * - bob = undefined
 * - this.name = "Bob" pollutes global scope (or throws in strict)
 * 
 * FIX: Always use 'new', or use ES6 classes (which throw if no 'new')
 */

// TRAP 2: Replacing .prototype breaks existing instances
console.log("\n--- Trap 2: Replacing Prototype ---");

function Animal() { }
Animal.prototype.speak = function () {
    console.log("Animal sound");
};

const dog = new Animal();

// Replace prototype (BREAKS existing instances)
Animal.prototype = {
    speak: function () {
        console.log("New sound");
    }
};

const cat = new Animal();

dog.speak();  // "Animal sound" (still uses OLD prototype)
cat.speak();  // "New sound" (uses NEW prototype)

/**
 * WHY:
 * 
 * dog.[[Prototype]] points to the OLD Animal.prototype object.
 * Replacing Animal.prototype creates a NEW object.
 * Existing instances still point to the old one.
 * 
 * FIX: Don't replace .prototype. Modify it instead:
 * Animal.prototype.speak = function() { ... };
 */

// TRAP 3: Modifying Object.prototype (NEVER DO THIS!)
console.log("\n--- Trap 3: Polluting Object.prototype ---");

// DON'T DO THIS:
// Object.prototype.myMethod = function() { return "bad"; };

/**
 * If you add to Object.prototype:
 * - ALL objects inherit it
 * - Shows up in for...in loops (breaks iteration)
 * - Can conflict with library code
 * - Affects entire codebase
 * 
 * This is called "pollution" and is extremely dangerous.
 */

// TRAP 4: Array.prototype and primitive wrappers
console.log("\n--- Trap 4: Primitives and Prototypes ---");

const str = "hello";
console.log("str.toUpperCase():", str.toUpperCase());  // "HELLO"

/**
 * WHAT HAPPENS:
 * 
 * 1. str is a primitive string
 * 2. When you access .toUpperCase, JavaScript TEMPORARILY wraps it:
 *    new String("hello")
 * 3. The wrapper has [[Prototype]] → String.prototype
 * 4. String.prototype has toUpperCase method
 * 5. After method call, wrapper is discarded
 * 
 * This is "autoboxing"
 * 
 * You CAN modify String.prototype:
 */

String.prototype.shout = function () {
    return this.toUpperCase() + "!!!";
};

console.log("str.shout():", str.shout());  // "HELLO!!!"

/**
 * But you SHOULDN'T pollute built-in prototypes.
 */

// TRAP 5: instanceof and prototype changes
console.log("\n--- Trap 5: instanceof Quirk ---");

function Constructor1() { }
const obj = new Constructor1();

console.log("obj instanceof Constructor1:", obj instanceof Constructor1);  // true

// Change what Constructor1.prototype points to
Constructor1.prototype = {};

console.log("obj instanceof Constructor1 after change:", obj instanceof Constructor1);  // false!

/**
 * instanceof checks if Constructor1.prototype is in obj's chain.
 * 
 * After replacement, Constructor1.prototype is a NEW object.
 * obj.[[Prototype]] still points to the OLD object.
 * So instanceof returns false.
 * 
 * instanceof is NOT reliable if prototypes are changed after instantiation.
 */

// TRAP 6: Constructor property is NOT reliable
console.log("\n--- Trap 6: Constructor Property ---");

function MyConstructor() { }

const instance = new MyConstructor();

console.log("instance.constructor:", instance.constructor);  // MyConstructor
console.log("instance.hasOwnProperty('constructor'):", instance.hasOwnProperty('constructor'));  // false

/**
 * instance.constructor is inherited from MyConstructor.prototype.
 * It's NOT on the instance itself.
 * 
 * If you replace the prototype and forget to set constructor:
 */

function Parent() { }
function Child() { }

Child.prototype = Object.create(Parent.prototype);
// Forgot: Child.prototype.constructor = Child;

const child = new Child();
console.log("child.constructor:", child.constructor);  // Parent (WRONG!)

/**
 * Always restore the constructor reference after setting prototype.
 */

// TRAP 7: hasOwnProperty in chain
console.log("\n--- Trap 7: hasOwnProperty Edge Case ---");

const proto = { hasOwnProperty: function () { return false; } };
const obj2 = Object.create(proto);
obj2.x = 1;

console.log("obj2.hasOwnProperty('x'):", obj2.hasOwnProperty('x'));  // false (shadowed!)

/**
 * hasOwnProperty is shadowed by the prototype.
 * 
 * SAFE way to check:
 */
console.log("Safe check:", Object.prototype.hasOwnProperty.call(obj2, 'x'));  // true

// TRAP 8: Setting [[Prototype]] after creation (SLOW!)
console.log("\n--- Trap 8: Performance Trap ---");

const fast = Object.create({ a: 1 });  // Set prototype at creation → FAST

const slow = {};
Object.setPrototypeOf(slow, { a: 1 });  // Change prototype after creation → SLOW!

/**
 * Changing [[Prototype]] after object creation is EXTREMELY SLOW.
 * JavaScript engines can't optimize objects with changed prototypes.
 * 
 * ALWAYS set prototype at creation time:
 * - Object.create(proto)
 * - new Constructor()
 * 
 * NEVER use Object.setPrototypeOf() in performance-critical code.
 */

// TRAP 9: Null prototype objects
console.log("\n--- Trap 9: Null Prototype ---");

const nullProto = Object.create(null);
nullProto.a = 1;

console.log("nullProto.a:", nullProto.a);  // 1
// console.log("nullProto.toString():", nullProto.toString());  // Error!

console.log("Object.getPrototypeOf(nullProto):", Object.getPrototypeOf(nullProto));  // null

/**
 * Objects created with Object.create(null) have NO prototype.
 * 
 * Pros:
 * - Truly empty (no inherited properties)
 * - Good for dictionaries/maps
 * - No toString, hasOwnProperty, etc.
 * 
 * Cons:
 * - Can't use inherited methods
 * - Some libraries expect Object.prototype methods
 */

// TRAP 10: for...in and prototypes
console.log("\n--- Trap 10: for...in and Inheritance ---");

function Base() { }
Base.prototype.inherited = "base";

const derived = new Base();
derived.own = "derived";

console.log("for...in loop:");
for (let key in derived) {
    console.log(`  ${key}: ${derived[key]}`);
}

/**
 * for...in iterates over:
 * - Own enumerable properties
 * - Inherited enumerable properties
 * 
 * This includes prototype properties!
 * 
 * FIX: Check with hasOwnProperty:
 */

console.log("\nWith hasOwnProperty check:");
for (let key in derived) {
    if (derived.hasOwnProperty(key)) {
        console.log(`  ${key}: ${derived[key]}`);
    }
}

// Or use Object.keys() (own properties only):
console.log("\nObject.keys():", Object.keys(derived));

console.log("\n=== Traps Summary ===");
console.log("✓ Always use 'new' with constructors");
console.log("✓ Don't replace .prototype after instances exist");
console.log("✓ NEVER modify Object.prototype");
console.log("✓ instanceof unreliable after prototype changes");
console.log("✓ Restore constructor after setting prototype");
console.log("✓ Use Object.prototype.hasOwnProperty.call() safely");
console.log("✓ Set prototype at creation, not after");
console.log("✓ Object.create(null) for truly empty objects");
console.log("✓ for...in includes inherited properties");
