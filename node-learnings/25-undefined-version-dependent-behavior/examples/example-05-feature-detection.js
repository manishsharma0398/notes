console.log('Safe feature detection across Node versions\n');

// ❌ BAD: Version checking
function badVersionCheck() {
    const version = process.version;
    const major = parseInt(version.slice(1));

    if (major >= 18) {
        console.log('❌ BAD: Using version check for fetch');
        // Use fetch
    } else {
        // Use node-fetch
    }
    // BUG: Brittle, assumes feature exists in v18+
    //      What if feature is backported to v16?
    //      What if it's removed in v22?
}

// ✅ GOOD: Feature detection
function goodFeatureDetection() {
    // Check if feature exists
    if (typeof globalThis.fetch === 'function') {
        console.log('✅ Native fetch available');
        return globalThis.fetch;
    } else {
        console.log('⚠️  Native fetch not available, using polyfill');
        try {
            return require('node-fetch');
        } catch (err) {
            throw new Error('fetch not available and no polyfill installed');
        }
    }
}

// Example: Detecting crypto.webcrypto
function detectWebCrypto() {
    console.log('\nDetecting WebCrypto API:');

    // Try global crypto first
    if (typeof crypto !== 'undefined' && crypto.webcrypto) {
        console.log('✅ WebCrypto API available (global)');
        return crypto.webcrypto;
    }

    // Try require('crypto').webcrypto
    try {
        const { webcrypto } = require('crypto');
        if (webcrypto) {
            console.log('✅ WebCrypto via require("crypto")');
            return webcrypto;
        }
    } catch (err) {
        // Not available
    }

    console.log('❌ WebCrypto not available');
    return null;
}

// Example: Detecting Worker Threads
function detectWorkerThreads() {
    console.log('\nDetecting Worker Threads:');

    try {
        const { Worker } = require('worker_threads');
        console.log('✅ Worker threads available');
        console.log(`   Module version: ${process.versions.modules}`);
        return Worker;
    } catch (err) {
        console.log('❌ Worker threads not available');
        console.log(`   Error: ${err.message}`);
        return null;
    }
}

// Example: Detecting AbortController
function detectAbortController() {
    console.log('\nDetecting AbortController:');

    if (typeof AbortController !== 'undefined') {
        console.log('✅ AbortController available (global)');
        return AbortController;
    }

    try {
        const { AbortController } = require('node-abort-controller');
        console.log('⚠️  Using polyfill for AbortController');
        return AbortController;
    } catch (err) {
        console.log('❌ AbortController not available');
        return null;
    }
}

// Running tests
console.log('Testing feature detection:\n');
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}\n`);

badVersionCheck(); // Show the anti-pattern
const fetch = goodFeatureDetection();
const webcrypto = detectWebCrypto();
const Worker = detectWorkerThreads();
const AbortController = detectAbortController();

console.log('\n' + '='.repeat(60));
console.log('✅ Best Practices:');
console.log('='.repeat(60));
console.log('1. Detect features, not versions');
console.log('2. Gracefully degrade when features missing');
console.log('3. Throw early if required feature unavailable');
console.log('4. Provide polyfills when possible');
console.log('5. Document minimum Node version in README');

console.log('\nExample pattern for required features:');
console.log(`
function initApp() {
  if (typeof fetch !== 'function') {
    throw new Error('This app requires Node 18+ for native fetch');
  }
  if (!detectWorkerThreads()) {
    throw new Error('Worker threads required, use Node 12+');
  }
  
  // App initialization...
}
`);
