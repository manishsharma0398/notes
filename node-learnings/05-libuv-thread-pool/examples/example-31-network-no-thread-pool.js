// example-31-network-no-thread-pool.js
// Demonstrates that network operations do NOT use the thread pool

const http = require('http');

console.log('1: Start');

// Network operations do NOT use the thread pool
// They use OS-level async I/O (epoll, kqueue, etc.)
// These can run in parallel without thread pool limits
http.get('http://example.com', (res) => {
  res.on('data', () => {});
  res.on('end', () => {
    console.log('2: HTTP request 1 complete');
  });
});

http.get('http://example.com', (res) => {
  res.on('data', () => {});
  res.on('end', () => {
    console.log('3: HTTP request 2 complete');
  });
});

http.get('http://example.com', (res) => {
  res.on('data', () => {});
  res.on('end', () => {
    console.log('4: HTTP request 3 complete');
  });
});

// These can all run in parallel without thread pool
// OS handles async I/O directly
console.log('5: End');

// Expected output:
// 1: Start
// 5: End
// 2-4: HTTP request complete (order may vary, all can run in parallel)
//
// Key observation:
// - Network I/O doesn't use the thread pool
// - Doesn't compete with file I/O for thread pool resources
// - OS handles async I/O directly
// - Can handle many concurrent connections without thread pool limits
