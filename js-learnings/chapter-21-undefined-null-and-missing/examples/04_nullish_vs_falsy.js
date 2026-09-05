const FALSY = ["false", "0", "-0", "0n", '""', "null", "undefined", "NaN"];
console.log("the eight falsy values :", FALSY.join(" · "));
console.log("of those, NULLISH      : null · undefined      <- that is the whole difference");

console.log("\n-- the bug this causes --");
const opts = { retries: 0, prefix: "", verbose: false, timeout: undefined };
console.table([
  { field: "retries", "||": opts.retries || 3, "??": opts.retries ?? 3 },
  { field: "prefix", "||": opts.prefix || "app", "??": opts.prefix ?? "app" },
  { field: "verbose", "||": opts.verbose || true, "??": opts.verbose ?? true },
  { field: "timeout", "||": opts.timeout || 1000, "??": opts.timeout ?? 1000 },
]);

console.log("\n-- ?? and || cannot be mixed without parentheses --");
try { eval("null ?? false || true"); } catch (e) { console.log("a ?? b || c ->", e.constructor.name + ":", e.message); }
console.log("and the two groupings are NOT the same, so it is not a style rule:");
console.log("  (0 ?? 1) || 2 ->", (0 ?? 1) || 2);      // 0 is not nullish -> 0 -> falsy -> 2
console.log("  0 ?? (1 || 2) ->", 0 ?? (1 || 2));      // 0 is not nullish -> 0

console.log("\n-- logical assignment SHORT-CIRCUITS THE WRITE --");
const target = {
  _v: 0,
  get v() { console.log("    [get v]"); return this._v; },
  set v(x) { console.log("    [set v]", x); this._v = x; },
};
console.log("target.v ??= 9   (v is 0, not nullish -> no write expected)");
target.v ??= 9;
console.log("target.v ||= 9   (v is 0, falsy -> write expected)");
target.v ||= 9;
console.log("final:", target._v);

console.log("\n-- ?? does not rescue you from a thrown getter or a deep miss --");
const cfg = { db: null };
console.log("cfg.db?.host ?? 'localhost' :", cfg.db?.host ?? "localhost");
try { console.log(cfg.db.host ?? "localhost"); } catch (e) { console.log("cfg.db.host ?? ... ->", e.constructor.name + ":", e.message); }
