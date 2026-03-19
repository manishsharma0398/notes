/**
 * Example 76: Circular Dependency Handling
 *
 * Demonstrates how CommonJS handles circular dependencies:
 * - Cache inserted BEFORE execution (prevents infinite loops)
 * - Circular requires get partial exports (what's been set so far)
 * - Order of execution matters
 *
 * Run with: node example-76-circular-dependencies.js
 *
 * What to observe:
 * - How circular dependencies are resolved
 * - When exports are available
 * - Difference between CommonJS and ESM behavior
 */

console.log("=== Circular Dependency Handling ===\n");

// Create circular dependency: a.js → b.js → a.js
const fs = require("fs");
const path = require("path");

const dir = __dirname;

// Module A
const aCode = `
console.log('[A] Loading module A...');
const b = require('./b.js');
console.log('[A] b.value:', b.value);

let aValue = 1;

function incrementA() {
  aValue++;
  console.log('[A] aValue incremented to:', aValue);
}

module.exports = {
  value: aValue,
  incrementA: incrementA,
  getBValue: () => b.value
};

console.log('[A] Module A loaded, exports.value =', module.exports.value);
`;

// Module B
const bCode = `
console.log('[B] Loading module B...');
const a = require('./a.js');
console.log('[B] a.value:', a.value); // May be undefined!

let bValue = 2;

function incrementB() {
  bValue++;
  console.log('[B] bValue incremented to:', bValue);
}

module.exports = {
  value: bValue,
  incrementB: incrementB,
  getAValue: () => a.value // a is the partial module.exports object obtained during circular require
};

console.log('[B] Module B loaded, exports.value =', module.exports.value);
`;

// Write modules
fs.writeFileSync(path.join(dir, "a.js"), aCode);
fs.writeFileSync(path.join(dir, "b.js"), bCode);

console.log("--- Loading Circular Dependencies ---\n");

// Load module A (which loads B, which loads A)
const a = require("./a.js");

console.log("\n--- After Loading ---");
console.log("a.value:", a.value);
console.log("a.getBValue():", a.getBValue());

// Try to modify values
console.log("\n--- Modifying Values ---");
console.log("Calling a.incrementA():");
a.incrementA();
console.log("a.value after increment:", a.value); // Still 1! (exports are copies)

// Show that exports are copies
console.log("\n--- Circular Dependency Mechanics (CommonJS) ---");
console.log("In CommonJS, the module is cached BEFORE execution:");
console.log(
  "- When B requires A during A's execution, B gets A's partial exports",
);
console.log("- a.value is undefined because A hadn't set module.exports yet");
console.log(
  "- This is different from ESM (which uses live bindings that always read current value)",
);

// Demonstrate the issue
console.log("\n--- Demonstrating Copy Behavior ---");
const a2 = require("./a.js");
console.log("a === a2:", a === a2); // Same module (cached)
console.log("But if we modify a.value directly:");
a.value = 100;
console.log("a.value:", a.value);
console.log("a2.value:", a2.value); // Same object, so it changes
console.log("But a.getBValue() still returns old value:", a.getBValue());

// Cleanup
fs.unlinkSync(path.join(dir, "a.js"));
fs.unlinkSync(path.join(dir, "b.js"));

console.log("\n=== Key Observations ===");
console.log("1. Circular dependencies work in CommonJS");
console.log(
  "2. Cache is inserted BEFORE execution — this prevents infinite loops",
);
console.log(
  "3. If module B requires A before A finishes, B gets A's partial exports (whatever was set so far)",
);
console.log(
  "4. The module.exports object reference is shared, but live value updates after the fact are not visible",
);
console.log(
  "5. ESM uses live bindings (references), which always reflect the current exported value",
);
