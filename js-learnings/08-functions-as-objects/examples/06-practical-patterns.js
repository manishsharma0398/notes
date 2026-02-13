// Example 6: Practical Patterns
// Demonstrates: Real-world function object patterns

console.log('=== Pattern 1: Module Pattern (IIFE) ===');

const Calculator = (function () {
    // Private state
    let history = [];

    // Private function
    function log(operation, result) {
        history.push({ operation, result, timestamp: Date.now() });
    }

    // Public API
    return {
        add(a, b) {
            const result = a + b;
            log(`${a} + ${b}`, result);
            return result;
        },
        subtract(a, b) {
            const result = a - b;
            log(`${a} - ${b}`, result);
            return result;
        },
        getHistory() {
            return [...history]; // Return copy
        },
        clearHistory() {
            history = [];
        }
    };
})();

console.log('Calculator.add(5, 3):', Calculator.add(5, 3));
console.log('Calculator.subtract(10, 4):', Calculator.subtract(10, 4));
console.log('Calculator.getHistory():', Calculator.getHistory());

console.log('\n=== Pattern 2: Counter with Methods ===');

function createCounter(initial = 0) {
    let count = initial;

    function counter() {
        return count;
    }

    counter.increment = function () {
        count++;
        return count;
    };

    counter.decrement = function () {
        count--;
        return count;
    };

    counter.reset = function () {
        count = initial;
        return count;
    };

    return counter;
}

const myCounter = createCounter(5);
console.log('Initial:', myCounter());           // 5
console.log('Increment:', myCounter.increment()); // 6
console.log('Increment:', myCounter.increment()); // 7
console.log('Decrement:', myCounter.decrement()); // 6
console.log('Reset:', myCounter.reset());         // 5

console.log('\n=== Pattern 3: Event Emitter === ');

function createEventEmitter() {
    const events = {};

    return {
        on(event, listener) {
            if (!events[event]) {
                events[event] = [];
            }
            events[event].push(listener);
        },

        off(event, listener) {
            if (!events[event]) return;
            events[event] = events[event].filter(l => l !== listener);
        },

        emit(event, ...args) {
            if (!events[event]) return;
            events[event].forEach(listener => listener(...args));
        },

        once(event, listener) {
            const onceWrapper = (...args) => {
                listener(...args);
                this.off(event, onceWrapper);
            };
            this.on(event, onceWrapper);
        }
    };
}

const emitter = createEventEmitter();

const greetListener = (name) => console.log(`  Hello, ${name}!`);
emitter.on('greet', greetListener);
emitter.on('greet', (name) => console.log(`  Welcome, ${name}!`));

console.log('Emitting greet event:');
emitter.emit('greet', 'Alice');

emitter.off('greet', greetListener);
console.log('\nAfter removing first listener:');
emitter.emit('greet', 'Bob');

console.log('\n=== Pattern 4: Function Factory with Configuration ===');

function createLogger(config = {}) {
    const defaults = {
        prefix: '[LOG]',
        timestamp: false,
        level: 'info'
    };

    const settings = { ...defaults, ...config };

    function log(message) {
        let output = settings.prefix;
        if (settings.timestamp) {
            output += ` [${new Date().toISOString()}]`;
        }
        output += ` ${message}`;
        console.log(output);
    }

    log.setPrefix = function (prefix) {
        settings.prefix = prefix;
    };

    log.enableTimestamp = function () {
        settings.timestamp = true;
    };

    log.disableTimestamp = function () {
        settings.timestamp = false;
    };

    log.getConfig = function () {
        return { ...settings };
    };

    return log;
}

const appLogger = createLogger({ prefix: '[APP]' });
appLogger('Application started');
appLogger.enableTimestamp();
appLogger('With timestamp');
appLogger.setPrefix('[DEBUG]');
appLogger('Changed prefix');

console.log('\n=== Pattern 5: Memoized Recursive Function ===');

function createMemoizedFibonacci() {
    const cache = { 0: 0, 1: 1 };

    function fib(n) {
        if (n in cache) {
            return cache[n];
        }

        cache[n] = fib(n - 1) + fib(n - 2);
        return cache[n];
    }

    fib.getCache = function () {
        return { ...cache };
    };

    fib.clearCache = function () {
        Object.keys(cache).forEach(key => {
            if (key !== '0' && key !== '1') {
                delete cache[key];
            }
        });
    };

    return fib;
}

const fib = createMemoizedFibonacci();
console.log('fib(10):', fib(10));
console.log('Cache:', fib.getCache());
console.log('fib(15):', fib(15));
console.log('Cache size:', Object.keys(fib.getCache()).length);

console.log('\n=== Pattern 6: Singleton Function ===');

