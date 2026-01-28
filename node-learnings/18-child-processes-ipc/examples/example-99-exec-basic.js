// Example 99: exec() usage (buffered output)
// This demonstrates exec() with buffered output

const { exec } = require('child_process');

// Execute command (buffered)
exec('ls -la', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  console.log('STDOUT:');
  console.log(stdout);
  
  if (stderr) {
    console.error('STDERR:');
    console.error(stderr);
  }
});

// What happens:
// 1. exec() runs command in shell
// 2. Output is buffered (collected)
// 3. When process exits, callback receives all output
// 4. stdout/stderr are strings (entire output)
// Benefits: Simple API, automatic handling
// Drawbacks: Buffers entire output (memory issue for large output)
