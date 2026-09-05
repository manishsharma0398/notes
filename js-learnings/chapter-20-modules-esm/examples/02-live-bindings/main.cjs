const { count, inc } = require("./counter.cjs");   // destructured = copied
const mod = require("./counter.cjs");              // object reference

console.log("before:", count, mod.count);
inc(); inc(); inc();
console.log("after :", count, mod.count);
