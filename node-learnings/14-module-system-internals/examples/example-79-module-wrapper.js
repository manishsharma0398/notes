/**
 * Example 79: The CommonJS Module Wrapper
 *
 * Demonstrates that variables like \`require\`, \`module\`, \`exports\`, \`__filename\`,
 * and \`__dirname\` are NOT global variables, but rather function parameters
 * injected by Node.js into every CommonJS file via the Module Wrapper.
 *
 * Run with: node example-79-module-wrapper.js
 *
 * What to observe:
 * - Top-level variables do not pollute the global scope
 * - The built-in arguments object reveals the 5 injected variables
 * - Difference between \`global.require\` and local \`require\`
 */

console.log("=== The CommonJS Module Wrapper ===\n");

// 1. Top-level variables are NOT global
console.log("--- 1. Top-level Scope isolated from Global ---");
var myVariable = "Hello, World!";
console.log("myVariable:", myVariable);
console.log("global.myVariable:", global.myVariable); // undefined!
console.log(
  "Why? Because this file doesn't execute in the global scope. It's wrapped in a function.\n",
);

// 2. Proving that \`require\` and \`exports\` are not global
console.log("--- 2. Are require and exports globals? ---");
console.log("typeof require:", typeof require); // function
console.log("typeof global.require:", typeof global.require); // undefined
console.log("typeof exports:", typeof exports); // object
console.log("typeof global.exports:", typeof global.exports); // undefined
console.log("Why? They are function parameters specific to this file.\n");

// 3. Peeking at the wrapper function's arguments
console.log("--- 3. Exploring the Wrapper Function Arguments ---");
console.log(
  "Did you know that since this code runs in a function, we have access to the \`arguments\` object?",
);

// \`arguments\` refers to the parameters passed by Node.js when it invoked the wrapper funtion:
// (function(exports, require, module, __filename, __dirname) { ... })
console.log("\\nNumber of arguments passed to this file:", arguments.length);

console.log(
  "\\nArgument 0 (exports):",
  arguments[0] === exports ? "Matches \`exports\`" : "Mismatch",
);
console.log(
  "Argument 1 (require):",
  arguments[1] === require ? "Matches \`require\`" : "Mismatch",
);
console.log(
  "Argument 2 (module):",
  arguments[2] === module ? "Matches \`module\`" : "Mismatch",
);
console.log(
  "Argument 3 (__filename):",
  arguments[3] === __filename ? "Matches \`__filename\`" : "Mismatch",
);
console.log(
  "Argument 4 (__dirname):",
  arguments[4] === __dirname ? "Matches \`__dirname\`" : "Mismatch",
);

// 4. Extracting the wrapper function literal
console.log("\\n--- 4. Viewing the Wrapper Syntax ---");
const wrapper = require("module").wrapper;
console.log("The wrapper array used by Node.js internals:");
console.log(wrapper[0]);
console.log("  /* your code goes here */");
console.log(wrapper[1]);

console.log("\\n=== Key Takeaway ===");
console.log(
  "Node.js compiles your module code by wrapping it inside the function signature above.",
);
console.log(
  'This creates an isolated scope and gives you "local" access to variables like \`require\` and \`module\`.',
);
