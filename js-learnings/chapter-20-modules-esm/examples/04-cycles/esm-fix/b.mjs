import { aValue } from "./a.mjs";

export const bValue = "B";
export function describeB() { return `b says ${bValue} and can see a's ${aValue}`; }

console.log("  b: evaluated (read nothing)");
