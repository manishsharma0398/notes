// example-48-custom-transform.js
// Demonstrates building a custom Transform stream (class-based)

const { Transform } = require("stream");

class UpperCaseTransform extends Transform {
  // _transform is called for EVERY chunk that comes in
  _transform(chunk, encoding, callback) {
    // chunk: Buffer by default (unless encoding set on stream)
    // encoding: the encoding of the chunk string (if applicable)
    // callback: call when done — signals Node.js we're ready for next chunk

    const upperCased = chunk.toString().toUpperCase();

    // Push transformed data to the readable side (output)
    this.push(upperCased);

    // Signal we're ready for the next chunk
    // Node.js will NOT call _transform again until callback() is called
    callback();
  }

  // _flush is called ONCE after all input has been written (.end() called)
  // Use it to push any remaining internally buffered data
  _flush(callback) {
    // Nothing to flush here — but you MUST call callback() to end the stream
    console.log("[_flush] No remaining data to push");
    callback();
  }
}

// Usage: pipe stdin through transform to stdout
const upperCase = new UpperCaseTransform();

console.log("Type something and press Enter (Ctrl+C to exit):");
process.stdin.pipe(upperCase).pipe(process.stdout);

// Key observations:
// - _transform() is the only required method
// - this.push() sends data to the readable (output) side
// - callback() tells Node.js we're ready for the next chunk
// - _flush() is called once at the end — use to drain internal buffers
// - Backpressure is handled automatically by the Transform base class
