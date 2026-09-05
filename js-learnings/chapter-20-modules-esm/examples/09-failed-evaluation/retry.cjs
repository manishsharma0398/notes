for (let i = 0; i < 2; i++) {
  try { require("./boom.cjs"); } catch (e) { console.log("attempt", i, "->", e.message); }
}
