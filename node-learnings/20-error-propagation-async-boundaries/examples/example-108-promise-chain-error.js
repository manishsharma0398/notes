// Example 108: Error propagation in Promise chains

function doWork(value) {
  return new Promise((resolve, reject) => {
    if (value < 0) {
      return reject(new Error('negative not allowed'));
    }

    setTimeout(() => {
      // Simulate async work
      resolve(value * 2);
    }, 100);
  });
}

console.log('=== Promise chain with .catch() ===');

doWork(21)
  .then((result) => {
    console.log('First result:', result);
    // Throwing here turns into a rejection
    throw new Error('something went wrong after first result');
  })
  .then(() => {
    // This will be skipped
    console.log('This will not run');
  })
  .catch((err) => {
    console.log('Caught in .catch():', err.message);
  });

console.log('\n=== Missing .catch() (unhandled rejection) ===');

// This will trigger an unhandledRejection unless you have a global handler
doWork(-1)
  .then((result) => {
    console.log('Should not get here:', result);
  });

process.on('unhandledRejection', (reason, promise) => {
  console.log('[process] Unhandled rejection observed:', reason.message);
});

// Run:
//   node example-108-promise-chain-error.js
//
// Takeaways:
// - Throwing inside a .then() becomes a rejection.
// - Rejections propagate down the chain until a .catch() handles them.
// - If there is no .catch(), Node emits 'unhandledRejection'.

