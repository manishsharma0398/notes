// Example 98: Spawn with streaming output
// This demonstrates how to handle streaming stdout/stderr

const { spawn } = require('child_process');

// Spawn process with piped stdio
const child = spawn('node', ['-e', `
  console.log('stdout message 1');
  console.error('stderr message 1');
  setTimeout(() => {
    console.log('stdout message 2');
    console.error('stderr message 2');
  }, 1000);
`], {
  stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
});

// Handle stdout (streaming)
child.stdout.on('data', (data) => {
  console.log(`[STDOUT] ${data}`);
});

// Handle stderr (streaming)
child.stderr.on('data', (data) => {
  console.error(`[STDERR] ${data}`);
});

// Handle process exit
child.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});

// Write to stdin
child.stdin.write('input data\n');
child.stdin.end(); // Close stdin

// What happens:
// 1. Process spawned with piped stdio
// 2. Data streams as it's produced (non-blocking)
// 3. Parent receives 'data' events for stdout/stderr
// 4. Parent can write to child's stdin
// Benefits: Streaming (good for large output), non-blocking
