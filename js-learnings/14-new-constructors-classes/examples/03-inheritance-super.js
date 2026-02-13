/**
 * Example 3: Class Inheritance and super
 */

console.log("=== Example 3: Inheritance ===\n");

// SCENARIO 1: Basic inheritance
class Animal {
    constructor(name) {
        this.name = name;
        console.log(`Animal constructor: ${name}`);
    }

    speak() {
        console.log(`${this.name} makes a sound`);
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);  // MUST call before using 'this'
        this.breed = breed;
        console.log(`Dog constructor: ${breed}`);
    }

    speak() {
        console.log(`${this.name} barks`);
    }

    parentSpeak() {
        super.speak();  // Call parent method
    }
}

const rex = new Dog("Rex", "Labrador");
rex.speak();        // "Rex barks"
rex.parentSpeak();  // "Rex makes a sound"

// SCENARIO 2: Static inheritance
console.log("\n--- Static Inheritance ---");

class Parent {
    static greeting() {
        return "Hello from Parent";
    }
}

class Child extends Parent {
    static greeting() {
        return super.greeting() + " and Child";
    }
}

console.log(Child.greeting());  // "Hello from Parent and Child"

console.log("\n=== Summary ===");
console.log("✓ extends sets up prototype chain");
console.log("✓ super() calls parent constructor");
console.log("✓ super.method() calls parent method");
console.log("✓ Static methods are also inherited");
