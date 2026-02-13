/**
 * Example 4: Edge Cases and Advanced Scenarios
 * Demonstrates subtle this behaviors
 */

console.log("=== Example 4: Edge Cases ===\n");

// EDGE CASE 1: new with explicit return
console.log("--- new with Return Value ---");

function ConstructorReturn(value) {
    this.value = value;

    // Returning primitive → ignored
    return 42;
}

const obj1 = new ConstructorReturn(10);
console.log("obj1.value:", obj1.value);  // 10 (primitive return ignored)

function ConstructorReturnObject(value) {
    this.value = value;

    // Returning object → used instead of this
    return { value: "override" };
}

const obj2 = new ConstructorReturnObject(10);
console.log("obj2.value:", obj2.value);  // "override"

/**
 * RULE:
 * 
 * If constructor returns an OBJECT, that's returned.
 * If constructor returns a PRIMITIVE (or nothing), return this.
 * 
 * this binding is created, but may be discarded.
 */

// EDGE CASE 2: null/undefined in .call/.apply
console.log("\n--- null/undefined in Explicit Binding ---");

function showThis() {
    console.log("this:", this);
}

showThis.call(null);      // global (non-strict) or null (strict)
showThis.call(undefined); // global (non-strict) or undefined (strict)

/**
 * When you pass null/undefined to .call/.apply:
 * 
 * Non-strict: this = global object
 * Strict: this = null/undefined (as-is)
 * 
 * GOTCHA: Passing null for "no this" can accidentally expose global!
 * 
 * SAFER: Use Object.create(null) if you need a truly empty this
 */

// EDGE CASE 3: Hard binding can't be overridden
console.log("\n--- Hard Binding Override Attempt ---");

function test() {
    console.log("this.value:", this.value);
}

const obj3 = { value: 1 };
const obj4 = { value: 2 };

const bound = test.bind(obj3);

// Try to override with .call
bound.call(obj4);  // Still 1 (bind wins)

// Try to override with new
const instance = new bound();  // undefined (new object has no value)

/**
 * .bind() creates HARD binding.
 * .call/.apply can't override it.
 * 
 * BUT: new is the only thing that can override .bind()
 */

// EDGE CASE 4: this in getter/setter
console.log("\n--- this in Getters/Setters ---");

const obj5 = {
    _value: 10,

    get value() {
        console.log("getter this:", this);
        return this._value;
    },

    set value(v) {
        console.log("setter this:", this);
        this._value = v;
    }
};

console.log("Get:", obj5.value);  // this = obj5
obj5.value = 20;                  // this = obj5

/**
 * Getters/setters follow implicit binding.
 * obj5.value → this = obj5
 */

// EDGE CASE 5: this in Object literals
console.log("\n--- this in Object Literals ---");

const obj6 = {
    name: "obj6",

    // this in property value (WRONG!)
    // value: this.name,  // this = ???

    method: function () {
        console.log("method this.name:", this.name);
    }
};

// obj6.value would be undefined (this = global at object creation time)

/**
 * In object literals, this in property values = global (not the object).
 * Object doesn't exist yet when properties are evaluated.
 * 
 * Use methods, not property values with this.
 */

// EDGE CASE 6: Arrow in prototype
console.log("\n--- Arrow in Prototype (Anti-pattern) ---");

function Person(name) {
    this.name = name;
}

// DON'T do this
Person.prototype.greet = () => {
    console.log("Hello", this.name);  // this = global (where arrow was defined)
};

const alice = new Person("Alice");
alice.greet();  // "Hello undefined"

/**
 * Arrow on prototype inherits this from where it's DEFINED (global).
 * NOT from the instance.
 * 
 * Always use regular functions for prototype methods.
 */

// EDGE CASE 7: Indirect function invocation
console.log("\n--- Indirect Invocation ---");

const obj7 = {
    value: 7,
    getValue: function () {
        return this.value;
    }
};

console.log("Direct:", obj7.getValue());  // 7

// Indirect through ()
console.log("Indirect:", (obj7.getValue)());  // 7 (still works)

// Assignment and call
console.log("Assignment:", (0, obj7.getValue)());  // undefined (default binding)

/**
 * (obj7.getValue) preserves the reference.
 * (0, obj7.getValue) uses comma operator, returns function value (no binding).
 * 
 * Subtle but important for understanding this binding.
 */

// EDGE CASE 8: this with destructuring
console.log("\n--- Destructuring Method ---");

const obj8 = {
    value: 8,
    getValue: function () {
        return this.value;
    }
};

const { getValue } = obj8;
try {
    console.log("Destructured:", getValue());  // undefined or error
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * Destructuring extracts the function VALUE, losing the binding.
 * Same as: const getValue = obj8.getValue
 * 
 * Call-site: getValue() → default binding
 */

// EDGE CASE 9: this in setTimeout/setInterval
console.log("\n--- setTimeout this ---");

const obj9 = {
    value: 9,
    delayed: function () {
        setTimeout(function () {
            console.log("setTimeout this.value:", this.value);  // undefined
        }, 100);

        setTimeout(() => {
            console.log("setTimeout arrow this.value:", this.value);  // 9
        }, 150);
    }
};

obj9.delayed();

/**
 * setTimeout calls function standalone → default binding.
 * Use arrow to preserve this.
 */

// EDGE CASE 10: eval and this
console.log("\n--- eval and this ---");

const obj10 = {
    value: 10,
    test: function () {
        eval("console.log('eval this.value:', this.value)");
    }
};

obj10.test();  // 10

/**
 * eval inherits this from surrounding scope.
 * Since it's in test(), and test was called as obj10.test(),
 * this = obj10
 * 
 * (Don't use eval in production!)
 */

console.log("\n=== Edge Cases Summary ===");
console.log("✓ Constructor return object → overrides this");
console.log("✓ null/undefined in .call → global (non-strict) or as-is (strict)");
console.log("✓ .bind() can't be overridden (except by new)");
console.log("✓ Getters/setters follow implicit binding");
console.log("✓ this in object literals → global (not the object)");
console.log("✓ Arrows on prototypes → wrong this");
console.log("✓ Destructuring loses binding");
