/**
 * Example 2: Compilation and Hoisting
 * Demonstrates that compilation happens before execution
 */

console.log("=== Example 2: Compilation and Hoisting ===\n");

// Function declaration - works because of compilation
greet("World");

function greet(name) {
    console.log(`Hello, ${name}!`);
}

/**
 * EXPLANATION:
 * 
 * PHASE 1 - PARSING:
 * - Entire code is parsed into AST
 * - No execution yet
 * 
 * PHASE 2 - COMPILATION:
 * - Scope is analyzed
 * - Function 'greet' is REGISTERED in the global scope
 * - Compiler notes: greet is at line X, takes 1 parameter, has this body
 * 
 * WHAT'S IN MEMORY AFTER COMPILATION:
 * - Global Scope Record: { greet: <function object> }
 * - The function object contains its code and scope reference
 * 
 * PHASE 3 - EXECUTION (line by line):
 * - Line 9: greet("World") → looks up 'greet' in scope → finds it → executes
 * - Line 11-13: These lines were already compiled, so skipped
 * 
 * KEY INSIGHT:
 * - The function exists in memory BEFORE line 9 executes
 * - This is why we can call it before its declaration in the code
 */

console.log("\n--- Var vs Let Hoisting ---\n");

// var is hoisted and initialized to undefined
console.log("varValue:", varValue);  // undefined (not ReferenceError)
var varValue = 42;
console.log("varValue:", varValue);  // 42

// let is hoisted but NOT initialized (Temporal Dead Zone)
try {
    console.log("letValue:", letValue);  // ReferenceError
} catch (e) {
    console.log("Error:", e.message);
}
let letValue = 42;
console.log("letValue:", letValue);  // 42

/**
 * EXPLANATION:
 * 
 * For 'var varValue':
 * 
 * COMPILATION:
 * - 'varValue' is registered in scope
 * - Set to undefined immediately
 * 
 * Memory after compilation:
 * - Global Scope: { varValue: undefined }
 * 
 * EXECUTION:
 * - Line 48: logs 'undefined'
 * - Line 49: varValue is assigned 42
 * - Line 50: logs '42'
 * 
 * For 'let letValue':
 * 
 * COMPILATION:
 * - 'letValue' is registered in scope
 * - Marked as "uninitialized" (TDZ)
 * 
 * Memory after compilation:
 * - Global Scope: { letValue: <uninitialized> }
 * 
 * EXECUTION:
 * - Line 55: tries to access letValue → still in TDZ → ReferenceError
 * - Line 59: letValue exits TDZ and is assigned 42
 * - Line 60: logs '42'
 * 
 * KEY INSIGHT:
 * - Both are hoisted (registered during compilation)
 * - var is initialized to undefined
 * - let/const stay uninitialized until their declaration line executes
 */
