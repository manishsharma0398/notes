/**
 * Example 58: Streams vs readFile for Large Files
 * 
 * Demonstrates:
 * - Memory usage difference
 * - When to use streams
 * - Performance comparison
 */

const fs = require('fs');
const { performance } = require('perf_hooks');
const path = require('path');

console.log('=== Streams vs readFile for Large Files ===\n');

// Create a large test file (10 MB)
const testFile = path.join(__dirname, 'test-large.txt');
const chunk = 'X'.repeat(1024); // 1 KB chunks
const fileSize = 10 * 1024 * 1024; // 10 MB

console.log(`Creating ${(fileSize / 1024 / 1024).toFixed(0)} MB test file...`);
const writeStream = fs.createWriteStream(testFile);
for (let i = 0; i < fileSize / chunk.length; i++) {
  writeStream.write(chunk);
}
writeStream.end();

// Wait for file to be written
setTimeout(() => {
  // Test 1: readFile (loads entire file into memory)
  console.log('\nTest 1: fs.readFile (loads entire file)...');
  const memBefore1 = process.memoryUsage();
  const start1 = performance.now();
  
  fs.readFile(testFile, 'utf8', (err, data) => {
    const duration1 = performance.now() - start1;
    const memAfter1 = process.memoryUsage();
    
    if (err) {
      console.error('Error:', err.message);
      return;
    }
    
    console.log(`  Duration: ${duration1.toFixed(2)} ms`);
    console.log(`  Heap before: ${(memBefore1.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap after: ${(memAfter1.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap increase: ${((memAfter1.heapUsed - memBefore1.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Data size: ${(data.length * 2 / 1024 / 1024).toFixed(2)} MB (UTF-16)`);
    console.log();
    
    // Test 2: Streams (processes in chunks)
    console.log('Test 2: fs.createReadStream (processes in chunks)...');
    const memBefore2 = process.memoryUsage();
    const start2 = performance.now();
    let totalBytes = 0;
    
    const stream = fs.createReadStream(testFile, { encoding: 'utf8' });
    
    stream.on('data', (chunk) => {
      totalBytes += chunk.length;
    });
    
    stream.on('end', () => {
      const duration2 = performance.now() - start2;
      const memAfter2 = process.memoryUsage();
      
      console.log(`  Duration: ${duration2.toFixed(2)} ms`);
      console.log(`  Heap before: ${(memBefore2.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap after: ${(memAfter2.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap increase: ${((memAfter2.heapUsed - memBefore2.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Total bytes processed: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
      console.log();
      
      console.log('=== Comparison ===');
      console.log(`Memory efficiency: Streams use ${((memAfter2.heapUsed - memBefore2.heapUsed) / (memAfter1.heapUsed - memBefore1.heapUsed) * 100).toFixed(0)}% of readFile memory`);
      console.log();
      console.log('Key insight: Streams process data in chunks, memory stays low');
      console.log('readFile loads entire file, memory usage = file size');
      
      // Cleanup
      fs.unlinkSync(testFile);
      console.log('\nTest file cleaned up');
    });
  });
}, 1000);
