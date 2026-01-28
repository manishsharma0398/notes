const http = require('http');
const { EventEmitter } = require('events');

class GracefulShutdown extends EventEmitter {
    constructor() {
        super();
        this.isShuttingDown = false;
        this.shutdownTimeout = 30000; // 30 seconds
        this.activeConnections = new Set();
    }

    init(server) {
        this.server = server;

        // Track active connections
        server.on('connection', (conn) => {
            this.activeConnections.add(conn);
            conn.on('close', () => {
                this.activeConnections.delete(conn);
            });
        });

        // Handle signals
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));

        // Handle uncaught errors
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
            this.shutdown('uncaughtException', 1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.shutdown('unhandledRejection', 1);
        });
    }

    async shutdown(signal, exitCode = 0) {
        if (this.isShuttingDown) {
            console.log(`Already shutting down, ignoring ${signal}`);
            return;
        }

        this.isShuttingDown = true;
        console.log(`\n${signal} received, starting graceful shutdown...`);

        // Set a hard timeout
        const forceExitTimer = setTimeout(() => {
            console.error('Graceful shutdown timeout, forcing exit');
            process.exit(1);
        }, this.shutdownTimeout);

        try {
            // Step 1: Stop accepting new connections
            console.log('1. Stopping server (no new connections)...');
            await new Promise((resolve) => {
                this.server.close((err) => {
                    if (err) console.error('Error closing server:', err);
                    resolve();
                });
            });

            // Step 2: Close idle connections
            console.log('2. Closing idle connections...');
            for (const conn of this.activeConnections) {
                if (!conn.destroyed) {
                    conn.end();
                }
            }

            // Step 3: Wait for active connections to finish
            console.log('3. Waiting for active connections to close...');
            await this.waitForConnections();

            // Step 4: Close database connections
            console.log('4. Closing database connections...');
            await this.closeDatabase();

            // Step 5: Flush logs and metrics
            console.log('5. Flushing logs and metrics...');
            await this.flushLogs();

            console.log('Graceful shutdown complete');
            clearTimeout(forceExitTimer);
            process.exit(exitCode);
        } catch (err) {
            console.error('Error during shutdown:', err);
            clearTimeout(forceExitTimer);
            process.exit(1);
        }
    }

    async waitForConnections(maxWait = 25000) {
        const startTime = Date.now();
        while (this.activeConnections.size > 0) {
            if (Date.now() - startTime > maxWait) {
                console.warn(`Forcing close of ${this.activeConnections.size} connections`);
                for (const conn of this.activeConnections) {
                    conn.destroy();
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async closeDatabase() {
        // Simulate database close
        return new Promise(resolve => setTimeout(resolve, 500));
    }

    async flushLogs() {
        // Simulate log flush
        return new Promise(resolve => setTimeout(resolve, 200));
    }
}

// Usage
const server = http.createServer((req, res) => {
    // Simulate slow request
    setTimeout(() => {
        res.writeHead(200);
        res.end('Response after 2 seconds\n');
    }, 2000);
});

const gracefulShutdown = new GracefulShutdown();
gracefulShutdown.init(server);

server.listen(3000, () => {
    console.log('Server listening on port 3000');
    console.log(`Process PID: ${process.pid}`);
    console.log('Test: curl http://localhost:3000 & kill -TERM <PID>');
});
