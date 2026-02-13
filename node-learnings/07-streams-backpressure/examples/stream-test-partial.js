const { Readable } = require("stream");

console.log("--- Partial multibyte test ---");
const rs = new Readable({
  read() {},
});
rs.setEncoding("utf8");
const euro = Buffer.from("€"); // 3 bytes: e2 82 ac

console.log("Pushing first 2 bytes...");
rs.push(euro.subarray(0, 2));
console.log("Buffer after 2 bytes:", rs._readableState.buffer);

console.log("Pushing last byte...");
rs.push(euro.subarray(2, 3));
console.log("Buffer after 3rd byte:", rs._readableState.buffer);
