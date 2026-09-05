import { gate } from "./gate.mjs";
console.log("  user: awaiting the gate");
await gate;
console.log("  user: never printed");
export const ready = true;
