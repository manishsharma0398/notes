const fs = require("node:fs");
const path = require("node:path");

fs.readFile(__filename, () => console.log("finished reading first file"));

fs.readFile(path.join(__dirname, "01-timer-precision.js"), () =>
  console.log("finished reading second file"),
);

fs.readFile(
  path.join(
    __dirname,
    "..",
    "..",
    "03-microtasks-vs-macrotasks",
    "exercises",
    "setTimeout-vs-setImmediate-timing-EXPLANATION.md",
  ),
  () => console.log("finished reading third file"),
);

// the order of execution is not guaranteed
// it depends on the OS and the file system and the file size

// Part 2: Using Promises for explicit ordering
console.log("\n--- Guaranteed Order with Promises ---");
(async () => {
  await fs.promises.readFile(__filename);
  console.log("First file (guaranteed order)");

  await fs.promises.readFile(path.join(__dirname, "01-timer-precision.js"));
  console.log("Second file (guaranteed order)");

  await fs.promises.readFile(
    path.join(
      __dirname,
      "..",
      "..",
      "03-microtasks-vs-macrotasks",
      "exercises",
      "setTimeout-vs-setImmediate-timing-EXPLANATION.md",
    ),
  );
  console.log("Third file (guaranteed order)");
})();
