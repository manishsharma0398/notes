/**
 * Example 74: Module Cache Behavior and Memory Implications
 * 
 * Demonstrates how modules are cached and how this affects memory.
 * Shows that modules are never freed from cache (unless manually deleted).
 * 
 * Run with: node example-74-module-cache-behavior.js
 * 
 * What to observe:
 * - Modules are cached permanently
 * - require.cache holds references to all loaded modules
 * - Clearing cache affects all references
 * - Memory implications of caching
 */

const { performance } = require('perf_hooks');
const v8 = require('v8');

function getHeapStats() {
  const stats = v8.getHeapStatistics();
  return {
    used: (stats.usedHeapSize / 1024 / 1024).toFixed(2),
    total: (stats.totalHeapSize / 1024 / 1024).toFixed(2)
  };
}

console.log('=== Module Cache Behavior ===\n');

// Create a test module with large data
const testModulePath = require('path').join(__dirname, 'large-module.js');
const testModuleCode = `
// Module with large data
const largeData = new Array(100000).fill(0).map((_, i) => ({
  id: i,
  value: Math.random(),
  buffer: Buffer.alloc(1024) // 1 KB per item
}));

module.exports = {
  data: largeData,
  getData: () => largeData,
  size: largeData.length
};
`;

require('fs').writeFileSync(testModulePath, testModuleCode);

console.log('--- Initial Heap ---');
const heapBefore = getHeapStats();
console.log(`Heap: ${heapBefore.used} MB / ${heapBefore.total} MB`);

// Load module
console.log('\n--- Loading Module ---');
const module1 = require('./large-module');
const heapAfterLoad = getHeapStats();
console.log(`Heap: ${heapAfterLoad.used} MB / ${heapAfterLoad.total} MB`);
console.log(`Heap growth: ${(parseFloat(heapAfterLoad.used) - parseFloat(heapBefore.used)).toFixed(2)} MB`);

// Load same module again (should use cache)
console.log('\n--- Loading Same Module Again (cached) ---');
const module2 = require('./large-module');
const heapAfterCache = getHeapStats();
console.log(`Heap: ${heapAfterCache.used} MB / ${heapAfterCache.total} MB`);
console.log(`Same object: ${module1 === module2 ? 'Yes' : 'No'}`);

// Remove local reference
console.log('\n--- Removing Local Reference ---');
let moduleRef = module1;
module1 = null;
module2 = null;

// Force GC (if available)
if (global.gc) {
  global.gc();
}

const heapAfterGC = getHeapStats();
console.log(`Heap: ${heapAfterGC.used} MB / ${heapAfterGC.total} MB`);
console.log(`Heap after GC: ${(parseFloat(heapAfterGC.used) - parseFloat(heapBefore.used)).toFixed(2)} MB above initial`);
console.log(`Module still in cache: ${testModulePath in require.cache ? 'Yes' : 'No'}`);
console.log(`Cache still holds reference: ${require.cache[testModulePath] ? 'Yes' : 'No'}`);

// Show cache contents
console.log('\n--- Module Cache Contents ---');
console.log(`Total cached modules: ${Object.keys(require.cache).length}`);
console.log(`Test module in cache: ${testModulePath in require.cache ? 'Yes' : 'No'}`);

// Clear cache entry
console.log('\n--- Clearing Cache Entry ---');
delete require.cache[testModulePath];
console.log(`Test module in cache: ${testModulePath in require.cache ? 'Yes' : 'No'}`);

// Force GC again
if (global.gc) {
  global.gc();
}

const heapAfterClear = getHeapStats();
console.log(`Heap: ${heapAfterClear.used} MB / ${heapAfterClear.total} MB`);
console.log(`Heap reduction: ${(parseFloat(heapAfterGC.used) - parseFloat(heapAfterClear.used)).toFixed(2)} MB`);

// Try to use module after cache clear
console.log('\n--- Using Module After Cache Clear ---');
try {
  // This will fail because moduleRef still points to the module
  // but the module is no longer in cache
  console.log(`Module data size: ${moduleRef.data.length}`);
  console.log('Module still works (reference held)');
} catch (e) {
  console.log(`Error: ${e.message}`);
}

// Cleanup
require('fs').unlinkSync(testModulePath);

console.log('\n=== Key Observations ===');
console.log('1. Modules are cached permanently in require.cache');
console.log('2. Cache holds references, preventing GC');
console.log('3. Removing local references does not free memory (cache holds reference)');
console.log('4. Clearing cache allows GC to free memory');
console.log('5. But clearing cache breaks existing references');
