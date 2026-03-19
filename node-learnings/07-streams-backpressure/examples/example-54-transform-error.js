// example-54-transform-error.js
// Demonstrates correct error handling in Transform streams
//
// WRONG: throw inside _transform → unhandled exception, process crash
// RIGHT: pass error to callback(err) or use this.destroy(err)

const { Transform } = require("stream");
const { Readable } = require("stream");

class JSONParseTransform extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this._buffer = "";
    this._lineCount = 0;
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;

      this._lineCount++;
      let parsed;

      try {
        parsed = JSON.parse(line);
      } catch (err) {
        // ✅ CORRECT: pass error to callback → destroys stream gracefully
        // The 'error' event fires on the stream, pipeline cleans up
        return callback(
          new Error(
            `Invalid JSON on line ${this._lineCount}: ${line.slice(0, 40)}`,
          ),
        );

        // ❌ WRONG: this would crash the process
        // throw new Error('bad json');

        // ❌ ALSO WRONG: continue silently (data corruption)
        // continue;
      }

      this.push(parsed);
    }

    callback();
  }

  _flush(callback) {
    if (this._buffer.trim()) {
      try {
        this.push(JSON.parse(this._buffer));
      } catch (err) {
        return callback(
          new Error(
            `Invalid JSON in final chunk: ${this._buffer.slice(0, 40)}`,
          ),
        );
      }
    }
    callback();
  }
}

// Demo with valid + invalid JSON lines
const lines = [
  '{"name": "Alice", "age": 30}',
  '{"name": "Bob", "age": 25}',
  "not valid json at all", // ← triggers error
  '{"name": "Charlie"}', // ← never reached after error
];

const readable = Readable.from(lines.join("\n") + "\n");
const parser = new JSONParseTransform();

parser.on("error", (err) => {
  // ✅ Error is caught here — stream is already destroyed
  console.error("Parse error caught gracefully:", err.message);
  console.log("Stream destroyed:", parser.destroyed); // true
});

parser.on("data", (obj) => {
  console.log("Parsed:", JSON.stringify(obj));
});

parser.on("end", () => {
  console.log("Stream ended normally");
});

readable.pipe(parser);

// Key observations:
// - callback(err) is the safe way to signal errors from _transform()
// - It fires the 'error' event and destroys the stream
// - Never throw inside _transform — unhandled exceptions crash the process
// - With stream.pipeline(), errors propagate to ALL streams (and the callback)
// - this.destroy(err) is an alternative to callback(err) for async paths
