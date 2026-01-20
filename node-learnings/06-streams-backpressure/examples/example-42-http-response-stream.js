// example-42-http-response-stream.js
// Demonstrates HTTP response body as writable stream

const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  // res is writable stream (response body)

  // Stream file directly to response
  // No intermediate memory buffer
  fs.createReadStream(__filename)
    .pipe(res);

  // Alternative: manual streaming with backpressure
  // const fileStream = fs.createReadStream(__filename);
  // fileStream.on('data', (chunk) => {
  //   const ok = res.write(chunk);
  //   if (!ok) {
  //     fileStream.pause();
  //     res.once('drain', () => fileStream.resume());
  //   }
  // });
  // fileStream.on('end', () => res.end());
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log('Visit http://localhost:3000 to test');
});

// Key observations:
// - File streamed directly to response
// - No intermediate memory buffer
// - Handles backpressure automatically (via .pipe())
// - Can serve files larger than memory
//
// Compare to:
// const data = fs.readFileSync('file.txt');
// res.end(data); // Loads entire file into memory
