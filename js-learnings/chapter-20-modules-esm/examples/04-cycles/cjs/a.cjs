console.log("  a: start");
const b = require("./b.cjs");

exports.aValue = "A";
exports.aFn = function aFn() { return "aFn()"; };

console.log("  a: b.bFn() ->", typeof b.bFn === "function" ? b.bFn() : b.bFn);
console.log("  a: b.bValue ->", b.bValue);
console.log("  a: end");
