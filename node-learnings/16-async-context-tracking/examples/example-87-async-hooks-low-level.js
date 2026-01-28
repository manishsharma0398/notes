/**
 * Example 87: Low-Level Async Hooks API
 * 
 * Demonstrates the low-level Async Hooks API:
 * - Creating hooks with createHook()
 * - Tracking async resource lifecycle
 * - Manual context management
 * 
 * Run with: node example-87-async-hooks-low-level.js
 * 
 * What to observe:
 * - Async resource lifecycle events
 * - Manual context storage and retrieval
 * - Complexity compared to AsyncLocalStorage
 */

const async_hooks = require('async_hooks');

console.log('=== Low-Level Async Hooks API ===\n');

// Manual context storage
const context = new Map();

// Track async resource lifecycle
const hook = async_hooks.createHook({
  init(asyncId, type, triggerAsyncId, resource) {
    // Resource created
    console.log(`[init] asyncId: ${asyncId}, type: ${type}, trigger: ${triggerAsyncId}`);
    
    // Propagate context from parent
    if (context.has(triggerAsyncId)) {
      context.set(asyncId, context.get(triggerAsyncId));
      console.log(`  → Context propagated from ${triggerAsyncId}`);
    }
  },
  
  before(asyncId) {
    // Resource callback about to execute
    console.log(`[before] asyncId: ${asyncId}`);
  },
  
  after(asyncId) {
    // Resource callback finished
    console.log(`[after] asyncId: ${asyncId}`);
  },
  
  destroy(asyncId) {
    // Resource destroyed
    console.log(`[destroy] asyncId: ${asyncId}`);
    
    // Clean up context
    context.delete(asyncId);
  },
  
  promiseResolve(asyncId) {
    // Promise resolved
    console.log(`[promiseResolve] asyncId: ${asyncId}`);
  }
});

hook.enable();

console.log('--- Test 1: setTimeout ---');
const timeoutId = async_hooks.executionAsyncId();
context.set(timeoutId, { userId: 123, requestId: 'req-1' });
console.log(`Root context set: ${JSON.stringify(context.get(timeoutId))}`);

setTimeout(() => {
  const currentId = async_hooks.executionAsyncId();
  const currentContext = context.get(currentId);
  console.log(`\nInside setTimeout:`);
  console.log(`  asyncId: ${currentId}`);
  console.log(`  context: ${JSON.stringify(currentContext)}`);
}, 100);

console.log('\n--- Test 2: Promise ---');
const promiseId = async_hooks.executionAsyncId();
context.set(promiseId, { userId: 456, requestId: 'req-2' });
console.log(`Root context set: ${JSON.stringify(context.get(promiseId))}`);

Promise.resolve().then(() => {
  const currentId = async_hooks.executionAsyncId();
  const currentContext = context.get(currentId);
  console.log(`\nInside Promise.then():`);
  console.log(`  asyncId: ${currentId}`);
  console.log(`  context: ${JSON.stringify(currentContext)}`);
});

// Wait for async operations
setTimeout(() => {
  console.log('\n=== Key Observations ===');
  console.log('1. Async Hooks provide low-level control over async resource lifecycle');
  console.log('2. Manual context management is complex (must store/retrieve manually)');
  console.log('3. Must clean up context in destroy hook to prevent leaks');
  console.log('4. AsyncLocalStorage is much simpler (handles this automatically)');
  
  hook.disable();
}, 200);
