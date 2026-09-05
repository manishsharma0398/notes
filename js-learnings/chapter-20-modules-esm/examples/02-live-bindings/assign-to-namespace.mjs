import * as ns from "./counter.mjs";
console.log("prototype of namespace:", Object.getPrototypeOf(ns));
console.log("Symbol.toStringTag    :", ns[Symbol.toStringTag]);
console.log("keys (sorted?)        :", Object.keys(ns));
console.log("isSealed / isFrozen   :", Object.isSealed(ns), "/", Object.isFrozen(ns));
console.log("descriptor of count   :", Object.getOwnPropertyDescriptor(ns, "count"));
try { ns.count = 99; } catch (e) { console.log("ns.count = 99 ->", e.constructor.name + ":", e.message); }
try { ns.brandNew = 1; } catch (e) { console.log("ns.brandNew = 1 ->", e.constructor.name + ":", e.message); }
