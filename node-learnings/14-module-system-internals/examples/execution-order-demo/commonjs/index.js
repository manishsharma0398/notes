console.log("  [index.js] Start");

console.log("  [index.js] Require ./a.js...");
const { ddd } = require("./a.js");

ddd();

console.log("  [index.js] Require ./b.js...");
const b = require("./b.js");

console.log("  [index.js] End");
