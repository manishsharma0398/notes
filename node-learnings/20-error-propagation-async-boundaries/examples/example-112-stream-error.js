// Example 112: Stream error handling with pipeline

const fs = require('fs');
const { pipeline } = require('stream');

function demoWithoutErrorHandling() {
  console.log('=== Without proper stream error handling ===');

  const src = fs.createReadStream('non-existent-file.txt');

  // No 'error' handlers and no pipeline callback
  src.pipe(process.stdout);
}

function demoWithPipeline() {
  console.log('\n=== With pipeline error handling ===');

  pipeline(
    fs.createReadStream('non-existent-file.txt'),
    process.stdout,
    (err) => {
      if (err) {
        console.log('[pipeline] Caught error:', err.code, err.message);
      } else {
        console.log('[pipeline] Completed successfully');
      }
    }
  );
}

// Comment/uncomment to test:
// demoWithoutErrorHandling();
demoWithPipeline();

// Run:
//   node example-112-stream-error.js
//
// Takeaways:
// - Streams emit 'error' when underlying I/O fails.
// - Using pipeline centralizes error and completion handling.

