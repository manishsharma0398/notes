// Example 105: Preventing zombie processes
// This demonstrates how to properly clean up child processes

const { spawn } = require('child_process');

// BAD: Child process not cleaned up (becomes zombie)
function badSpawn() {
  console.log('BAD: Spawning process without cleanup...');
  spawn('sleep', ['5']);
  // Parent exits, child becomes zombie!
}

// GOOD: Wait for child to exit
function goodSpawn() {
  console.log('GOOD: Spawning process with cleanup...');
  
  const child = spawn('sleep', ['5']);
  
  // Wait for child to exit
  child.on('exit', (code) => {
    console.log(`Child exited with code ${code}`);
    // Now parent can safely exit
  });
  
  // Handle errors
  child.on('error', (err) => {
    console.error('Child error:', err);
  });
}

// GOOD: Track all children
class ChildTracker {
  constructor() {
    this.children = new Set();
  }
  
  spawn(command, args) {
    const child = spawn(command, args);
    
    this.children.add(child);
    
    child.on('exit', () => {
      this.children.delete(child);
    });
    
    child.on('error', () => {
      this.children.delete(child);
    });
    
    return child;
  }
  
  async waitForAll() {
    const promises = Array.from(this.children).map(child => {
      return new Promise(resolve => {
        child.on('exit', resolve);
        child.on('error', resolve);
      });
    });
    
    await Promise.all(promises);
    console.log('All children exited');
  }
}

// Test
const tracker = new ChildTracker();

tracker.spawn('sleep', ['2']);
tracker.spawn('sleep', ['3']);
tracker.spawn('sleep', ['4']);

// Wait for all children
tracker.waitForAll().then(() => {
  console.log('All children cleaned up');
  process.exit(0);
});

// What happens:
// 1. BAD: Child not cleaned up → becomes zombie
// 2. GOOD: Wait for child exit → proper cleanup
// 3. GOOD: Track all children → ensure cleanup
// Key: Always wait for child processes to exit
