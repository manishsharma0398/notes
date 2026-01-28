console.log('1: Script starts');

process.on('beforeExit', (code) => {
    console.log('4: beforeExit - event loop is empty');
    console.log(`   Exit code will be: ${code}`);

    // YOU CAN schedule new async work here!
    setTimeout(() => {
        console.log('5: New work scheduled from beforeExit');
    }, 100);

    // This will cause beforeExit to fire again after the timer
});

process.on('exit', (code) => {
    console.log('6: exit - process is exiting NOW');
    console.log(`   Final exit code: ${code}`);

    // ONLY SYNCHRONOUS CODE WORKS HERE
    // Event loop is stopped
    setTimeout(() => {
        console.log('This will NEVER run!');
    }, 0);
});

setTimeout(() => {
    console.log('3: Timer executed');
}, 50);

console.log('2: Script ends');
