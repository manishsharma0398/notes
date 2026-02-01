const fs = require("node:fs");

fs.readFile(__filename, (err, data) => {
  setTimeout(() => {
    console.log("I am inside setTimeout");
  }, 0);

  setImmediate(() => {
    console.log("I am inside setImmediate");
  });
});
