/**
 * Example 3: Prototype Inheritance
 * Demonstrates how to set up inheritance using prototypes
 */

console.log("=== Example 3: Prototype Inheritance ===\n");

// SCENARIO 1: Basic inheritance setup
console.log("--- Setting Up Inheritance ---");

// Parent constructor
function Animal(name) {
    this.name = name;
}

Animal.prototype.eat = function () {
    console.log(`${this.name} is eating`);
};

Animal.prototype.sleep = function () {
    console.log(`${this.name} is sleeping`);
};

// Child constructor
function Dog(name, breed) {
    Animal.call(this, name);  // Call parent constructor
    this.breed = breed;
}

// CRITICAL: Set up prototype chain BEFORE adding methods
Dog.prototype = Object.create(Animal.prototype);

// CRITICAL: Restore constructor reference
Dog.prototype.constructor = Dog;

// Add child-specific methods
Dog.prototype.bark = function () {
    console.log(`${this.name} barks: Woof!`);
};

const rex = new Dog("Rex", "Labrador");

rex.eat();   // From Animal.prototype
rex.bark();  // From Dog.prototype
rex.sleep(); // From Animal.prototype

/**
 * PROTOTYPE CHAIN for rex:
 * 
 * rex
 *   name: "Rex"
 *   breed: "Labrador"
 *   [[Prototype]] → Dog.prototype
 *                     bark: function
 *                     constructor: Dog
 *                     [[Prototype]] → Animal.prototype
 *                                       eat: function
 *                                       sleep: function
 *                                       [[Prototype]] → Object.prototype
 *                                                         toString: function
 *                                                         [[Prototype]] → null
 * 
 * STEPS TO SET UP INHERITANCE:
 * 
 * 1. Dog.prototype = Object.create(Animal.prototype)
 *    - Creates new object with [[Prototype]] = Animal.prototype
 *    - Assigns it to Dog.prototype
 * 
 * 2. Dog.prototype.constructor = Dog
 *    - Restores constructor reference
 *    - Without this, Dog.prototype.constructor would be Animal
 * 
 * 3. Add methods to Dog.prototype AFTER setting up chain
 */

// Verify the chain
console.log("\nVerifying inheritance:");
console.log("rex instanceof Dog:", rex instanceof Dog);           // true
console.log("rex instanceof Animal:", rex instanceof Animal);     // true
console.log("rex instanceof Object:", rex instanceof Object);     // true

// SCENARIO 2: Why Object.create() is used
console.log("\n--- Why Object.create()? ---");

// WRONG way (don't do this):
function Bird() { }
function Sparrow() { }

// Sparrow.prototype = Bird.prototype;  // WRONG: Same object, not a chain!

// With assignment (WRONG):
// Sparrow.prototype and Bird.prototype are THE SAME OBJECT
// Adding to Sparrow.prototype also adds to Bird.prototype!

// CORRECT way:
Sparrow.prototype = Object.create(Bird.prototype);
// Now Sparrow.prototype is a NEW object with [[Prototype]] = Bird.prototype

/**
 * Object.create(proto) does:
 * 1. Create new empty object
 * 2. Set its [[Prototype]] to proto
 * 3. Return the object
 * 
 * This creates a CHAIN, not a shared reference.
 */

// SCENARIO 3: Multiple levels of inheritance
console.log("\n--- Multi-Level Inheritance ---");

function LivingThing() {
    this.alive = true;
}

LivingThing.prototype.breathe = function () {
    console.log("Breathing...");
};

function Mammal(name) {
    LivingThing.call(this);
    this.name = name;
}

Mammal.prototype = Object.create(LivingThing.prototype);
Mammal.prototype.constructor = Mammal;

Mammal.prototype.warmBlooded = function () {
    return true;
};

function Cat(name, breed) {
    Mammal.call(this, name);
    this.breed = breed;
}

Cat.prototype = Object.create(Mammal.prototype);
Cat.prototype.constructor = Cat;

Cat.prototype.meow = function () {
    console.log(`${this.name} meows`);
};

const whiskers = new Cat("Whiskers", "Siamese");

whiskers.breathe();      // From LivingThing.prototype
console.log("Warm blooded:", whiskers.warmBlooded());  // From Mammal.prototype
whiskers.meow();         // From Cat.prototype

/**
 * CHAIN:
 * 
 * whiskers → Cat.prototype → Mammal.prototype → LivingThing.prototype → Object.prototype → null
 * 
 * Property lookup walks the entire chain.
 */

console.log("\nMulti-level instanceof:");
console.log("whiskers instanceof Cat:", whiskers instanceof Cat);                       // true
console.log("whiskers instanceof Mammal:", whiskers instanceof Mammal);                 // true
console.log("whiskers instanceof LivingThing:", whiskers instanceof LivingThing);       // true
console.log("whiskers instanceof Object:", whiskers instanceof Object);                 // true

// SCENARIO 4: Calling parent methods
console.log("\n--- Calling Parent Methods ---");

function Vehicle(type) {
    this.type = type;
}

Vehicle.prototype.describe = function () {
    return `This is a ${this.type}`;
};

function Car(type, brand) {
    Vehicle.call(this, type);
    this.brand = brand;
}

Car.prototype = Object.create(Vehicle.prototype);
Car.prototype.constructor = Car;

// Override parent method
Car.prototype.describe = function () {
    // Call parent method
    const baseDescription = Vehicle.prototype.describe.call(this);
    return `${baseDescription}, brand: ${this.brand}`;
};

const myCar = new Car("sedan", "Toyota");
console.log(myCar.describe());  // "This is a sedan, brand: Toyota"

/**
 * To call parent method from child:
 * ParentConstructor.prototype.methodName.call(this, ...args)
 * 
 * This ensures 'this' is the current instance.
 */

// SCENARIO 5: Checking prototype relationships
console.log("\n--- Checking Relationships ---");

console.log("Prototype checks:");
console.log("  Dog.prototype.isPrototypeOf(rex):", Dog.prototype.isPrototypeOf(rex));           // true
console.log("  Animal.prototype.isPrototypeOf(rex):", Animal.prototype.isPrototypeOf(rex));     // true
console.log("  Object.prototype.isPrototypeOf(rex):", Object.prototype.isPrototypeOf(rex));     // true

console.log("\nGetting prototypes:");
console.log("  Object.getPrototypeOf(rex) === Dog.prototype:",
    Object.getPrototypeOf(rex) === Dog.prototype);  // true
console.log("  Object.getPrototypeOf(Dog.prototype) === Animal.prototype:",
    Object.getPrototypeOf(Dog.prototype) === Animal.prototype);  // true

console.log("\n=== Inheritance Summary ===");
console.log("✓ Use Object.create() to set up chain");
console.log("✓ Restore constructor reference");
console.log("✓ Call parent constructor with .call(this)");
console.log("✓ Add child methods AFTER setting up chain");
console.log("✓ Can have multiple levels of inheritance");
console.log("✓ Call parent methods using ParentConstructor.prototype.method.call(this)");
