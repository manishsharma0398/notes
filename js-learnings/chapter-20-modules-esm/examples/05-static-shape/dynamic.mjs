import { FEATURE } from "./flag.mjs";

console.log("FEATURE =", FEATURE);
console.log("before the dynamic import");

if (FEATURE) {
  const mod = await import("./heavy.mjs");        // top-level await, allowed in a module
  console.log("namespace keys :", Object.keys(mod));
  console.log("default is fn  :", typeof mod.default);
  console.log("calling it     :", mod.default());
} else {
  console.log("heavy.mjs was never fetched, parsed, linked or evaluated");
}

// the specifier can be computed, and the module is cached by resolved URL
const twice = await Promise.all([import("./heavy.mjs"), import("./heavy.mjs")]);
console.log("same namespace object twice:", twice[0] === twice[1]);
