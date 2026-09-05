// There are FOUR states a property can be in, not two.
const user = {
  name: "ada",
  nickname: undefined,   // present, holds undefined
  deleted: null,         // present, holds null
};                       // `email` is absent entirely

const probe = (obj, key) => ({
  key,
  read: obj[key],
  "in": key in obj,
  hasOwn: Object.hasOwn(obj, key),
  "!== undefined": obj[key] !== undefined,
  inKeys: Object.keys(obj).includes(key),
  inEntries: Object.entries(obj).some(([k]) => k === key),
});

console.table(["name", "nickname", "deleted", "email", "toString"].map((k) => probe(user, k)));

// Only `in` and `hasOwn` can tell "present but undefined" from "absent".
// They disagree on inherited keys: `toString` is `in` but not own.

console.log("\n-- delete really removes it --");
const o = { a: 1 };
o.a = undefined;
console.log("after o.a = undefined :", "a" in o, Object.keys(o));
delete o.a;
console.log("after delete o.a      :", "a" in o, Object.keys(o));
