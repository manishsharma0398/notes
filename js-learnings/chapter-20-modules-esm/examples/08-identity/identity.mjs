const a = await import("./state.mjs");
const b = await import("./state.mjs");
const c = await import("./state.mjs?v=2");          // different URL -> different instance

console.log("a === b (same specifier)  :", a === b);
console.log("a.store === c.store       :", a.store === c.store);
console.log("instanceof across copies  :", new a.Token() instanceof c.Token);

a.store.set("k", 1);
console.log("b sees the write          :", b.store.get("k"));
console.log("c sees the write          :", c.store.get("k"));
