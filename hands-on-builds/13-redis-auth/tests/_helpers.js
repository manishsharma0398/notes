"use strict";
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const net = require("node:net");

const SOLUTION = join(__dirname, "..", "solution", "auth.js");

function loadAuth() {
  if (!existsSync(SOLUTION)) {
    throw new Error(
      `\n\n  Not written yet.\n  Create:  13-redis-auth/solution/auth.js\n` +
        `  Export what each phase needs, e.g. module.exports = { sign, verify }\n`,
    );
  }
  return require(SOLUTION);
}

// Redis may not be running. Skip rather than fail — a red run should mean your
// code is wrong, never that docker wasn't up.
function redisReachable(port = 6379, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(400);
    s.on("connect", () => done(true));
    s.on("error", () => done(false));
    s.on("timeout", () => done(false));
  });
}

const SKIP_MSG = "redis not reachable on 127.0.0.1:6379 — " +
  "run: docker run -d --rm --name redis-auth -p 6379:6379 redis:7-alpine";

module.exports = { loadAuth, redisReachable, SKIP_MSG };
