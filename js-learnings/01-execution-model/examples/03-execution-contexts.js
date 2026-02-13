/**
 * Example 3: Execution Contexts
 * Demonstrates execution context creation during the execution phase
 */

console.log("=== Example 3: Execution Contexts ===\n");

let globalVar = "I'm global";

function outer() {
    let outerVar = "I'm in outer";
    console.log("Outer function executing");

    function inner() {
        let innerVar = "I'm in inner";
        console.log("Inner function executing");
        console.log("Accessing:", globalVar, outerVar, innerVar);
    }

    inner();
    console.log("Back in outer");
}

outer();
console.log("Back in global");

/**
 * STEP-BY-STEP EXECUTION:
 * 
 * COMPILATION PHASE (happens first for entire script):
 * 
 * Global Scope compiled:
 * - 'globalVar' registered (let - uninitialized)
 * - 'outer' registered as function
 * 
 * outer() Scope compiled (when outer is called):
 * - 'outerVar' registered (let - uninitialized)
 * - 'inner' registered as function
 * 
 * inner() Scope compiled (when inner is called):
 * - 'innerVar' registered (let - uninitialized)
 * 
 * ════════════════════════════════════════
 * 
 * EXECUTION PHASE:
 * 
 * Step 1: Global Execution Context created
 * Memory state:
 * {
 *   globalVar: <uninitialized>,
 *   outer: <function>
 * }
 * 
 * Step 2: Line 8 executes
 * globalVar assigned "I'm global"
 * Memory state:
 * {
 *   globalVar: "I'm global",
 *   outer: <function>
 * }
 * 
 * Step 3: Line 24 - outer() called
 * New Execution Context created for outer()
 * Call Stack: [Global, outer]
 * 
 * outer's Memory:
 * {
 *   outerVar: <uninitialized>,
 *   inner: <function>
 * }
 * 
 * Step 4: Line 11 executes
 * outerVar assigned "I'm in outer"
 * outer's Memory:
 * {
 *   outerVar: "I'm in outer",
 *   inner: <function>
 * }
 * 
 * Step 5: Line 12 - console.log
 * Output: "Outer function executing"
 * 
 * Step 6: Line 20 - inner() called
 * New Execution Context created for inner()
 * Call Stack: [Global, outer, inner]
 * 
 * inner's Memory:
 * {
 *   innerVar: <uninitialized>
 * }
 * 
 * Step 7: Line 15 executes
 * innerVar assigned "I'm in inner"
 * inner's Memory:
 * {
 *   innerVar: "I'm in inner"
 * }
 * 
 * Step 8: Line 16 - console.log
 * Output: "Inner function executing"
 * 
 * Step 9: Line 17 - console.log
 * Looks up variables:
 * - globalVar: checks inner scope → No → checks outer scope → No → checks global scope → Found!
 * - outerVar: checks inner scope → No → checks outer scope → Found!
 * - innerVar: checks inner scope → Found!
 * Output: "Accessing: I'm global I'm in outer I'm in inner"
 * 
 * Step 10: inner() returns
 * inner's Execution Context destroyed
 * Call Stack: [Global, outer]
 * 
 * Step 11: Line 21 - console.log
 * Output: "Back in outer"
 * 
 * Step 12: outer() returns
 * outer's Execution Context destroyed
 * Call Stack: [Global]
 * 
 * Step 13: Line 25 - console.log
 * Output: "Back in global"
 * 
 * Step 14: Script ends
 * Global Execution Context destroyed
 * Call Stack: []
 * 
 * ════════════════════════════════════════
 * 
 * KEY INSIGHTS:
 * 
 * 1. Each function call creates a NEW execution context
 * 2. Execution contexts are stacked (Call Stack)
 * 3. Variables are looked up through the scope chain
 * 4. When a function returns, its execution context is destroyed
 * 5. Compilation happens once per scope, execution creates contexts dynamically
 */
