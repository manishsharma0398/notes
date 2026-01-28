// Example 102: fork() with IPC communication
// This demonstrates fork() with bidirectional IPC

const { fork } = require('child_process');
const path = require('path');

// Fork Node.js process with IPC
const child = fork(path.join(__dirname, 'child-ipc.js'), ['arg1', 'arg2'], {
  stdio: 'inherit' // Can also use 'pipe' or 'ignore'
});

// Send message to child
child.send({ type: 'request', data: 'hello from parent' });

// Receive message from child
child.on('message', (msg) => {
  console.log('Parent received:', msg);
  
  if (msg.type === 'response') {
    console.log('Child responded:', msg.data);
    child.disconnect(); // Close IPC channel
  }
});

// Handle child exit
child.on('exit', (code) => {
  console.log(`Child exited with code ${code}`);
});

// What happens:
// 1. fork() spawns Node.js process with IPC channel
// 2. Parent sends message via child.send()
// 3. Child receives message via process.on('message')
// 4. Child responds via process.send()
// 5. Parent receives response via child.on('message')
// Benefits: Easy bidirectional communication, structured data
