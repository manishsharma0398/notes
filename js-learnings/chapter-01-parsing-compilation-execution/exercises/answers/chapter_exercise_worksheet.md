# Chapter 1 Worksheet — Predicting Parse-Time vs Runtime Behavior

Predict each answer before running any code. Fill in the blanks below.

---

### Snippet A

```javascript
console.log(x);
var x = 5;
console.log(x);
```

- Line 1 output: \***\*\_\_\_\*\***
  Answer: undefined

- Line 3 output: \***\*\_\_\_\*\***
  Answer: 5

- Reason: \***\*\_\_\_\*\***
  Answer: var x is hoisted; so line 1 logs undefined. on line 2 x is assigned a value = 5. At line 3, we log the value which is now 5

---

### Snippet B

```javascript
console.log(typeof y);
let y = 10;
```

- Output: \***\*\_\_\_\*\***
  Answer: Reference Error: cannot access y before initialization

- Error or not? \***\*\_\_\_\*\***
  Answer: Error

- Reason: \***\*\_\_\_\*\***
  Answer: y is in Temporal Dead Zone phase when it is logged

---

### Snippet C

```javascript
foo();
bar();

function foo() {
  console.log("foo");
}
var bar = function () {
  console.log("bar");
};
```

- `foo()` output: \***\*\_\_\_\*\***
  Answer: foo

- `bar()` output or error: \***\*\_\_\_\*\***
  Answer: Error

- Reason: \***\*\_\_\_\*\***
  Answer: function declarations are hoisted with full reference , so it can be called without any error but bar() is hosited with undefined as it is not a function declaration but a var function expression

---

### Snippet D

```javascript
var x = "global";
function test() {
  console.log(x);
  var x = "local";
  console.log(x);
}
test();
```

- First `console.log`: \***\*\_\_\_\*\***
  Answer: undefined

- Second `console.log`: \***\*\_\_\_\*\***
  Answer: local

- Reason: \***\*\_\_\_\*\***
  Answer: since, var x is hoisted in test() so global variable x is shadowed there and the scope chain lookup will not be required for "x".

---

### Snippet E

```javascript
function outer() {
  var secret = "42";
  return function inner() {
    return secret;
  };
}

var secret = "0";
var getSecret = outer();
console.log(getSecret());
```

- Output: \***\*\_\_\_\*\***
  Answer: 42

- Reason (use "lexical scope" in your answer): \***\*\_\_\_\*\***
  Answer: inner() forms a closure with outer() function, and the inner()'s Outer Environment Reference Points to outer() Lexical Environment. Thus, secret is accessed through Lexical scope of inner().

---

### Snippet F

```javascript
function getValue() {
  return;
  42;
}
console.log(getValue());
```

- Output: \***\*\_\_\_\*\***
  Answer: undefined

- Reason: \***\*\_\_\_\*\***
  Answer: ASI inserts a semiclon after return meaning end of statement/line.

---

### Snippet G

```javascript
let i = 5;
{
  console.log(i);
  let i = 10;
}
```

- Output or error: \***\*\_\_\_\*\***
  Answer: Error

- Reason: \***\*\_\_\_\*\***
  Answer: Hoisting also occurs at {} block level, and at the time when i is console logged it is in Temporal Dead zone phase meaning memory is allocated to i but it is not initialized, so we get error Reference Error: i cannot be accessed before initialization

---

### Snippet H

```javascript
function a() {
  b();
}
function b() {
  c();
}
function c() {
  console.trace();
}
a();
```

- What does `console.trace()` print? Describe the call stack order.
  Answer: c() -> b() -> a()
  Call Stack
  c()
  b()
  a()
  Global Execution Context

- Reason: \***\*\_\_\_\*\***
  Answer:
  console.trace() prints starting from the currently executing (innermost, top-of-stack) frame outward to its callers — that's why the order is c → b → a, not the reverse.
  multiple EC formed as calling function from another function as call stack is a LIFO.
