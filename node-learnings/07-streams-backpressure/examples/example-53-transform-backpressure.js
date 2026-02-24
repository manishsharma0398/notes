// example-53-transform-backpressure.js
// Demonstrates how callback() controls backpressure in a Transform stream
//
// KEY RULE: The next chunk is NOT fed to _transform() until callback() is called.
// This means you can do async work inside _transform() safely.

const { Transform } = require("stream");
const { Readable } = require("stream");

// A Transform that simulates async processing (e.g., DB write, API call)
class SlowTransform extends Transform {
  constructor() {
    super();
    this._chunkCount = 0;
  }

  _transform(chunk, encoding, callback) {
    const chunkNum = ++this._chunkCount;
    const start = Date.now();

    console.log(
      `[SlowTransform] Processing chunk #${chunkNum} (${chunk.length} bytes)...`,
    );

    // Simulate 50ms async work (e.g., API call, DB insert)
    setTimeout(() => {
      const elapsed = Date.now() - start;
      console.log(`[SlowTransform] Done chunk #${chunkNum} in ${elapsed}ms`);

      this.push(chunk.toString().toUpperCase());

      // CRITICAL: Only call callback() AFTER async work is done.
      // If we called callback() before setTimeout fires, the next chunk
      // would arrive immediately, causing out-of-order processing.
      callback();
    }, 50);
  }

  _flush(callback) {
    console.log(
      `[SlowTransform] _flush called — all ${this._chunkCount} chunks processed`,
    );
    callback();
  }
}

// Create a readable that pushes chunks rapidly
function createFastReadable(lines = 5) {
  let i = 0;
  return new Readable({
    read() {
      if (i < lines) {
        this.push(`hello world line ${++i}\n`);
      } else {
        this.push(null); // signal end
      }
    },
  });
}

const readable = createFastReadable(5);
const slow = new SlowTransform();

console.log("Starting pipeline — notice chunks process ONE AT A TIME:\n");

readable
  .pipe(slow)
  .on("data", (chunk) => {
    process.stdout.write("[OUTPUT] " + chunk.toString());
  })
  .on("end", () => {
    console.log("\nAll done!");
  });

// Key observations:
// - Even though readable pushes 5 chunks immediately, SlowTransform processes them
//   one at a time — because the next chunk waits until callback() is called.
// - This provides automatic rate limiting — the transform controls its own pace.
// - Calling callback() early (before setTimeout fires) would process chunks in parallel
//   and potentially produce out-of-order or overlapping output.
