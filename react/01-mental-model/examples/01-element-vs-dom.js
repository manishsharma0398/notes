const React = require("react");

console.log("---------------------------------------------------");
console.log("REACT MENTAL MODEL: ELEMENT VS DOM");
console.log("---------------------------------------------------");

// 1. The React "Element" (What JSX compiles to)
// This is mimicking <div id="app"><h1>Hello World</h1></div>
const element = React.createElement(
  "div",
  { id: "app" },
  React.createElement("h1", null, "Hello World"),
);

// 2. Inspect the Object
console.log("1. The React Element (The Menu Item):");
console.log(JSON.stringify(element, null, 2));

console.log("\n2. Key Observation:");
console.log("   Is this a DOM node? NO.");
console.log("   Does it have methods like .appendChild()? NO.");
console.log("   It is just a plain JavaScript object describing UI.");

console.log("\n3. The Cost:");
console.log("   Creating this object is virtually free.");
console.log(
  "   You can create thousands of these in a loop without touching the browser.",
);

console.log("\n---------------------------------------------------");
console.log("NEXT EXPECTATION:");
console.log("React (The Waiter) will take this object and hand it to");
console.log("ReactDOM (The Line Cook) to turn it into actual pixels.");
