/**
 * Example 1: Call Stack Visualization
 * Demonstrates how the call stack grows and shrinks with function calls
 */

console.log("=== Example 1: Call Stack Visualization ===\n");

// Helper function to show current call stack depth
function showStack(label) {
    const err = new Error();
    const stack = err.stack.split('\n').length - 2;  // Approximate depth
    console.log(`[${label}] Approx stack depth: ${stack}`);
}

function third() {
    showStack("Inside third()");
    console.log("Executing third()");
}

function second() {
    showStack("Inside second()");
    console.log("Executing second()");
    third();
    console.log("Back in second() after third()");
}

function first() {
    showStack("Inside first()");
    console.log("Executing first()");
    second();
    console.log("Back in first() after second()");
}

showStack("Global scope");
first();
showStack("Back in global after first()");

/**
 * EXECUTION BREAKDOWN:
 * 
 * Call Stack Evolution:
 * 
 * 1. [Global] - Script starts
 * 2. [Global, first] - first() called
 * 3. [Global, first, second] - second() called from first()
 * 4. [Global, first, second, third] - third() called from second()
 * 5. [Global, first, second] - third() returns
 * 6. [Global, first] - second() returns
 * 7. [Global] - first() returns
 * 
 * MEMORY STATE TRACKING:
 * 
 * When third() is executing:
 * - Global context: { showStack: <fn>, third: <fn>, second: <fn>, first: <fn> }
 * - first() context: { (empty - no local variables) }
 * - second() context: { (empty - no local variables) }
 * - third() context: { (empty - no local variables) }
 * 
 * Each function has its own execution context, even if it has no variables.
 * The showStack() calls create temporary contexts that are immediately destroyed.
 * 
 * KEY INSIGHTS:
 * 
 * 1. The call stack grows with each function call
 * 2. Functions "wait" on the stack until inner functions return
 * 3. Stack depth indicates how many nested function calls are active
 * 4. Each function returns to where it was called from
 */

console.log("\n=== Call Stack Order ===");
console.log("When third() executes, the call stack contains:");
console.log("- Global Execution Context (bottom)");
console.log("- first() Execution Context");
console.log("- second() Execution Context");
console.log("- third() Execution Context (top)");
console.log("\nLIFO: Last In (third), First Out (third returns first)");
