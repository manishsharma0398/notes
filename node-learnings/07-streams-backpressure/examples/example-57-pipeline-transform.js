// example-57-pipeline-transform.js
// Demonstrates pipeline() with a custom Transform: ByteCounter pass-through
//
// ByteCounter is a "pass-through" Transform — it lets data through unchanged
// but counts the bytes as they flow past.

const { pipeline, Transform } = require("stream");
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// --- ByteCounter Transform ---
class ByteCounter extends Transform {
  constructor(label = "bytes") {
    super();
    this.label = label;
    this.bytesProcessed = 0;
  }

  _transform(chunk, encoding, callback) {
    this.bytesProcessed += chunk.length;
    this.push(chunk); // pass through unchanged
    callback();
  }

  _flush(callback) {
    // Emit a summary log when all data has passed through
    console.log(`[${this.label}] Total bytes: ${this.bytesProcessed}`);
    callback();
  }
}

// --- Demo ---
const INPUT = __filename;
const OUTPUT = path.join(__dirname, "example-57-output.txt.gz");

const counter = new ByteCounter("uncompressed");

pipeline(
  fs.createReadStream(INPUT),
  counter, // count raw bytes
  zlib.createGzip(), // compress
  fs.createWriteStream(OUTPUT),
  (err) => {
    if (err) {
      console.error("❌ Pipeline failed:", err.message);
      return;
    }

    const compressedSize = fs.statSync(OUTPUT).size;

    console.log(`[compressed]   Total bytes: ${compressedSize}`);
    console.log(
      `Ratio: ${((1 - compressedSize / counter.bytesProcessed) * 100).toFixed(1)}% reduction`,
    );
    console.log("✅ Done!");

    // Clean up
    fs.unlinkSync(OUTPUT);
  },
);

// Key observations:
// - ByteCounter is transparent (pass-through) — doesn't change data
// - It demonstrates that you can insert Transforms anywhere in a pipeline
// - pipeline() handles error propagation for ALL streams including custom ones
// - counter.bytesProcessed is accessible after pipeline completes
// - Custom Transforms in production use cases: rate limiting, progress tracking,
//   logging, hashing, checksum calculation
