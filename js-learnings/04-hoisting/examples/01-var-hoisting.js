/**
 * Example 1: var Hoisting
 * Demonstrates how var declarations are hoisted and initialized to undefined
 */

console.log("=== Example 1: var Hoisting ===\n");

console.log("Before declaration, x:", x);  // undefined (not ReferenceError)
var x = 10;
console.log("After assignment, x:", x);    // 10

/**
 * COMPILATION PHASE:
 * 
 * The engine sees:
 * - Line 7: var x declaration
 * 
 * Scope registry after compilation:
 * {
 *   x: undefined  ← Hoisted and initialized
 * }
 * 
 * EXECUTION PHASE:
 * 
 * Line 7: console.log(x)
 *   → Look up x in scope → Found: undefined
 *   → Logs: "Before declaration, x: undefined"
 * 
 * Line 8: x = 10
 *   → Assign 10 to x
 *   → x is now 10
 * 
 * Line 9: console.log(x)
 *   → Look up x → Found: 10
 *   → Logs: "After assignment, x: 10"
 * 
 * KEY INSIGHT:
 * 
 * The DECLARATION is processed during compilation (hoisted).
 * The ASSIGNMENT happens during execution.
 * 
 * Mentally, you can think of it like this:
 * 
 * var x;              // ← Compilation phase (hoisted)
 * console.log(x);     // ← Execution: undefined
 * x = 10;             // ← Execution: assignment
 * console.log(x);     // ← Execution: 10
 */

console.log("\n--- Multiple var Declarations ---");

console.log("a:", a);  // undefined
console.log("b:", b);  // undefined
var a = 1;
var b = 2;
console.log("a:", a);  // 1
console.log("b:", b);  // 2

/**
 * COMPILATION:
 * {
 *   a: undefined,
 *   b: undefined
 * }
 * 
 * Both are hoisted and initialized to undefined.
 */

console.log("\n--- var in Function Scope ---");

function test() {
    console.log("Inside function, y:", y);  // undefined
    var y = 20;
    console.log("After assignment, y:", y);  // 20
}

test();
// console.log("Outside function, y:", y);  // ReferenceError: y is not defined

/**
 * COMPILATION of test():
 * {
 *   y: undefined  ← Hoisted to FUNCTION scope
 * }
 * 
 * y is hoisted within test(), not globally.
 * Outside test(), y doesn't exist.
 */

console.log("\n--- var Hoisting with Shadowing ---");

var outerX = "outer";

function shadowTest() {
    console.log("Before inner declaration, outerX:", outerX);  // undefined!
    var outerX = "inner";
    console.log("After assignment, outerX:", outerX);          // "inner"
}

shadowTest();
console.log("Global outerX:", outerX);  // "outer"

/**
 * WHY does line 82 log undefined, not "outer"?
 * 
 * COMPILATION of shadowTest():
 * {
 *   outerX: undefined  ← Local outerX hoisted
 * }
 * 
 * The local 'var outerX' is hoisted to the top of shadowTest().
 * It SHADOWS the global outerX.
 * 
 * At line 82, the local outerX exists but is still undefined.
 * The scope chain stops at the local outerX; never checks global.
 * 
 * This is a common bug!
 */
