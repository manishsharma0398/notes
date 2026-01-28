/**
 * Example 67: Measuring GC Pause Time
 * 
 * Demonstrates how to measure GC pause time using perf_hooks
 * and observe the impact of GC on JavaScript execution.
 * 
 * Run with: node --expose-gc example-67-gc-pause-measurement.js
 * 
 * What to observe:
 * - GC pause times (should be 1-5ms for minor, 50-200ms+ for major)
 * - How GC pauses block JavaScript execution
 * - Correlation between heap size and pause time
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const v8 = require('v8');

// Enable GC tracking
const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.name === 'gc') {
      const duration = entry.duration;
      const kind = entry.kind === 0 ? 'minor' : 'major';
      const heapBefore = (entry.detail.heapStatisticsBefore.usedHeapSize / 1024 / 1024).toFixed(2);
      const heapAfter = (entry.detail.heapStatisticsAfter.usedHeapSize / 1024 / 1024).toFixed(2);
      
      console.log(`\n[GC] ${kind.toUpperCase()} GC`);
      console.log(`  Pause time: ${duration.toFixed(2)}ms`);
      console.log(`  Heap before: ${heapBefore} MB`);
      console.log(`  Heap after: ${heapAfter} MB`);
      console.log(`  Freed: ${(entry.detail.heapStatisticsBefore.usedHeapSize - entry.detail.heapStatisticsAfter.usedHeapSize) / 1024 / 1024} MB`);
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('=== GC Pause Measurement ===\n');
console.log('Heap stats:', {
  total: `${(v8.getHeapStatistics().totalHeapSize / 1024 / 1024).toFixed(2)} MB`,
  used: `${(v8.getHeapStatistics().usedHeapSize / 1024 / 1024).toFixed(2)} MB`,
  limit: `${(v8.getHeapStatistics().heapSizeLimit / 1024 / 1024).toFixed(2)} MB`
});

// Simulate work with timestamps to show GC blocking
let lastTimestamp = performance.now();

function logTimestamp(label) {
  const now = performance.now();
  const elapsed = now - lastTimestamp;
  console.log(`[${label}] Time: ${now.toFixed(2)}ms (elapsed: ${elapsed.toFixed(2)}ms)`);
  lastTimestamp = now;
}

logTimestamp('Start');

// Allocate memory to trigger minor GC
console.log('\n--- Allocating small objects (minor GC) ---');
const smallObjects = [];
for (let i = 0; i < 100000; i++) {
  smallObjects.push({
    id: i,
    data: `string-${i}`,
    nested: { value: i * 2 }
  });
}
logTimestamp('After small allocations');

// Force GC (for demonstration)
if (global.gc) {
  console.log('\n--- Forcing minor GC ---');
  global.gc();
  logTimestamp('After minor GC');
}

// Allocate larger objects to trigger major GC
console.log('\n--- Allocating large objects (major GC) ---');
const largeObjects = [];
for (let i = 0; i < 10000; i++) {
  largeObjects.push({
    id: i,
    data: Buffer.alloc(1024 * 10), // 10 KB per object
    nested: {
      array: new Array(100).fill(i),
      obj: { deep: { value: i } }
    }
  });
}
logTimestamp('After large allocations');

// Force major GC
if (global.gc) {
  console.log('\n--- Forcing major GC ---');
  global.gc();
  logTimestamp('After major GC');
}

console.log('\n=== Final Heap Stats ===');
console.log({
  total: `${(v8.getHeapStatistics().totalHeapSize / 1024 / 1024).toFixed(2)} MB`,
  used: `${(v8.getHeapStatistics().usedHeapSize / 1024 / 1024).toFixed(2)} MB`,
  limit: `${(v8.getHeapStatistics().heapSizeLimit / 1024 / 1024).toFixed(2)} MB`
});

console.log('\n=== Key Observations ===');
console.log('1. GC pauses block JavaScript execution');
console.log('2. Minor GC pauses are short (1-5ms)');
console.log('3. Major GC pauses are longer (50-200ms+)');
console.log('4. Pause time correlates with heap size');
