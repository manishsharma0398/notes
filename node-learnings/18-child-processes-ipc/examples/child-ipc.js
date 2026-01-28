// Child process for IPC example
// This file is executed in the forked child process

// Receive command-line arguments
console.log('Child process started');
console.log('Arguments:', process.argv.slice(2));

// Receive message from parent
process.on('message', (msg) => {
  console.log('Child received:', msg);
  
  if (msg.type === 'request') {
    // Process request
    const response = {
      type: 'response',
      data: `Echo: ${msg.data}`
    };
    
    // Send response to parent
    process.send(response);
  }
});

// Handle disconnect
process.on('disconnect', () => {
  console.log('IPC channel closed');
  process.exit(0);
});

// What happens:
// 1. Child process receives messages via process.on('message')
// 2. Child sends messages via process.send()
// 3. IPC channel allows bidirectional communication
// 4. Messages are serialized/deserialized automatically
