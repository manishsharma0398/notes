// The import declarations are the LAST lines of this file on purpose.
console.log("  main.mjs   : statement 1");
console.log("  main.mjs   : statement 2");

import { NAME } from "./dep.mjs";
import { OTHER } from "./other.mjs";

console.log("  main.mjs   : statement 3, has", NAME, OTHER);
