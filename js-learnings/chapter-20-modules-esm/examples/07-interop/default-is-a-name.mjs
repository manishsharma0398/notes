import * as sync from "../06-top-level-await/sync.mjs";
console.log("an ESM namespace  :", Object.keys(sync));
console.log("sync.default      :", typeof sync.default);
const { default: renamed, VALUE } = sync;
console.log("renamed()         :", renamed(), "| VALUE:", VALUE);
