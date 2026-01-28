/**
 * Example 86: Request Tracking with AsyncLocalStorage
 * 
 * Demonstrates how to use AsyncLocalStorage for request tracking:
 * - Correlate logs across async operations
 * - Track request lifecycle
 * - Add context to all log messages
 * 
 * Run with: node example-86-request-tracking.js
 * 
 * What to observe:
 * - Request ID propagates to all log messages
 * - User ID available in all operations
 * - Easy correlation of logs across async boundaries
 */

const { AsyncLocalStorage } = require('async_hooks');

console.log('=== Request Tracking with AsyncLocalStorage ===\n');

const storage = new AsyncLocalStorage();

// Enhanced logger that uses context
function log(level, message) {
  const context = storage.getStore();
  const requestId = context?.requestId || 'unknown';
  const userId = context?.userId || 'unknown';
  
  console.log(`[${level}] [${requestId}] [User: ${userId}] ${message}`);
}

// Simulate request handler
function handleRequest(userId, requestId) {
  storage.run({ userId, requestId, startTime: Date.now() }, () => {
    log('INFO', 'Request received');
    
    // Simulate async operations
    processRequest();
  });
}

function processRequest() {
  log('INFO', 'Processing request...');
  
  setTimeout(() => {
    log('INFO', 'Fetching user data...');
    
    fetchUserData().then(() => {
      log('INFO', 'User data fetched');
      
      updateCache().then(() => {
        log('INFO', 'Cache updated');
        
        sendResponse();
      });
    });
  }, 100);
}

function fetchUserData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log('DEBUG', 'Database query executed');
      resolve();
    }, 50);
  });
}

function updateCache() {
  return new Promise((resolve) => {
    setTimeout(() => {
      log('DEBUG', 'Cache write completed');
      resolve();
    }, 50);
  });
}

function sendResponse() {
  const context = storage.getStore();
  const duration = Date.now() - context.startTime;
  log('INFO', `Response sent (duration: ${duration}ms)`);
}

// Simulate multiple concurrent requests
console.log('--- Request 1 ---');
handleRequest(123, 'req-abc-123');

setTimeout(() => {
  console.log('\n--- Request 2 ---');
  handleRequest(456, 'req-def-456');
}, 50);

setTimeout(() => {
  console.log('\n--- Request 3 ---');
  handleRequest(789, 'req-ghi-789');
}, 100);

// Wait for requests to complete
setTimeout(() => {
  console.log('\n=== Key Observations ===');
  console.log('1. Request ID propagates to all log messages automatically');
  console.log('2. User ID available in all operations without passing explicitly');
  console.log('3. Easy to correlate logs across async boundaries');
  console.log('4. No need to pass context through every function call');
}, 300);
