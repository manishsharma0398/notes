// example-26-io-ordering.js
// Demonstrates that I/O callbacks are not guaranteed to execute in submission order

const fs = require('fs');

console.log('1: Start');

// File 1: Small file (fast)
fs.readFile(__filename, () => {
  console.log('2: Small file complete');
});

// File 2: Large file (slow)
// Note: In this example, both files are the same (__filename)
// In real scenarios, different files would complete at different times
fs.readFile(__filename, () => {
  console.log('3: Large file complete');
});

console.log('4: End');

// Expected output (non-deterministic):
// Could be:
// 1: Start
// 4: End
// 2: Small file complete
// 3: Large file complete
//
// OR:
// 1: Start
// 4: End
// 3: Large file complete
// 2: Small file complete
//
// Explanation:
// - I/O callbacks execute when OS completes operations
// - Order depends on OS, disk, caching, etc.
// - Submission order does NOT guarantee execution order
//
// In production, use Promises or callbacks for explicit ordering:
// fs.promises.readFile('file1.txt')
//   .then(() => fs.promises.readFile('file2.txt'))
//   .then(() => console.log('Both files read in order'));
