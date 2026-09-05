console.log("  a: start");
import { bValue, bFn } from "./b.mjs";

export const aValue = "A";
export function aFn() { return "aFn()"; }

console.log("  a: bFn() ->", bFn());        // works: function declarations are hoisted+initialised
console.log("  a: bValue ->", bValue);      // b has finished by now
console.log("  a: end");
