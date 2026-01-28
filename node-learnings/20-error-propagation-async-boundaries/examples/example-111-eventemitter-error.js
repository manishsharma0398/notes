// Example 111: EventEmitter 'error' events

const { EventEmitter } = require('events');

function demoWithoutErrorListener() {
  console.log('=== Without error listener (will crash) ===');

  const emitter = new EventEmitter();

  // No 'error' listener attached
  setTimeout(() => {
    emitter.emit('error', new Error('something went wrong'));
  }, 10);
}

function demoWithErrorListener() {
  console.log('\n=== With error listener (safe) ===');

  const emitter = new EventEmitter();

  emitter.on('error', (err) => {
    console.log('[listener] Caught emitter error:', err.message);
  });

  setTimeout(() => {
    emitter.emit('error', new Error('something went wrong'));
  }, 10);
}

// Comment/uncomment to observe behavior separately
// demoWithoutErrorListener();
demoWithErrorListener();

// Run:
//   node example-111-eventemitter-error.js
//
// If you enable demoWithoutErrorListener():
// - Node will throw: "Error [ERR_UNHANDLED_ERROR]: Unhandled error."
// - Process will exit.
//
// Takeaways:
// - Any EventEmitter that can fail should have an 'error' listener.
// - Missing 'error' listeners turn errors into uncaught exceptions.

