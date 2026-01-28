const { performance, PerformanceObserver } = require('perf_hooks');

// Observe multiple entry types
const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        console.log(`[${entry.entryType}] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
});

// All available entry types
obs.observe({
    entryTypes: [
        'mark',      // performance.mark()
        'measure',   // performance.measure()
        'function',  // timerify() wrapped functions
        'gc',        // Garbage collection
        'http',      // HTTP requests (server)
        'http2',     // HTTP/2 requests
        'dns'        // DNS lookups
    ]
});

console.log('Creating various performance entries...\n');

// 1. Marks and Measures
performance.mark('start');
setTimeout(() => {
    performance.mark('end');
    performance.measure('timer-duration', 'start', 'end');
}, 100);

// 2. Function wrapping (timerify)
const wrapped = performance.timerify(function expensiveOperation(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += Math.sqrt(i);
    }
    return sum;
});

setTimeout(() => {
    wrapped(1000000); // Automatically creates 'function' entry
}, 200);

// 3. GC events (automatic)
// Trigger GC by allocating and releasing memory
setTimeout(() => {
    const arrays = [];
    for (let i = 0; i < 100; i++) {
        arrays.push(new Array(100000).fill(Math.random()));
    }
    // Clear references
    arrays.length = 0;

    // Force GC (if --expose-gc flag is set)
    if (global.gc) {
        global.gc();
    }
}, 300);

// Keep process alive
setTimeout(() => {
    console.log('\nPerformance observation complete');
    obs.disconnect();
}, 1000);

console.log('Run with: node --expose-gc example-02-entry-types.js');
