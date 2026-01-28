const { performance, PerformanceObserver } = require('perf_hooks');

// Run with: node --trace-events-enabled --trace-event-categories v8,node,node.async_hooks example-07-tracing.js

console.log('Tracing enabled, running workload...');
console.log('Trace will be saved to: node_trace.*.log\n');

// Add custom performance marks
performance.mark('workload-start');

async function asyncWork() {
    performance.mark('async-start');

    await new Promise(resolve => setTimeout(resolve, 100));

    performance.mark('async-end');
    performance.measure('async-duration', 'async-start', 'async-end');
}

async function databaseQuery() {
    performance.mark('db-query-start');

    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 200));

    performance.mark('db-query-end');
    performance.measure('db-query', 'db-query-start', 'db-query-end');
}

async function apiCall() {
    performance.mark('api-call-start');

    await new Promise(resolve => setTimeout(resolve, 150));

    performance.mark('api-call-end');
    performance.measure('api-call', 'api-call-start', 'api-call-end');
}

async function runWorkload() {
    await asyncWork();
    await databaseQuery();
    await apiCall();
    await asyncWork();
}

// Observe performance entries
const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
});
obs.observe({ entryTypes: ['measure'] });

runWorkload().then(() => {
    performance.mark('workload-end');
    performance.measure('total-workload', 'workload-start', 'workload-end');

    setTimeout(() => {
        console.log('\nTracing complete!');
        console.log('Trace file saved. To view:');
        console.log('1. Open Chrome and navigate to: chrome://tracing');
        console.log('2. Click "Load" and select the node_trace.*.log file');
        console.log('3. Examine timeline of async operations');
        process.exit(0);
    }, 500);
});
