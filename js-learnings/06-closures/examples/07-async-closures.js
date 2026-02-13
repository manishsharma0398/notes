// Example 7: Closure with setTimeout
// Demonstrates: How closures work with async callbacks

console.log('=== Problem: var in setTimeout ===');

function demonstrateVarProblem() {
    for (var i = 1; i <= 3; i++) {
        setTimeout(function () {
            console.log('var version, i =', i);
        }, i * 1000);
    }
    // All three timeouts will log 4, not 1, 2, 3
    // Because they all reference the same 'i', which becomes 4 after the loop
}

demonstrateVarProblem();

setTimeout(() => {
    console.log('\n=== Solution 1: let in setTimeout ===');

    function demonstrateLetSolution() {
        for (let i = 1; i <= 3; i++) {
            setTimeout(function () {
                console.log('let version, i =', i);
            }, i * 1000);
        }
        // Each iteration creates a new 'i' binding
        // Each setTimeout closure captures its own 'i'
    }

    demonstrateLetSolution();
}, 4000);

setTimeout(() => {
    console.log('\n=== Solution 2: IIFE to capture value ===');

    function demonstrateIIFESolution() {
        for (var i = 1; i <= 3; i++) {
            (function (captured) {
                setTimeout(function () {
                    console.log('IIFE version, i =', captured);
                }, captured * 1000);
            })(i);
        }
    }

    demonstrateIIFESolution();
}, 8000);

setTimeout(() => {
    console.log('\n=== Solution 3: Pass value as parameter ===');

    function demonstrateParameterSolution() {
        for (var i = 1; i <= 3; i++) {
            setTimeout(function (value) {
                console.log('Parameter version, i =', value);
            }, i * 1000, i);  // Third argument to setTimeout is passed to callback
        }
    }

    demonstrateParameterSolution();
}, 12000);

console.log('\nWait for all setTimeout callbacks to execute...');
