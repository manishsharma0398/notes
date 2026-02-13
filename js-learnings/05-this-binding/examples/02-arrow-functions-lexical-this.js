/**
 * Example 2: Arrow Functions and Lexical this
 * Demonstrates how arrow functions inherit this from enclosing scope
 */

console.log("=== Example 2: Arrow Functions and Lexical this ===\n");

// SCENARIO 1: Arrow function inherits this
console.log("--- Arrow Function Inheriting this ---");

const obj = {
    name: "Object",
    value: 42,

    regularMethod: function () {
        console.log("regularMethod this.name:", this.name);

        // Arrow function inherits this from regularMethod
        const arrow = () => {
            console.log("arrow this.name:", this.name);
        };

        arrow();
    }
};

obj.regularMethod();

/**
 * EXPLANATION:
 * 
 * regularMethod this = obj (implicit binding)
 * arrow this = inherited from regularMethod = obj
 * 
 * Arrow functions DON'T have their own this.
 * They use this from the enclosing lexical scope.
 */

// SCENARIO 2: Arrow as object method (WRONG!)
console.log("\n--- Arrow Function as Method (Anti-pattern) ---");

const obj2 = {
    name: "Object2",

    // Arrow function as method
    arrowMethod: () => {
        console.log("arrowMethod this.name:", this.name);  // undefined
    }
};

obj2.arrowMethod();

/**
 * PROBLEM:
 * 
 * arrowMethod is defined in global scope (where obj2 is).
 * It inherits this from global scope.
 * this = global object (or undefined), NOT obj2
 * 
 * Implicit binding (obj2.arrowMethod) is IGNORED.
 * 
 * DON'T use arrow functions as object methods!
 */

// SCENARIO 3: Arrow in callbacks (GOOD!)
console.log("\n--- Arrow Function in Callbacks ---");

const counter = {
    count: 0,

    start: function () {
        console.log("Starting counter...");

        // Arrow function in setTimeout
        setTimeout(() => {
            this.count++;
            console.log("Count:", this.count);
        }, 100);

        // If we used regular function:
        // setTimeout(function() {
        //     this.count++;  // ERROR: this = global/undefined
        // }, 100);
    }
};

counter.start();

// Wait for callback
setTimeout(() => {
    console.log("Final count:", counter.count);
}, 200);

/**
 * WHY ARROW WORKS:
 * 
 * Arrow inherits this from start().
 * start() was called as counter.start() → this = counter
 * Arrow's this = counter
 * 
 * WHY REGULAR FUNCTION FAILS:
 * 
 * Regular function has its own this.
 * setTimeout calls it standalone → default binding
 * this = global/undefined
 */

// SCENARIO 4: Arrow functions ignore call/apply/bind
console.log("\n--- Arrow Ignores Explicit Binding ---");

const arrowFunction = () => {
    console.log("this.value:", this.value);
};

const obj3 = { value: 100 };

arrowFunction.call(obj3);   // Ignored
arrowFunction.apply(obj3);  // Ignored
arrowFunction.bind(obj3)(); // Ignored

/**
 * Arrow functions LOCK this at definition time.
 * You CANNOT change arrow's this with .call/.apply/.bind
 * 
 * this is determined by WHERE arrow is DEFINED,
 * not where it's CALLED.
 */

// SCENARIO 5: Nested arrow functions
console.log("\n--- Nested Arrow Functions ---");

const obj4 = {
    name: "Nested",

    outer: function () {
        console.log("outer this.name:", this.name);

        const arrow1 = () => {
            console.log("arrow1 this.name:", this.name);

            const arrow2 = () => {
                console.log("arrow2 this.name:", this.name);
            };

            arrow2();
        };

        arrow1();
    }
};

obj4.outer();

/**
 * SCOPE CHAIN FOR this:
 * 
 * outer() this = obj4 (implicit binding)
 * arrow1 this = inherited from outer = obj4
 * arrow2 this = inherited from arrow1 = obj4
 * 
 * All arrows inherit from the nearest REGULAR function's this.
 */

// SCENARIO 6: Arrow in class methods
console.log("\n--- Arrow in Class ---");

class MyClass {
    constructor() {
        this.value = "class instance";

        // Regular method
        this.regularMethod = function () {
            console.log("regularMethod this.value:", this.value);
        };

        // Arrow function as property
        this.arrowMethod = () => {
            console.log("arrowMethod this.value:", this.value);
        };
    }
}

const instance = new MyClass();

// Both work when called directly
instance.regularMethod();  // "class instance"
instance.arrowMethod();    // "class instance"

// Extract methods
const regular = instance.regularMethod;
const arrow = instance.arrowMethod;

// Regular loses this
setTimeout(() => {
    try {
        regular();  // undefined or error
    } catch (e) {
        console.log("regular() error:", e.message);
    }
}, 50);

// Arrow keeps this
setTimeout(() => {
    arrow();  // "class instance" - works!
}, 100);

/**
 * Arrow function defined in constructor inherits this from constructor.
 * constructor's this = instance (new binding)
 * Arrow's this = instance (permanently)
 * 
 * This is useful for event handlers and callbacks!
 */

console.log("\n=== Arrow Function Summary ===");
console.log("✓ Arrow functions don't have their own this");
console.log("✓ They inherit this from enclosing lexical scope");
console.log("✓ Don't use arrows as object methods");
console.log("✓ DO use arrows in callbacks to preserve this");
console.log("✓ Arrows ignore .call/.apply/.bind");
