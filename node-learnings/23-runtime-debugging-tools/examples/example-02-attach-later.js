console.log(`Process PID: ${process.pid}`);
console.log('Running without inspector initially...');

let counter = 0;
setInterval(() => {
    counter++;
    console.log(`Counter: ${counter}`);

    if (counter === 10) {
        console.log('Something seems wrong, need to debug!');
        console.log(`Send SIGUSR1 to enable inspector: kill -USR1 ${process.pid}`);
    }
}, 1000);

console.log('\nTo attach debugger later:');
console.log(`  kill -USR1 ${process.pid}`);
console.log('  Then open chrome://inspect');
