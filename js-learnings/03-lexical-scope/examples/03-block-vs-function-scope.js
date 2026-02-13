/**
 * Example 3: Block Scope vs Function Scope
 * Demonstrates the difference between var (function-scoped) and let/const (block-scoped)
 */

console.log("=== Example 3: Block Scope vs Function Scope ===\n");

// SCENARIO 1: var is function-scoped
console.log("--- var (function-scoped) ---");

function testVar() {
    console.log("Before if block, x:", typeof x);  // undefined (hoisted)

    if (true) {
        var x = 10;
        console.log("Inside if block, x:", x);     // 10
    }

    console.log("After if block, x:", x);          // 10 (leaked out)
}

testVar();

/**
 * EXPLANATION:
 * 
 * var is FUNCTION-SCOPED, not BLOCK-SCOPED
 * 
 * Creation phase:
 * - var x is hoisted to function scope
 * - x is initialized to undefined
 * 
 * Execution:
 * - Line 11: x is undefined (hoisted but not assigned)
 * - Line 14: x is assigned 10 (the if block doesn't create new scope for var)
 * - Line 18: x is still 10 (it's in function scope, not block scope)
 * 
 * The if block DOES NOT create a scope boundary for var.
 */

// SCENARIO 2: let is block-scoped
console.log("\n--- let (block-scoped) ---");

function testLet() {
    // console.log("Before if block, y:", y);  // ReferenceError: Cannot access before initialization

    if (true) {
        let y = 20;
        console.log("Inside if block, y:", y);     // 20
    }

    // console.log("After if block, y:", y);      // ReferenceError: y is not defined
    console.log("After if block, y is not accessible");
}

testLet();

/**
 * EXPLANATION:
 * 
 * let is BLOCK-SCOPED
 * 
 * The if block CREATES a new scope for y
 * 
 * Scope structure:
 * ┌─────────────────────┐
 * │ testLet() scope     │
 * │ { (no y here) }     │
 * │   ┌─────────────┐   │
 * │   │ if block    │   │
 * │   │ { y: 20 }   │   │
 * │   └─────────────┘   │
 * └─────────────────────┘
 * 
 * y exists ONLY inside the if block.
 * Outside the block, y doesn't exist at all.
 */

// SCENARIO 3: Loop scope differences
console.log("\n--- Loop Scope Differences ---");

console.log("var in loop:");
for (var i = 0; i < 3; i++) {
    // var i is in function/global scope
}
console.log("After loop, i:", i);  // 3 (leaked out)

console.log("\nlet in loop:");
for (let j = 0; j < 3; j++) {
    // let j is in block scope (each iteration gets its own j)
}
// console.log("After loop, j:", j);  // ReferenceError
console.log("After loop, j is not accessible");

/**
 * CRITICAL DIFFERENCE FOR CLOSURES:
 * 
 * var in loop - ALL closures share the SAME variable
 */
console.log("\n--- var in loop with closures ---");

let varFunctions = [];
for (var k = 0; k < 3; k++) {
    varFunctions.push(function () {
        console.log("var k:", k);
    });
}

console.log("Calling var functions:");
varFunctions[0]();  // 3
varFunctions[1]();  // 3
varFunctions[2]();  // 3

/**
 * All log 3 because:
 * 1. var k is in the SAME SCOPE for all iterations
 * 2. All three functions close over the SAME k
 * 3. By the time they run, the loop has finished and k = 3
 */

/**
 * let in loop - EACH closure gets its OWN variable
 */
console.log("\n--- let in loop with closures ---");

let letFunctions = [];
for (let m = 0; m < 3; m++) {
    letFunctions.push(function () {
        console.log("let m:", m);
    });
}

console.log("Calling let functions:");
letFunctions[0]();  // 0
letFunctions[1]();  // 1
letFunctions[2]();  // 2

/**
 * Each logs its own value because:
 * 1. let m creates a NEW binding for EACH iteration
 * 2. Each function closes over a DIFFERENT m
 * 3. Each m retains its value from that iteration
 * 
 * Scope structure (simplified):
 * 
 * Iteration 0: { m: 0 } → function closes over this m
 * Iteration 1: { m: 1 } → function closes over this m
 * Iteration 2: { m: 2 } → function closes over this m
 */

// SCENARIO 4: Multiple block scopes
console.log("\n--- Nested Block Scopes ---");

{
    let x = "outer block";
    console.log("Outer block x:", x);

    {
        let x = "inner block";  // Different x (shadowing)
        console.log("Inner block x:", x);
    }

    console.log("Back to outer block x:", x);
}

// console.log("Outside blocks, x:", x);  // ReferenceError

/**
 * SCOPE STRUCTURE:
 * 
 * ┌─────────────────────────┐
 * │ Global scope            │
 * │                         │
 * │ ┌─────────────────────┐ │
 * │ │ Outer block         │ │
 * │ │ { x: "outer block" }│ │
 * │ │                     │ │
 * │ │ ┌─────────────────┐ │ │
 * │ │ │ Inner block     │ │ │
 * │ │ │ { x: "inner..." }│ │ │
 * │ │ └─────────────────┘ │ │
 * │ └─────────────────────┘ │
 * └─────────────────────────┘
 * 
 * Each block creates its own scope.
 * Inner x SHADOWS outer x.
 */

console.log("\n=== Key Takeaway ===");
console.log("✓ var: function-scoped, ignores blocks");
console.log("✓ let/const: block-scoped, respects any {}");
console.log("✓ For loops: let creates new binding per iteration");
console.log("✓ This affects closures significantly");
