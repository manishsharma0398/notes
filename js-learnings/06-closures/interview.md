# Chapter 6: Closures - Interview Questions

## Question 1: Core Understanding

**What is a closure? Provide a precise, technical definition.**

<details>
<summary>Answer</summary>

A closure is a function bundled together with references to its lexical environment. Specifically:

1. When a function is created, JavaScript stores a reference to the current lexical environment in an internal property called `[[Environment]]`
2. This reference persists for the lifetime of the function
3. When the function executes, it can access variables from that captured environment, even if executed in a different scope
4. The variables are accessed by reference, not copied

**Key point**: Every function creates a closure, but it's only observable when a function accesses variables from an outer scope and is executed outside that scope.

</details>

---

## Question 2: Memory & Lifecycle

**Predict the output. Then explain what happens in memory.**

```javascript
function outer() {
  let count = 0;
  
  function inner() {
    count++;
    return count;
  }
  
  return inner;
}

const fn1 = outer();
const fn2 = outer();

console.log(fn1());
console.log(fn1());
console.log(fn2());
console.log(fn1());
```

<details>
<summary>Answer</summary>

**Output**: 1, 2, 1, 3

**Explanation**:

1. **First `outer()` call** creates a new Execution Context with its own `count` variable (initialized to 0) and `inner` function. The `inner` function's `[[Environment]]` references this context.

2. **`fn1 = outer()`** assigns the returned `inner` function to `fn1`. Even though `outer()`'s execution context is gone, the `count` variable remains in memory because `fn1`'s `[[Environment]]` still references it.

3. **Second `outer()` call** creates a COMPLETELY SEPARATE Execution Context with its OWN `count` variable and `inner` function.

4. **`fn2 = outer()`** captures this second, independent closure.

**Calls**:
- `fn1()` → accesses first closure's `count` (0→1) → returns 1
- `fn1()` → accesses same `count` (1→2) → returns 2
- `fn2()` → accesses second closure's `count` (0→1) → returns 1
- `fn1()` → accesses first closure's `count` (2→3) → returns 3

Each closure maintains its own private `count` variable.

</details>

---

## Question 3: The Classic Loop Bug

**Why does this code log "3, 3, 3" instead of "0, 1, 2"?**

```javascript
function createFunctions() {
  const arr = [];
  for (var i = 0; i < 3; i++) {
    arr.push(function() {
      return i;
    });
  }
  return arr;
}

const fns = createFunctions();
console.log(fns[0]());
console.log(fns[1]());
console.log(fns[2]());
```

**Follow-up**: Provide THREE different solutions.

<details>
<summary>Answer</summary>

**Why 3, 3, 3?**

1. `var i` is **function-scoped**, not block-scoped
2. There is only **ONE** `i` variable for the entire `createFunctions` function
3. All three closures capture a reference to the **SAME** `i` variable
4. After the loop completes, `i === 3`
5. When any function executes, it reads the **current** value of `i`, which is 3

**Solution 1: Use `let` (Block Scope)**
```javascript
for (let i = 0; i < 3; i++) {  // let instead of var
  arr.push(function() {
    return i;
  });
}
// Each iteration creates a NEW block scope with its own 'i'
```

**Solution 2: IIFE (Immediately Invoked Function Expression)**
```javascript
for (var i = 0; i < 3; i++) {
  (function(j) {  // Create new scope with parameter 'j'
    arr.push(function() {
      return j;
    });
  })(i);  // Pass current 'i' value
}
```

**Solution 3: Pass as setTimeout parameter**
```javascript
for (var i = 0; i < 3; i++) {
  arr.push((function(j) {
    return function() {
      return j;
    };
  })(i));
}
```

</details>

---

## Question 4: Reference vs Copy

**What's the output? Explain why.**

```javascript
function makeCounter() {
  let count = 0;
  
  return {
    increment: function() {
      count++;
    },
    decrement: function() {
      count--;
    },
    value: function() {
      return count;
    }
  };
}

const counter = makeCounter();
counter.increment();
counter.increment();
counter.decrement();
console.log(counter.value());
```

<details>
<summary>Answer</summary>

**Output**: 1

**Explanation**:

All three methods (`increment`, `decrement`, `value`) are closures that reference the **SAME** `count` variable:

1. `increment()` → `count` becomes 1
2. `increment()` → `count` becomes 2  
3. `decrement()` → `count` becomes 1
4. `value()` → returns 1

**Key insight**: Closures don't copy variables; they hold **references**. When multiple closures are created in the same scope, they all reference the same variable in memory.

</details>

---

## Question 5: Garbage Collection

