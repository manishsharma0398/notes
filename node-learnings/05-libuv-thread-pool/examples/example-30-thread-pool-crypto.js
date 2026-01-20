// example-30-thread-pool-crypto.js
// Demonstrates that crypto operations use the thread pool

const crypto = require('crypto');

console.log('1: Start');

// Crypto operations use the thread pool
// With default 4 threads, only 4 run in parallel
// These are CPU-intensive and will take some time
crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('2: Crypto 1 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('3: Crypto 2 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('4: Crypto 3 complete');
});

crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('5: Crypto 4 complete');
});

// 5th crypto operation waits in queue
crypto.pbkdf2('password', 'salt', 100000, 64, 'sha512', () => {
  console.log('6: Crypto 5 complete (queued)');
});

console.log('7: End');

// Expected output:
// 1: Start
// 7: End (event loop continues, not blocked)
// 2-5: Crypto complete (order may vary, 4 run in parallel)
// 6: Crypto 5 complete (queued, executes after one completes)
//
// Key observation:
// - Crypto operations block thread pool threads, not the event loop
// - Event loop continues processing other operations
// - Only 4 crypto operations run in parallel
// - 5th crypto operation waits in queue
