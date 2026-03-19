const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const http = require("node:http");
const { Transform, pipeline } = require("node:stream");

class ByteCounter extends Transform {
  constructor(label = "") {
    super();
    this.label = label;
    this._bytes = 0;
  }

  _transform(chunk, encoding, cb) {
    try {
      this._bytes += chunk.length;
      this.push(chunk);
      cb();
    } catch (error) {
      return cb(error);
    }
  }

  _flush(cb) {
    cb();
  }

  getBytes() {
    return this._bytes;
  }
}

const filePath = path.join(__dirname, "..", "..", "..", "huge.txt");
const PORT = 5000;

const server = http.createServer((req, res) => {
  const readableStream = fs.createReadStream(filePath);
  const reqByteCounter = new ByteCounter("req");
  const resByteCounter = new ByteCounter("res");
  const gz = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

  readableStream.on("close", () => {
    console.log("📁 File stream closed");
  });

  readableStream.on("end", () => {
    console.log("📁 File stream ended normally");
  });

  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Content-Encoding": "gzip",
  });
  return pipeline(
    readableStream,
    reqByteCounter,
    gz,
    resByteCounter,
    res,
    (err) => {
      if (err) {
        if (
          err.code === "ERR_STREAM_PREMATURE_CLOSE" ||
          err.code === "ECONNRESET" ||
          err.code === "EPIPE"
        ) {
          console.log("Client disconnected early");
        } else {
          console.error("Pipeline error:", err);
        }
      } else {
        console.log("Pipeline succeeded");
      }

      console.log(`Raw bytes read: ${reqByteCounter.getBytes()}`);
      console.log(`Compressed bytes sent: ${resByteCounter.getBytes()}`);
    },
  );
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
