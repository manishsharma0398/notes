// The CommonJS mirror: the same mistake is not detectable until runtime.
const { REAL, IMAGINARY } = require("./noisy.cjs");
console.log("reached anyway:", REAL, IMAGINARY);
