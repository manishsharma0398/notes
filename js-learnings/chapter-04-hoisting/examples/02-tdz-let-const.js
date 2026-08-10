// 02-tdz-let-const.js
// Demonstrates: let/const ARE hoisted (binding exists), but start in the
// Temporal Dead Zone — no usable value until their declaration line runs.
// typeof does NOT protect you from the TDZ.

function proveTdzExists() {
  console.log(typeof neverDeclaredAnywhere); // "undefined" — truly no binding
  try {
    console.log(typeof tdzVar); // throws — a binding DOES exist, just uninitialized
  } catch (e) {
    console.log("typeof threw:", e.constructor.name, "-", e.message);
  }
  let tdzVar = "now initialized";
  console.log(tdzVar);
}
proveTdzExists();

// TDZ span: from the top of the block to the declaration's own line.
function tdzSpan() {
  {
    // ---- TDZ for `age` begins here (top of block) ----
    try {
      console.log(age);
    } catch (e) {
      console.log("caught:", e.constructor.name);
    }
    let age = 30; // ---- TDZ ends the instant this line executes ----
    console.log("after declaration:", age);
  }
}
tdzSpan();

// try/catch cannot recover a usable value from the TDZ — only the error object.
function noRecovery() {
  try {
    console.log(count);
  } catch (e) {
    console.log("caught, but no fallback value exists for count:", e.constructor.name);
  }
  let count = 5;
  console.log("count after its line:", count);
}
noRecovery();

// const behaves identically to let for TDZ purposes.
function constTdz() {
  try {
    console.log(PI);
  } catch (e) {
    console.log("const TDZ:", e.constructor.name);
  }
  const PI = 3.14159;
  console.log(PI);
}
constTdz();
