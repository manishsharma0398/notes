/**
 * Example 1: Prototype Chain Basics
 * Demonstrates how the prototype chain works and property lookup
 */

console.log("=== Example 1: Prototype Chain Basics ===\n");

// SCENARIO 1: Simple prototype chain
console.log("--- Basic Object Prototype Chain ---");

const obj = { a: 1 };

console.log("obj.a:", obj.a);                    // 1 (own property)
console.log("obj.toString:", obj.toString);      // function (from Object.prototype)
console.log("obj.nonExistent:", obj.nonExistent); // undefined (not in chain)

/**
 * PROTOTYPE CHAIN for obj:
 * 
 * obj
 *   a: 1
 *   [[Prototype]] → Object.prototype
 *                     toString: function
 *                     hasOwnProperty: function
 *                     ...
 *                     [[Prototype]] → null
 * 
 * PROPERTY LOOKUP for obj.toString:
 * 1. Check obj → no toString
 * 2. Check obj.[[Prototype]] (Object.prototype) → FOUND toString!
 * 3. Return the function
 * 
 * PROPERTY LOOKUP for obj.nonExistent:
 * 1. Check obj → no nonExistent
 * 2. Check obj.[[Prototype]] → no nonExistent
 * 3. Check next [[Prototype]] → null (end of chain)
 * 4. Return undefined
 */

// SCENARIO 2: Constructor and prototype
console.log("\n--- Constructor Prototype Chain ---");

function Person(name) {
    this.name = name;
}

Person.prototype.greet = function () {
    console.log(`Hello, I'm ${this.name}`);
};

const alice = new Person("Alice");

console.log("alice.name:", alice.name);         // "Alice" (own property)
alice.greet();                                   // "Hello, I'm Alice" (from prototype)

/**
 * PROTOTYPE CHAIN for alice:
 * 
 * alice
 *   name: "Alice"
 *   [[Prototype]] → Person.prototype
 *                     greet: function
 *                     constructor: Person
 *                     [[Prototype]] → Object.prototype
 *                                       toString: function
 *                                       [[Prototype]] → null
 * 
 * What 'new Person("Alice")' did:
 * 1. Created empty object: {}
 * 2. Set [[Prototype]]: object.[[Prototype]] = Person.prototype
 * 3. Called Person with this = object → this.name = "Alice"
 * 4. Returned the object
 */

// Verify the chain
console.log("\nVerifying prototype chain:");
console.log("alice.[[Prototype]] === Person.prototype:",
    Object.getPrototypeOf(alice) === Person.prototype);  // true
console.log("Person.prototype.[[Prototype]] === Object.prototype:",
    Object.getPrototypeOf(Person.prototype) === Object.prototype);  // true
console.log("Object.prototype.[[Prototype]]:",
    Object.getPrototypeOf(Object.prototype));  // null

// SCENARIO 3: [[Prototype]] vs .prototype
console.log("\n--- [[Prototype]] vs .prototype ---");

console.log("Person.prototype:", Person.prototype);  // Object with greet method

// alice doesn't have .prototype (only functions do)
console.log("alice.prototype:", alice.prototype);    // undefined

// alice has [[Prototype]] (all objects do)
console.log("alice.[[Prototype]]:", Object.getPrototypeOf(alice));

/**
 * CRITICAL DISTINCTION:
 * 
 * .prototype:
 * - Property on FUNCTIONS
 * - Holds the object that becomes [[Prototype]] of instances
 * - Person.prototype is the object with greet method
 * 
 * [[Prototype]]:
 * - Internal link on ALL OBJECTS
 * - Points to the object this object inherits from
 * - alice.[[Prototype]] points to Person.prototype
 * 
 * MNEMONIC:
 * - .prototype: "What will my instances inherit from?"
 * - [[Prototype]]: "What do I inherit from?"
 */

// SCENARIO 4: Multiple instances share prototype
console.log("\n--- Shared Prototype ---");

const bob = new Person("Bob");

console.log("alice.greet === bob.greet:", alice.greet === bob.greet);  // true!

/**
 * Both alice and bob have [[Prototype]] → Person.prototype
 * 
 * So alice.greet and bob.greet are THE SAME FUNCTION object.
 * 
 * Memory efficient: One function shared by all instances.
 */

// SCENARIO 5: Property lookup in action
console.log("\n--- Property Lookup Demonstration ---");

function Animal(name) {
    this.name = name;
}

Animal.prototype.type = "animal";

Animal.prototype.speak = function () {
    console.log(`${this.name} makes a sound`);
};

const dog = new Animal("Rex");

console.log("Accessing properties:");
console.log("  dog.name:", dog.name);           // Own property
console.log("  dog.type:", dog.type);           // From Animal.prototype
console.log("  dog.toString:", dog.toString);   // From Object.prototype

// Check where each property comes from
console.log("\nProperty locations:");
console.log("  dog.hasOwnProperty('name'):", dog.hasOwnProperty('name'));       // true
console.log("  dog.hasOwnProperty('type'):", dog.hasOwnProperty('type'));       // false
console.log("  dog.hasOwnProperty('toString'):", dog.hasOwnProperty('toString')); // false

/**
 * hasOwnProperty checks ONLY the object itself, not the chain.
 * 
 * name: on dog
 * type: on Animal.prototype
 * toString: on Object.prototype
 */

console.log("\n=== Key Insights ===");
console.log("✓ Every object has [[Prototype]] (internal link)");
console.log("✓ Only functions have .prototype (for new instances)");
console.log("✓ Property lookup walks the chain");
console.log("✓ All instances share the same prototype object");
console.log("✓ Chain ends at null");
