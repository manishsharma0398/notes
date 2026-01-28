// example-40-pipe-backpressure.js
// Demonstrates automatic backpressure handling with .pipe()

const fs = require('fs');

// Automatic backpressure handling
fs.createReadStream(__filename)
  .pipe(fs.createWriteStream('output.txt'));

// What .pipe() does automatically:
// 1. Reads chunk from readable
// 2. Writes to writable
// 3. If writable buffer full, pauses readable
// 4. When writable drains, resumes readable
// 5. Handles backpressure automatically
//
// Key observation:
// - .pipe() is SAFE - handles backpressure automatically
// - Manual .write() requires manual backpressure handling
// - Use .pipe() when possible for automatic handling
