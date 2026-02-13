// Example 6: Module Pattern
// Demonstrates: Creating singleton modules with private state

const Calculator = (function () {
    // Private state
    let history = [];
    let lastResult = 0;

    // Private helper
    function log(operation, a, b, result) {
        history.push({
            operation,
            operands: [a, b],
            result,
            timestamp: new Date()
        });
    }

    // Public API
    return {
        add(a, b) {
            const result = a + b;
            log('add', a, b, result);
            lastResult = result;
            return result;
        },

        subtract(a, b) {
            const result = a - b;
            log('subtract', a, b, result);
            lastResult = result;
            return result;
        },

        multiply(a, b) {
            const result = a * b;
            log('multiply', a, b, result);
            lastResult = result;
            return result;
        },

        divide(a, b) {
            if (b === 0) {
                throw new Error('Division by zero');
            }
            const result = a / b;
            log('divide', a, b, result);
            lastResult = result;
            return result;
        },

        getLastResult() {
            return lastResult;
        },

        getHistory() {
            return [...history];  // Return copy
        },

        clearHistory() {
            history = [];
            lastResult = 0;
        }
    };
})();

// Usage
console.log('5 + 3 =', Calculator.add(5, 3));        // 8
console.log('10 - 4 =', Calculator.subtract(10, 4)); // 6
console.log('7 * 6 =', Calculator.multiply(7, 6));   // 42
console.log('20 / 5 =', Calculator.divide(20, 5));   // 4

console.log('\nLast result:', Calculator.getLastResult()); // 4

console.log('\nHistory:');
const history = Calculator.getHistory();
history.forEach(entry => {
    console.log(`  ${entry.operation}(${entry.operands.join(', ')}) = ${entry.result}`);
});

// Private variables are inaccessible
console.log('\nTrying to access private data:');
console.log('Calculator.history:', Calculator.history);       // undefined
console.log('Calculator.lastResult:', Calculator.lastResult); // undefined
console.log('Calculator.log:', Calculator.log);               // undefined
