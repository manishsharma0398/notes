/**
 * Example 3: Variable Environment vs Lexical Environment
 * Demonstrates how scope chain lookup works
 */

console.log("=== Example 3: Variable & Lexical Environments ===\n");

// Global variables
let globalVar = "I'm global";
const globalConst = "Global constant";

function outer() {
    let outerVar = "I'm in outer";
    const outerConst = "Outer constant";

    console.log("--- Inside outer() ---");
    console.log("Can access globalVar?", globalVar);        // Yes, via lexical environment
    console.log("Can access outerVar?", outerVar);          // Yes, in variable environment

    function inner() {
        let innerVar = "I'm in inner";
        const innerConst = "Inner constant";

        console.log("\n--- Inside inner() ---");
        console.log("Can access globalVar?", globalVar);    // Yes, via scope chain
        console.log("Can access outerVar?", outerVar);      // Yes, via scope chain
        console.log("Can access innerVar?", innerVar);      // Yes, in variable environment

        console.log("\n--- Scope chain lookup for globalVar ---");
        console.log("1. Check inner()'s Variable Environment → Not found");
        console.log("2. Follow Lexical Environment to outer() → Not found");
        console.log("3. Follow Lexical Environment to Global → Found!");
    }

    inner();

    console.log("\n--- Back in outer() ---");
    // console.log(innerVar);  // ReferenceError: innerVar is not defined
    console.log("Cannot access innerVar - it's in a destroyed context");
}

outer();

console.log("\n--- Back in global ---");
// console.log(outerVar);  // ReferenceError: outerVar is not defined
console.log("Cannot access outerVar - it's in a destroyed context");

/**
 * EXECUTION CONTEXT STRUCTURE:
 * 
 * ════════════════════════════════════════════════════════════
 * GLOBAL EXECUTION CONTEXT
 * ════════════════════════════════════════════════════════════
 * Variable Environment: {
 *   globalVar: "I'm global",
 *   globalConst: "Global constant",
 *   outer: <function>
 * }
 * Lexical Environment: null (no outer scope)
 * this: global object
 * 
 * ════════════════════════════════════════════════════════════
 * outer() EXECUTION CONTEXT
 * ════════════════════════════════════════════════════════════
 * Variable Environment: {
 *   outerVar: "I'm in outer",
 *   outerConst: "Outer constant",
 *   inner: <function>
 * }
 * Lexical Environment: --> Reference to Global Execution Context
 * this: global object (or undefined in strict mode)
 * 
 * ════════════════════════════════════════════════════════════
 * inner() EXECUTION CONTEXT
 * ════════════════════════════════════════════════════════════
 * Variable Environment: {
 *   innerVar: "I'm in inner",
 *   innerConst: "Inner constant"
 * }
 * Lexical Environment: --> Reference to outer() Execution Context
 * this: global object (or undefined in strict mode)
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * VARIABLE LOOKUP PROCESS (when inner() accesses globalVar):
 * 
 * 1. Engine checks inner()'s Variable Environment
 *    → { innerVar, innerConst } → globalVar not found
 * 
 * 2. Engine follows Lexical Environment reference to outer()
 *    → Checks outer()'s Variable Environment
 *    → { outerVar, outerConst, inner } → globalVar not found
 * 
 * 3. Engine follows Lexical Environment reference to Global
 *    → Checks Global Variable Environment
 *    → { globalVar, globalConst, outer } → globalVar FOUND!
 * 
 * 4. Returns "I'm global"
 * 
 * This chain of Lexical Environment references is the SCOPE CHAIN.
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * KEY INSIGHTS:
 * 
 * 1. Variable Environment = "My own variables"
 * 2. Lexical Environment = "Link to parent scope"
 * 3. Scope chain = Following Lexical Environment links
 * 4. Lookup stops at first match (shadowing is possible)
 * 5. Lookup failure at the end = ReferenceError
 * 
 * WHY "LEXICAL"?
 * 
 * "Lexical" means "based on how code is written, not how it's executed."
 * The Lexical Environment is determined at COMPILE TIME by where
 * the function is DEFINED, not where it's CALLED.
 */

console.log("\n=== Variable Shadowing Example ===");

let x = "global x";

function shadowDemo() {
    let x = "local x";
    console.log(x);  // "local x" - found in local Variable Environment first
}

shadowDemo();
console.log(x);  // "global x" - function's local x doesn't affect global x
