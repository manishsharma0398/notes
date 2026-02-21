const fs = require("node:fs");

//  node node-learnings/07-streams-backpressure/exercises/01-backpressure-handling.js --ignore-back-pressure
const ignoreBackPressure = process.argv[2] === "--ignore-back-pressure";

const writeableStream = fs.createWriteStream(`${__dirname}/large_file.txt`, {
  highWaterMark: 1024 * 1024,
});

const textToWrite = "Hello, This is a write file for testing\n";

const COUNT = 10_00_000;
let i = 0;
let drainCount = 0;

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

function writeLarge() {
  let ok = true;
  while (i < COUNT && ok) {
    ok = writeableStream.write(textToWrite);
    i++;
  }

  if (i < COUNT) {
    drainCount++;
    writeableStream.once("drain", writeLarge);
  } else {
    writeableStream.end();
  }
}

logStats("start");

if (ignoreBackPressure) {
  while (i < COUNT) {
    writeableStream.write(textToWrite);
    i++;
  }
  writeableStream.end();
} else {
  writeLarge();
}

writeableStream.on("finish", () => {
  console.log("finished writing");
  logStats("finish");
  console.log("drain count", drainCount);
});
