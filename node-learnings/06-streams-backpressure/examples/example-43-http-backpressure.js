// example-43-http-backpressure.js
// Demonstrates HTTP backpressure in practice

const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  // Stream large file to response
  const fileStream = fs.createReadStream(__filename);

  // Pipe handles backpressure automatically
  fileStream.pipe(res);

  // What happens:
  // 1. Server reads file chunks quickly
  // 2. Client receives chunks slowly (slow network)
  // 3. Response buffer fills up
  // 4. .pipe() pauses file reading automatically
  // 5. When client catches up, buffer drains
  // 6. File reading resumes
  //
  // Backpressure handled automatically!
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log('Visit http://localhost:3000 to test');
  console.log('Try throttling network in browser dev tools');
});

// Key observations:
// - HTTP backpressure is automatic with .pipe()
// - Without .pipe(), must handle manually
// - Slow clients cause backpressure
// - Server automatically slows down to match client speed