**Will `largeData` be garbage collected after this code runs? Why or why not?**

```javascript
function createFunction() {
  const largeData = new Array(1000000).fill('data');
  const smallValue = 42;
  
  return function() {
    return smallValue;
  };
}

const fn = createFunction();
```

<details>
<summary>Answer</summary>

**Theoretically**: NO, `largeData` would NOT be garbage collected because the returned function's `[[Environment]]` references the entire lexical environment of `createFunction`, which includes both `largeData` and `smallValue`.

**In practice**: Modern JavaScript engines (V8, SpiderMonkey, etc.) perform **closure optimization**. They analyze which variables are actually accessed by the closure and only retain those. Since `largeData` is never referenced in the returned function, the engine will allow it to be garbage collected.

**Important**: This is an optimization, not guaranteed by the spec. In older engines or non-optimized code, the entire environment might be retained.

**Best practice**: Don't rely on engine optimizations. If you have large data structures that aren't needed by closures, explicitly set them to `null` to help the garbage collector:

```javascript
function createFunction() {
  let largeData = new Array(1000000).fill('data');
  const smallValue = 42;
  
  // ... use largeData ...
  
  largeData = null;  // Explicit cleanup
  
  return function() {
    return smallValue;
  };
}
```

</details>

---

## Question 6: Private Variables (Encapsulation)

**Can you access or modify `balance` directly? Why or why not?**

```javascript
function createAccount(initial) {
  let balance = initial;
  
  return {
    deposit(amount) {
      balance += amount;
    },
    getBalance() {
      return balance;
    }
  };
}

const account = createAccount(100);
account.balance = 9999;
console.log(account.getBalance());
```

<details>
<summary>Answer</summary>

**Output**: 100

**Explanation**:

1. `balance` is a **local variable** in `createAccount`'s scope
2. The returned object only exposes the `deposit` and `getBalance` methods
3. These methods form closures that reference `balance`
4. `balance` is NOT a property of the returned object

When you write `account.balance = 9999`, you're creating a NEW property on the `account` object, but this doesn't affect the closure's `balance` variable.

The only way to access `balance` is through the methods that close over it.

**This is true data privacy** - unlike using naming conventions like `_balance` or `#balance` (private fields), closure-based privacy is **absolute**: there's no reflection, prototype manipulation, or other trick that can access the variable.

</details>

---

## Question 7: Async Closures

**Predict the output and explain the execution order.**

```javascript
for (var i = 1; i <= 3; i++) {
  setTimeout(function() {
    console.log(i);
  }, i * 1000);
}
```

<details>
<summary>Answer</summary>

**Output** (with timing):
- After 1 second: 4
- After 2 seconds: 4
- After 3 seconds: 4

**Explanation**:

1. **Loop executes synchronously**:
   - `i = 1`: Schedule setTimeout for 1s
   - `i = 2`: Schedule setTimeout for 2s
   - `i = 3`: Schedule setTimeout for 3s
   - `i = 4`: Loop condition fails, loop exits

