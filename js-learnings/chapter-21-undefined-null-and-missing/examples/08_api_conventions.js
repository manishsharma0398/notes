// Which absence you get is an API convention, not a language rule. Nothing enforces consistency.
const rows = [];
const t = (call, value) => rows.push({ call, result: String(value), type: value === null ? "null" : typeof value });

t("[1,2,3].find(x => x > 9)", [1, 2, 3].find((x) => x > 9));
t("[1,2,3].at(9)", [1, 2, 3].at(9));
t("'abc'.match(/z/)", "abc".match(/z/));
t("/z/.exec('abc')", /z/.exec("abc"));
t("new Map().get('k')", new Map().get("k"));
t("Object.getPrototypeOf(Object.create(null))", Object.getPrototypeOf(Object.create(null)));
t("({}).missing", {}.missing);
t("[1,2,3].findIndex(x => x > 9)", [1, 2, 3].findIndex((x) => x > 9));   // -1, a third convention
t("'abc'.indexOf('z')", "abc".indexOf("z"));
console.table(rows);

console.log("\n-- so a generic 'is it missing' helper has to accept all of them --");
console.log("null == undefined is the ONLY loose-equality special case worth using");

console.log("\n-- and JSON.parse can hand you null for a field your types say is a string --");
const parsed = JSON.parse('{"name": null}');
console.log("parsed.name?.toUpperCase() :", parsed.name?.toUpperCase());
console.log("(parsed.name ?? '').toUpperCase() :", (parsed.name ?? "").toUpperCase());
try { parsed.name.toUpperCase(); } catch (e) { console.log("parsed.name.toUpperCase() ->", e.constructor.name + ":", e.message); }

console.log("\n-- scale: how you ask 'is this key present' matters --");
const big = Object.fromEntries(Array.from({ length: 50_000 }, (_, i) => [`k${i}`, i]));
const bench = (n, fn) => {
  const s = process.hrtime.bigint();
  for (let i = 0; i < n; i++) if (!fn()) throw new Error("bench broke");
  return Number(process.hrtime.bigint() - s) / n;
};
const inNs = bench(100_000, () => "k49999" in big);
const keysNs = bench(20, () => Object.keys(big).includes("k49999"));
console.log(`'k' in obj                     : ${inNs.toFixed(0)} ns/op`);
console.log(`Object.keys(obj).includes('k')  : ${(keysNs / 1e6).toFixed(1)} ms/op   (${(keysNs / inNs / 1000).toFixed(0)},000x slower)`);
console.log("both are 'correct'. one allocates a 50,000-element array on every call.");
console.log("fine for a ten-key options object. wrong for a cache.");
