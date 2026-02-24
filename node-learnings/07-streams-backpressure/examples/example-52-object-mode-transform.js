// example-52-object-mode-transform.js
// Demonstrates object mode Transform: CSV lines → plain JS objects
//
// Key: readableObjectMode: true means output side emits JS objects, not Buffers
// Input side still receives Buffers/strings (raw file data)

const { Transform } = require("stream");
const fs = require("fs");
const path = require("path");

class CSVParser extends Transform {
  constructor() {
    super({
      readableObjectMode: true, // output: push JS objects
      // writableObjectMode defaults to false → input: Buffers/strings
    });
    this._headers = null;
    this._buffer = ""; // holds incomplete line across chunk boundaries
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep last incomplete line

    for (const line of lines) {
      if (!line.trim()) continue; // skip empty lines

      const values = line.split(",");

      if (!this._headers) {
        // First non-empty line = header row
        this._headers = values.map((h) => h.trim());
      } else {
        // Data row → build an object
        const obj = {};
        this._headers.forEach((header, i) => {
          obj[header] = values[i] !== undefined ? values[i].trim() : null;
        });
        this.push(obj); // pushing a plain JS object, not a Buffer
      }
    }

    callback();
  }

  _flush(callback) {
    // Handle last line if there's no trailing newline
    if (this._buffer.trim() && this._headers) {
      const values = this._buffer.split(",");
      const obj = {};
      this._headers.forEach((header, i) => {
        obj[header] = values[i] !== undefined ? values[i].trim() : null;
      });
      this.push(obj);
    }
    callback();
  }
}

// Create a sample CSV file and parse it
const CSV_FILE = path.join(__dirname, "sample.csv");

// Write sample CSV data
fs.writeFileSync(
  CSV_FILE,
  `name,age,city
Alice,30,New York
Bob,25,London
Charlie,35,Tokyo
Diana,28,Paris
`,
);

console.log("Parsing sample.csv...\n");

let rowCount = 0;
fs.createReadStream(CSV_FILE, { highWaterMark: 20 }) // tiny chunks to prove boundary safety
  .pipe(new CSVParser())
  .on("data", (record) => {
    rowCount++;
    // Each 'data' event is a plain JS object like { name: 'Alice', age: '30', city: 'New York' }
    console.log(`Row ${rowCount}:`, record);
  })
  .on("end", () => {
    console.log(`\nDone! Parsed ${rowCount} rows.`);
    fs.unlinkSync(CSV_FILE); // clean up
  })
  .on("error", (err) => {
    console.error("Parse error:", err);
  });

// Key observations:
// - readableObjectMode: true allows pushing any JS value (not just Buffers)
// - Without this, this.push({...}) would throw a TypeError
// - highWaterMark in objectMode defaults to 16 objects (not 16KB)
// - You cannot mix byte mode and object mode without explicit flags
