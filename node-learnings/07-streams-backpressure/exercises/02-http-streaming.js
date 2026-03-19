const http = require("node:http");
const fs = require("node:fs");
const zlib = require("node:zlib");

const PORT = 3000;

const startCpu = process.cpuUsage();
const startTime = Date.now();

function logStats(label = "") {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage(startCpu);
  const elapsed = (Date.now() - startTime) / 1000;

  console.log(`
${label}
Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB
CPU user: ${(cpu.user / 1_000_000).toFixed(2)} sec
CPU system: ${(cpu.system / 1_000_000).toFixed(2)} sec
Elapsed: ${elapsed.toFixed(2)} sec
`);
}

logStats("start");

const stat = fs.statSync(`${__dirname}/large_file.txt`);

const server = http.createServer((req, res) => {
  const file = fs.createReadStream(`${__dirname}/large_file.txt`);
  res.writeHead(200, {
    "Content-Type": "text/plain",
    //   "Content-Length": stat.size,
    "Content-Encoding": "gzip",
  });
  return file
    .pipe(zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }))
    .pipe(res);
});

server.listen(PORT, () => console.log(`Server running on PORT:${PORT}`));
