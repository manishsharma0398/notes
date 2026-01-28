// Example 107: Why try/catch fails across async boundaries

function syncExample() {
  function b() {
    throw new Error('sync boom');
  }

  function a() {
    try {
      b();
    } catch (err) {
      console.log('[sync] Caught in a():', err.message);
    }
  }

  a();
}

function asyncExample() {
  function bAsync() {
    setTimeout(() => {
      // This throw happens on a new stack
      throw new Error('async boom');
    }, 0);
  }

  function a() {
    try {
      bAsync(); // Schedules timer and returns
    } catch (err) {
      // This will NEVER run
      console.log('[async] Caught in a():', err.message);
    }
  }

  a();
}

console.log('=== Synchronous example ===');
syncExample();

console.log('\n=== Asynchronous example (process will crash) ===');
asyncExample();

// Run this file:
//   node example-107-try-catch-async.js
//
// Observe:
// - The sync example prints the caught error.
// - The async example triggers an uncaught exception and terminates the process.
//
// Takeaway:
// - try/catch only works for errors on the current synchronous stack.
// - Once you cross an async boundary (setTimeout, I/O callback), you need a different error protocol.

