/**
 * Example 1: ToPrimitive in Action
 * Demonstrates how ToPrimitive converts objects to primitives
 */

console.log("=== Example 1: ToPrimitive ===\n");

// SCENARIO 1: valueOf vs toString priority
console.log("--- valueOf vs toString ---");

const obj1 = {
    valueOf() {
        console.log("valueOf called");
        return 10;
    },
    toString() {
        console.log("toString called");
        return "20";
    }
};

// Numeric context: valueOf first
console.log("obj1 + 5:");
const result1 = obj1 + 5;
console.log("Result:", result1);

// String context: toString first
console.log("\nString(obj1):");
const result2 = String(obj1);
console.log("Result:", result2);

/**
 * TOPRIMITIVE ALGORITHM:
 * 
 * obj1 + 5 (numeric context):
 * 1. ToPrimitive(obj1, "number")
 * 2. Try valueOf() first → returns 10
 * 3. 10 + 5 = 15
 * 
 * String(obj1) (string context):
 * 1. ToPrimitive(obj1, "string")
 * 2. Try toString() first → returns "20"
 * 3. Result: "20"
 */

// SCENARIO 2: Only valueOf
console.log("\n--- Only valueOf Defined ---");

const obj2 = {
    valueOf() {
        console.log("valueOf called");
        return 42;
    }
};

console.log("obj2 + 0:", obj2 + 0);
console.log("String(obj2):", String(obj2));

/**
 * When toString is missing:
 * - Numeric context: uses valueOf → 42
 * - String context: tries toString (missing) → uses valueOf → 42
 */

// SCENARIO 3: Symbol.toPrimitive (modern way)
console.log("\n--- Symbol.toPrimitive ---");

const obj3 = {
    [Symbol.toPrimitive](hint) {
        console.log(`Symbol.toPrimitive called with hint: "${hint}"`);

        if (hint === "number") return 100;
        if (hint === "string") return "custom string";
        return "default";
    }
};

console.log("\nNumeric:");
console.log(+obj3);  // Unary + → number hint

console.log("\nString:");
console.log(`${obj3}`);  // Template literal → string hint

console.log("\nDefault:");
console.log(obj3 + "");  // Ambiguous → default hint

/**
 * Symbol.toPrimitive OVERRIDES valueOf/toString.
 * It receives a hint: "number", "string", or "default"
 */

// SCENARIO 4: ToPrimitive failures
console.log("\n--- ToPrimitive Failure ---");

const obj4 = {
    valueOf() {
        return {};  // Returns object, not primitive
    },
    toString() {
        return {};  // Also returns object
    }
};

try {
    console.log(obj4 + 5);
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * Both valueOf and toString return objects → TypeError
 * ToPrimitive MUST return a primitive or throw.
 */

console.log("\n=== ToPrimitive Summary ===");
console.log("✓ valueOf first for numeric contexts");
console.log("✓ toString first for string contexts");
console.log("✓ Symbol.toPrimitive overrides both");
console.log("✓ Must return primitive or throw TypeError");
