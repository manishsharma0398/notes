/**
 * Example 77: CommonJS vs ESM Differences
 * 
 * Demonstrates key differences between CommonJS and ESM:
 * - Synchronous vs asynchronous loading
 * - Static vs dynamic imports
 * - Export behavior (copies vs live bindings)
 * - Top-level await
 * 
 * Note: This example requires both CommonJS and ESM files.
 * Run with: node example-77-commonjs-vs-esm.js
 * 
 * What to observe:
 * - Loading behavior differences
 * - Export/import differences
 * - When each is appropriate
 */

const fs = require('fs');
const path = require('path');

console.log('=== CommonJS vs ESM Differences ===\n');

// Create test files
const dir = __dirname;

// CommonJS module
const cjsCode = `
// CommonJS: Synchronous, dynamic
let value = 1;

function increment() {
  value++;
}

function getValue() {
  return value;
}

module.exports = {
  value: value, // Copy at export time
  increment: increment,
  getValue: getValue
};
`;

// ESM module (will be created as .mjs)
const esmCode = `
// ESM: Asynchronous, static analysis
let value = 1;

export function increment() {
  value++;
}

export function getValue() {
  return value;
}

// Live binding: exports reference the variable
export { value };
`;

fs.writeFileSync(path.join(dir, 'cjs-module.js'), cjsCode);
fs.writeFileSync(path.join(dir, 'esm-module.mjs'), esmCode);

console.log('--- CommonJS Behavior ---');

// Load CommonJS module
const cjs = require('./cjs-module.js');
console.log('Initial value:', cjs.value);
console.log('getValue():', cjs.getValue());

// Modify
cjs.increment();
console.log('After increment():');
console.log('  value:', cjs.value); // Still 1 (copy)
console.log('  getValue():', cjs.getValue()); // 2 (reads internal state)

console.log('\n--- ESM Behavior (using dynamic import) ---');

// Load ESM module dynamically
(async () => {
  try {
    const esm = await import('./esm-module.mjs');
    console.log('Initial value:', esm.value);
    console.log('getValue():', esm.getValue());
    
    // Modify
    esm.increment();
    console.log('After increment():');
    console.log('  value:', esm.value); // 2 (live binding)
    console.log('  getValue():', esm.getValue()); // 2
    
    console.log('\n--- Key Differences ---');
    console.log('1. CommonJS:');
    console.log('   - Synchronous loading (blocks event loop)');
    console.log('   - Dynamic require() (can be conditional)');
    console.log('   - Exports are copies');
    console.log('   - No top-level await');
    console.log('\n2. ESM:');
    console.log('   - Asynchronous loading (parallel)');
    console.log('   - Static imports (known at parse time)');
    console.log('   - Live bindings (exports are references)');
    console.log('   - Top-level await supported');
    
    // Cleanup
    fs.unlinkSync(path.join(dir, 'cjs-module.js'));
    fs.unlinkSync(path.join(dir, 'esm-module.mjs'));
  } catch (e) {
    console.error('Error loading ESM:', e.message);
    // Cleanup on error
    fs.unlinkSync(path.join(dir, 'cjs-module.js'));
    if (fs.existsSync(path.join(dir, 'esm-module.mjs'))) {
      fs.unlinkSync(path.join(dir, 'esm-module.mjs'));
    }
  }
})();

// Note: This example shows the concepts, but ESM loading is async
// so the output order may vary
