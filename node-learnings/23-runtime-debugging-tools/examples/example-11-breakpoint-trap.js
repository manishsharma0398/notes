const inspector = require('inspector');

console.log('⚠️  Demonstrating forgotten debugger statement\n');

function processPayment(amount, userId) {
    console.log(`Processing payment: $${amount} for user ${userId}`);

    // Simulate payment processing
    const fee = amount * 0.029 + 0.30;
    const total = amount + fee;

    // BUG: Developer forgot to remove debugger statement!
    // If inspector is enabled, this will PAUSE execution
    // Uncomment to see the effect:
    // debugger;

    console.log(`Total with fees: $${total.toFixed(2)}`);
    return { amount, fee, total };
}

console.log(`Process PID: ${process.pid}`);
console.log('Application running normally...\n');

if (inspector.url()) {
    console.log('⚠️  WARNING: Inspector is enabled!');
    console.log('If there\'s a "debugger;" statement, execution will PAUSE\n');
} else {
    console.log('✅ Inspector not enabled, debugger statements are ignored\n');
}

// Simulate requests
let counter = 0;
setInterval(() => {
    counter++;

    try {
        const result = processPayment(100, `user_${counter}`);
        console.log(`[${counter}] Payment processed: ${JSON.stringify(result)}\n`);
    } catch (err) {
        console.error(`[${counter}] Payment failed:`, err.message);
    }
}, 2000);

console.log('Tips to avoid this issue:');
console.log('1. Add ESLint rule: "no-debugger": "error"');
console.log('2. Use build process to strip debugger statements');
console.log('3. Only enable inspector when explicitly needed');
console.log('4. Search codebase for debugger statements before deploy\n');

console.log('To test the bug:');
console.log('1. Uncomment the "debugger;" line in processPayment');
console.log(`2. Run: node --inspect example-11-breakpoint-trap.js`);
console.log('3. Connect chrome://inspect');
console.log('4. Watch execution pause every 2 seconds');
