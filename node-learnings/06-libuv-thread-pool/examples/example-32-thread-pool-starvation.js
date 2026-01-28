// example-32-thread-pool-starvation.js
// Demonstrates thread pool starvation

const fs = require('fs');
const crypto = require('crypto');

console.log('1: Start');
const startTime = Date.now();

// Fill thread pool with slow crypto operations
// These will block all 4 threads
for (let i = 0; i < 4; i++) {
  crypto.pbkdf2('password', 'salt', 1000000, 64, 'sha512', () => {
    const elapsed = Date.now() - startTime;
    console.log(`Crypto ${i} complete (${elapsed}ms)`);
  });
}

// File operations wait in queue
// They can't start until crypto operations complete
fs.readFile(__filename, () => {
  const elapsed = Date.now() - startTime;
  console.log(`File read 1 complete (${elapsed}ms - delayed)`);
});

fs.readFile(__filename, () => {
  const elapsed = Date.now() - startTime;
  console.log(`File read 2 complete (${elapsed}ms - delayed)`);
});

console.log('2: End');

// Expected output:
// 1: Start
// 2: End
// Crypto 0-3 complete (order may vary, takes time)
// File read 1 complete (delayed - waited for crypto to complete)
// File read 2 complete (delayed - waited for crypto to complete)
//
// Key observation:
// - Thread pool is filled with crypto operations
// - File operations wait in queue
// - File operations are delayed by crypto operations
// - This is thread pool starvation
