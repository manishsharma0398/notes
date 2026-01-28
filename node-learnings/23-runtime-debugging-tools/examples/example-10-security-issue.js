const inspector = require('inspector');

console.log('⚠️  SECURITY DEMONSTRATION - DO NOT USE IN PRODUCTION!\n');

console.log('BAD: Exposing inspector to network');
console.log('Command: node --inspect=0.0.0.0:9229 example-10-security-issue.js\n');

console.log('This allows ANYONE on the network to:');
console.log('  ✗ Read all memory (passwords, tokens, PII)');
console.log('  ✗ Execute arbitrary code');
console.log('  ✗ Modify application state');
console.log('  ✗ Cause denial of service');
console.log('  ✗ Steal sensitive data\n');

console.log('GOOD: Bind to localhost only');
console.log('Command: node --inspect=127.0.0.1:9229 app.js\n');

console.log('For remote debugging, use SSH tunnel:');
console.log('Command: ssh -L 9229:localhost:9229 user@production-server');
console.log('Then connect to localhost:9229 from your machine\n');

if (inspector.url()) {
    console.log(`Inspector is enabled: ${inspector.url()}`);

    const url = new URL(inspector.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
        console.log('\n❌ DANGER: Inspector is exposed to network!');
        console.log('   This is a CRITICAL SECURITY VULNERABILITY');
    } else {
        console.log('\n✅ SAFE: Inspector bound to localhost only');
    }
} else {
    console.log('Inspector is not currently enabled');
    console.log('This is the safest configuration for production');
}

// Simulate sensitive data
const sensitiveData = {
    apiKey: 'sk-1234567890abcdef',
    databasePassword: 'super-secret-password',
    userTokens: ['token1', 'token2', 'token3']
};

console.log('\nSensitive data in memory (visible via inspector):');
console.log(JSON.stringify(sensitiveData, null, 2));

setInterval(() => {
    console.log('Application running...');
}, 5000);
