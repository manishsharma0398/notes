const { performance } = require('perf_hooks');

function expensiveOperation() {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
    }
    return sum;
}

console.log('Measuring overhead of different monitoring approaches\n');

// Baseline: No monitoring
console.log('=== Baseline (No Monitoring) ===');
let start = performance.now();
for (let i = 0; i < 100; i++) {
    expensiveOperation();
}
let baseline = performance.now() - start;
console.log(`100 iterations: ${baseline.toFixed(2)}ms\n`);

// With performance marks
console.log('=== With performance.mark() ===');
start = performance.now();
for (let i = 0; i < 100; i++) {
    performance.mark(`op-${i}-start`);
    expensiveOperation();
    performance.mark(`op-${i}-end`);
}
let withMarks = performance.now() - start;
console.log(`100 iterations: ${withMarks.toFixed(2)}ms`);
console.log(`Overhead: ${(withMarks - baseline).toFixed(2)}ms (${(((withMarks - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// With performance.measure()
console.log('=== With performance.measure() ===');
start = performance.now();
for (let i = 0; i < 100; i++) {
    performance.mark(`measure-${i}-start`);
    expensiveOperation();
    performance.mark(`measure-${i}-end`);
    performance.measure(`measure-${i}`, `measure-${i}-start`, `measure-${i}-end`);
}
let withMeasures = performance.now() - start;
console.log(`100 iterations: ${withMeasures.toFixed(2)}ms`);
console.log(`Overhead: ${(withMeasures - baseline).toFixed(2)}ms (${(((withMeasures - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// With manual timing
console.log('=== With Manual performance.now() ===');
start = performance.now();
const durations = [];
for (let i = 0; i < 100; i++) {
    const opStart = performance.now();
    expensiveOperation();
    const opEnd = performance.now();
    durations.push(opEnd - opStart);
}
let withManual = performance.now() - start;
console.log(`100 iterations: ${withManual.toFixed(2)}ms`);
console.log(`Overhead: ${(withManual - baseline).toFixed(2)}ms (${(((withManual - baseline) / baseline) * 100).toFixed(1)}%)\n`);

// Summary
console.log('=== Overhead Summary ===');
console.log(`Baseline:               ${baseline.toFixed(2)}ms (0%)`);
console.log(`performance.mark():     +${(((withMarks - baseline) / baseline) * 100).toFixed(1)}%`);
console.log(`performance.measure():  +${(((withMeasures - baseline) / baseline) * 100).toFixed(1)}%`);
console.log(`manual performance.now(): +${(((withManual - baseline) / baseline) * 100).toFixed(1)}%`);

console.log('\nKey Takeaway:');
console.log('- performance.now() is very fast (~0.001ms per call)');
console.log('- Overhead is negligible for most use cases');
console.log('- Avoid measuring inside tight loops with millions of iterations');
