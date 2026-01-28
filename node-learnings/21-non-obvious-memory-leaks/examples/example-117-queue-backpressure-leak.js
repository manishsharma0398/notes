// Example 117: Unbounded in-memory queue vs backpressure

const http = require('http');

// BAD: Unbounded queue
const badQueue = [];

function enqueueBad(job) {
  badQueue.push(job);
}

function workerBad() {
  if (badQueue.length === 0) return;
  // Simulate slow processing
  const job = badQueue.shift();
  setTimeout(() => {
    // processed
  }, 100);
}

setInterval(workerBad, 10);

// GOOD: Bounded queue with drop behavior
const goodQueue = [];
const GOOD_LIMIT = 1000;

function enqueueGood(job) {
  if (goodQueue.length >= GOOD_LIMIT) {
    // Drop or shed load
    return false;
  }
  goodQueue.push(job);
  return true;
}

function workerGood() {
  if (goodQueue.length === 0) return;
  const job = goodQueue.shift();
  setTimeout(() => {
    // processed
  }, 100);
}

setInterval(workerGood, 10);

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/bad')) {
    enqueueBad({ at: Date.now(), url: req.url });
    res.end(`Queued BAD job, queue length=${badQueue.length}\n`);
  } else if (req.url.startsWith('/good')) {
    const ok = enqueueGood({ at: Date.now(), url: req.url });
    if (!ok) {
      res.statusCode = 503;
      res.end(`GOOD queue full (length=${goodQueue.length}), rejecting\n`);
    } else {
      res.end(`Queued GOOD job, queue length=${goodQueue.length}\n`);
    }
  } else {
    res.end('Use /bad or /good\n');
  }
});

server.listen(3002, () => {
  console.log('Server on http://localhost:3002');
  console.log('Hit /bad rapidly: badQueue length grows without bound (memory leak).');
  console.log('Hit /good rapidly: goodQueue length is capped; excess load is rejected.');
});

// Takeaways:
// - Any unbounded in-memory queue is a potential memory leak under sustained load.
// - Backpressure / limits turn an unbounded leak into a controlled failure mode.

