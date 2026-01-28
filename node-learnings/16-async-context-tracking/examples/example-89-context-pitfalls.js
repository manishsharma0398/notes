/**
 * Example 89: Common Pitfalls and Solutions
 * 
 * Demonstrates common pitfalls when using AsyncLocalStorage:
 * - Context outside storage.run()
 * - Nested storage.run() calls
 * - Context in worker threads
 * - Memory leaks
 * 
 * Run with: node example-89-context-pitfalls.js
 * 
 * What to observe:
 * - Common mistakes and how to avoid them
 * - Best practices for using AsyncLocalStorage
 */

const { AsyncLocalStorage } = require('async_hooks');

console.log('=== Common Pitfalls and Solutions ===\n');

const storage = new AsyncLocalStorage();

// Pitfall 1: Accessing context outside storage.run()
console.log('--- Pitfall 1: Context Outside storage.run() ---');
try {
  const context = storage.getStore();
  console.log('Context:', context); // undefined
  console.log('❌ Context is undefined outside storage.run()');
} catch (e) {
  console.log('Error:', e.message);
}

// Solution: Always access context within storage.run()
console.log('\n✅ Solution: Access within storage.run()');
storage.run({ userId: 123 }, () => {
  const context = storage.getStore();
  console.log('Context:', context); // { userId: 123 }
});

// Pitfall 2: Nested storage.run() calls (context overwrite)
console.log('\n--- Pitfall 2: Nested storage.run() Calls ---');
storage.run({ userId: 123 }, () => {
  console.log('Outer context:', storage.getStore());
  
  storage.run({ userId: 456 }, () => {
    console.log('Inner context:', storage.getStore()); // { userId: 456 }
    // Outer context is overwritten!
  });
  
  console.log('Back to outer context:', storage.getStore()); // { userId: 123 }
});

// Solution: Merge contexts or use single storage.run()
console.log('\n✅ Solution: Merge contexts or use single run()');
storage.run({ userId: 123, requestId: 'req-1' }, () => {
  const outerContext = storage.getStore();
  
  // Merge contexts instead of overwriting
  storage.run({ ...outerContext, userId: 456 }, () => {
    const mergedContext = storage.getStore();
    console.log('Merged context:', mergedContext);
    // Both userId and requestId preserved
  });
});

// Pitfall 3: Context in callbacks created before storage.run()
console.log('\n--- Pitfall 3: Callbacks Created Before storage.run() ---');
let callback;

// Callback created before storage.run()
setTimeout(() => {
  callback = () => {
    const context = storage.getStore();
    console.log('Context in pre-created callback:', context); // undefined
  };
  
  // Now run storage.run()
  storage.run({ userId: 789 }, () => {
    console.log('Context in storage.run():', storage.getStore());
    callback(); // Context is undefined!
  });
}, 100);

// Solution: Create callbacks within storage.run()
console.log('\n✅ Solution: Create callbacks within storage.run()');
setTimeout(() => {
  storage.run({ userId: 999 }, () => {
    // Create callback within storage.run()
    const callback = () => {
      const context = storage.getStore();
      console.log('Context in callback created within run():', context); // Available!
    };
    
    setTimeout(callback, 50);
  });
}, 200);

// Pitfall 4: Not cleaning up context (memory leak with Async Hooks)
console.log('\n--- Pitfall 4: Memory Leak (Async Hooks) ---');
console.log('With Async Hooks, must clean up context in destroy hook');
console.log('AsyncLocalStorage handles this automatically ✅');

// Best practices
setTimeout(() => {
  console.log('\n=== Best Practices ===');
  console.log('1. ✅ Use AsyncLocalStorage instead of raw Async Hooks');
  console.log('2. ✅ Always access context within storage.run()');
  console.log('3. ✅ Create async operations within storage.run()');
  console.log('4. ✅ Use single storage instance per application');
  console.log('5. ✅ Merge contexts instead of nesting storage.run()');
  console.log('6. ✅ Don\'t pass context to worker threads (use messages)');
}, 300);
