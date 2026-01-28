const inspector = require('inspector');
const { Session } = require('inspector');
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class ProductionDebugger {
    constructor() {
        this.session = null;
        this.isProfilerRunning = false;
    }

    enableInspector() {
        if (inspector.url()) {
            console.log('Inspector already enabled:', inspector.url());
            return;
        }

        // Enable inspector on SIGUSR1
        process.on('SIGUSR1', () => {
            console.log('\n[SIGUSR1] Enabling inspector...');
            inspector.open(9229, '127.0.0.1', false);
            console.log('Inspector enabled on port 9229');
            console.log('Connect with: chrome://inspect or VS Code');
            console.log(`Inspector URL: ${inspector.url()}\n`);
        });

        console.log(`Send SIGUSR1 to enable inspector: kill -USR1 ${process.pid}`);
    }

    takeHeapSnapshot(filename) {
        const filepath = path.join(__dirname, filename || `heap-${Date.now()}.heapsnapshot`);
        console.log('\n[Heap Snapshot] Taking snapshot...');

        const memBefore = process.memoryUsage();
        const snapshot = v8.writeHeapSnapshot(filepath);
        const stats = fs.statSync(snapshot);
        const memAfter = process.memoryUsage();

        console.log(`Snapshot written: ${snapshot}`);
        console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Memory impact: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB\n`);

        return snapshot;
    }

    async startCPUProfile(duration = 30000) {
        if (this.isProfilerRunning) {
            console.log('[CPU Profile] Profiler already running');
            return;
        }

        this.session = new Session();
        this.session.connect();
        this.isProfilerRunning = true;

        return new Promise((resolve, reject) => {
            this.session.post('Profiler.enable', () => {
                this.session.post('Profiler.start', () => {
                    console.log(`\n[CPU Profile] Started for ${duration}ms`);

                    setTimeout(() => {
                        this.session.post('Profiler.stop', (err, { profile }) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const filename = `cpu-profile-${Date.now()}.cpuprofile`;
                            fs.writeFileSync(filename, JSON.stringify(profile));

                            const stats = fs.statSync(filename);
                            console.log(`[CPU Profile] Saved: ${filename}`);
                            console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB\n`);

                            this.session.disconnect();
                            this.isProfilerRunning = false;
                            resolve(filename);
                        });
                    }, duration);
                });
            });
        });
    }

    setupSignalHandlers() {
        // SIGUSR1: Enable inspector
        this.enableInspector();

        // SIGUSR2: Take heap snapshot
        process.on('SIGUSR2', () => {
            console.log('\n[SIGUSR2] Signal received');
            this.takeHeapSnapshot();
        });

        console.log(`\nDebugging signals configured for PID ${process.pid}:`);
        console.log('  kill -USR1 <pid>  # Enable inspector (chrome://inspect)');
        console.log('  kill -USR2 <pid>  # Take heap snapshot');
        console.log('');
    }
}

// Usage
const debugger = new ProductionDebugger();
debugger.setupSignalHandlers();

// Simulate application
let counter = 0;
const cache = [];

console.log('Application started. Simulating workload...\n');

setInterval(() => {
    counter++;

    // Simulate some memory allocation
    cache.push({
        timestamp: Date.now(),
        data: new Array(1000).fill(Math.random())
    });

    // Prevent unbounded growth
    if (cache.length > 100) {
        cache.shift();
    }

    const memUsed = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`[${counter}] Heartbeat | Cache: ${cache.length} items | Heap: ${memUsed.toFixed(2)} MB`);
}, 1000);

console.log('Application running. Use signals to debug while live:');
console.log(`  kill -USR1 ${process.pid}  # Enable inspector`);
console.log(`  kill -USR2 ${process.pid}  # Take heap snapshot`);
