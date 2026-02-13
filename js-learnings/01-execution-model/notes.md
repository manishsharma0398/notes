# Chapter 1 Revision Notes: JavaScript Execution Model

## The Three Phases (In Order)

### 1. Parsing
- Converts source code → tokens → AST
- Validates syntax
- **Does NOT execute anything**
- Syntax errors stop everything

### 2. Compilation
- AST → bytecode/machine code
- **Registers all declarations** (var, let, const, function)
- Analyzes scopes
- JIT optimization
- This is why hoisting works

### 3. Execution
- Creates execution contexts
- Runs code line by line
- Assigns values
- Calls functions

---

## Key Mental Models

### 🧠 JavaScript is Compiled (Not Interpreted)
```
Parse → Compile → Execute
(Not: Read line → Run line → Read line → Run line)
```

### 🧠 Declarations vs Assignments
- **Declarations** registered at compile time
- **Assignments** happen at execution time

```javascript
var x = 5;
//  ↑   ↑
//  |   └─ Assignment (execution time)
//  └───── Declaration (compile time)
```

---

## Hoisting Quick Reference

| Type | Hoisted? | Initial Value | Can Use Before Declaration? |
|------|----------|---------------|----------------------------|
| `var` | ✓ | `undefined` | Yes (returns undefined) |
| `let` | ✓ | `<uninitialized>` | No (ReferenceError - TDZ) |
| `const` | ✓ | `<uninitialized>` | No (ReferenceError - TDZ) |
| `function` (declaration) | ✓ | Full function | Yes |
| `function` (expression) | Depends on var/let/const | Depends | No |

---

## Critical Rules

1. **Parsing happens before any execution**
   - Entire script parsed first
   - Syntax errors = nothing runs
   - `try/catch` can't catch syntax errors

2. **Compilation creates scope metadata**
   - All declarations registered
   - Scopes analyzed and linked
   - Closures detected

3. **Temporal Dead Zone (TDZ)**
   - `let/const` are hoisted but uninitialized
   - Accessing them before declaration = ReferenceError
   - TDZ = from scope start until declaration line

4. **Function declarations are fully hoisted**
   - Can call before they appear in code
   - Name + body both available

5. **Function expressions follow variable rules**
   - `var` → hoisted to undefined
   - `let/const` → TDZ

---

## Common Pitfalls

### ❌ Thinking JavaScript is interpreted
```javascript
// If this were true, the first line would run
console.log("Start");
let x = ;  // Syntax error prevents ENTIRE script
console.log("End");  // Never runs
```

### ❌ Forgetting TDZ for let/const
```javascript
console.log(x);  // ReferenceError, not undefined
let x = 5;
```

### ❌ Confusing function declaration vs expression
```javascript
foo();  // Works
function foo() {}

bar();  // ReferenceError
const bar = function() {};
```

---

## One-Sentence Summary

**JavaScript compiles your entire scope before executing any of it, which is why hoisting, TDZ, and syntax errors work the way they do.**

---

## ASCII Reminder

```
SOURCE → PARSE → COMPILE → EXECUTE
           ↓        ↓         ↓
         AST    Bytecode   Contexts
                Scope      Memory
                Registry   Assignments
```

---

## Next Chapter Preview

**Execution Contexts and Call Stack:**
- What exactly is an execution context?
- How does the call stack work?
- Variable Environment vs Lexical Environment
