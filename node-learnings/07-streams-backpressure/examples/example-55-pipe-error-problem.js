// example-55-pipe-error-problem.js
// Demonstrates the HIDDEN PROBLEM with .pipe(): errors don't propagate
//
// When ANY stream emits an error, the OTHER streams are NOT automatically
// destroyed → leads to file descriptor leaks, zombie processes, memory leaks

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const NON_EXISTENT = path.join(__dirname, "this-file-does-not-exist.txt");
const OUTPUT = path.join(__dirname, "output-pipe-test.txt.gz");

console.log("=== Demo 1: .pipe() with NO error handling (BAD) ===\n");

// BAD: .pipe() with no error handling on a non-existent file
const badSrc = fs.createReadStream(NON_EXISTENT);
const badGz = zlib.createGzip();
const badDst = fs.createWriteStream(OUTPUT);

badSrc.pipe(badGz).pipe(badDst);

// What happens:
// - badSrc emits 'error' (ENOENT: file not found)
// - badSrc is destroyed
// - badGz and badDst are NOT destroyed → FILE DESCRIPTOR LEAK
// - The process does NOT exit (hanging streams)

// We need to manually listen to survive the demo:
badSrc.on("error", (err) => {
  console.log("❌ Error on src:", err.code);
  console.log("   badGz destroyed?", badGz.destroyed); // false — LEAK
  console.log("   badDst destroyed?", badDst.destroyed); // false — LEAK
  console.log("   → These streams are STILL OPEN. Resource leak!\n");

  // Clean up manually (what pipeline() would do automatically)
  badGz.destroy();
  badDst.destroy();
  try {
    fs.unlinkSync(OUTPUT);
  } catch {}

  runGoodDemo();
});

function runGoodDemo() {
  console.log("=== Demo 2: Same scenario with stream.pipeline() (GOOD) ===\n");

  const { pipeline } = require("stream");

  const goodSrc = fs.createReadStream(NON_EXISTENT);
  const goodGz = zlib.createGzip();
  const goodDst = fs.createWriteStream(OUTPUT);

  pipeline(goodSrc, goodGz, goodDst, (err) => {
    if (err) {
      console.log("✅ Error caught by pipeline:", err.code);
      console.log("   goodGz destroyed?", goodGz.destroyed); // true
      console.log("   goodDst destroyed?", goodDst.destroyed); // true
      console.log("   → All streams cleaned up automatically. No leak!");
    }
    try {
      fs.unlinkSync(OUTPUT);
    } catch {}
  });
}

// Key observations:
// - .pipe() ONLY handles backpressure — NOT errors
// - Errors require manual .on('error', ...) on EVERY stream in the chain
// - Forgetting even one stream = resource leak
// - stream.pipeline() fixes this: one callback handles all errors
// - pipeline() destroys ALL streams on any error
