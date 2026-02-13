/**
 * Example 2: let/const and the Temporal Dead Zone (TDZ)
 * Demonstrates how let/const are hoisted but remain in TDZ
 */

console.log("=== Example 2: let/const and TDZ ===\n");

// console.log("Before declaration, x:", x);  // ReferenceError
let x = 10;
console.log("After declaration, x:", x);      // 10

/**
 * COMPILATION PHASE:
 * 
 * Scope registry:
 * {
 *   x: <uninitialized>  ← Hoisted but NOT initialized (TDZ)
 * }
 * 
 * EXECUTION PHASE:
 * 
 * If line 7 is uncommented:
 * - Try to access x → x exists in scope BUT is in TDZ
 * - ReferenceError: Cannot access 'x' before initialization
 * 
 * Line 8: let x = 10
 * - EXIT TDZ
 * - Initialize x to 10
 * 
 * Line 9: console.log(x)
 * - x is now accessible → 10
 * 
 * KEY DIFFERENCE FROM var:
 * 
 * var: Hoisted → initialized to undefined → accessible
 * let/const: Hoisted → stay in TDZ → inaccessible until declaration line
 */

console.log("--- const also has TDZ ---");

// console.log("y:", y);  // ReferenceError
const y = 20;
console.log("y:", y);     // 20

/**
 * const behaves exactly like let regarding TDZ.
 * The only difference: const can't be reassigned.
 */

console.log("\n--- TDZ in Block Scope ---");

let outer = "I'm outer";

{
    // The TDZ for 'outer' in THIS BLOCK starts here

    // console.log(outer);  // ReferenceError!

    let outer = "I'm inner";
    console.log("Inside block, outer:", outer);  // "I'm inner"
}

console.log("Outside block, outer:", outer);  // "I'm outer"

/**
 * CRITICAL INSIGHT:
 * 
 * The block-scoped 'let outer' creates a NEW binding.
 * This binding SHADOWS the outer 'let outer'.
 * 
 * The shadowing starts at the BEGINNING of the block,
 * not at the declaration line.
 * 
 * So even though there's an outer 'outer' that's initialized,
 * the inner 'outer' exists (in TDZ) and shadows it.
 * 
 * Accessing it before declaration → ReferenceError.
 */

console.log("\n--- typeof and TDZ ---");

console.log("typeof undeclared:", typeof undeclaredVariable);  // "undefined"

try {
    console.log("typeof z:", typeof z);  // ReferenceError
    let z = 30;
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * WEIRD BUT SPEC-COMPLIANT BEHAVIOR:
 * 
 * typeof undeclaredVariable: "undefined"
 * - Variable doesn't exist at all → typeof returns "undefined"
 * 
 * typeof z: ReferenceError
 * - z DOES exist (hoisted) but is in TDZ
 * - Accessing it (even with typeof) → ReferenceError
 * 
 * This is intentional! typeof can't be used to check for TDZ.
 */

console.log("\n--- TDZ in Function Parameters ---");

// This works:
function good(a = 1, b = a + 1) {
    console.log("good: a =", a, ", b =", b);
}
good();  // a = 1, b = 2

// This fails:
try {
    function bad(a = b, b = 2) {  // ReferenceError
        console.log("bad: a =", a, ", b =", b);
    }
    bad();
} catch (e) {
    console.log("Error:", e.message);
}

/**
 * PARAMETER TDZ:
 * 
 * Parameters are evaluated LEFT TO RIGHT.
 * Each parameter is in TDZ until it's initialized.
 * 
 * good(a = 1, b = a + 1):
 * 1. a = 1 → a exits TDZ
 * 2. b = a + 1 → a is available → b = 2
 * 
 * bad(a = b, b = 2):
 * 1. a = b → b is in TDZ → ReferenceError
 * 
 * You can't use a parameter that hasn't been initialized yet!
 */

console.log("\n--- const Must Be Initialized ---");

// var can be declared without initialization
var varValue;
console.log("varValue:", varValue);  // undefined

// let can be declared without initialization
let letValue;
console.log("letValue:", letValue);  // undefined

// const MUST be initialized
// const constValue;  // SyntaxError: Missing initializer in const declaration

/**
 * WHY?
 * 
 * const means "constant reference" - you can't reassign it.
 * If you could declare without initializing, when would you initialize?
 * You can't assign later (const can't be reassigned).
 * 
 * So const MUST be initialized at declaration.
 */

console.log("\n=== TDZ Summary ===");
console.log("✓ let/const are hoisted");
console.log("✓ They stay in TDZ until declaration line executes");
console.log("✓ Accessing in TDZ → ReferenceError");
console.log("✓ TDZ prevents bugs from accessing uninitialized variables");
console.log("✓ Even typeof throws ReferenceError in TDZ");
