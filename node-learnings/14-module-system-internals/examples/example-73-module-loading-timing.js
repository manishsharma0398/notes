/**
 * Example 73: Module Loading Timing and Blocking Behavior
 * 
 * Demonstrates how require() blocks the event loop during module loading.
 * Shows the difference between first load (slow) and cached load (fast).
 * 
 * Run with: node example-73-module-loading-timing.js
 * 
 * What to observe:
 * - require() blocks event loop during loading
 * - First load is slow (file I/O + execution)
 * - Cached load is fast (cache lookup)
 * - Timers are delayed during module loading
 */

const { performance } = require('perf_hooks');

console.log('=== Module Loading Timing ===\n');

// Track event loop activity
let timerFired = false;
const timer = setInterval(() => {
  timerFired = true;
  console.log('[Timer] Event loop is active');
}, 10);

// Measure first require() call
console.log('--- First require() call (uncached) ---');
const start1 = performance.now();
timerFired = false;

// This will block the event loop
const fs = require('fs'); // Core module (fast, but still blocks)
const start2 = performance.now();

// Create a test module dynamically to measure file I/O
const testModulePath = require('path').join(__dirname, 'test-module.js');
const testModuleCode = `
const { performance } = require('perf_hooks');
const start = performance.now();

// Simulate some work
let sum = 0;
for (let i = 0; i < 1000000; i++) {
  sum += i;
}

const end = performance.now();
module.exports = {
  loadTime: end - start,
  sum: sum
};
`;

require('fs').writeFileSync(testModulePath, testModuleCode);

const loadStart = performance.now();
const testModule = require('./test-module');
const loadEnd = performance.now();

console.log(`First require() took: ${(loadEnd - loadStart).toFixed(2)}ms`);
console.log(`Module execution time: ${testModule.loadTime.toFixed(2)}ms`);
console.log(`Timer fired during load: ${timerFired ? 'Yes' : 'No'} (event loop was blocked)`);

// Measure second require() call (cached)
console.log('\n--- Second require() call (cached) ---');
timerFired = false;
const cacheStart = performance.now();
const testModule2 = require('./test-module');
const cacheEnd = performance.now();

console.log(`Cached require() took: ${(cacheEnd - cacheStart).toFixed(4)}ms`);
console.log(`Same module object: ${testModule === testModule2 ? 'Yes' : 'No'}`);
console.log(`Timer fired during cached load: ${timerFired ? 'Yes' : 'No'}`);

// Show cache
console.log('\n--- Module Cache ---');
console.log(`Cache has ${Object.keys(require.cache).length} modules`);
console.log(`Test module in cache: ${testModulePath in require.cache ? 'Yes' : 'No'}`);
console.log(`Cache key: ${testModulePath}`);

// Cleanup
clearInterval(timer);
require('fs').unlinkSync(testModulePath);

console.log('\n=== Key Observations ===');
console.log('1. First require() blocks event loop (file I/O + execution)');
console.log('2. Cached require() is instant (no file I/O)');
console.log('3. Modules are cached in require.cache');
console.log('4. Same require() call returns same module object');
