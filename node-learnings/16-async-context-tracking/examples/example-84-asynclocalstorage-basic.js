/**
 * Example 84: Basic AsyncLocalStorage Usage
 * 
 * Demonstrates basic AsyncLocalStorage usage:
 * - Creating storage instance
 * - Setting context with storage.run()
 * - Retrieving context with storage.getStore()
 * - Context propagation across async operations
 * 
 * Run with: node example-84-asynclocalstorage-basic.js
 * 
 * What to observe:
 * - Context is available within storage.run() callback
 * - Context propagates to nested async operations
 * - Context is undefined outside storage.run()
 */

const { AsyncLocalStorage } = require('async_hooks');

console.log('=== Basic AsyncLocalStorage Usage ===\n');

// Create storage instance
const storage = new AsyncLocalStorage();

// Test 1: Basic usage
console.log('--- Test 1: Basic Usage ---');

storage.run({ userId: 123, requestId: 'req-1' }, () => {
  const context = storage.getStore();
  console.log('Context:', context);
  console.log(`User ID: ${context.userId}`);
  console.log(`Request ID: ${context.requestId}`);
});

// Test 2: Context outside run() is undefined
console.log('\n--- Test 2: Context Outside run() ---');
const contextOutside = storage.getStore();
console.log('Context outside run():', contextOutside); // undefined

// Test 3: Context propagation to setTimeout
console.log('\n--- Test 3: Context Propagation to setTimeout ---');

storage.run({ userId: 456, requestId: 'req-2' }, () => {
  console.log('Before setTimeout:', storage.getStore());
  
  setTimeout(() => {
    const context = storage.getStore();
    console.log('Inside setTimeout:', context);
    console.log(`User ID: ${context.userId}`); // Still available!
  }, 100);
});

// Test 4: Context propagation to Promise
console.log('\n--- Test 4: Context Propagation to Promise ---');

storage.run({ userId: 789, requestId: 'req-3' }, () => {
  console.log('Before Promise:', storage.getStore());
  
  Promise.resolve().then(() => {
    const context = storage.getStore();
    console.log('Inside Promise.then():', context);
    console.log(`User ID: ${context.userId}`); // Still available!
  });
});

// Test 5: Nested async operations
console.log('\n--- Test 5: Nested Async Operations ---');

storage.run({ userId: 999, requestId: 'req-4' }, () => {
  console.log('Level 1:', storage.getStore());
  
  setTimeout(() => {
    console.log('Level 2 (setTimeout):', storage.getStore());
    
    Promise.resolve().then(() => {
      console.log('Level 3 (Promise):', storage.getStore());
      
      setTimeout(() => {
        console.log('Level 4 (setTimeout):', storage.getStore());
        // Context still available at all levels!
      }, 50);
    });
  }, 50);
});

// Wait for async operations
setTimeout(() => {
  console.log('\n=== Key Observations ===');
  console.log('1. Context is only available within storage.run() callback');
  console.log('2. Context propagates automatically to nested async operations');
  console.log('3. Context is undefined outside storage.run()');
  console.log('4. Context persists across setTimeout, Promise, and other async operations');
}, 200);
