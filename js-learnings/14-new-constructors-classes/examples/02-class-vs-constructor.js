/**
 * Example 2: Class Syntax vs Constructor Functions
 * Demonstrates that classes are syntactic sugar
 */

console.log("=== Example 2: Classes vs Constructors ===\n");

// SCENARIO 1: Constructor function
console.log("--- Constructor Function ---");

function PersonFunc(name, age) {
    this.name = name;
    this.age = age;
}

PersonFunc.prototype.greet = function () {
    console.log(`Hi, I'm ${this.name}`);
};

PersonFunc.species = function () {
    return "Homo sapiens";
};

const bob = new PersonFunc("Bob", 30);
bob.greet();

// SCENARIO 2: Equivalent class
console.log("\n--- Class Syntax ---");

class PersonClass {
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

const alice = new PersonClass("Alice", 25);
alice.greet();

// SCENARIO 3: Key differences
console.log("\n--- Key Differences ---");

// 1. Must use 'new' with class
try {
    PersonFunc("Test");  // Works (but wrong)
    console.log("Constructor without new: OK (but pollutes global)");
} catch (e) {
    console.log("Error:", e.message);
}

try {
    PersonClass("Test");  // Throws
} catch (e) {
    console.log("Class without new:", e.message);
}

// 2. Methods are non-enumerable in classes
console.log("\nConstructor methods enumerable:",
    Object.keys(PersonFunc.prototype));  // ["greet"]
console.log("Class methods enumerable:",
    Object.keys(PersonClass.prototype));  // []

console.log("\n=== Summary ===");
console.log("✓ Classes are syntactic sugar over constructors");
console.log("✓ Classes REQUIRE new");
console.log("✓ Class methods are non-enumerable");
