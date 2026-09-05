console.log("  b: start");
import { aValue, aFn } from "./a.mjs";

console.log("  b: aFn() ->", aFn());        // works — hoisted function binding, already initialised
try {
  console.log("  b: aValue ->", aValue);    // THROWS — a's const has not been evaluated yet
} catch (e) {
  console.log("  b: aValue ->", e.constructor.name + ":", e.message);
}

export const bValue = "B";
export function bFn() { return "bFn()"; }
console.log("  b: end");
