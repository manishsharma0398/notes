// example-56-pipeline-basic.js
// Demonstrates stream.pipeline() — the safe way to chain streams
//
// pipeline() vs .pipe():
// - Both handle backpressure automatically
// - pipeline() ALSO: propagates errors, destroys all streams on error/finish
// - .pipe() does NOT propagate errors (see example-55)

const { pipeline } = require("stream");
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const INPUT = __filename;
const OUTPUT = path.join(__dirname, "example-56-output.txt.gz");

console.log("Compressing file using stream.pipeline()...");
console.log(`Input:  ${INPUT}`);
console.log(`Output: ${OUTPUT}\n`);

pipeline(
  // 1. Source
  fs.createReadStream(INPUT),

  // 2. Transform (gzip compression)
  zlib.createGzip(),

  // 3. Destination
  fs.createWriteStream(OUTPUT),

  // 4. Completion callback — called on SUCCESS or ERROR
  (err) => {
    if (err) {
      // Any stream in the chain errored
      // ALL streams have already been destroyed automatically
      console.error("❌ Pipeline failed:", err.message);
      return;
    }

    // Success — all data written
    const inSize = fs.statSync(INPUT).size;
    const outSize = fs.statSync(OUTPUT).size;
    const ratio = ((1 - outSize / inSize) * 100).toFixed(1);

    console.log("✅ Pipeline succeeded!");
    console.log(`   ${inSize} bytes → ${outSize} bytes (${ratio}% smaller)`);

    // Clean up
    fs.unlinkSync(OUTPUT);
  },
);

// Key observations:
// - signature: pipeline(source, ...transforms, destination, callback)
// - If createReadStream throws (e.g. file not found):
//     → all other streams are destroyed automatically
//     → callback is called with the error
//     → no file descriptor leaks
// - stream.pipeline() was added in Node.js 10
// - For async/await, use stream/promises (see example-58)
