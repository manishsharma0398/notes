/**
 * Example 3: Common this Pitfalls
 * Demonstrates typical bugs and how to fix them
 */

console.log("=== Example 3: Common this Pitfalls ===\n");

// PITFALL 1: Losing this in callbacks
console.log("--- Pitfall 1: Lost this in Callback ---");

const user = {
    name: "Alice",
    greet: function () {
        console.log("Hello, I'm", this.name);
    }
};

// Works fine
user.greet();  // "Hello, I'm Alice"

// But in setTimeout...
setTimeout(user.greet, 100);  // "Hello, I'm undefined"

/**
 * PROBLEM:
 * 
 * setTimeout receives the FUNCTION, not the call.
 * It calls: user.greet() → NO, it calls greet() standalone
 * 
 * Call-site: greet() (default binding)
 * this = global/undefined
 * 
 * FIXES:
 */

// Fix 1: Arrow wrapper
setTimeout(() => user.greet(), 150);

// Fix 2: .bind()
setTimeout(user.greet.bind(user), 200);

// PITFALL 2: Method extraction
console.log("\n--- Pitfall 2: Method Extraction ---");

const calculator = {
    value: 10,
    add: function (n) {
        this.value += n;
        return this.value;
    }
};

// Works
console.log("Direct call:", calculator.add(5));  // 15

// Extracted method
const addFn = calculator.add;
try {
    console.log("Extracted:", addFn(5));  // Error or wrong result
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * PROBLEM:
 * 
 * addFn is just the function, no connection to calculator.
 * Call-site: addFn(5) → default binding
 * this = undefined (strict mode)
 * 
 * FIX: Bind it
 */

const boundAdd = calculator.add.bind(calculator);
setTimeout(() => {
    console.log("Bound:", boundAdd(3));
}, 250);

// PITFALL 3: Array methods callbacks
console.log("\n--- Pitfall 3: Array Methods ---");

const obj = {
    multiplier: 2,
    multiplyAll: function (numbers) {
        // WRONG: regular function
        return numbers.map(function (n) {
            return n * this.multiplier;  // this = undefined!
        });
    },

    multiplyAllCorrect: function (numbers) {
        // FIX 1: Arrow function
        return numbers.map(n => n * this.multiplier);
    },

    multiplyAllBind: function (numbers) {
        // FIX 2: .bind()
        return numbers.map(function (n) {
            return n * this.multiplier;
        }.bind(this));
    }
};

try {
    console.log("Wrong:", obj.multiplyAll([1, 2, 3]));
} catch (e) {
    console.log("Error:", e.message);
}

console.log("Arrow:", obj.multiplyAllCorrect([1, 2, 3]));  // [2, 4, 6]
console.log("Bind:", obj.multiplyAllBind([1, 2, 3]));      // [2, 4, 6]

/**
 * Array methods (map, forEach, filter, etc.) call callbacks as standalone.
 * Regular function → default binding → this = undefined
 * 
 * FIXES:
 * 1. Arrow function (inherits this)
 * 2. .bind(this)
 * 3. Use thisArg parameter (some methods have it)
 */

// PITFALL 4: Event handlers
console.log("\n--- Pitfall 4: Event Handlers ---");

const button = {
    label: "Click Me",
    click: function () {
        console.log("Button clicked:", this.label);
    }
};

// Simulating element.addEventListener
function addEventListener(callback) {
    // In real DOM, this would be the element
    callback.call({ label: "DOM Element" });
}

// WRONG: loses this
addEventListener(button.click);  // "Button clicked: DOM Element"

// FIX: Bind
addEventListener(button.click.bind(button));

/**
 * Event handlers set this to the DOM element.
 * If you want the original object, use .bind()
 */

// PITFALL 5: Nested functions
console.log("\n--- Pitfall 5: Nested Functions ---");

const obj2 = {
    value: 42,
    outer: function () {
        console.log("outer this.value:", this.value);  // 42

        function inner() {
            console.log("inner this.value:", this.value);  // undefined
        }

        inner();  // Standalone call → default binding
    },

    outerFixed: function () {
        console.log("outerFixed this.value:", this.value);

        const inner = () => {
            console.log("arrow inner this.value:", this.value);  // 42
        };

        inner();
    }
};

obj2.outer();
obj2.outerFixed();

/**
 * PROBLEM:
 * 
 * inner() is called standalone (not as obj2.inner()).
 * this = global/undefined
 * 
 * FIX: Use arrow function (inherits this from outer)
 */

// PITFALL 6: Class method callbacks
console.log("\n--- Pitfall 6: Class Methods ---");

class Counter {
    constructor() {
        this.count = 0;
    }

    increment() {
        this.count++;
        console.log("Count:", this.count);
    }
}

const counter = new Counter();

// Works
counter.increment();  // Count: 1

// Extracted (e.g., in event handler)
const inc = counter.increment;
setTimeout(() => {
    try {
        inc();  // Error: this = undefined (classes use strict mode)
    } catch (e) {
        console.log("Error:", e.message);
    }
}, 300);

/**
 * PROBLEM:
 * 
 * Class methods run in strict mode.
 * inc() call → default binding → this = undefined
 * 
 * FIXES:
 */

class CounterFixed {
    constructor() {
        this.count = 0;
        // Bind in constructor
        this.increment = this.increment.bind(this);
    }

    increment() {
        this.count++;
        console.log("Fixed count:", this.count);
    }
}

// Or: Use arrow function field
class CounterArrow {
    count = 0;

    // Arrow function field (not in prototype)
    increment = () => {
        this.count++;
        console.log("Arrow count:", this.count);
    };
}

const counter2 = new CounterFixed();
const inc2 = counter2.increment;
setTimeout(inc2, 350);  // Works!

console.log("\n=== Pitfalls Summary ===");
console.log("✓ Callbacks lose this → use arrow or .bind()");
console.log("✓ Method extraction loses this → .bind() it");
console.log("✓ Array methods → use arrow or .bind()");
console.log("✓ Event handlers change this → .bind() if needed");
console.log("✓ Nested functions don't inherit this → use arrow");
console.log("✓ Class methods in callbacks → bind in constructor or use arrow fields");
