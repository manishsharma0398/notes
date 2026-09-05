import { describeB } from "./b.mjs";

export const aValue = "A";
export function describeA() { return `a says ${aValue}, and ${describeB()}`; }

// nothing here READS an import at evaluation time — every read is inside a function body
console.log("  a: evaluated (read nothing)");
