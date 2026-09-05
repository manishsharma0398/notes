// a CJS module whose export shape is partly static and partly computed
exports.staticName = "found by static analysis";
exports.helper = function helper() { return "helper()"; };

const computed = "computedName";
exports[computed] = "assigned through a variable key";

if (process.env.NODE_ENV !== "production") {
  exports.devOnly = "conditionally attached";
}
