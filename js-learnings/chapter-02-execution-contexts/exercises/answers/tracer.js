let depth = 0;

const stack = [];

function getStack() {
  return stack;
}

function wrap(fn, name) {
  return function (...args) {
    depth++;
    stack[stack.length] = { name: name, depth };
    console.log(`→ ENTER ${name} depth: ${depth}`);
    try {
      return fn.call(this, ...args);
    } catch (error) {
      throw error;
    } finally {
      console.log(`← EXIT ${name} depth: ${depth}`);
      stack.splice(depth - 1, depth);
      depth--;
    }
  };
}

module.exports = { wrap, getStack };
