# Chapter 23: Strict Mode and Why It Exists

## What is Strict Mode?

**Opt-in mode** that:
- Eliminates silent errors → throws instead
- Prevents unsafe actions
- Helps optimizations

**Enable:**

```javascript
"use strict";  // Whole file

function test() {
    "use strict";  // Just this function
}

// Classes and modules: always strict
```

## Changes in Strict Mode

### 1. No Implicit Globals

```javascript
// Non-strict
function bad() {
    x = 10;  // Creates global.x
}

// Strict
"use strict";
function good() {
    x = 10;  // ReferenceError
}
```

### 2. No with Statement

```javascript
with (obj) {  // SyntaxError in strict mode
    x = 1;
}
```

### 3. this = undefined

```javascript
"use strict";
function test() {
    console.log(this);  // undefined (not global)
}
test();
```

### 4. No Octal Literals

```javascript
"use strict";
const num = 0123;  // SyntaxError
const ok = 0o123;  // OK (ES6 syntax)
```

### 5. delete Restrictions

```javascript
"use strict";
var x = 1;
delete x;  // SyntaxError

delete Object.prototype;  // TypeError
```

### 6. No Duplicate Parameters

```javascript
"use strict";
function test(a, a) {  // SyntaxError
    return a;
}
```

### 7. eval Scope

```javascript
"use strict";
eval("var x = 1");
console.log(x);  // ReferenceError (eval has own scope)
```

### 8. arguments Behavior

```javascript
"use strict";
function test(a) {
    a = 10;
    console.log(arguments[0]);  // Original value, not 10
}
```

## Why Strict Mode Exists

1. **Catch mistakes:** Silent errors → thrown errors
2. **Prevent bad features:** `with`, octal, etc.
3. **Enable optimizations:** Simpler semantics
4. **Secure JavaScript:** No eval scope leak
5. **Future-proof:** Reserved words for future features

## Modern Usage

**Classes and modules:** Always strict (no need to declare)

```javascript
class MyClass {  // Strict mode
    constructor() {}
}

// module.js - always strict
export function test() {}
```

## Key Takeaways

1. **"use strict"** at top of file/function
2. **Classes/modules:** Always strict
3. **Prevents globals:** Undeclared variables throw
4. **this = undefined** in functions
5. **Safer eval:** Own scope
6. **Better errors:** Catch bugs early

## Next: Undefined, Null, Missing Properties
