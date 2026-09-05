const rows = [];
const t = (expr, value) => rows.push({ expression: expr, result: value });

t("null == undefined", null == undefined);
t("null === undefined", null === undefined);
t("null == false", null == false);
t("null == 0", null == 0);
t("undefined == 0", undefined == 0);
t("null >= 0", null >= 0);
t("null > 0", null > 0);
t("null <= 0", null <= 0);
t("undefined >= 0", undefined >= 0);
t("Object.is(null, undefined)", Object.is(null, undefined));
console.table(rows);

console.log("\n-- why null >= 0 is true but null == 0 is false --");
console.log("Number(null)      :", Number(null));       // relational operators coerce
console.log("Number(undefined) :", Number(undefined));  // -> NaN, so every comparison is false
console.log("== has a SPECIAL CASE: null and undefined equal only each other, no coercion");

console.log("\n-- the one loose-equality idiom worth keeping --");
const isNullish = (v) => v == null;
console.log([null, undefined, 0, "", false, NaN, {}].map(isNullish));
