console.log('1: Start');

process.on('SIGTERM', () => {
    console.log('4: SIGTERM handler');
});

// Simulate blocking operation
console.log('2: Starting blocking operation...');
let count = 0;
while (count < 2000000000) {
    count++;
}

console.log('3: After blocking operation');
setTimeout(() => console.log('5: Timer'), 0);

console.log('\nSend SIGTERM now: kill -TERM ' + process.pid);
console.log('Signal will be queued and processed after blocking operation completes');

// Keep alive to see the signal handler
setTimeout(() => { }, 5000);
