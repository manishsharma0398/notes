import legacy from "./legacy.cjs";           // default === module.exports
import * as ns from "./legacy.cjs";

console.log("default keys :", Object.keys(legacy));
console.log("namespace    :", Object.keys(ns));
console.log("computed via default:", legacy.computedName);
console.log("ns.default === legacy:", ns.default === legacy);
