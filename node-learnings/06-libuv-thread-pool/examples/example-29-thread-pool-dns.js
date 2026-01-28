// example-29-thread-pool-dns.js
// Demonstrates that DNS operations use the thread pool

const dns = require('dns');

console.log('1: Start');

// DNS lookups use the thread pool
// With default 4 threads, only 4 run in parallel
dns.lookup('google.com', () => {
  console.log('2: DNS lookup 1 complete');
});

dns.lookup('github.com', () => {
  console.log('3: DNS lookup 2 complete');
});

dns.lookup('nodejs.org', () => {
  console.log('4: DNS lookup 3 complete');
});

dns.lookup('npmjs.com', () => {
  console.log('5: DNS lookup 4 complete');
});

// 5th DNS lookup waits in queue
dns.lookup('stackoverflow.com', () => {
  console.log('6: DNS lookup 5 complete (queued)');
});

console.log('7: End');

// Expected output:
// 1: Start
// 7: End
// 2-5: DNS lookup complete (order may vary, 4 run in parallel)
// 6: DNS lookup 5 complete (queued, executes after one completes)
//
// Key observation:
// - DNS lookups compete with file operations for thread pool resources
// - Only 4 DNS lookups run in parallel (default thread pool size)
// - 5th DNS lookup waits in queue
