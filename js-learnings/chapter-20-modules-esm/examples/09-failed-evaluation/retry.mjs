for (let i = 0; i < 2; i++) {
  try { await import("./boom.mjs"); } catch (e) { console.log("attempt", i, "->", e.message); }
}
