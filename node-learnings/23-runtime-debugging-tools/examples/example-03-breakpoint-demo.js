function processUser(user) {
    console.log('Processing user:', user.name);

    // Set breakpoint here via DevTools
    const validation = validateUser(user);

    if (validation.valid) {
        return saveUser(user);
    } else {
        throw new Error(`Invalid user: ${validation.reason}`);
    }
}

function validateUser(user) {
    // Inspect variables here
    if (!user.email) {
        return { valid: false, reason: 'No email' };
    }
    if (!user.email.includes('@')) {
        return { valid: false, reason: 'Invalid email format' };
    }
    return { valid: true };
}

function saveUser(user) {
    console.log('Saving user to database...');
    return { id: Math.random(), ...user };
}

console.log('Testing user validation...');
console.log('Run with: node --inspect example-03-breakpoint-demo.js');
console.log('Then open chrome://inspect and set breakpoints\n');

// Test cases
try {
    const user1 = processUser({ name: 'Alice', email: 'alice@example.com' });
    console.log('User 1 saved:', user1);

    const user2 = processUser({ name: 'Bob', email: 'invalid' });
    console.log('User 2 saved:', user2);
} catch (err) {
    console.error('Error:', err.message);
}

try {
    const user3 = processUser({ name: 'Charlie' });
    console.log('User 3 saved:', user3);
} catch (err) {
    console.error('Error:', err.message);
}
