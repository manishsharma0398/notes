// Example 104: Simple process manager
// This demonstrates how to manage multiple child processes

const { fork } = require('child_process');
const path = require('path');

class ProcessManager {
  constructor(script, count = 2) {
    this.script = script;
    this.count = count;
    this.workers = [];
    this.restartCount = 0;
    
    // Start workers
    for (let i = 0; i < count; i++) {
      this.startWorker();
    }
  }
  
  startWorker() {
    const worker = fork(this.script, [], {
      stdio: 'inherit'
    });
    
    console.log(`Worker ${worker.pid} started`);
    
    // Handle worker exit
    worker.on('exit', (code, signal) => {
      console.log(`Worker ${worker.pid} exited: code=${code}, signal=${signal}`);
      
      // Remove from workers array
      const index = this.workers.indexOf(worker);
      if (index > -1) {
        this.workers.splice(index, 1);
      }
      
      // Restart worker if it crashed (non-zero exit code)
      if (code !== 0) {
        this.restartCount++;
        console.log(`Restarting worker (restart count: ${this.restartCount})...`);
        setTimeout(() => {
          this.startWorker();
        }, 1000); // Wait 1 second before restart
      }
    });
    
    // Handle worker errors
    worker.on('error', (err) => {
      console.error(`Worker ${worker.pid} error:`, err);
    });
    
    this.workers.push(worker);
  }
  
  shutdown() {
    console.log('Shutting down workers...');
    
    // Send SIGTERM to all workers
    this.workers.forEach(worker => {
      worker.kill('SIGTERM');
    });
    
    // Wait for workers to exit
    Promise.all(this.workers.map(worker => {
      return new Promise(resolve => {
        worker.on('exit', resolve);
      });
    })).then(() => {
      console.log('All workers shut down');
      process.exit(0);
    });
    
    // Force kill after timeout
    setTimeout(() => {
      console.log('Force killing workers...');
      this.workers.forEach(worker => {
        worker.kill('SIGKILL');
      });
      process.exit(1);
    }, 5000);
  }
}

// Create process manager
const manager = new ProcessManager('./worker-simple.js', 3);

// Handle shutdown signals
process.on('SIGTERM', () => {
  manager.shutdown();
});

process.on('SIGINT', () => {
  manager.shutdown();
});

// What happens:
// 1. Process manager starts N workers
// 2. Monitors workers (exit, error events)
// 3. Restarts crashed workers automatically
// 4. Graceful shutdown on SIGTERM/SIGINT
// Benefits: Fault tolerance, automatic restarts, graceful shutdown
