/**
 * Example 68: Heap Size Impact on GC Pause Time
 * 
 * Demonstrates how heap size affects GC pause duration.
 * Larger heaps = longer GC pauses.
 * 
 * Run with different heap sizes:
 *   node --max-old-space-size=128 example-68-heap-size-impact.js
 *   node --max-old-space-size=512 example-68-heap-size-impact.js
 *   node --max-old-space-size=2048 example-68-heap-size-impact.js
 * 
 * What to observe:
 * - GC pause time increases with heap size
 * - More frequent GC with smaller heap
 * - Trade-off between pause time and frequency
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const v8 = require('v8');

const gcPauses = [];

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.name === 'gc') {
      const duration = entry.duration;
      const kind = entry.kind === 0 ? 'minor' : 'major';
      const heapUsed = entry.detail.heapStatisticsAfter.usedHeapSize / 1024 / 1024;
      
      if (kind === 'major') {
        gcPauses.push({
          duration,
          heapUsed: heapUsed.toFixed(2),
          timestamp: performance.now()
        });
        
        console.log(`\n[MAJOR GC] Pause: ${duration.toFixed(2)}ms | Heap: ${heapUsed.toFixed(2)} MB`);
      }
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('=== Heap Size Impact on GC Pause Time ===\n');
console.log('Heap limit:', `${(v8.getHeapStatistics().heapSizeLimit / 1024 / 1024).toFixed(2)} MB`);

// Function to allocate memory and trigger GC
function allocateAndTriggerGC(sizeMB) {
  console.log(`\n--- Allocating ${sizeMB} MB ---`);
  const start = performance.now();
  
  const objects = [];
  const targetSize = sizeMB * 1024 * 1024;
  let allocated = 0;
  
  while (allocated < targetSize) {
    const obj = {
      data: Buffer.alloc(1024 * 10), // 10 KB
      nested: {
        array: new Array(100).fill(Math.random()),
        deep: {
          value: Math.random(),
          more: { nested: true }
        }
      }
    };
    objects.push(obj);
    allocated += 10 * 1024; // Approximate size
  }
  
  const end = performance.now();
  console.log(`Allocated ${sizeMB} MB in ${(end - start).toFixed(2)}ms`);
  console.log(`Current heap: ${(v8.getHeapStatistics().usedHeapSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Force GC to measure pause time
  if (global.gc) {
    global.gc();
  }
  
  return objects;
}

// Allocate progressively larger amounts
const allocations = [];

// Small allocation (should trigger minor GC)
console.log('\n=== Phase 1: Small Allocation ===');
allocations.push(...allocateAndTriggerGC(10));

// Medium allocation (should trigger major GC)
console.log('\n=== Phase 2: Medium Allocation ===');
allocations.push(...allocateAndTriggerGC(50));

// Large allocation (should trigger major GC with longer pause)
console.log('\n=== Phase 3: Large Allocation ===');
allocations.push(...allocateAndTriggerGC(100));

// Very large allocation (if heap allows)
const heapLimitMB = v8.getHeapStatistics().heapSizeLimit / 1024 / 1024;
if (heapLimitMB > 200) {
  console.log('\n=== Phase 4: Very Large Allocation ===');
  allocations.push(...allocateAndTriggerGC(200));
}

// Summary
console.log('\n=== GC Pause Summary ===');
if (gcPauses.length > 0) {
  const avgPause = gcPauses.reduce((sum, p) => sum + p.duration, 0) / gcPauses.length;
  const maxPause = Math.max(...gcPauses.map(p => p.duration));
  const minPause = Math.min(...gcPauses.map(p => p.duration));
  
  console.log(`Total major GCs: ${gcPauses.length}`);
  console.log(`Average pause: ${avgPause.toFixed(2)}ms`);
  console.log(`Min pause: ${minPause.toFixed(2)}ms`);
  console.log(`Max pause: ${maxPause.toFixed(2)}ms`);
  
  console.log('\n=== Key Insight ===');
  console.log('Larger heap → Longer GC pauses');
  console.log('Smaller heap → More frequent GC');
  console.log('Find the optimal balance for your workload');
} else {
  console.log('No major GC events captured. Try with --expose-gc flag');
}
