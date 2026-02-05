// Input { a: { b: { c: 1 }, d: 2 } };
// Output: [ { path: ['a','b','c'], value: 1 }, { path: ['a','d'], value: 2 } ]

// output: [
//   { path: ['user', 'name'], value: "John" },
//   { path: ['user', 'age'], value: 25 },
//   { path: ['active'], value: true }
// ]

const input1 = { a: { b: { c: 1 }, d: 2 } };
const input2 = {
  user: {
    name: "John",
    age: 25,
  },
  active: true,
};

const fullPath = (obj, parent = [], output = []) => {
  if (obj && typeof obj !== "object") {
    output.push({ path: parent, value: obj });
    return output;
  }

  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const newParent = [...parent, key];
    fullPath(obj[key], newParent, output);
  }
  return output;
};

// console.log(fullPath(input1));
// console.log(fullPath(input2));
// console.log(fullPath({}));
// console.log(fullPath([]));
// console.log(fullPath("a"));

const input11 = { a: { b: { c: 1 }, d: 2 } };

const fullPath2 = (obj, parent = [], output = {}) => {
  if (obj === null || obj === undefined) {
    return output;
  }

  if (typeof obj !== "object") {
    const p = parent.join(".");
    output[p] = obj;
    return output;
  }

  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const newParent = [...parent, key];
    fullPath2(obj[key], newParent, output);
  }
  return output;
};

console.log(fullPath2(input11));
console.log(fullPath2(null));
console.log(fullPath2(undefined));
