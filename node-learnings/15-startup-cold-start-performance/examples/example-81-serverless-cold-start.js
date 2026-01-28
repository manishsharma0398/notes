/**
 * Example 81: Serverless Cold Start Simulation
 * 
 * Simulates serverless cold start behavior:
 * - Cold start: Full startup pipeline runs
 * - Warm start: Process reused, minimal overhead
 * 
 * Run with: node example-81-serverless-cold-start.js
 * 
 * What to observe:
 * - Cold start vs warm start timing
 * - Impact of module loading on cold starts
 * - Optimization strategies
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('=== Serverless Cold Start Simulation ===\n');

// Simulate serverless function
function simulateColdStart() {
  const start = performance.now();
  const phases = {};
  
  // Phase 1: Process creation
  phases.processCreation = performance.now() - start;
  
  // Phase 2: V8 initialization (simulated)
  const v8Start = performance.now();
  // Simulate V8 init overhead
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += i;
  }
  phases.v8Init = performance.now() - v8Start;
  
  // Phase 3: Module loading
  const moduleStart = performance.now();
  const modules = ['fs', 'path', 'http', 'util', 'events', 'crypto'];
  modules.forEach(mod => require(mod));
  phases.moduleLoading = performance.now() - moduleStart;
  
  // Phase 4: Application initialization
  const appStart = performance.now();
  // Simulate config loading
  const config = { region: 'us-east-1', timeout: 30 };
  // Simulate connection setup (would be async in real app)
  const connected = true;
  phases.appInit = performance.now() - appStart;
  
  // Phase 5: Function handler execution
  const handlerStart = performance.now();
  // Simulate function logic
  const result = { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) };
  phases.handlerExecution = performance.now() - handlerStart;
  
  phases.total = performance.now() - start;
  
  return { phases, result };
}

// Simulate warm start (process already exists)
function simulateWarmStart() {
  const start = performance.now();
  
  // Only handler execution (everything else is cached)
  const handlerStart = performance.now();
  const result = { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) };
  const handlerTime = performance.now() - handlerStart;
  
  const total = performance.now() - start;
  
  return { handlerTime, total, result };
}

console.log('--- Cold Start (First Invocation) ---');
const coldStart = simulateColdStart();
console.log(`Process creation: ${coldStart.phases.processCreation.toFixed(2)}ms`);
console.log(`V8 initialization: ${coldStart.phases.v8Init.toFixed(2)}ms`);
console.log(`Module loading: ${coldStart.phases.moduleLoading.toFixed(2)}ms`);
console.log(`Application initialization: ${coldStart.phases.appInit.toFixed(2)}ms`);
console.log(`Handler execution: ${coldStart.phases.handlerExecution.toFixed(2)}ms`);
console.log(`─────────────────────────────────────`);
console.log(`Total cold start: ${coldStart.phases.total.toFixed(2)}ms`);

console.log('\n--- Warm Start (Subsequent Invocation) ---');
const warmStart = simulateWarmStart();
console.log(`Handler execution: ${warmStart.handlerTime.toFixed(2)}ms`);
console.log(`Process thaw overhead: ${(warmStart.total - warmStart.handlerTime).toFixed(2)}ms`);
console.log(`─────────────────────────────────────`);
console.log(`Total warm start: ${warmStart.total.toFixed(2)}ms`);

console.log('\n=== Comparison ===');
const speedup = coldStart.phases.total / warmStart.total;
console.log(`Cold start: ${coldStart.phases.total.toFixed(2)}ms`);
console.log(`Warm start: ${warmStart.total.toFixed(2)}ms`);
console.log(`Speedup: ${speedup.toFixed(1)}x faster`);

// Optimized cold start (lazy loading)
console.log('\n--- Optimized Cold Start (Lazy Loading) ---');

function simulateOptimizedColdStart() {
  const start = performance.now();
  const phases = {};
  
  phases.processCreation = performance.now() - start;
  
  // V8 init (same)
  const v8Start = performance.now();
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += i;
  }
  phases.v8Init = performance.now() - v8Start;
  
  // Minimal module loading (only essential)
  const moduleStart = performance.now();
  require('fs'); // Only essential modules
  phases.moduleLoading = performance.now() - moduleStart;
  
  // Deferred initialization (not at startup)
  phases.appInit = 0; // Deferred to handler
  
  // Handler execution (loads modules on-demand)
  const handlerStart = performance.now();
  // Load modules only when needed
  const path = require('path');
  const http = require('http');
  const result = { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) };
  phases.handlerExecution = performance.now() - handlerStart;
  
  phases.total = performance.now() - start;
  
  return { phases, result };
}

const optimizedColdStart = simulateOptimizedColdStart();
console.log(`Process creation: ${optimizedColdStart.phases.processCreation.toFixed(2)}ms`);
console.log(`V8 initialization: ${optimizedColdStart.phases.v8Init.toFixed(2)}ms`);
console.log(`Module loading: ${optimizedColdStart.phases.moduleLoading.toFixed(2)}ms`);
console.log(`Application initialization: ${optimizedColdStart.phases.appInit.toFixed(2)}ms (deferred)`);
console.log(`Handler execution: ${optimizedColdStart.phases.handlerExecution.toFixed(2)}ms`);
console.log(`─────────────────────────────────────`);
console.log(`Total optimized cold start: ${optimizedColdStart.phases.total.toFixed(2)}ms`);

console.log('\n=== Optimization Impact ===');
const improvement = ((coldStart.phases.total - optimizedColdStart.phases.total) / coldStart.phases.total) * 100;
console.log(`Original cold start: ${coldStart.phases.total.toFixed(2)}ms`);
console.log(`Optimized cold start: ${optimizedColdStart.phases.total.toFixed(2)}ms`);
console.log(`Improvement: ${improvement.toFixed(1)}% faster`);

console.log('\n=== Optimization Strategies ===');
console.log('1. Lazy loading: Load modules on-demand in handler');
console.log('2. Reduce dependencies: Only load essential modules at startup');
console.log('3. Defer initialization: Move init code to handler');
console.log('4. Bundle optimization: Smaller bundles = faster cold starts');
console.log('5. Provisioned concurrency: Keep instances warm (costs money)');
