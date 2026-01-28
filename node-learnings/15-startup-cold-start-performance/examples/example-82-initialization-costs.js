/**
 * Example 82: Measuring Initialization Costs
 * 
 * Demonstrates the cost of different initialization strategies:
 * - Synchronous initialization (blocks startup)
 * - Asynchronous initialization (non-blocking)
 * - Deferred initialization (on-demand)
 * 
 * Run with: node example-82-initialization-costs.js
 * 
 * What to observe:
 * - Cost of synchronous initialization
 * - Benefits of async/deferred initialization
 * - Impact on startup time
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

console.log('=== Initialization Costs ===\n');

// Create test files for initialization
const dir = __dirname;
const configFile = path.join(dir, 'config.json');
const dataFile = path.join(dir, 'data.json');

// Setup test files
fs.writeFileSync(configFile, JSON.stringify({
  port: 3000,
  host: 'localhost',
  database: { url: 'mongodb://localhost:27017' },
  cache: { ttl: 3600 }
}));

fs.writeFileSync(dataFile, JSON.stringify(
  new Array(1000).fill(0).map((_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random()
  }))
));

// Test 1: Synchronous initialization (blocks startup)
console.log('--- Test 1: Synchronous Initialization (blocks startup) ---');
const syncStart = performance.now();

// Synchronous file I/O
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Synchronous processing
const processedData = data.map(item => ({
  ...item,
  processed: true,
  timestamp: Date.now()
}));

const syncEnd = performance.now();
const syncTime = syncEnd - syncStart;

console.log(`Config loaded: ${Object.keys(config).length} keys`);
console.log(`Data loaded: ${data.length} items`);
console.log(`Data processed: ${processedData.length} items`);
console.log(`Initialization time: ${syncTime.toFixed(2)}ms`);
console.log(`⚠️  Startup blocked for ${syncTime.toFixed(2)}ms`);

// Test 2: Asynchronous initialization (non-blocking)
console.log('\n--- Test 2: Asynchronous Initialization (non-blocking) ---');
const asyncStart = performance.now();

let asyncConfig, asyncData, asyncProcessed;

async function asyncInit() {
  // Async file I/O
  const configContent = await fs.promises.readFile(configFile, 'utf8');
  asyncConfig = JSON.parse(configContent);
  
  const dataContent = await fs.promises.readFile(dataFile, 'utf8');
  asyncData = JSON.parse(dataContent);
  
  // Async processing
  asyncProcessed = asyncData.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now()
  }));
  
  return { config: asyncConfig, data: asyncProcessed };
}

// Start async init (doesn't block)
const initPromise = asyncInit();
const asyncEnd = performance.now();
const asyncStartupTime = asyncEnd - asyncStart;

console.log(`Startup time: ${asyncStartupTime.toFixed(2)}ms`);
console.log(`Initialization started (non-blocking)`);

// Wait for initialization
const initStart = performance.now();
await initPromise;
const initEnd = performance.now();

console.log(`Initialization completed in ${(initEnd - initStart).toFixed(2)}ms`);
console.log(`Total time: ${(initEnd - asyncStart).toFixed(2)}ms`);
console.log(`✅ Startup not blocked (${asyncStartupTime.toFixed(2)}ms vs ${syncTime.toFixed(2)}ms)`);

// Test 3: Deferred initialization (on-demand)
console.log('\n--- Test 3: Deferred Initialization (on-demand) ---');
const deferredStart = performance.now();

let deferredConfig, deferredData;

function getConfig() {
  if (!deferredConfig) {
    deferredConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
  return deferredConfig;
}

function getData() {
  if (!deferredData) {
    const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    deferredData = raw.map(item => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }));
  }
  return deferredData;
}

const deferredEnd = performance.now();
const deferredStartupTime = deferredEnd - deferredStart;

console.log(`Startup time: ${deferredStartupTime.toFixed(2)}ms`);
console.log(`No initialization at startup`);

// Simulate first request (triggers initialization)
console.log('\n--- Simulating First Request ---');
const firstRequestStart = performance.now();
const config = getConfig();
const data = getData();
const firstRequestEnd = performance.now();

console.log(`First request initialization: ${(firstRequestEnd - firstRequestStart).toFixed(2)}ms`);
console.log(`Config loaded: ${Object.keys(config).length} keys`);
console.log(`Data loaded: ${data.length} items`);

// Simulate second request (uses cached)
console.log('\n--- Simulating Second Request ---');
const secondRequestStart = performance.now();
const config2 = getConfig();
const data2 = getData();
const secondRequestEnd = performance.now();

console.log(`Second request (cached): ${(secondRequestEnd - secondRequestStart).toFixed(2)}ms`);
console.log(`Same objects: ${config === config2 && data === data2 ? 'Yes' : 'No'}`);

// Comparison
console.log('\n=== Comparison ===');
console.log(`Synchronous init: ${syncTime.toFixed(2)}ms (blocks startup)`);
console.log(`Async init startup: ${asyncStartupTime.toFixed(2)}ms (non-blocking)`);
console.log(`Deferred init startup: ${deferredStartupTime.toFixed(2)}ms (no init)`);
console.log(`\nStartup improvement:`);
console.log(`  Async: ${(syncTime - asyncStartupTime).toFixed(2)}ms faster`);
console.log(`  Deferred: ${(syncTime - deferredStartupTime).toFixed(2)}ms faster`);

// Cleanup
fs.unlinkSync(configFile);
fs.unlinkSync(dataFile);

console.log('\n=== Key Observations ===');
console.log('1. Synchronous initialization blocks startup');
console.log('2. Async initialization allows startup to proceed');
console.log('3. Deferred initialization eliminates startup cost');
console.log('4. First request may be slower with deferred init, but startup is faster');
console.log('5. Choose strategy based on requirements (startup vs first request)');
