/**
 * Example 1: The new Operator
 * Demonstrates what happens when you use 'new'
 */

console.log("=== Example 1: new Operator ===\n");

// SCENARIO 1: Manual implementation of 'new'
console.log("--- What new Does ---");

function myNew(Constructor, ...args) {
    // 1. Create empty object
    const obj = {};

    // 2. Set prototype
    Object.setPrototypeOf(obj, Constructor.prototype);

    // 3. Call constructor with this = obj
    const result = Constructor.apply(obj, args);

    // 4. Return object (unless constructor returns object)
    return (typeof result === 'object' && result !== null) ? result : obj;
}

function Person(name) {
    this.name = name;
}

Person.prototype.greet = function () {
    console.log(`Hi, I'm ${this.name}`);
};

const alice = myNew(Person, "Alice");
alice.greet();  // "Hi, I'm Alice"

console.log("alice instanceof Person:", alice instanceof Person);  // true

// SCENARIO 2: Constructor return override
console.log("\n--- Constructor Return Override ---");

function ReturnsObject() {
    this.x = 1;
    return { y: 2 };  // Override!
}

const obj1 = new ReturnsObject();
console.log("obj1:", obj1);  // { y: 2 }
console.log("obj1.x:", obj1.x);  // undefined

function ReturnsPrimitive() {
    this.x = 1;
    return 42;  // Ignored
}

const obj2 = new ReturnsPrimitive();
console.log("obj2:", obj2);  // { x: 1 }

console.log("\n=== Key Insights ===");
console.log("✓ new creates object with correct prototype");
console.log("✓ Constructor can override return value with object");
console.log("✓ Returning primitive is ignored");
