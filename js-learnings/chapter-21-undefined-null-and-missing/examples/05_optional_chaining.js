const a = { b: null };

console.log("-- ?. short-circuits the WHOLE chain, not one link --");
console.log("a.b?.c.d.e  :", a.b?.c.d.e);      // no TypeError: everything right of ?. is skipped
try { console.log(a.b.c); } catch (e) { console.log("a.b.c       ->", e.constructor.name); }

console.log("\n-- but only up to the end of the chain --");
try { console.log((a.b?.c).d); } catch (e) { console.log("(a.b?.c).d  ->", e.constructor.name + ":", e.message); }
console.log("parentheses END the chain — the short circuit does not escape them");

console.log("\n-- the three forms --");
const api = { list: () => [1, 2, 3], nested: { 0: "zero" } };
console.log("api.missing?.()      :", api.missing?.());
console.log("api.list?.()         :", api.list?.());
console.log("api.nested?.[0]      :", api.nested?.[0]);
console.log("api.absent?.[0]      :", api.absent?.[0]);

console.log("\n-- short circuit skips ARGUMENT evaluation --");
let evaluated = 0;
const arg = () => { evaluated++; return 1; };
const noFn = { };
noFn.run?.(arg());
console.log("arg() evaluated:", evaluated, "(0 = the whole call expression was skipped)");
noFn.run = (x) => x;
noFn.run?.(arg());
console.log("arg() evaluated:", evaluated);

console.log("\n-- what ?. does NOT do --");
console.log("it only guards null/undefined, not other errors:");
const throwy = { get x() { throw new Error("getter blew up"); } };
try { throwy?.x; } catch (e) { console.log("  throwy?.x ->", e.message); }
console.log("it does not make the RESULT safe:");
console.log("  a.b?.c + 1 =", a.b?.c + 1);      // undefined + 1
console.log("it is not allowed on the left of an assignment:");
try { eval("a?.b = 1"); } catch (e) { console.log("  a?.b = 1  ->", e.constructor.name + ":", e.message); }
console.log("delete IS allowed:", delete a?.zzz);

console.log("\n-- ?. and ?? are different questions --");
const cfg = { timeout: 0 };
console.log("cfg?.timeout ?? 30 :", cfg?.timeout ?? 30, "  (?. asks 'can I read', ?? asks 'is it absent')");
