const fs = require("node:fs");

const stream = fs.createWriteStream("huge.txt", { flags: "w" });

const WORDS = [
  "nebula",
  "quantum",
  "entropy",
  "galaxy",
  "singularity",
  "nodejs",
  "stream",
  "buffer",
  "eventloop",
  "async",
  "cosmos",
  "darkmatter",
  "photon",
  "gravity",
  "plasma",
  "algorithm",
  "latency",
  "throughput",
  "bandwidth",
];

// Change this number to control size
const TOTAL_LINES = 50_00_000;

function randomLine() {
  const count = Math.floor(Math.random() * 12) + 4;
  let line = [];
  for (let i = 0; i < count; i++) {
    line.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return line.join(" ");
}

let i = 0;

function write() {
  let ok = true;
  while (i < TOTAL_LINES && ok) {
    i++;
    ok = stream.write(`${randomLine()}\n`);
  }

  if (i < TOTAL_LINES) {
    stream.once("drain", write);
  } else {
    stream.end();
    console.log("huge.txt generated ✅");
  }
}

write();
