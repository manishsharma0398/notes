// example-59-pipeline-http.js
// Demonstrates stream.pipeline() in an HTTP server:
// - Serves a gzip-compressed file
// - Handles client disconnect mid-transfer (no zombie reads)
// - Uses ByteCounter to log bytes served per request

const { pipeline, Transform } = require("stream");
const http = require("http");
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const PORT = 3001;
const FILE_TO_SERVE = __filename; // serve this script itself

// --- ByteCounter Transform (same as example-57) ---
class ByteCounter extends Transform {
  constructor() {
    super();
    this.bytesProcessed = 0;
  }
  _transform(chunk, encoding, cb) {
    this.bytesProcessed += chunk.length;
    this.push(chunk);
    cb();
  }
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  const reqId = Date.now();
  console.log(`[${reqId}] Request received: ${req.method} ${req.url}`);

  // Set headers BEFORE pipeline — res will be destroyed on error,
  // so we can't set headers after the fact
  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Content-Encoding": "gzip",
  });

  const counter = new ByteCounter();

  pipeline(
    fs.createReadStream(FILE_TO_SERVE),
    counter,
    zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }),
    res,
    (err) => {
      if (err) {
        // Most common cause: client disconnected before transfer finished
        // pipeline() has already destroyed the file read stream
        // No need to manually clean up anything
        console.log(
          `[${reqId}] Transfer ended: ${err.message} (likely client disconnect)`,
        );
        console.log(
          `[${reqId}] Bytes sent before disconnect: ${counter.bytesProcessed}`,
        );
      } else {
        console.log(
          `[${reqId}] Transfer complete. Bytes sent (uncompressed): ${counter.bytesProcessed}`,
        );
      }
    },
  );
});

server.listen(PORT, () => {
  console.log(`\nServer running at http://localhost:${PORT}`);
  console.log("Access the URL to see gzip-compressed content.\n");
  console.log(
    "To test client disconnect: curl http://localhost:" + PORT + " | head -1",
  );
  console.log("Press Ctrl+C to stop.\n");

  // Auto-close after 30 seconds for testing convenience
  setTimeout(() => {
    console.log("Auto-shutting down after 30s");
    server.close();
  }, 30000);
});

// Key observations:
// - res is a Writable stream — valid as position, pipeline destination
// - When client disconnects: res emits 'close' → pipeline detects this
//   → destroys the fs.createReadStream IMMEDIATELY (no wasted disk reads)
//   → With .pipe(), the file would keep being read until EOF even if client left
// - Set headers with res.writeHead() BEFORE pipeline()
//   → if pipeline errors before headers are sent you'll get a "stream destroyed"
//      error so setting headers up front is safer
// - The callback error message is usually "write ECONNRESET" (client closed)
