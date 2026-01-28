const v8 = require('v8');

console.log('Demonstrating heap snapshot memory overhead...\n');

// Allocate significant memory
console.log('Allocating large array...');
const largeData = [];
for (let i = 0; i < 100000; i++) {
    largeData.push({
        id: i,
        data: new Array(100).fill('x'.repeat(100))
    });
}

const memBefore = process.memoryUsage();
console.log('\nMemory BEFORE snapshot:');
console.log(`  Heap Used: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Total: ${(memBefore.heapTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`  RSS: ${(memBefore.rss / 1024 / 1024).toFixed(2)} MB`);

console.log('\nTaking snapshot (this may cause memory spike)...');

try {
    const startTime = Date.now();
    const snapshot = v8.writeHeapSnapshot();
    const duration = Date.now() - startTime;

    const memAfter = process.memoryUsage();
    console.log('\nSnapshot completed!');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  File: ${snapshot}`);

    console.log('\nMemory AFTER snapshot:');
    console.log(`  Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap Total: ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB`);

    console.log('\nMemory IMPACT:');
    console.log(`  Heap increase: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  RSS increase: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n⚠️  WARNING: In production with near-full heap, this could cause OOM!');
    console.log('Consider using heap sampling instead for lower overhead.');

} catch (err) {
    console.error('\n❌ Snapshot failed:', err.message);
    console.error('Likely cause: Insufficient memory for snapshot creation');
}
