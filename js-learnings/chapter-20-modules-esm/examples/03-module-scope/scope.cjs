var topLevelVar = "declared with var at module top level";

console.log("this                          :", this, "=== module.exports:", this === module.exports);
console.log("globalThis.topLevelVar        :", globalThis.topLevelVar);
console.log("typeof require                :", typeof require);
console.log("typeof __dirname              :", typeof __dirname);
console.log("typeof arguments (wrapper)    :", typeof arguments);
console.log("arguments.length              :", arguments.length);
console.log("arguments callee names        :", [...arguments].map((a) => typeof a));

// sloppy mode by default
undeclared = 1;
console.log("undeclared = 1 succeeded      :", globalThis.undeclared);
(function () { console.log("this inside a plain call      :", this === globalThis ? "globalThis" : this); })();
