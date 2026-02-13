// Chapter 23: Strict Mode
"use strict";

// No implicit globals
// x = 10;  // ReferenceError

// this = undefined
function test() {
    console.log(this);  // undefined
}
test();

// eval own scope
eval("var y = 1");
// console.log(y);  // ReferenceError
