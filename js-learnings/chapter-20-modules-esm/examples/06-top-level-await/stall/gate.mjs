// a promise nothing ever settles — stands in for "the config service never answered"
console.log("  gate: evaluating");
export const gate = new Promise(() => {});
