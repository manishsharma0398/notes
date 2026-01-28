console.log('Application starting...');
console.log(`Process PID: ${process.pid}`);

function slowFunction() {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
        sum += i;
    }
    return sum;
}

setInterval(() => {
    console.log('Heartbeat:', Date.now());
    const result = slowFunction();
    console.log('Result:', result);
}, 2000);

console.log('\nTo debug:');
console.log('1. Open chrome://inspect in Chrome');
console.log('2. Click "inspect" under Remote Target');
console.log('3. Set breakpoints in slowFunction');