const DatabaseConnection = (function () {
    let instance;
    let connectionCount = 0;

    function createConnection() {
        connectionCount++;
        return {
            id: connectionCount,
            query(sql) {
                console.log(`  Executing query: ${sql}`);
                return `Result set from connection ${this.id}`;
            },
            close() {
                console.log(`  Connection ${this.id} closed`);
            }
        };
    }

    return {
        getInstance() {
            if (!instance) {
                console.log('  Creating new connection...');
                instance = createConnection();
            }
            return instance;
        }
    };
})();

const conn1 = DatabaseConnection.getInstance();
const conn2 = DatabaseConnection.getInstance();

console.log('conn1 === conn2:', conn1 === conn2); // true
console.log(conn1.query('SELECT * FROM users'));

console.log('\n=== Pattern 7: Fluent Interface ===');

function QueryBuilder() {
    this.query = {
        select: [],
        from: null,
        where: [],
        limit: null
    };
}

QueryBuilder.prototype.select = function (...fields) {
    this.query.select.push(...fields);
    return this; // Enable chaining
};

QueryBuilder.prototype.from = function (table) {
    this.query.from = table;
    return this;
};

QueryBuilder.prototype.where = function (condition) {
    this.query.where.push(condition);
    return this;
};

QueryBuilder.prototype.limit = function (n) {
    this.query.limit = n;
    return this;
};

QueryBuilder.prototype.build = function () {
    let sql = `SELECT ${this.query.select.join(', ')} FROM ${this.query.from}`;
    if (this.query.where.length > 0) {
        sql += ` WHERE ${this.query.where.join(' AND ')}`;
    }
    if (this.query.limit) {
        sql += ` LIMIT ${this.query.limit}`;
    }
    return sql;
};

const query = new QueryBuilder()
    .select('id', 'name', 'email')
    .from('users')
    .where('age > 18')
    .where('active = true')
    .limit(10)
    .build();

console.log('Generated SQL:', query);

console.log('\n=== Pattern 8: Strategy Pattern ===');

const PaymentProcessor = {
    strategies: {
        creditCard(amount) {
            console.log(`  Processing $${amount} via Credit Card`);
            return { success: true, method: 'credit card' };
        },
        paypal(amount) {
            console.log(`  Processing $${amount} via PayPal`);
            return { success: true, method: 'paypal' };
        },
        crypto(amount) {
            console.log(`  Processing $${amount} via Cryptocurrency`);
            return { success: true, method: 'crypto' };
        }
    },

    process(method, amount) {
        const strategy = this.strategies[method];
        if (!strategy) {
            throw new Error(`Unknown payment method: ${method}`);
        }
        return strategy(amount);
    },

    addStrategy(name, fn) {
        this.strategies[name] = fn;
    }
};

console.log('Processing payments:');
PaymentProcessor.process('creditCard', 100);
PaymentProcessor.process('paypal', 50);

PaymentProcessor.addStrategy('bankTransfer', (amount) => {
    console.log(`  Processing $${amount} via Bank Transfer`);
    return { success: true, method: 'bank' };
});

PaymentProcessor.process('bankTransfer', 200);

console.log('\n=== Pattern 9: Observer Pattern ===');

function createObservable(initialValue) {
    let value = initialValue;
    const observers = [];

    return {
        get() {
            return value;
        },
        set(newValue) {
            if (value !== newValue) {
                const oldValue = value;
                value = newValue;
                observers.forEach(observer => observer(newValue, oldValue));
            }
        },
        subscribe(observer) {
            observers.push(observer);
            return () => {
                const index = observers.indexOf(observer);
                if (index > -1) observers.splice(index, 1);
            };
        }
    };
}

const state = createObservable(0);

const unsubscribe = state.subscribe((newVal, oldVal) => {
    console.log(`  State changed: ${oldVal} → ${newVal}`);
});

console.log('Updating state:');
state.set(1);
state.set(2);
state.set(3);

console.log('\n=== Pattern 10: Dependency Injection ===');

function createService(dependencies) {
    const { logger, database, cache } = dependencies;

    return {
        async getUser(id) {
            logger.log(`Fetching user ${id}`);

            // Check cache
            const cached = cache.get(`user:${id}`);
            if (cached) {
                logger.log('Cache hit');
                return cached;
            }

            // Fetch from database
            logger.log('Cache miss, querying database');
            const user = await database.query(`SELECT * FROM users WHERE id = ${id}`);
            cache.set(`user:${id}`, user);

            return user;
        }
    };
}

// Mock dependencies
const mockLogger = {
    log(msg) { console.log(`  [LOGGER] ${msg}`); }
};

const mockDatabase = {
    query(sql) {
        return Promise.resolve({ id: 1, name: 'Alice' });
    }
};

const mockCache = new Map();

const userService = createService({
    logger: mockLogger,
    database: mockDatabase,
    cache: mockCache
});

console.log('Calling userService.getUser(1):');
userService.getUser(1).then(user => {
    console.log('Received user:', user);
});
