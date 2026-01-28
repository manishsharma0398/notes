// Example 113: Cache leak vs bounded cache

const http = require('http');

// BAD: Unbounded cache (memory leak under high-cardinality keys)
const badCache = new Map();

function getUserBad(userId) {
  if (badCache.has(userId)) {
    return badCache.get(userId);
  }
  // Simulate expensive load
  const user = { id: userId, name: `User ${userId}` };
  badCache.set(userId, user); // never evicted
  return user;
}

// BETTER: Bounded LRU-like cache
class LruCache {
  constructor(limit = 1000) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}

const goodCache = new LruCache(1000);

function getUserGood(userId) {
  const cached = goodCache.get(userId);
  if (cached) return cached;
  const user = { id: userId, name: `User ${userId}` };
  goodCache.set(userId, user);
  return user;
}

// Simple server to exercise caches
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('id') || String(Math.random());

  if (url.pathname === '/bad') {
    const user = getUserBad(id);
    res.end(`BAD cache user: ${user.name}, cache size=${badCache.size}\n`);
  } else if (url.pathname === '/good') {
    const user = getUserGood(id);
    res.end(`GOOD cache user: ${user.name}, cache size=${goodCache.map.size}\n`);
  } else {
    res.end('Use /bad?id=... or /good?id=...\n');
  }
});

server.listen(3000, () => {
  console.log('Server on http://localhost:3000');
  console.log('Hit /bad?id=RANDOM many times and watch badCache.size grow without bound.');
  console.log('Hit /good?id=RANDOM many times and see goodCache size capped at 1000.');
});

