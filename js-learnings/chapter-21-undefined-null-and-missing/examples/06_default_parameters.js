function greet(name = "world", punct = "!") { return `hello ${name}${punct}`; }

console.log("-- defaults fire on undefined ONLY --");
console.log('greet()            :', greet());
console.log('greet(undefined)   :', greet(undefined));
console.log('greet(null)        :', greet(null));          // null is a value; the default does not fire
console.log('greet("")          :', greet(""));
console.log('greet(0)           :', greet(0));

console.log("\n-- you cannot skip a middle argument except with undefined --");
console.log('greet("hi", undefined) :', greet("hi", undefined));

console.log("\n-- destructuring defaults use the SAME rule --");
const show = ({ retries = 3, tag = "app" } = {}) => `${retries}/${tag}`;
console.log("show()                        :", show());
console.log("show({})                      :", show({}));
console.log("show({ retries: 0 })          :", show({ retries: 0 }));
console.log("show({ retries: null })       :", show({ retries: null }));
console.log("show({ retries: undefined })  :", show({ retries: undefined }));

console.log("\n-- defaults are evaluated AT CALL TIME, left to right --");
let calls = 0;
const fresh = () => ++calls;
function counter(n = fresh()) { return n; }
console.log(counter(), counter(), counter(), "-> a new value each call, not one shared default");
function ordered(a = 1, b = a + 1, c = b + 1) { return [a, b, c]; }
console.log("ordered()      :", ordered());
console.log("ordered(10)    :", ordered(10));
try { eval("(function (a = b, b = 2) { return [a, b]; })()"); }
catch (e) { console.log("(a = b, b = 2) ->", e.constructor.name + ":", e.message, " <- params have their own TDZ"); }

console.log("\n-- a default DISCONNECTS arguments from the parameters --");
function mapped(x) { arguments[0] = "changed"; return x; }
function unmapped(x = 1) { arguments[0] = "changed"; return x; }
console.log("without a default, arguments is mapped :", mapped("original"));
console.log("with a default,    arguments is NOT    :", unmapped("original"));

console.log("\n-- and it forbids a 'use strict' directive in the body --");
try { eval('(function (a = 1) { "use strict"; })'); }
catch (e) { console.log("->", e.constructor.name + ":", e.message);}

console.log("\n-- the only way to tell 'not passed' from 'passed undefined' --");
function probe(x) { return { value: x, argsLength: arguments.length }; }
console.log("probe()          :", probe());
console.log("probe(undefined) :", probe(undefined));
