// example-37-transform-stream.js
// Demonstrates transform streams

const fs = require('fs');
const zlib = require('zlib');

// Transform: file → gzip → output
// Transform streams are duplex streams that transform data
fs.createReadStream(__filename)
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));

// Key observations:
// - Transform streams transform data as it flows
// - Data flows in one direction
// - Can be piped between readable and writable
// - Handles backpressure automatically
//
// Other transform streams:
// - zlib.createGzip() - Compression
// - zlib.createGunzip() - Decompression
// - crypto.createCipher() - Encryption
// - crypto.createDecipher() - Decryption
// - Custom transform streams
