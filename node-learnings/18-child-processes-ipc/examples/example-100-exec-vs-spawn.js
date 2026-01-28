// Example 100: exec() vs spawn() comparison
// This demonstrates the difference between exec() and spawn()

const { exec, spawn } = require('child_process');

console.log('=== exec() ===');
console.log('Buffered output, runs in shell\n');

exec('node -e "console.log(1); setTimeout(() => console.log(2), 1000);"', (error, stdout) => {
  console.log('exec() output (all at once):');
  console.log(stdout);
  console.log('exec() callback executed after process completes\n');
});

console.log('=== spawn() ===');
console.log('Streaming output, direct execution\n');

const child = spawn('node', ['-e', 'console.log(1); setTimeout(() => console.log(2), 1000);']);

child.stdout.on('data', (data) => {
  console.log('spawn() output (streaming):');
  console.log(data.toString());
});

child.on('exit', () => {
  console.log('spawn() process exited');
});

// What happens:
// 1. exec(): Buffers output, callback when done
// 2. spawn(): Streams output, events as data arrives
// Key difference: exec() buffers, spawn() streams
