const v8 = require('v8');
const fs = require('fs');

console.log('Creating objects to analyze...');

// Global leak simulation
global.leakyCache = [];

function createLeak() {
    const data = {
        timestamp: Date.now(),
        largeArray: new Array(10000).fill('x'.repeat(100)),
        nested: {
            moreData: new Array(5000).fill({ id: Math.random() })
        }
    };

    global.leakyCache.push(data);
}

// Create some leaked objects
for (let i = 0; i < 50; i++) {
    createLeak();
}

console.log(`Created ${global.leakyCache.length} leaked objects`);

// Show memory usage before snapshot
const memBefore = process.memoryUsage();
console.log('\nMemory before snapshot:');
console.log(`  Heap Used: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  External: ${(memBefore.external / 1024 / 1024).toFixed(2)} MB`);

// Take heap snapshot
console.log('\nTaking heap snapshot...');
const snapshot = v8.writeHeapSnapshot();
const stats = fs.statSync(snapshot);

console.log(`Heap snapshot written to: ${snapshot}`);
console.log(`Snapshot size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

console.log('\nTo analyze:');
console.log('1. Open Chrome DevTools (F12)');
console.log('2. Memory tab > Load Profile');
console.log(`3. Load: ${snapshot}`);
console.log('4. Search for "leakyCache" to find the leak');
console.log('5. Check retainers to see what holds references');

// Show memory after snapshot
const memAfter = process.memoryUsage();
console.log('\nMemory after snapshot:');
console.log(`  Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Note: Snapshot temporarily increases memory`);
