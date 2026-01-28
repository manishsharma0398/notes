// Example 114: Per-request Map leak vs proper cleanup

const http = require('http');
const crypto = require('crypto');

// BAD: Map that never deletes entries
const badRequests = new Map();

// GOOD: Map with cleanup on 'finish'
const goodRequests = new Map();

function handleBad(req, res) {
  const id = crypto.randomUUID();
  badRequests.set(id, {
    startedAt: Date.now(),
    url: req.url,
    // Capture req/res (large objects)
    req,
    res,
  });

  res.end(`Handled BAD request ${id}, total tracked=${badRequests.size}\n`);
  // BUG: No cleanup on finish/end
}

function handleGood(req, res) {
  const id = crypto.randomUUID();
  const meta = {
    startedAt: Date.now(),
    url: req.url,
  };
  goodRequests.set(id, meta);

  res.on('finish', () => {
    goodRequests.delete(id);
  });

  res.end(`Handled GOOD request ${id}, total tracked=${goodRequests.size}\n`);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/bad')) {
    handleBad(req, res);
  } else if (req.url.startsWith('/good')) {
    handleGood(req, res);
  } else {
    res.end('Use /bad or /good\n');
  }
});

server.listen(3001, () => {
  console.log('Server on http://localhost:3001');
  console.log('Hit /bad many times: badRequests.size grows linearly.');
  console.log('Hit /good many times: goodRequests.size returns to near 0 after responses finish.');
});

