/**
 * Example 71: Memory Leak and GC Interaction
 * 
 * Demonstrates how memory leaks cause GC issues:
 * - Heap grows continuously
 * - GC runs more frequently
 * - GC pauses get longer
 * - Memory is never fully freed
 * 
 * Run with: node --expose-gc --trace-gc example-71-memory-leak-gc.js
 * 
 * What to observe:
 * - Heap grows despite GC
 * - GC frequency increases
 * - GC pause time increases
 * - Memory is never reclaimed
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const v8 = require('v8');

const gcEvents = [];
let iteration = 0;

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.name === 'gc') {
      const duration = entry.duration;
      const kind = entry.kind === 0 ? 'minor' : 'major';
      const heapBefore = entry.detail.heapStatisticsBefore.usedHeapSize / 1024 / 1024;
      const heapAfter = entry.detail.heapStatisticsAfter.usedHeapSize / 1024 / 1024;
      
      if (kind === 'major') {
        gcEvents.push({
          iteration,
          duration,
          heapBefore: heapBefore.toFixed(2),
          heapAfter: heapAfter.toFixed(2),
          freed: (heapBefore - heapAfter).toFixed(2)
        });
      }
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('=== Memory Leak and GC Interaction ===\n');

// Memory leak: objects held in closure
const leakedData = [];

function simulateWork() {
  iteration++;
  
  // Allocate memory (some will leak)
  const data = {
    id: iteration,
    buffer: Buffer.alloc(1024 * 100), // 100 KB
    nested: {
      array: new Array(1000).fill(Math.random()),
      deep: {
        level1: { level2: { level3: { value: Math.random() } } }
      }
    }
  };
  
  // Leak: hold reference in closure
  setTimeout(() => {
    // This closure holds 'data', preventing GC
    console.log(`Processing data ${data.id}`);
    // But we never clear leakedData, so memory accumulates
  }, 1000);
  
  // Leak: add to array that never gets cleared
  leakedData.push(data);
  
  // Get heap stats
  const heapStats = v8.getHeapStatistics();
  const heapUsedMB = (heapStats.usedHeapSize / 1024 / 1024).toFixed(2);
  const heapTotalMB = (heapStats.totalHeapSize / 1024 / 1024).toFixed(2);
  
  console.log(`[Iteration ${iteration}] Heap: ${heapUsedMB} MB / ${heapTotalMB} MB`);
  
  // Force GC every 10 iterations
  if (iteration % 10 === 0 && global.gc) {
    console.log('\n--- Forcing GC ---');
    const gcStart = performance.now();
    global.gc();
    const gcEnd = performance.now();
    console.log(`GC pause: ${(gcEnd - gcStart).toFixed(2)}ms`);
    
    // Show GC summary
    if (gcEvents.length > 0) {
      const recent = gcEvents.slice(-3);
      console.log('\nRecent GC events:');
      recent.forEach(e => {
        console.log(`  Iteration ${e.iteration}: ${e.duration.toFixed(2)}ms pause, Heap: ${e.heapBefore} → ${e.heapAfter} MB (freed: ${e.freed} MB)`);
      });
    }
    
    // Check if memory is growing
    if (gcEvents.length >= 2) {
      const last = gcEvents[gcEvents.length - 1];
      const prev = gcEvents[gcEvents.length - 2];
      const heapGrowth = parseFloat(last.heapAfter) - parseFloat(prev.heapAfter);
      
      if (heapGrowth > 0) {
        console.log(`⚠️  Memory leak detected: Heap grew by ${heapGrowth.toFixed(2)} MB between GCs`);
      }
    }
  }
  
  // Stop after 50 iterations
  if (iteration >= 50) {
    console.log('\n=== Final Analysis ===');
    console.log(`Total iterations: ${iteration}`);
    console.log(`Total GC events: ${gcEvents.length}`);
    console.log(`Leaked objects: ${leakedData.length}`);
    
    if (gcEvents.length > 0) {
      const firstGC = gcEvents[0];
      const lastGC = gcEvents[gcEvents.length - 1];
      const heapGrowth = parseFloat(lastGC.heapAfter) - parseFloat(firstGC.heapAfter);
      const avgPause = gcEvents.reduce((sum, e) => sum + e.duration, 0) / gcEvents.length;
      const maxPause = Math.max(...gcEvents.map(e => e.duration));
      
      console.log(`\nHeap growth: ${heapGrowth.toFixed(2)} MB`);
      console.log(`Average GC pause: ${avgPause.toFixed(2)}ms`);
      console.log(`Max GC pause: ${maxPause.toFixed(2)}ms`);
      console.log(`\n⚠️  Memory leak symptoms:`);
      console.log(`- Heap grows despite GC`);
      console.log(`- GC pauses get longer`);
      console.log(`- Memory is never fully freed`);
    }
    
    process.exit(0);
  }
}

// Run work every 100ms
const interval = setInterval(simulateWork, 100);
