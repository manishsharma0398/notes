/**
 * Example 75: Module Resolution Algorithm
 * 
 * Demonstrates how Node.js resolves module paths:
 * - Relative paths
 * - Absolute paths
 * - Bare specifiers (node_modules)
 * - Extension resolution
 * - Directory resolution
 * 
 * Run with: node example-75-resolution-algorithm.js
 * 
 * What to observe:
 * - Resolution order for different path types
 * - node_modules traversal
 * - Extension and directory resolution
 * - Performance implications
 */

const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

console.log('=== Module Resolution Algorithm ===\n');

// Helper to show resolution steps
function resolveModule(modulePath, fromFile) {
  console.log(`\nResolving: ${modulePath} from ${fromFile}`);
  
  const start = performance.now();
  
  try {
    // Try to resolve (this will show actual resolution)
    const resolved = require.resolve(modulePath, { paths: [path.dirname(fromFile)] });
    const end = performance.now();
    
    console.log(`  ✓ Resolved to: ${resolved}`);
    console.log(`  Time: ${(end - start).toFixed(4)}ms`);
    
    return resolved;
  } catch (e) {
    const end = performance.now();
    console.log(`  ✗ Failed: ${e.message}`);
    console.log(`  Time: ${(end - start).toFixed(4)}ms`);
    return null;
  }
}

// Test different resolution types
console.log('--- Resolution Types ---');

// 1. Core modules (built-in)
console.log('\n1. Core Modules:');
resolveModule('fs', __filename);
resolveModule('path', __filename);
resolveModule('http', __filename);

// 2. Relative paths
console.log('\n2. Relative Paths:');
resolveModule('./example-75-resolution-algorithm.js', __filename);
resolveModule('../14-module-system-internals/examples/example-75-resolution-algorithm.js', __filename);

// 3. Absolute paths
console.log('\n3. Absolute Paths:');
resolveModule(__filename, __filename);

// 4. Bare specifiers (node_modules)
console.log('\n4. Bare Specifiers (node_modules):');
// These will search node_modules
resolveModule('fs', __filename); // Core module (fast)
// Try to resolve a package (if it exists)
try {
  resolveModule('express', __filename);
} catch (e) {
  console.log('  (express not installed, skipping)');
}

// 5. Directory resolution
console.log('\n5. Directory Resolution:');
const testDir = path.join(__dirname, 'test-dir');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
  fs.writeFileSync(path.join(testDir, 'index.js'), 'module.exports = { name: "test-dir" };');
}

resolveModule('./test-dir', __filename);
resolveModule('./test-dir/index.js', __filename);

// Show resolution order for node_modules
console.log('\n--- node_modules Resolution Order ---');
console.log('When resolving a bare specifier (e.g., "express"):');
console.log('1. Check if core module (fs, http, etc.)');
console.log('2. Start at current directory, walk up:');
console.log('   - ./node_modules/express');
console.log('   - ../node_modules/express');
console.log('   - ../../node_modules/express');
console.log('   - ... (until root)');
console.log('3. For each directory, check:');
console.log('   - node_modules/express/package.json → "main" field');
console.log('   - node_modules/express/index.js');
console.log('   - node_modules/express/express.js');

// Performance: first resolution vs cached
console.log('\n--- Resolution Performance ---');
const testPath = './example-75-resolution-algorithm.js';

console.log('\nFirst resolution (uncached):');
const start1 = performance.now();
const resolved1 = require.resolve(testPath, { paths: [__dirname] });
const end1 = performance.now();
console.log(`  Time: ${(end1 - start1).toFixed(4)}ms`);

console.log('\nSecond resolution (cached path):');
const start2 = performance.now();
const resolved2 = require.resolve(testPath, { paths: [__dirname] });
const end2 = performance.now();
console.log(`  Time: ${(end2 - start2).toFixed(4)}ms`);
console.log(`  Same path: ${resolved1 === resolved2 ? 'Yes' : 'No'}`);

// Cleanup
if (fs.existsSync(testDir)) {
  fs.unlinkSync(path.join(testDir, 'index.js'));
  fs.rmdirSync(testDir);
}

console.log('\n=== Key Observations ===');
console.log('1. Core modules resolve instantly (no file system access)');
console.log('2. Relative paths resolve relative to current file');
console.log('3. Bare specifiers search node_modules (can be slow)');
console.log('4. Directory resolution checks package.json and index.js');
console.log('5. Resolution is cached (subsequent resolves are fast)');
