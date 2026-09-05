"use strict";
const { existsSync } = require("node:fs");
const { join, dirname } = require("node:path");

// Loads a named export from the category's solution/ dir.
// Fails with an instruction rather than a module-not-found stack, because
// a useless error message under a timer is its own kind of bug.
function load(testFile, name, exportName) {
  const file = join(dirname(dirname(testFile)), "solution", `${name}.js`);
  if (!existsSync(file)) {
    throw new Error(
      `\n\n  Not written yet.\n` +
        `  Create:  ${file.replace(process.cwd() + "/", "")}\n` +
        `  Export:  module.exports = { ${exportName} }\n`,
    );
  }
  const mod = require(file);
  const fn = mod[exportName] ?? mod.default ?? mod;
  if (typeof fn !== "function") {
    throw new Error(
      `\n\n  ${file.replace(process.cwd() + "/", "")} loaded, but no function found.\n` +
        `  Expected:  module.exports = { ${exportName} }\n`,
    );
  }
  return fn;
}

module.exports = { load };
