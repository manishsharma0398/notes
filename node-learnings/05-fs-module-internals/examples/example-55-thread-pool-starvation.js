/**
 * Example 55: Thread Pool Starvation with File Operations
 * 
 * Demonstrates:
 * - Thread pool limits concurrent file operations
 * - Starvation when pool is saturated
 * - Impact on performance
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Thread Pool Starvation ===\n');

// Create multiple test files
const numFiles = 20;
const testFiles = [];

console.log(`Creating ${numFiles} test files...`);
for (let i = 0; i < numFiles; i++) {
  const filePath = path.join(__dirname, `test-${i}.txt`);
  fs.writeFileSync(filePath, `File ${i} content\n`.repeat(1000));
  testFiles.push(filePath);
}
console.log('Files created\n');

// Default thread pool size is 4
console.log(`Thread pool size: ${process.env.UV_THREADPOOL_SIZE || 4}`);
console.log(`Concurrent operations: ${numFiles}`);
console.log(`Expected: First 4 complete quickly, rest queue up\n`);

// Test: Read all files concurrently
console.log('Reading all files concurrently...');
const start = performance.now();
let completed = 0;
const completionTimes = [];

testFiles.forEach((file, index) => {
  const fileStart = performance.now();
  fs.readFile(file, 'utf8', (err, data) => {
    const fileDuration = performance.now() - fileStart;
    completed++;
    completionTimes.push({ index, duration: fileDuration });
    
    if (completed === numFiles) {
      const totalDuration = performance.now() - start;
      
      // Sort by completion time
      completionTimes.sort((a, b) => a.duration - b.duration);
      
      console.log(`\nAll files read in ${totalDuration.toFixed(2)} ms`);
      console.log(`\nFirst 4 files (thread pool slots):`);
      completionTimes.slice(0, 4).forEach(t => {
        console.log(`  File ${t.index}: ${t.duration.toFixed(2)} ms`);
      });
      
      console.log(`\nRemaining files (queued):`);
      completionTimes.slice(4).forEach(t => {
        console.log(`  File ${t.index}: ${t.duration.toFixed(2)} ms`);
      });
      
      const firstBatchAvg = completionTimes.slice(0, 4).reduce((sum, t) => sum + t.duration, 0) / 4;
      const queuedAvg = completionTimes.slice(4).reduce((sum, t) => sum + t.duration, 0) / (numFiles - 4);
      
      console.log(`\nFirst batch average: ${firstBatchAvg.toFixed(2)} ms`);
      console.log(`Queued average: ${queuedAvg.toFixed(2)} ms`);
      console.log(`Slowdown: ${(queuedAvg / firstBatchAvg).toFixed(1)}x`);
      
      // Cleanup
      testFiles.forEach(f => fs.unlinkSync(f));
      console.log('\nTest files cleaned up');
    }
  });
});
