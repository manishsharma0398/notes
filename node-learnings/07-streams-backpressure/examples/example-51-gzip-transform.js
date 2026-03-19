// example-51-gzip-transform.js
// Demonstrates chaining multiple Transform streams:
//   read file → gzip compress → write compressed file

const fs = require("fs");
const zlib = require("zlib");
const { pipeline } = require("stream");

const INPUT = __filename; // compress this very file
const OUTPUT = `${__filename}.gz`;

console.log(`Compressing: ${INPUT}`);
console.log(`Output:      ${OUTPUT}`);

pipeline(
  fs.createReadStream(INPUT),
  zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
  fs.createWriteStream(OUTPUT),
  (err) => {
    if (err) {
      console.error("Compression failed:", err.message);
    } else {
      const inSize = fs.statSync(INPUT).size;
      const outSize = fs.statSync(OUTPUT).size;
      const ratio = ((1 - outSize / inSize) * 100).toFixed(1);
      console.log(
        `Done! ${inSize} bytes → ${outSize} bytes (${ratio}% smaller)`,
      );
    }
  },
);

// Key observations:
// - zlib.createGzip() IS a Transform stream (input bytes → compressed bytes)
// - Each .pipe() connects the readable side of one stream to the writable side of next
// - pipeline() ensures all streams are destroyed on error (no resource leaks)
// - Comparing: what would happen with .pipe() and an error? (see example-55)
//
// To decompress: zlib.createGunzip() is also a Transform stream
// To verify: node -e "require('zlib').gunzipSync(require('fs').readFileSync('example-51-gzip-transform.js.gz')).toString()"
