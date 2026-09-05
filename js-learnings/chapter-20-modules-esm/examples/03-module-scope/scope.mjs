var topLevelVar = "declared with var at module top level";
function topLevelFn() {}

console.log("this                          :", this);
console.log("globalThis.topLevelVar        :", globalThis.topLevelVar);
console.log("globalThis.topLevelFn         :", globalThis.topLevelFn);
console.log("typeof require                :", typeof require);
console.log("typeof module                 :", typeof module);
console.log("typeof __dirname              :", typeof __dirname);
console.log("import.meta.url               :", import.meta.url.split("/").slice(-2).join("/"));
console.log("import.meta.dirname           :", typeof import.meta.dirname);

// strict mode is on, and there is no way to turn it off
try { undeclared = 1; } catch (e) { console.log("undeclared = 1              ->", e.constructor.name + ":", e.message); }
try { (function () { console.log("this inside a plain call      :", this); })(); } catch (e) {}
console.log("typeof arguments (module)     :", typeof arguments === "undefined" ? "not defined" : "defined");
