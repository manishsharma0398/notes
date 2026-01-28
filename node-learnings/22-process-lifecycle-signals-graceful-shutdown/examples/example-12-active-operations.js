const fs = require('fs');
const path = require('path');

const filename = path.join(__dirname, 'temp-data.txt');

console.log(`Process PID: ${process.pid}`);
console.log(`Writing to: ${filename}`);

process.on('SIGTERM', () => {
    console.log('SIGTERM received - exiting immediately (BUG!)');
    process.exit(0);
    // BUG: File write is still in progress!
});

// Start a file write
fs.writeFile(filename, 'important data that must not be lost', (err) => {
    if (err) {
        console.error('Write failed:', err);
    } else {
        console.log('Write complete successfully');
        // Clean up
        fs.unlink(filename, () => { });
    }
});

console.log('File write initiated...');
console.log(`Send SIGTERM immediately: kill -TERM ${process.pid}`);
console.log('The file write will be interrupted!');

// Keep process alive for 2 seconds
setTimeout(() => {
    console.log('Normal exit - file write should have completed');
}, 2000);
