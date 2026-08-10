# Chapter Exercise — Predicting Parse-Time vs Runtime Behavior

## Problem Statement

You will be given **8 JavaScript snippets**. For each one:
1. Predict the **exact output** (or error type and message).
2. Write a **one-sentence explanation** of *why* that output occurs, using precise vocabulary from this chapter (e.g., "hoisting", "TDZ", "lexical scope", "compilation phase", "ASI").

Do **not** run the code first. Commit to your predictions on paper (or in a `.md` file), then verify by running each snippet.

---

## Snippets

### Snippet A
```javascript
console.log(x);
var x = 5;
console.log(x);
```

**Predict:**
- Line 1 output: ___________
- Line 3 output: ___________
- Reason: ___________

---

### Snippet B
```javascript
console.log(typeof y);
let y = 10;
```

**Predict:**
- Output: ___________
- Error or not? ___________
- Reason: ___________

---

### Snippet C
```javascript
foo();
bar();

function foo() { console.log("foo"); }
var bar = function() { console.log("bar"); };
```

**Predict:**
- `foo()` output: ___________
- `bar()` output or error: ___________
- Reason: ___________

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

**Predict:**
- First `console.log`: ___________
- Second `console.log`: ___________
- Reason: ___________

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

**Predict:**
- Output: ___________
- Reason (use "lexical scope" in your answer): ___________

---

### Snippet F
```javascript
function getValue() {
  return
    42;
}
console.log(getValue());
```

**Predict:**
- Output: ___________
- Reason: ___________

---

### Snippet G
```javascript
let i = 5;
{
  console.log(i);
  let i = 10;
}
```

**Predict:**
- Output or error: ___________
- Reason: ___________

---

### Snippet H
```javascript
function a() { b(); }
function b() { c(); }
function c() { console.trace(); }
a();
```

**Predict:**
- What does `console.trace()` print? Describe the call stack order.
- Reason: ___________

---

## Acceptance Criteria

You can consider this exercise complete when:
- [ ] You predicted all 8 snippets **before** running any of them.
- [ ] Your explanation for each uses correct vocabulary from Chapter 1.
- [ ] You ran all snippets and compared output — note any you got wrong and explain *why* your mental model was off.
- [ ] You can explain Snippet D and G from memory without looking at notes.

---

## Hints
*(Read only if stuck for more than 10 minutes on a specific snippet)*

<details>
<summary>Hint for Snippet B</summary>
`typeof` is special — but does it bypass TDZ? Look carefully at what kind of declaration `y` is.
</details>

<details>
<summary>Hint for Snippet D</summary>
The `var x` inside `test()` creates a function-scoped variable. At what point is it registered? What is its value before its assignment line?
</details>

<details>
<summary>Hint for Snippet F</summary>
The parser has rules for when it inserts semicolons. What rule applies when a newline follows `return`?
</details>

<details>
<summary>Hint for Snippet G</summary>
Does the inner `let i` create a new scope? Does it get registered before `console.log` runs?
</details>
