console.log("  b: start");
const a = require("./a.cjs");

console.log("  b: a.aFn ->", typeof a.aFn);      // undefined — a has not assigned it yet
console.log("  b: a.aValue ->", a.aValue);        // undefined — silently

exports.bValue = "B";
exports.bFn = function bFn() { return "bFn()"; };
console.log("  b: end");
