/**
 * Example 72: GC Tuning Flags and Their Effects
 * 
 * Demonstrates different GC tuning flags and their impact:
 * - --max-old-space-size: Heap size limit
 * - --min-semi-space-size: Young generation size
 * - --max-semi-space-size: Young generation max size
 * - --expose-gc: Enable manual GC
 * 
 * Run with different flags to compare:
 *   node --max-old-space-size=256 example-72-gc-tuning.js
 *   node --max-old-space-size=1024 example-72-gc-tuning.js
 * 
 * What to observe:
 * - How heap size affects GC behavior
 * - Trade-off between pause time and frequency
 * - Impact on application performance
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const v8 = require('v8');

const gcStats = {
  minor: { count: 0, totalPause: 0 },
  major: { count: 0, totalPause: 0 }
};

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.name === 'gc') {
      const duration = entry.duration;
      const kind = entry.kind === 0 ? 'minor' : 'major';
      
      gcStats[kind].count++;
      gcStats[kind].totalPause += duration;
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('=== GC Tuning Flags and Effects ===\n');

// Display current V8 flags
const flags = v8.getHeapStatistics();
console.log('Current heap configuration:');
console.log(`  Heap size limit: ${(flags.heapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Total heap size: ${(flags.totalHeapSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Used heap size: ${(flags.usedHeapSize / 1024 / 1024).toFixed(2)} MB`);

// Check for common flags
const nodeFlags = process.execArgv;
console.log('\nNode.js flags:');
if (nodeFlags.length > 0) {
  nodeFlags.forEach(flag => console.log(`  ${flag}`));
} else {
  console.log('  (default flags)');
}

console.log('\n=== Workload Simulation ===');

// Simulate realistic workload
function simulateWorkload() {
  const start = performance.now();
  const allocations = [];
  
  // Allocate memory in waves
  for (let wave = 0; wave < 10; wave++) {
    // Small objects (young generation)
    for (let i = 0; i < 50000; i++) {
      allocations.push({
        id: wave * 50000 + i,
        value: Math.random(),
        timestamp: Date.now()
      });
    }
    
    // Large objects (old generation)
    for (let i = 0; i < 1000; i++) {
      allocations.push({
        id: wave * 1000 + i,
        data: Buffer.alloc(1024 * 50), // 50 KB
        nested: {
          array: new Array(500).fill(Math.random()),
          deep: { value: Math.random() }
        }
      });
    }
    
    // Force GC to measure
    if (global.gc && wave % 3 === 0) {
      global.gc();
    }
    
    // Small delay to simulate real work
    const heapUsed = (v8.getHeapStatistics().usedHeapSize / 1024 / 1024).toFixed(2);
    console.log(`  Wave ${wave + 1}/10: Heap used: ${heapUsed} MB`);
  }
  
  const end = performance.now();
  return { duration: end - start, allocations: allocations.length };
}

const result = simulateWorkload();

console.log(`\nWorkload completed:`);
console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
console.log(`  Allocations: ${result.allocations}`);

// Final GC stats
if (global.gc) {
  global.gc();
}

console.log('\n=== GC Statistics ===');
if (gcStats.minor.count > 0) {
  console.log(`Minor GC:`);
  console.log(`  Count: ${gcStats.minor.count}`);
  console.log(`  Total pause: ${gcStats.minor.totalPause.toFixed(2)}ms`);
  console.log(`  Average pause: ${(gcStats.minor.totalPause / gcStats.minor.count).toFixed(2)}ms`);
}

if (gcStats.major.count > 0) {
  console.log(`Major GC:`);
  console.log(`  Count: ${gcStats.major.count}`);
  console.log(`  Total pause: ${gcStats.major.totalPause.toFixed(2)}ms`);
  console.log(`  Average pause: ${(gcStats.major.totalPause / gcStats.major.count).toFixed(2)}ms`);
}

const finalHeap = v8.getHeapStatistics();
console.log(`\nFinal heap:`);
console.log(`  Used: ${(finalHeap.usedHeapSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Total: ${(finalHeap.totalHeapSize / 1024 / 1024).toFixed(2)} MB`);

console.log('\n=== Tuning Recommendations ===');
console.log('1. --max-old-space-size: Controls heap size limit');
console.log('   - Smaller: More frequent GC, shorter pauses');
console.log('   - Larger: Less frequent GC, longer pauses');
console.log('   - Find balance for your workload');
console.log('\n2. --min-semi-space-size: Controls young generation size');
console.log('   - Larger: Fewer minor GCs, but more memory per GC');
console.log('   - Smaller: More minor GCs, but less memory per GC');
console.log('\n3. Monitor GC behavior:');
console.log('   - Use --trace-gc to see GC events');
console.log('   - Use perf_hooks to measure pause times');
console.log('   - Adjust flags based on observed behavior');
