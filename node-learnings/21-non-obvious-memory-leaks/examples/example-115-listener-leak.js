// Example 115: Event listener leak vs unsubscribe

const { EventEmitter } = require('events');

const emitter = new EventEmitter();

// BAD: Subscribe and never unsubscribe
function subscribeBad(userId) {
  function onMessage(msg) {
    // Captures userId in closure
    console.log('[BAD]', userId, 'received:', msg);
  }
  emitter.on('message', onMessage);
}

// GOOD: Return explicit unsubscribe and use it
function subscribeGood(userId) {
  function onMessage(msg) {
    console.log('[GOOD]', userId, 'received:', msg);
  }
  emitter.on('message', onMessage);
  return () => emitter.off('message', onMessage);
}

async function demo() {
  console.log('=== Listener leak demo ===');

  // Simulate many transient users
  for (let i = 0; i < 5000; i++) {
    subscribeBad(`bad-user-${i}`);
  }

  console.log('BAD listener count:', emitter.listenerCount('message'));

  // Now add good users and then unsubscribe them
  const unsubscribers = [];
  for (let i = 0; i < 5000; i++) {
    const unsubscribe = subscribeGood(`good-user-${i}`);
    unsubscribers.push(unsubscribe);
  }

  console.log('Total listener count (before cleanup):', emitter.listenerCount('message'));

  // Unsubscribe good listeners
  unsubscribers.forEach((fn) => fn());

  console.log('Listener count after cleaning GOOD listeners:', emitter.listenerCount('message'));

  // Emit one message
  emitter.emit('message', 'hello');
}

demo().catch(console.error);

// Run:
//   node example-115-listener-leak.js
//
// Observe:
// - BAD listeners accumulate and never go away.
// - GOOD listeners are added then removed, keeping listenerCount stable.

