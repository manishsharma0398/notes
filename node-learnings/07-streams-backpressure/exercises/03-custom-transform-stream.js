const fs = require("node:fs");
const path = require("node:path");
const { Transform, pipeline } = require("node:stream");

class UpperCaseTransform extends Transform {
  constructor() {
    super();
    this._buffer = "";
    this._last_line = 0;
  }

  _transform(chunk, encoding, cb) {
    try {
      const string = chunk.toString();
      this._buffer += string;

      const lines = this._buffer.split("\n");
      this._buffer = lines.pop();

      for (let i = 1; i <= lines.length; i++) {
        const tr = `${this._last_line + i}: ${lines[i - 1].toUpperCase()}\n`;

        this.push(tr);
      }

      this._last_line += lines.length;
      cb();
    } catch (error) {
      return cb(error);
    }
  }

  _flush(cb) {
    if (this._buffer) {
      this._last_line++;
      this.push(`${this._last_line}: ${this._buffer.toUpperCase()}\n`);
    }
    cb();
  }
}

const filePath = path.join(__dirname, "..", "..", "..", "huge.txt");

const readableStream = fs.createReadStream(filePath);
const writeableStream = fs.createWriteStream(`${__dirname}/transformed.txt`);
const upperCaseTransform = new UpperCaseTransform();

pipeline(readableStream, upperCaseTransform, writeableStream, (err) => {
  if (err) console.error("Transformation error: ", err);
  else console.log("Pipeline succeeded");
});
