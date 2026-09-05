export let count = 0;
export function inc() { count++; }

// the value at the moment of export is 0 — but `count` is a binding, not a copy