2. **All callbacks are scheduled** but not executed yet (they're in the task queue)

3. **Loop completes**, `i === 4`

4. **Timeouts execute**:
   - After 1s: Callback runs, reads `i` (which is 4)
   - After 2s: Callback runs, reads `i` (which is 4)
   - After 3s: Callback runs, reads `i` (which is 4)

All three callbacks close over the **SAME** `i` variable (function-scoped), and by the time they execute, `i` has already been modified to 4.

</details>

---

## Question 8: Why This Design?

**Why does JavaScript implement closures this way? What would break if closures didn't exist?**

<details>
<summary>Answer</summary>

**Historical Context**:

JavaScript was designed with:
1. **First-class functions**: Functions can be passed as values, returned from functions
2. **Lexical scoping**: Variable resolution based on where code is **written**, not where it's **executed**

**Without closures, lexical scoping would break:**

```javascript
function outer() {
  let x = 10;
  
  function inner() {
    return x;  // Where does 'x' come from?
  }
  
  return inner;
}

const fn = outer();
fn();  // Without closures, 'x' would be undefined!
```

**What would break**:
- **Event handlers** couldn't access component state
- **Callbacks** couldn't reference local variables
- **Partial application** and currying would be impossible
- **Module pattern** wouldn't work
- **React hooks** couldn't maintain state

**The design choice**: 
To maintain consistency with lexical scoping when functions are first-class values, JavaScript must preserve variable references. This is the closure mechanism.

**Alternative**: Dynamic scoping (like early Lisp) where variables resolve based on call stack, but this makes reasoning about code much harder.

</details>

---

## Question 9: Performance & Memory

**Does this code have a memory leak? If so, how would you fix it?**

```javascript
function setupListeners() {
  const largeData = fetchLargeDataset();
  const button = document.getElementById('myButton');
  
  button.addEventListener('click', function() {
    console.log('Button clicked');
  });
}

setupListeners();
```

<details>
<summary>Answer</summary>

**Yes, this has a potential memory leak** (in older engines or without optimization).

**Problem**:
1. The click handler forms a closure
2. Its `[[Environment]]` references `setupListeners`' scope
3. That scope includes `largeData`
4. Even though the handler never uses `largeData`, the entire scope may be retained
5. As long as the button exists in the DOM, the handler exists, and the closure keeps `largeData` alive

**Solutions**:

**Option 1: Explicit cleanup**
```javascript
function setupListeners() {
  let largeData = fetchLargeDataset();
  const button = document.getElementById('myButton');
  
  // ... use largeData ...
  
  largeData = null;  // Release reference
  
  button.addEventListener('click', function() {
    console.log('Button clicked');
  });
}
```

**Option 2: Separate scope**
```javascript
function setupListeners() {
  const largeData = fetchLargeDataset();
  // ... use largeData ...
  
  setupClickHandler();
}

function setupClickHandler() {
  const button = document.getElementById('myButton');
  button.addEventListener('click', function() {
    console.log('Button clicked');
  });
  // No reference to largeData scope
}
```

**Option 3: Remove listener when done**
```javascript
function setupListeners() {
  const largeData = fetchLargeDataset();
  const button = document.getElementById('myButton');
  
  function handler() {
    console.log('Button clicked');
  }
  
  button.addEventListener('click', handler);
  
  // Later, when component unmounts:
  // button.removeEventListener('click', handler);
}
```

**Note**: Modern engines optimize this, but defensive coding helps with older browsers and makes intent clear.

</details>

---

## Question 10: Advanced - Closure Scope Chain

**What does this log and why?**

```javascript
var x = 10;

function outer() {
  var x = 20;
  
  function inner() {
    var x = 30;
    
    function innermost() {
      console.log(x);
    }
    
    return innermost;
  }
  
  return inner;
}

const fn = outer()();
fn();
```

<details>
<summary>Answer</summary>

**Output**: 30

**Execution Flow**:

1. **Global scope**: `x = 10`

2. **`outer()` execution**:
   - Creates new scope with `x = 20`
   - Defines `inner` function
   - Returns `inner`

3. **`outer()()` - immediately calls what `outer` returned**:
   - Executes `inner()`
   - Creates new scope with `x = 30`
   - Defines `innermost` function
   - Returns `innermost`

4. **`fn = outer()()`**:
   - `fn` now references `innermost`

5. **`fn()` execution**:
   - `innermost` executes
   - Looks for `x` in its scope chain:
     - `innermost` scope: no `x`
     - `inner` scope: `x = 30` ← **FOUND**
     - (doesn't need to look further)

**Scope chain for `innermost`**:
```
innermost [[Environment]]
  ↓
inner scope (x: 30)
  ↓
outer scope (x: 20)
  ↓
Global scope (x: 10)
```

Variable lookup stops at the first match following the scope chain, which is `x = 30` in `inner`'s scope.

</details>

---

## Bonus Question: Specification Knowledge

**What is the internal property that enables closures, and how would you describe it if interviewing a senior candidate?**

<details>
<summary>Answer</summary>

**The `[[Environment]]` internal slot.**

**Technical description**:

1. **Function Objects** in JavaScript have an internal slot called `[[Environment]]` (double square brackets indicate it's internal and not directly accessible)

2. When a function is **created** (not called), the engine sets `[[Environment]]` to reference the **current Lexical Environment**

3. This Lexical Environment is a record of all variables and their bindings in the current scope

4. When the function is **executed**, a new Execution Context is created with an **Outer Environment Reference** that points to the function's `[[Environment]]`

5. During variable lookup, if a variable isn't found in the current scope, the engine follows the Outer Environment Reference chain (the **scope chain**)

**Specification references**:
- `[[Environment]]`: ES spec §10.2 (Function Objects)
- Lexical Environment: ES spec §9.1 (Environment Records)
- Execution Context: ES spec §9.4 (Execution Contexts)

**Senior-level insight**: 

The closure mechanism is not a special "feature" - it's an automatic consequence of:
- Lexical scoping (variables resolved based on code structure)
- First-class functions (functions as values that can outlive their creation scope)
- Garbage collection (references keep data alive)

Closures are the only way to maintain lexical scoping consistency when functions are passed around as values.

</details>
