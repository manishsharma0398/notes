console.log("-- JSON: undefined does not survive, and the two containers disagree --");
console.log('object :', JSON.stringify({ a: 1, b: undefined, c: null, d: () => {}, e: Symbol("s") }));
console.log('array  :', JSON.stringify([1, undefined, null, () => {}, Symbol("s")]));
console.log("round trip loses the KEY in an object and the VALUE in an array");
console.log("JSON.parse('{\"a\":null}') :", JSON.parse('{"a":null}'));

console.log("\n-- structuredClone keeps undefined --");
const src = { a: undefined, b: null };
console.log("structuredClone :", structuredClone(src), "| 'a' in clone:", "a" in structuredClone(src));

console.log("\n-- spread and Object.assign COPY an undefined value over a real one --");
const defaults = { retries: 3, tag: "app" };
console.log("absent key      :", { ...defaults, ...{} });
console.log("explicit undefined:", { ...defaults, ...{ retries: undefined } });
console.log("...and the same through Object.assign:", Object.assign({}, defaults, { retries: undefined }));
console.log("that is the config bug: `{ retries: opts.retries }` built from a missing option");
console.log("ERASES the default, while omitting the key entirely keeps it.");

console.log("\n-- holes are a FIFTH state, distinct from undefined --");
const holey = [1, , 3];
const dense = [1, undefined, 3];
console.log("holey            :", holey, " 1 in holey:", 1 in holey, " length:", holey.length);
console.log("dense            :", dense, " 1 in dense:", 1 in dense);
console.log("holey.map(x=>9)  :", holey.map(() => 9), "  <- hole preserved, callback skipped");
console.log("dense.map(x=>9)  :", dense.map(() => 9));
console.log("Object.keys      :", Object.keys(holey), Object.keys(dense));
console.log("holey.forEach    :"); holey.forEach((v, i) => console.log("   visited", i, v));
console.log("[...holey]       :", [...holey], "  <- iteration FILLS holes with undefined");
console.log("Array.from(holey):", Array.from(holey));
console.log("holey.includes(undefined):", holey.includes(undefined), " holey.indexOf(undefined):", holey.indexOf(undefined));
console.log("new Array(3)     :", new Array(3), " .fill():", new Array(3).fill());

console.log("\n-- Map/Set: get() cannot distinguish, has() can --");
const m = new Map([["stored", undefined]]);
console.log("m.get('stored') :", m.get("stored"), " m.get('absent') :", m.get("absent"));
console.log("m.has('stored') :", m.has("stored"), " m.has('absent') :", m.has("absent"));
