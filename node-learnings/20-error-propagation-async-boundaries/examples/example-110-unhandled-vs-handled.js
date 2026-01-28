// Example 110: unhandledRejection vs handled errors

function failingPromise() {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('async failure'));
    }, 50);
  });
}

async function demoHandled() {
  console.log('=== Handled rejection with async/await ===');
  try {
    await failingPromise();
  } catch (err) {
    console.log('[handled] Caught error:', err.message);
  }
}

async function demoUnhandled() {
  console.log('\n=== Unhandled rejection example ===');
  // Fire-and-forget: no await, no .catch()
  failingPromise();
}

process.on('unhandledRejection', (reason, promise) => {
  console.log('[process] unhandledRejection for promise:', promise.constructor.name);
  console.log('[process] reason:', reason.message);
});

(async () => {
  await demoHandled();
  await demoUnhandled();
})();

// Run:
//   node example-110-unhandled-vs-handled.js
//
// Takeaways:
// - Every Promise must be either awaited or have a .catch().
// - Unhandled rejections surface at process level; treat them like programmer errors.

