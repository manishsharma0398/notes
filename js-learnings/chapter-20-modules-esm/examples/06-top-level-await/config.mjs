console.log("  config: start");
export const settings = await new Promise((r) => setTimeout(() => r({ region: "eu-west-1" }), 50));
console.log("  config: resolved");
