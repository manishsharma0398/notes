// Example 3: The Classic Loop Bug (var)
// Demonstrates: Why var in loops creates unexpected closures

console.log('=== BROKEN VERSION (var) ===');

function createFunctionsVar() {
    const functions = [];

    for (var i = 0; i < 3; i++) {
        functions.push(function () {
            return i;
        });
    }

    return functions;
}

const varsQuickFns = createFunctionsVar();
console.log('varsQuickFns[0]():', varsQuickFns[0]());  // 3 (not 0!)
console.log('varsQuickFns[1]():', varsQuickFns[1]());  // 3 (not 1!)
console.log('varsQuickFns[2]():', varsQuickFns[2]());  // 3 (not 2!)

// Why? All three functions reference the SAME 'i' variable
// After the loop, i === 3
// So all functions return 3

console.log('\n=== FIXED VERSION (let) ===');

function createFunctionsLet() {
    const functions = [];

    for (let i = 0; i < 3; i++) {  // let creates new binding each iteration
        functions.push(function () {
            return i;
        });
    }

    return functions;
}

const letFns = createFunctionsLet();
console.log('letFns[0]():', letFns[0]());  // 0 ✓
console.log('letFns[1]():', letFns[1]());  // 1 ✓
console.log('letFns[2]():', letFns[2]());  // 2 ✓

// With let, each iteration creates a NEW 'i' binding
// Each function closes over a DIFFERENT 'i'

console.log('\n=== ALTERNATIVE FIX (IIFE) ===');

function createFunctionsIIFE() {
    const functions = [];

    for (var i = 0; i < 3; i++) {
        // IIFE creates a new scope with its own copy of i
        (function (captured) {
            functions.push(function () {
                return captured;
            });
        })(i);
    }

    return functions;
}

const iifeFns = createFunctionsIIFE();
console.log('iifeFns[0]():', iifeFns[0]());  // 0 ✓
console.log('iifeFns[1]():', iifeFns[1]());  // 1 ✓
console.log('iifeFns[2]():', iifeFns[2]());  // 2 ✓
