/**
 * Example 79: Measuring Startup Time and Identifying Bottlenecks
 * 
 * Demonstrates how to measure startup time and identify what's slowing it down.
 * Shows the impact of module loading, initialization, and blocking operations.
 * 
 * Run with: node example-79-startup-measurement.js
 * 
 * What to observe:
 * - Total startup time
 * - Time spent in each phase
 * - Module loading overhead
 * - Blocking operations
 */

const { performance } = require('perf_hooks');
const Module = require('module');

// Track startup phases
const phases = {
  processInit: 0,
  moduleLoading: 0,
  appInit: 0,
  ready: 0
};

const startTime = performance.now();

// Phase 1: Process initialization (already started)
phases.processInit = performance.now() - startTime;

console.log('=== Startup Time Measurement ===\n');

// Phase 2: Module loading measurement
const moduleLoadStart = performance.now();
let moduleCount = 0;
let slowModules = [];

// Hook into require() to measure module loading
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  const moduleStart = performance.now();
  const result = originalRequire.apply(this, arguments);
  const moduleEnd = performance.now();
  const loadTime = moduleEnd - moduleStart;
  
  moduleCount++;
  
  // Track slow modules
  if (loadTime > 10) {
    slowModules.push({
      id,
      time: loadTime.toFixed(2)
    });
  }
  
  return result;
};

// Simulate application startup
console.log('--- Phase 2: Module Loading ---');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Load some modules (simulating real app)
const modules = ['fs', 'path', 'http', 'util', 'events'];
modules.forEach(mod => {
  require(mod);
});

const moduleLoadEnd = performance.now();
phases.moduleLoading = moduleLoadEnd - moduleLoadStart;

console.log(`Loaded ${moduleCount} modules in ${phases.moduleLoading.toFixed(2)}ms`);
console.log(`Average per module: ${(phases.moduleLoading / moduleCount).toFixed(2)}ms`);

if (slowModules.length > 0) {
  console.log('\nSlow modules (>10ms):');
  slowModules.forEach(m => {
    console.log(`  ${m.id}: ${m.time}ms`);
  });
}

// Phase 3: Application initialization
console.log('\n--- Phase 3: Application Initialization ---');
const appInitStart = performance.now();

// Simulate initialization work
function simulateInit() {
  // Simulate config loading
  const config = { port: 3000, env: 'development' };
  
  // Simulate database connection (synchronous simulation)
  const dbConnected = true;
  
  // Simulate cache warmup
  const cache = new Map();
  for (let i = 0; i < 1000; i++) {
    cache.set(`key-${i}`, `value-${i}`);
  }
  
  return { config, dbConnected, cacheSize: cache.size };
}

const initResult = simulateInit();
const appInitEnd = performance.now();
phases.appInit = appInitEnd - appInitStart;

console.log(`Initialization took: ${phases.appInit.toFixed(2)}ms`);
console.log(`Config loaded: ${Object.keys(initResult.config).length} keys`);
console.log(`Cache warmed: ${initResult.cacheSize} entries`);

// Phase 4: Ready to serve
phases.ready = performance.now() - startTime;

// Summary
console.log('\n=== Startup Time Breakdown ===');
console.log(`Process initialization: ${phases.processInit.toFixed(2)}ms (${((phases.processInit / phases.ready) * 100).toFixed(1)}%)`);
console.log(`Module loading: ${phases.moduleLoading.toFixed(2)}ms (${((phases.moduleLoading / phases.ready) * 100).toFixed(1)}%)`);
console.log(`Application initialization: ${phases.appInit.toFixed(2)}ms (${((phases.appInit / phases.ready) * 100).toFixed(1)}%)`);
console.log(`─────────────────────────────────────`);
console.log(`Total startup time: ${phases.ready.toFixed(2)}ms`);

console.log('\n=== Optimization Opportunities ===');
if (phases.moduleLoading > phases.ready * 0.4) {
  console.log('⚠️  Module loading is >40% of startup time');
  console.log('   Consider: Lazy loading, reducing dependencies');
}

if (phases.appInit > phases.ready * 0.3) {
  console.log('⚠️  Application initialization is >30% of startup time');
  console.log('   Consider: Deferring initialization, async initialization');
}

if (slowModules.length > 5) {
  console.log('⚠️  Many slow modules detected');
  console.log('   Consider: Optimizing or lazy loading slow modules');
}

// Restore original require
Module.prototype.require = originalRequire;
