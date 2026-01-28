const { performance } = require('perf_hooks');

console.log('Testing setTimeout precision across Node versions\n');

const measurements = [];

function testTimerPrecision() {
    const start = performance.now();

    setTimeout(() => {
        const actual = performance.now() - start;
        measurements.push(actual);

        if (measurements.length < 100) {
            testTimerPrecision();
        } else {
            analyzePrecision();
        }
    }, 1); // Request 1ms timeout
}

function analyzePrecision() {
    const sorted = measurements.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = measurements.reduce((a, b) => a + b) / measurements.length;

    console.log('setTimeout(callback, 1) precision:');
    console.log(`  Requested: 1ms`);
    console.log(`  Actual Min: ${min.toFixed(2)}ms`);
    console.log(`  Actual Avg: ${avg.toFixed(2)}ms`);
    console.log(`  Actual Max: ${max.toFixed(2)}ms`);
    console.log(`\nNode Version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);

    console.log('\nWhy it varies:');
    console.log('- OS timer granularity (Windows: ~15ms, Linux: ~1ms)');
    console.log('- Event loop congestion');
    console.log('- V8 optimizations');
    console.log('- System load');

    console.log('\n⚠️  NEVER rely on exact setTimeout timing!');
    console.log('Use setTimeout for "roughly after X ms", not "exactly at X ms"');
}

testTimerPrecision();
