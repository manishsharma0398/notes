// example-49-transform-factory.js
// Demonstrates building a Transform stream using the factory/options syntax
// Lighter alternative to extending the Transform class

const { Transform } = require("stream");

// Factory approach: pass transform/flush as options instead of subclassing
const upperCase = new Transform({
  // transform() is called for every incoming chunk
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  },

  // flush() is called once when all input has been written
  flush(callback) {
    // Push a final "marker" to show _flush fired
    this.push("\n[Stream ended]\n");
    callback();
  },
});

// Same usage as class-based approach
console.log("Type something and press Enter (Ctrl+C to exit):");
process.stdin.pipe(upperCase).pipe(process.stdout);

// Key observations:
// - Factory syntax is lighter — no need to create a class
// - Use class approach when you need internal state (e.g., this._buffer)
// - Use factory approach for simple stateless transforms
// - Both approaches are equivalent in behavior
