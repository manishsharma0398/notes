const { performance } = require('perf_hooks');

class EventLoopMonitor {
    constructor(interval = 1000) {
        this.interval = interval;
        this.lastTime = performance.now();
        this.timer = null;
    }

    start() {
        const check = () => {
            const now = performance.now();
            const elapsed = now - this.lastTime;

            // Expected: ~interval ms
            // Actual: elapsed ms
            // Lag: difference
            const lag = Math.max(0, elapsed - this.interval);

            if (lag > 10) { //More than 10ms lag
                console.log(`⚠️  Event loop lag: ${lag.toFixed(2)}ms`);
            } else {
                console.log(`✓ Event loop healthy: ${lag.toFixed(2)}ms lag`);
            }

            this.lastTime = now;
            this.timer = setTimeout(check, this.interval);
        };

        check();
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }
}

console.log('Starting event loop monitor...\n');

const monitor = new EventLoopMonitor(1000);
monitor.start();

// Simulate blocking operations
setTimeout(() => {
    console.log('\n[Test 1] Simulating 50ms blocking operation...');
    const end = Date.now() + 50;
    while (Date.now() < end) {
        // Block event loop
    }
}, 2000);

setTimeout(() => {
    console.log('\n[Test 2] Simulating 200ms blocking operation...');
    const end = Date.now() + 200;
    while (Date.now() < end) {
        // Block event loop
    }
}, 5000);

// Clean up
setTimeout(() => {
    monitor.stop();
    console.log('\nMonitoring stopped');
    process.exit(0);
}, 8000);
