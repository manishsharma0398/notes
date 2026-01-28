/**
 * Example 85: Context Isolation Between Concurrent Requests
 * 
 * Demonstrates how AsyncLocalStorage provides isolated context
 * for concurrent requests without race conditions.
 * 
 * Run with: node example-85-context-isolation.js
 * 
 * What to observe:
 * - Each request has its own isolated context
 * - Contexts don't interfere with each other
 * - No race conditions (unlike global variables)
 */

const { AsyncLocalStorage } = require('async_hooks');

console.log('=== Context Isolation ===\n');

const storage = new AsyncLocalStorage();

// Simulate concurrent requests
console.log('--- Simulating Concurrent Requests ---');

// Request 1
storage.run({ userId: 123, requestId: 'req-1', startTime: Date.now() }, () => {
  console.log('[Request 1] Context:', storage.getStore());
  
  setTimeout(() => {
    const context = storage.getStore();
    console.log(`[Request 1] After 100ms: User ${context.userId}, Request ${context.requestId}`);
  }, 100);
});

// Request 2 (runs concurrently)
storage.run({ userId: 456, requestId: 'req-2', startTime: Date.now() }, () => {
  console.log('[Request 2] Context:', storage.getStore());
  
  setTimeout(() => {
    const context = storage.getStore();
    console.log(`[Request 2] After 50ms: User ${context.userId}, Request ${context.requestId}`);
  }, 50);
});

// Request 3 (runs concurrently)
storage.run({ userId: 789, requestId: 'req-3', startTime: Date.now() }, () => {
  console.log('[Request 3] Context:', storage.getStore());
  
  setTimeout(() => {
    const context = storage.getStore();
    console.log(`[Request 3] After 150ms: User ${context.userId}, Request ${context.requestId}`);
  }, 150);
});

// Compare with global variables (BAD)
console.log('\n--- Comparison: Global Variables (BAD) ---');

let currentUserId; // Global variable

function handleRequestWithGlobal(userId) {
  currentUserId = userId; // Overwrites previous value!
  
  setTimeout(() => {
    console.log(`[Global] User ID: ${currentUserId}`); // Might be wrong!
  }, Math.random() * 100);
}

// Simulate concurrent requests with globals
handleRequestWithGlobal(111);
handleRequestWithGlobal(222);
handleRequestWithGlobal(333);

// Wait for async operations
setTimeout(() => {
  console.log('\n=== Key Observations ===');
  console.log('1. AsyncLocalStorage provides isolated context per request');
  console.log('2. No race conditions (each request has its own context)');
  console.log('3. Global variables cause race conditions (values overwrite each other)');
  console.log('4. Context isolation is automatic (no manual synchronization needed)');
}, 200);
