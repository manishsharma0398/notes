// example-50-line-splitter.js
// Demonstrates a LineSplitter Transform that handles chunk boundaries correctly
//
// Problem: A 64KB chunk may contain 500 lines, or one line may span two chunks.
// Solution: Buffer incomplete data, only emit complete lines.

const { Transform } = require("stream");
const fs = require("fs");
const path = require("path");

class LineSplitter extends Transform {
  constructor(options) {
    // readableObjectMode: true — output side emits strings (objects), not Buffers
    super({ ...options, readableObjectMode: true });
    this._buffer = ""; // internal buffer for incomplete lines
  }

  _transform(chunk, encoding, callback) {
    // Append incoming chunk to internal buffer
    this._buffer += chunk.toString();

    // Split on newlines
    const lines = this._buffer.split("\n");

    // Last element is either empty string ("") or an incomplete line
    // Pop it off and keep it in the buffer for the next chunk
    this._buffer = lines.pop();

    // Push all complete lines to the readable side
    for (const line of lines) {
      this.push(line); // emitting a string, not a Buffer
    }

    callback();
  }

  _flush(callback) {
    // Input stream has ended — push any remaining partial line
    if (this._buffer) {
      this.push(this._buffer);
    }
    callback();
  }
}

// Demo: read THIS file, split by line, log each line with a line number
let lineNumber = 0;

fs.createReadStream(__filename, { highWaterMark: 64 }) // tiny chunk size to show boundary handling
  .pipe(new LineSplitter())
  .on("data", (line) => {
    lineNumber++;
    // Each 'data' event = exactly ONE complete line
    console.log(`Line ${String(lineNumber).padStart(3, "0")}: ${line}`);
  })
  .on("end", () => {
    console.log(`\nTotal lines: ${lineNumber}`);
  });

// Key observations:
// - highWaterMark: 64 means only 64 bytes per chunk (very small, lots of splits)
// - Despite tiny chunks, each 'data' event is EXACTLY one complete line
// - The last line (no trailing newline) is correctly emitted via _flush()
// - Memory usage is bounded: at most one partial line in _buffer at any time
