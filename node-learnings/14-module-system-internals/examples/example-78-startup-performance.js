/**
 * Example 78: Startup Performance Impact
 * 
 * Demonstrates how module loading affects startup performance:
 * - Synchronous require() blocks event loop
 * - Many modules delay startup
 * - Lazy loading improves startup time
 * 
 * Run with: node example-78-startup-performance.js
 * 
 * What to observe:
 * - Startup time with many modules
 * - Event loop blocking during loading
 * - Benefits of lazy loading
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('=== Startup Performance Impact ===\n');

// Create multiple test modules
const dir = __dirname;
const moduleCount = 20;
const modules = [];

console.log(`Creating ${moduleCount} test modules...`);

for (let i = 0; i < moduleCount; i++) {
  const modulePath = path.join(dir, `startup-module-${i}.js`);
  const moduleCode = `
// Simulate some module work
const data = new Array(1000).fill(0).map((_, idx) => ({
  id: idx,
  value: Math.random()
}));

module.exports = {
  id: ${i},
  data: data,
  process: (input) => {
    return data.map(d => d.value * input);
  }
};
`;
  fs.writeFileSync(modulePath, moduleCode);
  modules.push(`./startup-module-${i}.js`);
}

// Test 1: Eager loading (load all at startup)
console.log('\n--- Test 1: Eager Loading (load all at startup) ---');
const startEager = performance.now();

const eagerModules = [];
for (const modulePath of modules) {
  const mod = require(modulePath);
  eagerModules.push(mod);
}

const endEager = performance.now();
const eagerTime = endEager - startEager;

console.log(`Loaded ${modules.length} modules in ${eagerTime.toFixed(2)}ms`);
console.log(`Average per module: ${(eagerTime / modules.length).toFixed(2)}ms`);

// Test 2: Lazy loading (load on demand)
console.log('\n--- Test 2: Lazy Loading (load on demand) ---');

// Clear cache to simulate fresh load
modules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  delete require.cache[fullPath];
});

const lazyModules = new Map();

function getLazyModule(index) {
  if (!lazyModules.has(index)) {
    const start = performance.now();
    const mod = require(modules[index]);
    const end = performance.now();
    lazyModules.set(index, { module: mod, loadTime: end - start });
    console.log(`  Loaded module ${index} in ${(end - start).toFixed(2)}ms`);
  }
  return lazyModules.get(index).module;
}

// Simulate startup (no modules loaded)
const startLazy = performance.now();
console.log('Startup time (no modules loaded):', (performance.now() - startLazy).toFixed(2), 'ms');

// Load modules on demand (simulate first request)
console.log('\nLoading modules on first use:');
const firstUseStart = performance.now();
getLazyModule(0);
getLazyModule(5);
getLazyModule(10);
const firstUseEnd = performance.now();

console.log(`\nFirst use loaded 3 modules in ${(firstUseEnd - firstUseStart).toFixed(2)}ms`);
console.log(`Total modules loaded: ${lazyModules.size}`);

// Compare
console.log('\n--- Comparison ---');
console.log(`Eager loading: ${eagerTime.toFixed(2)}ms (all ${modules.length} modules)`);
console.log(`Lazy loading startup: ${(performance.now() - startLazy).toFixed(2)}ms (0 modules)`);
console.log(`Lazy loading first use: ${(firstUseEnd - firstUseStart).toFixed(2)}ms (3 modules)`);
console.log(`\nStartup improvement: ${(eagerTime - (performance.now() - startLazy)).toFixed(2)}ms faster`);

// Show event loop blocking
console.log('\n--- Event Loop Blocking ---');
let timerCount = 0;
const timer = setInterval(() => {
  timerCount++;
  if (timerCount === 1) {
    console.log('Timer fired (event loop active)');
  }
}, 10);

// Block with module loading
setTimeout(() => {
  console.log('\nLoading modules (blocking event loop)...');
  const blockStart = performance.now();
  for (let i = 0; i < 5; i++) {
    if (!lazyModules.has(i)) {
      require(modules[i]);
    }
  }
  const blockEnd = performance.now();
  console.log(`Loaded 5 modules in ${(blockEnd - blockStart).toFixed(2)}ms`);
  console.log(`Timer fired ${timerCount} times during load`);
  
  clearInterval(timer);
  
  // Cleanup
  console.log('\n--- Cleanup ---');
  modules.forEach(modulePath => {
    const fullPath = require.resolve(modulePath, { paths: [dir] });
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  });
  
  console.log('\n=== Key Observations ===');
  console.log('1. Eager loading delays startup (all modules loaded synchronously)');
  console.log('2. Lazy loading improves startup (load only what\'s needed)');
  console.log('3. require() blocks event loop (timers delayed during loading)');
  console.log('4. Cached modules load instantly (no file I/O)');
}, 100);
