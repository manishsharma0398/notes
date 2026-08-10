const { wrap, getStack } = require("./tracer");

function c() {
  return "done";
}
function b() {
  return c();
}
function a() {
  return setTimeout(() => b(), 0);
}

c = wrap(c, "c");
b = wrap(b, "b");
a = wrap(a, "a");

a();
