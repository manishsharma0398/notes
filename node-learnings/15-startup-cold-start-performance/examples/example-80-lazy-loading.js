/**
 * Example 80: Lazy Loading Strategies and Impact
 * 
 * Demonstrates lazy loading vs eager loading and their impact on startup time.
 * Shows how to implement lazy loading for modules and resources.
 * 
 * Run with: node example-80-lazy-loading.js
 * 
 * What to observe:
 * - Startup time difference (eager vs lazy)
 * - Memory usage difference
 * - When modules are actually loaded
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('=== Lazy Loading Strategies ===\n');

// Create test modules
const dir = __dirname;
const modules = [];

for (let i = 0; i < 10; i++) {
  const modulePath = path.join(dir, `lazy-module-${i}.js`);
  const moduleCode = `
// Simulate heavy module
const data = new Array(10000).fill(0).map((_, idx) => ({
  id: idx,
  value: Math.random(),
  processed: false
}));

function processData() {
  return data.map(d => ({ ...d, processed: true }));
}

module.exports = {
  id: ${i},
  data: data,
  processData: processData,
  size: data.length
};
`;
  fs.writeFileSync(modulePath, moduleCode);
  modules.push(`./lazy-module-${i}.js`);
}

// Test 1: Eager loading (load all at startup)
console.log('--- Test 1: Eager Loading (load all at startup) ---');
const eagerStart = performance.now();

const eagerModules = [];
modules.forEach(modulePath => {
  const mod = require(modulePath);
  eagerModules.push(mod);
});

const eagerEnd = performance.now();
const eagerTime = eagerEnd - eagerStart;

console.log(`Loaded ${modules.length} modules in ${eagerTime.toFixed(2)}ms`);
console.log(`Startup time: ${eagerTime.toFixed(2)}ms`);

// Clear cache to simulate fresh load
modules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  delete require.cache[fullPath];
});

// Test 2: Lazy loading (load on-demand)
console.log('\n--- Test 2: Lazy Loading (load on-demand) ---');
const lazyStart = performance.now();

// Startup: No modules loaded
const lazyModules = new Map();

function getLazyModule(index) {
  if (!lazyModules.has(index)) {
    const loadStart = performance.now();
    const mod = require(modules[index]);
    const loadEnd = performance.now();
    lazyModules.set(index, {
      module: mod,
      loadTime: loadEnd - loadStart
    });
    console.log(`  Loaded module ${index} in ${(loadEnd - loadStart).toFixed(2)}ms`);
  }
  return lazyModules.get(index).module;
}

const lazyEnd = performance.now();
const lazyStartupTime = lazyEnd - lazyStart;

console.log(`Startup time: ${lazyStartupTime.toFixed(2)}ms`);
console.log(`Modules loaded: 0`);

// Simulate first request (loads 3 modules)
console.log('\n--- Simulating First Request ---');
const firstRequestStart = performance.now();
getLazyModule(0);
getLazyModule(5);
getLazyModule(9);
const firstRequestEnd = performance.now();

console.log(`First request loaded 3 modules in ${(firstRequestEnd - firstRequestStart).toFixed(2)}ms`);
console.log(`Total modules loaded: ${lazyModules.size}`);

// Simulate second request (uses cached modules)
console.log('\n--- Simulating Second Request ---');
const secondRequestStart = performance.now();
getLazyModule(0); // Already loaded
getLazyModule(5); // Already loaded
getLazyModule(2); // New module
const secondRequestEnd = performance.now();

console.log(`Second request loaded 1 new module in ${(secondRequestEnd - secondRequestStart).toFixed(2)}ms`);
console.log(`Total modules loaded: ${lazyModules.size}`);

// Comparison
console.log('\n=== Comparison ===');
console.log(`Eager loading startup: ${eagerTime.toFixed(2)}ms (all ${modules.length} modules)`);
console.log(`Lazy loading startup: ${lazyStartupTime.toFixed(2)}ms (0 modules)`);
console.log(`Startup improvement: ${(eagerTime - lazyStartupTime).toFixed(2)}ms (${(((eagerTime - lazyStartupTime) / eagerTime) * 100).toFixed(1)}% faster)`);
console.log(`\nFirst request with lazy loading: ${(firstRequestEnd - lazyStartupTime).toFixed(2)}ms`);
console.log(`Still faster than eager: ${eagerTime > (firstRequestEnd - lazyStartupTime) ? 'Yes' : 'No'}`);

// Advanced: Lazy loading with caching
console.log('\n--- Advanced: Lazy Loading with Factory Pattern ---');

class LazyModuleLoader {
  constructor() {
    this.cache = new Map();
  }
  
  load(modulePath) {
    if (!this.cache.has(modulePath)) {
      const mod = require(modulePath);
      this.cache.set(modulePath, mod);
    }
    return this.cache.get(modulePath);
  }
  
  clear(modulePath) {
    const fullPath = require.resolve(modulePath, { paths: [dir] });
    delete require.cache[fullPath];
    this.cache.delete(modulePath);
  }
  
  clearAll() {
    this.cache.forEach((_, modulePath) => {
      const fullPath = require.resolve(modulePath, { paths: [dir] });
      delete require.cache[fullPath];
    });
    this.cache.clear();
  }
}

const loader = new LazyModuleLoader();
console.log('Loader created (no modules loaded)');

// Load on first use
const mod1 = loader.load('./lazy-module-0.js');
console.log(`Loaded module on first use: ${mod1.id}`);

// Reuse cached module
const mod2 = loader.load('./lazy-module-0.js');
console.log(`Reused cached module: ${mod1 === mod2 ? 'Yes' : 'No'}`);

// Cleanup
modules.forEach(modulePath => {
  const fullPath = require.resolve(modulePath, { paths: [dir] });
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
});

console.log('\n=== Key Observations ===');
console.log('1. Lazy loading reduces startup time significantly');
console.log('2. Modules load on first use, not at startup');
console.log('3. Cached modules load instantly (no file I/O)');
console.log('4. First request may be slower, but startup is faster');
console.log('5. Factory pattern provides clean lazy loading API');
