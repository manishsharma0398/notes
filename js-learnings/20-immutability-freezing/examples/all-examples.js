// Chapter 20: Immutability
const obj = Object.freeze({ x: 1 });
obj.x = 2;  // Silently fails
console.log(obj.x);  // 1

// Shallow copy
const orig = { a: 1, nested: { b: 2 } };
const copy = { ...orig };
copy.nested.b = 3;
console.log(orig.nested.b);  // 3 (shared!)

// Deep copy
const deep = structuredClone(orig);
