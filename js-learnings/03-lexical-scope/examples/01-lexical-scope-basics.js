/**
 * Example 1: Lexical Scope Basics
 * Demonstrates how scope is determined by code structure, not execution
 */

console.log("=== Example 1: Lexical Scope Basics ===\n");

let globalVar = "I'm global";

function outer() {
    let outerVar = "I'm outer";

    function inner() {
        let innerVar = "I'm inner";

        console.log("From inner():");
        console.log("  globalVar:", globalVar);    // Access via scope chain
        console.log("  outerVar:", outerVar);      // Access via scope chain
        console.log("  innerVar:", innerVar);      // Access directly
    }

    inner();

    console.log("\nFrom outer():");
    console.log("  globalVar:", globalVar);        // Access directly
    console.log("  outerVar:", outerVar);          // Access directly
    // console.log("  innerVar:", innerVar);       // ReferenceError - out of scope
}

outer();

console.log("\nFrom global:");
console.log("  globalVar:", globalVar);            // Access directly
// console.log("  outerVar:", outerVar);           // ReferenceError - out of scope
// console.log("  innerVar:", innerVar);           // ReferenceError - out of scope

/**
 * SCOPE CHAIN VISUALIZATION:
 * 
 * When inner() executes:
 * 
 * ┌─────────────────────┐
 * │ inner() scope       │
 * │ { innerVar }        │
 * └──────────┬──────────┘
 *            │ Lexical Environment
 *            ↓
 * ┌─────────────────────┐
 * │ outer() scope       │
 * │ { outerVar, inner } │
 * └──────────┬──────────┘
 *            │ Lexical Environment
 *            ↓
 * ┌─────────────────────┐
 * │ Global scope        │
 * │ { globalVar, outer }│
 * └─────────────────────┘
 * 
 * 
 * VARIABLE LOOKUP PROCESS:
 * 
 * When inner() accesses `globalVar`:
 * 1. Check inner()'s scope → { innerVar } → Not found
 * 2. Follow link to outer()'s scope → { outerVar, inner } → Not found
 * 3. Follow link to global scope → { globalVar, outer } → Found!
 * 4. Return "I'm global"
 * 
 * When outer() tries to access `innerVar`:
 * 1. Check outer()'s scope → { outerVar, inner } → Not found
 * 2. Follow link to global scope → { globalVar, outer } → Not found
 * 3. Reached end of scope chain → ReferenceError
 * 
 * 
 * KEY INSIGHT:
 * 
 * The scope chain is determined by WHERE FUNCTIONS ARE WRITTEN,
 * not where they are called.
 * 
 * inner() is written inside outer(), so it has access to outer()'s variables.
 * outer() is not written inside inner(), so it cannot access inner()'s variables.
 * 
 * This is LEXICAL SCOPE.
 */

console.log("\n=== Scope is Permanent ===");

function createFunction() {
    let localVar = "I'm local to createFunction";

    return function () {
        console.log(localVar);  // Can access even after createFunction returns
    };
}

const myFunc = createFunction();  // createFunction has returned
myFunc();  // Still logs "I'm local to createFunction"

/**
 * This works because:
 * 
 * 1. The returned function is WRITTEN inside createFunction()
 * 2. At compile time, a lexical link is created
 * 3. This link is PERMANENT - it doesn't matter when/where you call the function
 * 4. The variable localVar is kept alive (closure) because the returned function references it
 * 
 * This is why closures work - they're a natural result of lexical scope.
 */
