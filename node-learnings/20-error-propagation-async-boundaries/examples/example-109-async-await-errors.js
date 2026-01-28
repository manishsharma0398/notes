// Example 109: async/await error propagation

const fs = require('fs').promises;

async function low() {
  // This will reject with ENOENT
  return fs.readFile('non-existent-file.txt', 'utf8');
}

async function mid() {
  // No try/catch here, let it bubble
  const data = await low();
  return data.toUpperCase();
}

async function top() {
  try {
    const result = await mid();
    console.log('Result:', result);
  } catch (err) {
    console.log('[top] Caught error:', err.code, err.message);
  }
}

top().catch((err) => {
  // Defensive: top() already catches, but good pattern at top-level
  console.error('[top-level catch] Should not see:', err);
});

// Run:
//   node example-109-async-await-errors.js
//
// Takeaways:
// - async/await lets you use try/catch across async boundaries
//   as long as errors are represented as Promise rejections.
// - low() → rejected Promise → mid() → rejected → top()'s try/catch.

