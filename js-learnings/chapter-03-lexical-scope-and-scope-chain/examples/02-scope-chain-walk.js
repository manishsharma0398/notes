// 02-scope-chain-walk.js
// Demonstrates: step-by-step identifier lookup up the scope chain

var planet = "Earth";          // Global ER

function galaxy() {
  var star = "Sun";            // galaxy's ER

  function system() {
    var rock = "Mars";         // system's ER

    // Lookup: rock  → system's ER       → found immediately
    // Lookup: star  → system's ER (no) → galaxy's ER (yes)
    // Lookup: planet→ system's ER (no) → galaxy's ER (no) → Global ER (yes)
    console.log(rock, star, planet); // "Mars" "Sun" "Earth"
  }

  system();
}

galaxy();
