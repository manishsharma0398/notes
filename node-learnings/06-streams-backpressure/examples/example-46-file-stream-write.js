// example-46-file-stream-write.js
// Demonstrates writing large files with backpressure handling

const fs = require('fs');

const writable = fs.createWriteStream('output.txt');

// Handle backpressure when writing large amounts of data
let i = 0;
function write() {
  let ok = true;
  do {
    // Write returns false when buffer is full
    ok = writable.write(`Line ${i++}\n`);
  } while (i < 1000000 && ok);

  if (i < 1000000) {
    // Buffer full, wait for drain event
    writable.once('drain', write);
  } else {
    // All data written, end stream
    writable.end();
  }
}

write();

writable.on('finish', () => {
  console.log('All data written');
});

writable.on('error', (err) => {
  console.error('Write error:', err);
});

// Key observations:
// - Checks .write() return value
// - Handles backpressure correctly
// - Memory usage stays bounded
// - Can write files larger than memory
//
// Compare to:
// const data = Array(1000000).fill('Line\n').join('');
// fs.writeFileSync('output.txt', data); // Loads entire data into memory
