// example-58-pipeline-promises.js
// Demonstrates stream.pipeline() with async/await (Node.js 15+)
//
// Requires: Node.js 15+
// Import from 'stream/promises' — not 'stream'

const { pipeline } = require("stream/promises"); // ← note: stream/promises
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const INPUT = __filename;
const OUTPUT = path.join(__dirname, "example-58-output.txt.gz");

// Async/await version — clean and readable
async function compressFile(inputPath, outputPath) {
  console.log(`Compressing: ${path.basename(inputPath)}`);

  try {
    await pipeline(
      fs.createReadStream(inputPath),
      zlib.createGzip(),
      fs.createWriteStream(outputPath),
    );
    // ↑ No callback needed — errors throw, success resolves

    const inSize = fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;
    const ratio = ((1 - outSize / inSize) * 100).toFixed(1);

    console.log(`✅ Success! ${inSize}B → ${outSize}B (${ratio}% smaller)`);
    return { inputSize: inSize, outputSize: outSize };
  } catch (err) {
    // All streams have already been cleaned up by the time we get here
    console.error("❌ Compression failed:", err.message);
    console.error("   All streams destroyed automatically:", err.code || "");
    throw err; // re-throw if caller needs to handle it
  } finally {
    // Clean up
    try {
      fs.unlinkSync(outputPath);
    } catch {}
  }
}

// Demo: compress a file, then try with non-existent file
async function main() {
  console.log("=== Test 1: Valid file ===");
  await compressFile(INPUT, OUTPUT);

  console.log("\n=== Test 2: Non-existent file (error path) ===");
  try {
    await compressFile("does-not-exist.txt", OUTPUT);
  } catch {
    console.log("Error handled — moving on\n");
  }

  console.log("Main function completed normally.");
}

main().catch(console.error);

// Key observations:
// - stream/promises is available in Node.js 15+
// - For Node.js 10-14: use the callback-based pipeline() from 'stream'
// - No explicit callback needed — await pipeline(...) resolves on finish
// - Errors throw as normal exceptions → caught by catch block
// - All streams are destroyed on both success and error (same as callback style)
// - Works naturally with try/catch/finally patterns
