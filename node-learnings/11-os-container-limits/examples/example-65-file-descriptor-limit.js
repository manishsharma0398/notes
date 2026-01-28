/**
 * Example 65: File Descriptor Limit
 * 
 * Demonstrates:
 * - Checking file descriptor limit
 * - Counting open file descriptors
 * - EMFILE error when limit exceeded
 */

const fs = require('fs');
const os = require('os');

console.log('=== File Descriptor Limit ===\n');

// Note: ulimit checking requires platform-specific code
// This example demonstrates the concept

console.log('System information:');
console.log(`  Platform: ${os.platform()}`);
console.log(`  Arch: ${os.arch()}`);
console.log();

// Try to open many files (may hit limit)
console.log('Attempting to open files...');
console.log('(This may hit EMFILE limit depending on system configuration)');
console.log();

const files = [];
let opened = 0;
let errors = 0;

function openFile(index) {
  const filename = `/tmp/test-fd-${index}.txt`;
  
  try {
    const fd = fs.openSync(filename, 'w');
    files.push({ fd, filename });
    opened++;
    
    if (opened % 100 === 0) {
      console.log(`  Opened ${opened} files...`);
    }
    
    // Try to open more (up to reasonable limit for demo)
    if (opened < 1000) {
      setImmediate(() => openFile(index + 1));
    } else {
      console.log(`\nSuccessfully opened ${opened} files`);
      console.log(`Errors: ${errors}`);
      console.log();
      console.log('Note: On systems with low ulimit, this would fail with EMFILE');
      console.log('      Check limit with: ulimit -n');
      console.log('      Increase limit with: ulimit -n 65536');
      
      // Cleanup
      files.forEach(({ fd, filename }) => {
        try {
          fs.closeSync(fd);
          fs.unlinkSync(filename);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
  } catch (err) {
    errors++;
    if (err.code === 'EMFILE') {
      console.log(`\nEMFILE error: Too many open files (limit exceeded)`);
      console.log(`  Opened: ${opened} files`);
      console.log(`  Limit: Check with 'ulimit -n'`);
      console.log();
      console.log('Fix: Increase file descriptor limit');
      console.log('  ulimit -n 65536  # For current session');
      console.log('  Or configure systemd/container limits');
      
      // Cleanup
      files.forEach(({ fd, filename }) => {
        try {
          fs.closeSync(fd);
          fs.unlinkSync(filename);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    } else {
      console.error(`Error: ${err.message}`);
    }
  }
}

openFile(0);
