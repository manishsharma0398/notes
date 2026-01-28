const { performance, PerformanceObserver } = require('perf_hooks');

console.log('Demonstrating performance measurement basics\n');

// Mark the start of an operation
performance.mark('operation-start');

// Simulate some work
function doWork() {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
    }
    return sum;
}

const result = doWork();

// Mark the end
performance.mark('operation-end');

// Measure the duration between marks
performance.measure('operation-duration', 'operation-start', 'operation-end');

// Get the measurement
const measurements = performance.getEntriesByName('operation-duration');
console.log(`Operation took: ${measurements[0].duration.toFixed(2)}ms`);

// PerformanceObserver: Async notification for performance entries
const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        console.log(`[Observer] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
});

// Observe 'measure' events
obs.observe({ entryTypes: ['measure'] });

// Create more measurements
performance.mark('another-start');
setTimeout(() => {
    performance.mark('another-end');
    performance.measure('async-operation', 'another-start', 'another-end');

    setTimeout(() => {
        obs.disconnect();
        console.log('\nDemo complete!');
    }, 100);
}, 100);
