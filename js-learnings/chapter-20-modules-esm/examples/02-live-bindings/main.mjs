import { count, inc } from "./counter.mjs";
import * as ns from "./counter.mjs";

console.log("before:", count, ns.count);
inc(); inc(); inc();
console.log("after :", count, ns.count);

// a destructured snapshot is NOT live — it is a copy of the current value
const { count: snapshot } = ns;
inc();
console.log("live:", count, " snapshot:", snapshot);
