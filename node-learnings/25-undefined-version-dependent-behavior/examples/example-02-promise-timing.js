console.log('Promise microtask timing (varies by V8 version)\n');

(async () => {
    console.log('1: Start');

    Promise.resolve().then(() => console.log('2: Microtask 1'));

    await null; // Yields to microtask queue

    console.log('3: After await');

    Promise.resolve().then(() => console.log('4: Microtask 2'));

    console.log('5: Synchronous after promise');

    setTimeout(() => {
        console.log('6: Macrotask');

        console.log('\n⚠️  Output order may vary across Node versions!');
        console.log('Node 14 vs 16 vs 18 vs 20 may produce different orders');
        console.log('Reason: V8 microtask queue implementation changes');
        console.log('\nCurrent Node version:', process.version);
        console.log('\nVersion differences:');
        console.log('- Node 14 (V8 8.4): await compiles to 2 microtasks');
        console.log('- Node 16 (V8 9.4): await optimized to 1 microtask');
        console.log('- Node 18 (V8 10.2): Further promise optimizations');
        console.log('- Node 20 (V8 11.3): Faster promise resolution');
    }, 0);
})();
