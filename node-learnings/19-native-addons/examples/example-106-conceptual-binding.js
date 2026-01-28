// Example 106: Conceptual shape of a native addon binding
// NOTE: This is conceptual pseudo-code, not a real build.
//
// Goal: Understand how JS sees a native addon, without writing C++.
//
// In practice, you'd have:
//   - C/C++ files using Node-API (N-API)
//   - A build system (node-gyp, cmake-js, etc.)
//   - A compiled .node binary in ./build/Release/my_addon.node

// JS usage looks like this:
let addon;

try {
  // Require the compiled native addon binary
  // (extension .node tells Node this is a native module)
  addon = require('../build/Release/my_addon.node');
} catch (err) {
  console.error('Native addon not built yet. This file is conceptual only.');
  console.error(err.message);
  process.exit(1);
}

// Suppose the addon exports a few functions:
// - heavyCompute(input: number): number
// - getVersion(): string
// - createHandle(): object with methods backed by native code

console.log('Addon version:', addon.getVersion());

const input = 42;
const result = addon.heavyCompute(input);
console.log(`heavyCompute(${input}) =`, result);

const handle = addon.createHandle();
handle.doWork();
handle.close();

// Conceptual mapping to native side (Node-API pseudo-code):
//
// NAPI_MODULE_INIT() {
//   napi_value exports;
//   napi_get_cb_info(...);
//
//   // Create JS functions that call into native code
//   napi_value heavyComputeFn = CreateFunction(env, HeavyCompute);
//   napi_set_named_property(env, exports, "heavyCompute", heavyComputeFn);
//
//   napi_value getVersionFn = CreateFunction(env, GetVersion);
//   napi_set_named_property(env, exports, "getVersion", getVersionFn);
//
//   napi_value createHandleFn = CreateFunction(env, CreateHandle);
//   napi_set_named_property(env, exports, "createHandle", createHandleFn);
//
//   return exports;
// }
//
// The important part for you as a JS runtime engineer:
// - require('./my_addon.node') returns a plain JS object
// - Each property is a JS function that, when called, crosses into native code
// - Node-API handles argument marshalling and returning values/errors

