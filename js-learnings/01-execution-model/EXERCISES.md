# Chapter 1: Prediction Exercise

Before reviewing the detailed explanations in the examples, try predicting the output of these code snippets. Write down your predictions, then run the code to check.

---

## Exercise 1: Hoisting Mystery

**Predict the output:**

```javascript
console.log(a);
console.log(b);
console.log(c);

var a = 1;
let b = 2;
const c = 3;
```

**Your prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________

**Why do you think this happens?**

---

## Exercise 2: Function Confusion

**Predict the output:**

```javascript
foo();
bar();
baz();

function foo() {
  console.log("foo");
}

var bar = function() {
  console.log("bar");
};

const baz = () => {
  console.log("baz");
};
```

**Your prediction:**
- Line 1: ___________
- Line 2: ___________
- Line 3: ___________

**Which lines will execute successfully?**

---

## Exercise 3: Scope Surprise

**Predict the output:**

```javascript
var x = "outer";

function test() {
  console.log(x);
  var x = "inner";
  console.log(x);
}

test();
```

**Your prediction:**
- Line 4: ___________
- Line 6: ___________

**Why doesn't the first log show "outer"?**

---

## Exercise 4: The TDZ Trap

**Predict what happens:**

```javascript
{
  console.log(typeof x);
  let x;
}
```

**Your prediction:**
- Will this output "undefined"?
- Will this throw an error?
- If error, what kind?

**Why?**

---

## Exercise 5: Double Declaration

**Predict what happens:**

```javascript
let name = "Alice";
let name = "Bob";
console.log(name);
```

**Your prediction:**
- Will this run?
- If not, what error and at what phase?

---

## Exercise 6: Conditional Function

**Predict the output:**

```javascript
console.log(typeof foo);

if (true) {
  function foo() {
    return "inside";
  }
}

console.log(typeof foo);
console.log(foo());
```

**Your prediction in strict mode:**
- Line 1: ___________
- Line 9: ___________
- Line 10: ___________

**Your prediction in non-strict mode:**
- Line 1: ___________
- Line 9: ___________
- Line 10: ___________

---

## Exercise 7: Named Expression

**Predict what happens:**

```javascript
const myFunc = function namedFunc() {
  console.log(typeof namedFunc);
};

myFunc();
console.log(typeof namedFunc);
```

**Your prediction:**
- Line 2 (inside function): ___________
- Line 6 (outside function): ___________

**Why is there a difference?**

---

## Exercise 8: Async Doesn't Matter (Yet)

**Predict the output:**

```javascript
console.log(foo);

setTimeout(function() {
  var foo = "async";
  console.log(foo);
}, 0);

var foo = "sync";
console.log(foo);
```

**Your prediction:**
- Line 1: ___________
- Line 9: ___________
- Line 5 (in setTimeout): ___________

**What scopes are involved?**

---

## After You've Made Your Predictions...

1. Run each exercise in Node.js or browser console
2. Compare actual output to your predictions
3. For each mismatch, review the relevant section in README.md
4. Try to explain WHY the behavior differs from your expectation

---

## Variation Challenge

Once you understand the basics, try these variations:

### Variation 1: Change `var` to `let`
```javascript
console.log(x);
var x = 5;
```

→ What changes if you use `let x = 5;`?

### Variation 2: Nested Scopes
```javascript
let x = "global";

function outer() {
  let x = "outer";
  
  function inner() {
    console.log(x);
  }
  
  inner();
}

outer();
```

→ What prints? What if you remove `let x = "outer";`?

### Variation 3: Block Scoping
```javascript
var x = 1;
let y = 2;

{
  var x = 10;
  let y = 20;
}

console.log(x);
console.log(y);
```

→ What are the values of x and y?

---

## Key Insight

If you got any of these wrong, it's because you're thinking execution-first instead of compilation-first. Remember:

**JavaScript reads everything, compiles it, THEN executes it.**

The compilation phase is what makes hoisting, TDZ, and scope resolution work the way they do.
