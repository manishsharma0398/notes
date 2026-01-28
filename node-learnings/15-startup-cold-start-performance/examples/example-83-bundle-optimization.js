/**
 * Example 83: Bundle Optimization for Startup Performance
 * 
 * Demonstrates how bundle size and module count affect startup:
 * - Smaller bundles = faster startup
 * - Fewer modules = faster startup
 * - Tree-shaking impact
 * 
 * Run with: node example-83-bundle-optimization.js
 * 
 * What to observe:
 * - Impact of bundle size on startup
 * - Impact of module count on startup
 * - Optimization strategies
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('=== Bundle Optimization ===\n');

// Create test scenarios
const dir = __dirname;

// Scenario 1: Many small modules (high module count)
console.log('--- Scenario 1: Many Small Modules ---');
const smallModules = [];
for (let i = 0; i < 50; i++) {
  const modulePath = path.join(dir, `small-module-${i}.js`);
  const moduleCode = `
module.exports = {
  id: ${i},
  process: (input) => input * 2
};
`;
  fs.writeFileSync(modulePath, moduleCode);
  smallModules.push(`./small-module-${i}.js`);
}

const smallStart = performance.now();
smallModules.forEach(modulePath => {
  require(modulePath);
});
const smallEnd = performance.now();
const smallTime = smallEnd - smallStart;

console.log(`Modules: ${smallModules.length}`);
console.log(`Total size: ~${(smallModules.length * 0.1).toFixed(1)} KB`);
console.log(`Load time: ${smallTime.toFixed(2)}ms`);
console.log(`Average per module: ${(smallTime / smallModules.length).toFixed(2)}ms`);

// Clear cache
smallModules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  delete require.cache[fullPath];
});

// Scenario 2: Few large modules (low module count)
console.log('\n--- Scenario 2: Few Large Modules ---');
const largeModules = [];
for (let i = 0; i < 5; i++) {
  const modulePath = path.join(dir, `large-module-${i}.js`);
  const moduleCode = `
// Large module with many functions
${new Array(10).fill(0).map((_, j) => `
function func${j}(input) {
  return input * ${j + 1};
}
`).join('')}

module.exports = {
  id: ${i},
  ${new Array(10).fill(0).map((_, j) => `func${j}: func${j}`).join(',\n  ')}
};
`;
  fs.writeFileSync(modulePath, moduleCode);
  largeModules.push(`./large-module-${i}.js`);
}

const largeStart = performance.now();
largeModules.forEach(modulePath => {
  require(modulePath);
});
const largeEnd = performance.now();
const largeTime = largeEnd - largeStart;

console.log(`Modules: ${largeModules.length}`);
console.log(`Total size: ~${(largeModules.length * 2).toFixed(1)} KB`);
console.log(`Load time: ${largeTime.toFixed(2)}ms`);
console.log(`Average per module: ${(largeTime / largeModules.length).toFixed(2)}ms`);

// Comparison
console.log('\n=== Comparison ===');
console.log(`Many small modules: ${smallTime.toFixed(2)}ms (${smallModules.length} modules)`);
console.log(`Few large modules: ${largeTime.toFixed(2)}ms (${largeModules.length} modules)`);
console.log(`Difference: ${Math.abs(smallTime - largeTime).toFixed(2)}ms`);
console.log(`\nKey insight: Module count matters more than total size`);

// Scenario 3: Tree-shaking simulation (only import what's used)
console.log('\n--- Scenario 3: Tree-shaking Impact ---');

// Create module with many exports
const treeShakeModulePath = path.join(dir, 'tree-shake-module.js');
const treeShakeCode = `
// Many exports, but we only use one
${new Array(20).fill(0).map((_, i) => `
function unusedFunc${i}() {
  return ${i} * 2;
}
`).join('')}

function usedFunc(input) {
  return input * 2;
}

module.exports = {
  ${new Array(20).fill(0).map((_, i) => `unusedFunc${i}: unusedFunc${i}`).join(',\n  ')},
  usedFunc: usedFunc
};
`;
fs.writeFileSync(treeShakeModulePath, treeShakeCode);

// Without tree-shaking (loads everything)
const noTreeShakeStart = performance.now();
const fullModule = require('./tree-shake-module.js');
const noTreeShakeEnd = performance.now();
const noTreeShakeTime = noTreeShakeEnd - noTreeShakeStart;

console.log(`Without tree-shaking: ${noTreeShakeTime.toFixed(2)}ms`);
console.log(`Exports loaded: ${Object.keys(fullModule).length}`);

// With tree-shaking (only load what's used - simulated)
const treeShakeStart = performance.now();
// Simulate tree-shaking: only create what's needed
const treeShakenModule = {
  usedFunc: (input) => input * 2
};
const treeShakeEnd = performance.now();
const treeShakeTime = treeShakeEnd - treeShakeStart;

console.log(`With tree-shaking: ${treeShakeTime.toFixed(2)}ms`);
console.log(`Exports loaded: ${Object.keys(treeShakenModule).length}`);
console.log(`Improvement: ${((noTreeShakeTime - treeShakeTime) / noTreeShakeTime * 100).toFixed(1)}% faster`);

// Cleanup
smallModules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
});

largeModules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
});

if (fs.existsSync(treeShakeModulePath)) {
  fs.unlinkSync(treeShakeModulePath);
}

console.log('\n=== Optimization Strategies ===');
console.log('1. Reduce module count: Bundle related modules together');
console.log('2. Tree-shaking: Only import what you use (ESM)');
console.log('3. Code splitting: Load code on-demand');
console.log('4. Minification: Reduce parse time');
console.log('5. Remove unused dependencies: Smaller node_modules');
