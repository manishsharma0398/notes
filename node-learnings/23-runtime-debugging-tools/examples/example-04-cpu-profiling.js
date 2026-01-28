const { Session } = require('inspector');
const fs = require('fs');

const session = new Session();
session.connect();

// Start profiling
session.post('Profiler.enable', () => {
    session.post('Profiler.start', () => {
        console.log('Profiling started...');

        // Run code to profile
        runWorkload();

        // Stop profiling after 5 seconds
        setTimeout(() => {
            session.post('Profiler.stop', (err, { profile }) => {
                if (err) {
                    console.error('Profiler stop error:', err);
                    return;
                }

                // Save profile
                fs.writeFileSync('cpu-profile.cpuprofile', JSON.stringify(profile));
                console.log('Profile saved to cpu-profile.cpuprofile');
                console.log('Load in Chrome DevTools: Performance > Load Profile');

                session.disconnect();
                process.exit(0);
            });
        }, 5000);
    });
});

function runWorkload() {
    setInterval(() => {
        fastFunction();
        slowFunction();
        mediumFunction();
    }, 100);
}

function fastFunction() {
    let sum = 0;
    for (let i = 0; i < 100; i++) {
        sum += i;
    }
    return sum;
}

function slowFunction() {
    // This will show up as hot in CPU profile
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
    }
    return sum;
}

function mediumFunction() {
    let result = '';
    for (let i = 0; i < 10000; i++) {
        result += 'x';
    }
    return result;
}

console.log('CPU profiling will run for 5 seconds...');
console.log('Expect slowFunction to show highest CPU usage');
