/**
 * Example 1: Parsing Errors
 * Demonstrates that syntax errors prevent ANY execution
 */

console.log("=== Example 1: Parsing Errors ===\n");

// This line will execute
console.log("This line runs fine");

// Uncomment the next line to see a parsing error
// let x = ;  // SyntaxError: Unexpected token ';'

// If the syntax error above is uncommented, this line will NEVER run
console.log("This line also runs fine");

/**
 * EXPLANATION:
 * 
 * PHASE 1 - PARSING:
 * - Engine reads all code character by character
 * - Tokenizes: console, ., log, (, "This line runs fine", ), ;
 * - Builds AST for each statement
 * - If it encounters `let x = ;`, parsing fails immediately
 * - NO EXECUTION HAPPENS if parsing fails
 * 
 * WHAT'S STORED IN MEMORY:
 * - Nothing yet! Code hasn't executed
 * - Only the source code string exists in memory
 * 
 * KEY INSIGHT:
 * - try/catch CANNOT catch parsing errors
 * - The entire script is parsed before ANY execution
 */

// This proves try/catch doesn't work for syntax errors
try {
  console.log("Inside try block");
  // Uncomment to see it fail:
  // let y = ;  // SyntaxError - try/catch won't save you
  console.log("Still in try block");
} catch (e) {
  console.log("Caught error:", e.message);
}
