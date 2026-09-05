const viaRequire = require("./state.mjs");
import("./state.mjs").then((viaImport) => {
  console.log("require()d === import()ed :", viaRequire.store === viaImport.store);
});
