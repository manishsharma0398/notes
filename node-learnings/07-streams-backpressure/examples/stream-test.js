const { Readable } = require("stream");

console.log("Node Version:", process.version);

// Case 1: No encoding
console.log("--- No Encoding ---");
const rs = new Readable({
  read() {},
});
rs.push(Buffer.from("Hello"));
// Inspect buffer directly
// In newer Node versions, buffer might be a BufferList { head: ..., tail: ..., length: ... }
// or just an array in older versions.
console.dir(rs._readableState.buffer, { depth: 1 });

// Case 2: Set Encoding
console.log("\n--- With Encoding utf8 ---");
const rs2 = new Readable({
  read() {},
});
rs2.setEncoding("utf8");
rs2.push(Buffer.from("World"));
console.dir(rs2._readableState.buffer, { depth: 1 });

// Case 3: Partial
console.log("\n--- Partial multibyte ---");
const rs3 = new Readable({
  read() {},
});
rs3.setEncoding("utf8");
const euro = Buffer.from("€"); // 3 bytes: e2 82 ac
// Push first 2 bytes
rs3.push(euro.subarray(0, 2));
console.dir(rs3._readableState.buffer, { depth: 1 });
