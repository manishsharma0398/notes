console.log("    [a.js] Start execution");

console.log("    [a.js] Doing work...");

const c = require("./c.js");

const ddd = () => {
  console.log("    [a.js] ddd");
};

module.exports = { name: "Module A", ddd };

console.log("    [a.js] End execution");
