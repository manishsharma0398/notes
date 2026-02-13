/**
 * Example 2: Shadowing and Property Assignment
 * Demonstrates how property assignment creates own properties and shadows prototype
 */

console.log("=== Example 2: Shadowing ===\n");

// SCENARIO 1: Basic shadowing
console.log("--- Basic Shadowing ---");

function Person() { }
Person.prototype.age = 25;

const alice = new Person();

console.log("Before shadowing:");
console.log("  alice.age:", alice.age);  // 25 (from prototype)
console.log("  alice.hasOwnProperty('age'):", alice.hasOwnProperty('age'));  // false

// Create own property (shadows prototype)
alice.age = 30;

console.log("\nAfter shadowing:");
console.log("  alice.age:", alice.age);  // 30 (own property)
console.log("  alice.hasOwnProperty('age'):", alice.hasOwnProperty('age'));  // true
console.log("  Person.prototype.age:", Person.prototype.age);  // 25 (unchanged)

/**
 * WHAT HAPPENED:
 * 
 * Before: alice → Person.prototype → Object.prototype → null
 *         (no age)      (age: 25)
 * 
 * alice.age lookup finds 25 in Person.prototype
 * 
 * After: alice → Person.prototype → Object.prototype → null
 *       (age: 30)   (age: 25)
 * 
 * alice.age lookup finds 30 on alice (stops searching)
 * 
 * The prototype property is SHADOWED, not modified.
 */

// SCENARIO 2: Removing shadow reveals prototype
console.log("\n--- Removing Shadow ---");

console.log("alice.age before delete:", alice.age);  // 30

delete alice.age;

console.log("alice.age after delete:", alice.age);   // 25 (back to prototype)
console.log("hasOwnProperty:", alice.hasOwnProperty('age'));  // false

/**
 * delete removes the OWN property.
 * Now alice.age falls through to the prototype again.
 */

// SCENARIO 3: Shadowing doesn't affect other instances
console.log("\n--- Shadowing is Per-Instance ---");

const bob = new Person();

alice.age = 35;

console.log("alice.age:", alice.age);  // 35 (own property)
console.log("bob.age:", bob.age);      // 25 (prototype)

/**
 * Each instance can have its own shadowing properties.
 * They don't affect each other.
 */

// SCENARIO 4: Assignment ALWAYS creates/updates own property
console.log("\n--- Assignment Creates Own Property ---");

function Counter() { }
Counter.prototype.count = 0;

const c1 = new Counter();
const c2 = new Counter();

console.log("Initial:");
console.log("  c1.count:", c1.count);  // 0 (prototype)
console.log("  c2.count:", c2.count);  // 0 (prototype)

c1.count++;  // Creates c1.count = 1 (doesn't modify prototype)

console.log("\nAfter c1.count++:");
console.log("  c1.count:", c1.count);              // 1 (own)
console.log("  c2.count:", c2.count);              // 0 (prototype)
console.log("  Counter.prototype.count:", Counter.prototype.count);  // 0

/**
 * c1.count++ is equivalent to:
 * 1. Read c1.count (finds 0 in prototype)
 * 2. Add 1 → 1
 * 3. Assign to c1.count → creates OWN property
 * 
 * It does NOT modify the prototype.
 */

// SCENARIO 5: Methods are typically NOT shadowed
console.log("\n--- Methods on Prototype ---");

function Animal(name) {
    this.name = name;
}

Animal.prototype.speak = function () {
    console.log(`${this.name} speaks`);
};

const dog = new Animal("Rex");
const cat = new Animal("Whiskers");

// Both share the method
console.log("dog.speak === cat.speak:", dog.speak === cat.speak);  // true

// Bad practice: shadowing a method
dog.speak = function () {
    console.log("Woof!");
};

console.log("\nAfter shadowing:");
console.log("dog.speak === cat.speak:", dog.speak === cat.speak);  // false

dog.speak();  // "Woof!" (own property)
cat.speak();  // "Whiskers speaks" (prototype)

/**
 * Generally, you DON'T want to shadow methods.
 * Methods belong on prototype (shared).
 * Data belongs on instance (own properties).
 */

// SCENARIO 6: Prototype modifications affect all instances
console.log("\n--- Modifying Prototype ---");

function Product() { }
Product.prototype.version = "1.0";

const p1 = new Product();
const p2 = new Product();

console.log("Before modification:");
console.log("  p1.version:", p1.version);  // "1.0"
console.log("  p2.version:", p2.version);  // "1.0"

// Modify prototype
Product.prototype.version = "2.0";

console.log("\nAfter prototype modification:");
console.log("  p1.version:", p1.version);  // "2.0" (both see change)
console.log("  p2.version:", p2.version);  // "2.0"

// Unless instance has own property
p1.version = "1.5";

Product.prototype.version = "3.0";

console.log("\nAfter p1 has own property:");
console.log("  p1.version:", p1.version);  // "1.5" (own property)
console.log("  p2.version:", p2.version);  // "3.0" (prototype)

/**
 * Modifying the prototype affects ALL instances that don't have own property.
 * 
 * This is why prototypes are powerful for shared behavior.
 */

// SCENARIO 7: Shadowing with getters/setters (tricky!)
console.log("\n--- Shadowing with Getters/Setters ---");

function Item() { }

Object.defineProperty(Item.prototype, 'value', {
    get() {
        return this._value || 0;
    },
    set(v) {
        console.log("Setter called with:", v);
        this._value = v;
    }
});

const item = new Item();

console.log("item.value:", item.value);  // 0 (getter called)

item.value = 42;  // Setter called, creates item._value = 42

console.log("item.value:", item.value);  // 42

/**
 * When prototype has a setter, assignment calls the setter.
 * The setter can create own properties (like _value).
 * 
 * This is different from simple property shadowing.
 */

console.log("\n=== Shadowing Summary ===");
console.log("✓ Assignment creates/updates own property");
console.log("✓ Own property shadows prototype property");
console.log("✓ delete on own property reveals prototype");
console.log("✓ Shadowing is per-instance");
console.log("✓ Modifying prototype affects all instances (unless shadowed)");
console.log("✓ Best practice: data on instance, methods on prototype");
