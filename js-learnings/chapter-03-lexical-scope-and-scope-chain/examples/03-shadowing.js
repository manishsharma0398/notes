// 03-shadowing.js
// Demonstrates: inner declarations shadow outer ones — not mutate them

var color = "blue";    // Global ER: color = "blue"

function paint() {
  var color = "red";   // paint's ER: color = "red" — shadows global color
  console.log(color);  // Looks in paint's ER first → "red"
}

paint();
console.log(color);    // Back in global scope → "blue" (untouched)

// -----------------------------------------------
// Shadowing via block scope:

let theme = "light";

{
  let theme = "dark";       // Block ER: shadows outer `theme`
  console.log(theme);       // "dark"
}

console.log(theme);          // "light" — block ER is gone, outer survives

// -----------------------------------------------
// Accessing shadowed global via globalThis (escape hatch):

var version = "1.0";   // Also lives as globalThis.version

function checkVersion() {
  var version = "2.0"; // Shadows the global
  console.log(version);              // "2.0" — local shadow
  console.log(globalThis.version);   // "1.0" — bypasses scope chain
}

checkVersion();
