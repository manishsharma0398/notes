// example-41-http-request-stream.js
// Demonstrates HTTP request body as readable stream

const http = require('http');

const server = http.createServer((req, res) => {
  // req is readable stream (request body)
  let data = '';

  // Process chunks as they arrive
  req.on('data', (chunk) => {
    data += chunk.toString();
    console.log(`Received chunk: ${chunk.length} bytes`);
    // Process chunk immediately, don't wait for entire body
  });

  req.on('end', () => {
    console.log('Request body complete');
    console.log(`Total size: ${data.length} bytes`);
    res.end('OK');
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
    res.statusCode = 500;
    res.end('Error');
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
  console.log('Send POST request with body to test');
});

// Key observations:
// - Request body arrives in chunks
// - Can process chunks as they arrive
// - Don't need to wait for entire body
// - Memory efficient for large uploads
//
// Test with:
// curl -X POST http://localhost:3000 -d "large data..."
