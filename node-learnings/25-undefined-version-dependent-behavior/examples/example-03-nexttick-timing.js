console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);

process.nextTick(() => console.log('3: nextTick'));

Promise.resolve().then(() => console.log('4: Promise'));

console.log('5: End');

setTimeout(() => {
    console.log('\n⚠️  Exact order depends on:');
    console.log('- V8 microtask queue implementation');
    console.log('- Event loop phase timing');
    console.log('- Node version');
    console.log('\n✅ Never rely on micro-timing between nextTick/Promise');
    console.log('\nNode version:', process.version);
    console.log('\nExpected order:');
    console.log('1, 5, 3, 4, 2');
    console.log('(Start, End, nextTick, Promise, setTimeout)');
    console.log('\nWhy:');
    console.log('- Synchronous code runs first (1, 5)');
    console.log('- nextTick queue processed before promises (3)');
    console.log('- Promise microtasks run next (4)');
    console.log('- setTimeout macrotask runs last (2)');
}, 10);
