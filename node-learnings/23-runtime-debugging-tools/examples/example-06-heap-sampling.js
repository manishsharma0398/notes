const { Session } = require('inspector');
const fs = require('fs');

const session = new Session();
session.connect();

console.log('Starting heap sampling profiler...');
console.log('This tracks allocation patterns with low overhead\n');

session.post('HeapProfiler.enable', () => {
    session.post('HeapProfiler.startSampling', { samplingInterval: 512 }, () => {
        console.log('Heap profiler started (sampling every 512 bytes)');

        // Allocate memory over time
        let allocations = [];
        let counter = 0;

        const interval = setInterval(() => {
            counter++;

            // Allocate objects
            const batch = [];
            for (let i = 0; i < 1000; i++) {
                batch.push({
                    id: counter * 1000 + i,
                    data: new Array(100).fill(Math.random())
                });
            }
            allocations.push(batch);

            const memUsed = process.memoryUsage().heapUsed / 1024 / 1024;
            console.log(`[${counter}] ${allocations.length * 1000} objects, ${memUsed.toFixed(2)} MB heap`);

            if (counter === 10) {
                clearInterval(interval);

                // Stop sampling
                console.log('\nStopping heap profiler...');
                session.post('HeapProfiler.stopSampling', (err, { profile }) => {
                    if (err) {
                        console.error('Error stopping:', err);
                        return;
                    }

                    fs.writeFileSync('heap-sampling.heapprofile', JSON.stringify(profile));
                    console.log('Heap sampling profile saved: heap-sampling.heapprofile');
                    console.log('\nLoad in Chrome DevTools:');
                    console.log('  Memory > Load Profile > heap-sampling.heapprofile');

                    session.disconnect();
                    process.exit(0);
                });
            }
        }, 500);
    });
});
