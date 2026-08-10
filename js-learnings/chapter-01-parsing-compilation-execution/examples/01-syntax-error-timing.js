// example-01-syntax-error-timing.js
// Demonstrates: parse errors prevent ALL execution

// Prediction: Does "Before error" log?
// Answer: NO. The entire file is parsed before any line executes.
// The syntax error causes the parse phase to fail for the whole file.

console.log("Before error");

let x = {;  // SyntaxError: Unexpected token ';'

console.log("After error");

// Run this and observe: neither log ever executes.
// This proves the parse-before-execute model.
