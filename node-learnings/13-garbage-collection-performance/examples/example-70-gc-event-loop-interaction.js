/**
 * Example 70: GC and Event Loop Interaction
 * 
 * Demonstrates how GC pauses block the event loop:
 * - Timers are delayed during GC
 * - I/O callbacks are delayed during GC
 * - Request processing is blocked during GC
 * 
 * Run with: node --expose-gc example-70-gc-event-loop-interaction.js
 * 
 * What to observe:
 * - GC pauses cause timer delays
 * - Event loop stalls during GC
 * - Impact on request latency
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const v8 = require('v8');

const gcPauses = [];
let timerDelays = [];

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.name === 'gc') {
      const duration = entry.duration;
      const kind = entry.kind === 0 ? 'minor' : 'major';
      
      if (kind === 'major') {
        gcPauses.push({
          duration,
          timestamp: performance.now()
        });
        console.log(`\n[GC] Major GC pause: ${duration.toFixed(2)}ms`);
      }
    }
  });
});

obs.observe({ entryTypes: ['gc'] });

console.log('=== GC and Event Loop Interaction ===\n');

// Simulate timer that should fire every 10ms
let timerCount = 0;
let lastTimerTime = performance.now();
const expectedInterval = 10;

const timer = setInterval(() => {
  timerCount++;
  const now = performance.now();
  const actualInterval = now - lastTimerTime;
  const delay = actualInterval - expectedInterval;
  
  if (delay > 5) { // Only log significant delays
    timerDelays.push({
      count: timerCount,
      expected: expectedInterval,
      actual: actualInterval.toFixed(2),
      delay: delay.toFixed(2)
    });
    console.log(`[Timer #${timerCount}] Expected: ${expectedInterval}ms, Actual: ${actualInterval.toFixed(2)}ms, Delay: ${delay.toFixed(2)}ms`);
  }
  
  lastTimerTime = now;
  
  if (timerCount >= 100) {
    clearInterval(timer);
    printSummary();
  }
}, expectedInterval);

// Simulate work that triggers GC
function triggerGC() {
  console.log('\n--- Triggering GC (allocating memory) ---');
  
  // Allocate memory to trigger major GC
  const objects = [];
  for (let i = 0; i < 50000; i++) {
    objects.push({
      data: Buffer.alloc(1024 * 10), // 10 KB
      nested: {
        array: new Array(100).fill(Math.random()),
        deep: { value: Math.random() }
      }
    });
  }
  
  // Force GC
  if (global.gc) {
    const gcStart = performance.now();
    global.gc();
    const gcEnd = performance.now();
    console.log(`GC completed in ${(gcEnd - gcStart).toFixed(2)}ms`);
  }
}

// Trigger GC at intervals
setTimeout(() => triggerGC(), 200);
setTimeout(() => triggerGC(), 500);
setTimeout(() => triggerGC(), 800);

function printSummary() {
  console.log('\n=== Summary ===');
  
  if (gcPauses.length > 0) {
    const totalGCPause = gcPauses.reduce((sum, p) => sum + p.duration, 0);
    console.log(`Total GC pauses: ${gcPauses.length}`);
    console.log(`Total GC pause time: ${totalGCPause.toFixed(2)}ms`);
    console.log(`Average GC pause: ${(totalGCPause / gcPauses.length).toFixed(2)}ms`);
  }
  
  if (timerDelays.length > 0) {
    const totalDelay = timerDelays.reduce((sum, d) => sum + parseFloat(d.delay), 0);
    const maxDelay = Math.max(...timerDelays.map(d => parseFloat(d.delay)));
    console.log(`\nTimer delays: ${timerDelays.length}`);
    console.log(`Total delay: ${totalDelay.toFixed(2)}ms`);
    console.log(`Max delay: ${maxDelay.toFixed(2)}ms`);
  }
  
  console.log('\n=== Key Insight ===');
  console.log('GC pauses block the event loop:');
  console.log('- Timers are delayed');
  console.log('- I/O callbacks are delayed');
  console.log('- Request processing is blocked');
  console.log('- Real-time applications experience jitter');
  
  process.exit(0);
}
