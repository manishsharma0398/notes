/**
 * Example 4: Private Fields and Modern Features
 */

console.log("=== Example 4: Modern Class Features ===\n");

// SCENARIO 1: Private fields
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
c.increment();
console.log("Count:", c.getCount());  // 2
// console.log(c.#count);  // SyntaxError

// SCENARIO 2: Public fields
class MyClass {
    x = 1;
    y = this.x + 1;

    constructor() {
        console.log("Fields initialized before constructor");
        console.log("x:", this.x, "y:", this.y);
    }
}

new MyClass();

// SCENARIO 3: Arrow function methods (preserve this)
class ClickHandler {
    count = 0;

    // Regular method (loses this when extracted)
    handleRegular() {
        this.count++;
    }

    // Arrow function (keeps this)
    handleArrow = () => {
        this.count++;
    }
}

const handler = new ClickHandler();

const regular = handler.handleRegular;
const arrow = handler.handleArrow;

// regular();  // Error: this is undefined
arrow();      // Works!
console.log("Arrow preserved this, count:", handler.count);

console.log("\n=== Summary ===");
console.log("✓ Private fields with #");
console.log("✓ Public fields initialized before constructor");
console.log("✓ Arrow functions preserve this binding");
