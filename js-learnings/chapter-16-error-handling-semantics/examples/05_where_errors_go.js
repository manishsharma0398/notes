"use strict";

// ─────────────────────────────────────────────────────────────
// 05 — Where an error goes when nothing catches it
// Run: node 05_where_errors_go.js
//
// Two different events, often confused:
//   uncaughtException  — a throw reached the top of the stack
//   unhandledRejection — a promise rejected and nobody observed it in time
// Each case below runs in its OWN process, because the whole point is
// what happens at the top level.
// ─────────────────────────────────────────────────────────────

const { spawnSync } = require("node:child_process");

const run = (label, code) => {
  const r = spawnSync(process.execPath, ["-e", code], { encoding: "utf8" });
  const out = (r.stdout + r.stderr).trim().split("\n").slice(0, 3).map((l) => "      " + l).join("\n");
  console.log(`\n-- ${label}\n   exit=${r.status}\n${out}`);
};

run("a throw at the top level", `
  throw new Error("plain throw");
`);

run("a rejection nobody handles (Node >= 15 default: it becomes a crash)", `
  Promise.reject(new Error("unobserved"));
`);

run("...with an unhandledRejection listener: yours runs, process survives", `
  process.on("unhandledRejection", e => console.log("handled by listener:", e.message));
  Promise.reject(new Error("unobserved"));
  setTimeout(() => console.log("still alive"), 5);
`);

run("...with ONLY an uncaughtException listener: note the origin argument", `
  process.on("uncaughtException", (e, origin) => console.log("origin =", origin, "| msg =", e.message));
  Promise.reject(new Error("unobserved"));
`);

run("a throw inside a timer — no try/catch can reach it", `
  try { setTimeout(() => { throw new Error("timer"); }, 0); } catch { console.log("never"); }
`);

console.log(`
   The origin argument is the tell: "unhandledRejection" means Node converted a
   rejection into an uncaught exception because you had no rejection listener.

   These handlers are for LOGGING AND EXITING, not for recovery. After an
   uncaught exception the process is in an unknown state — half-run functions,
   held locks, open handles. Log it, flush, exit non-zero, let the supervisor
   restart. Anything else is a slow corruption bug.
`);
