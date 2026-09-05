console.log("typeof undefined :", typeof undefined);
console.log("typeof null      :", typeof null);        // the famous bug
console.log("null instanceof Object:", null instanceof Object);
console.log("Object.prototype.toString.call(null)     :", Object.prototype.toString.call(null));
console.log("Object.prototype.toString.call(undefined):", Object.prototype.toString.call(undefined));

console.log("\n-- what they are --");
console.log("null is a LITERAL, undefined is an identifier");
console.log("descriptor of globalThis.undefined:", Object.getOwnPropertyDescriptor(globalThis, "undefined"));
undefined = 42;                                        // sloppy mode: silently ignored
console.log("after `undefined = 42`, undefined is:", undefined);

console.log("\n-- but it can still be shadowed --");
function shadow(undefined) {
  return [undefined, typeof undefined, undefined === void 0];
}
console.log('shadow("surprise") ->', shadow("surprise"));
console.log("void 0 is always undefined:", void 0, void "anything", void (1 + 1));

console.log("\n-- where each one comes from --");
function noReturn() {}
const obj = {};
let declared;
console.log("no return statement   :", noReturn());
console.log("missing property      :", obj.missing);
console.log("uninitialised let     :", declared);
console.log("missing argument      :", ((a) => a)());
console.log("array hole read       :", [1, , 3][1]);
console.log("void operator         :", void 0);
console.log("null is NEVER produced by the language on its own — you or an API assign it");
