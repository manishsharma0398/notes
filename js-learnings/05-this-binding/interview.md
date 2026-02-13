# Chapter 5 Interview Questions: `this` Binding

---

## Question 1: What is `this`?

**Q:** Explain what `this` is and correct common misconceptions.

**Expected Answer:**
- **NOT** a reference to the function or its scope
- **IS** a runtime binding determined by call-site
- Determined by **HOW** function is called, not where it's defined
- Four binding rules in priority order

---

## Question 2: The Four Rules

**Q:** What are the four `this` binding rules and their priority?

**Expected Answer:**
1. **new** (highest): `new fn()` → new object
2. **Explicit**: `.call/.apply/.bind` → specified object  
3. **Implicit**: `obj.method()` → obj
4. **Default** (lowest): `fn()` → global or undefined

---

## Question 3: Predict the Output

**Q:** What does this log?

```javascript
const obj = {
  value: 42,
  getValue: function() {
    return this.value;
  }
};

const fn = obj.getValue;
console.log(fn());
```

**Expected Answer:**
`undefined` (or TypeError in strict mode)

**Why:**
- `fn()` is standalone call (default binding)
- `this` = global/undefined
- Global has no `value` property

---

## Question 4: Arrow Functions

**Q:** How do arrow functions handle `this`?

**Expected Answer:**
- Don't have their own `this`
- Inherit `this` from enclosing lexical scope
- Ignore all 4 binding rules
- Can't be changed with `.call/.apply/.bind`
- Can't be used with `new`

**Follow-up:** When should you use arrow functions?

**Answer:** Callbacks where you want to preserve outer `this`. NOT as object methods.

---

## Question 5: Binding Priority

**Q:** Which wins?

```javascript
function test() {
  console.log(this.value);
}

const obj1 = { value: 1 };
const obj2 = { value: 2 };

const bound = test.bind(obj1);
bound.call(obj2);
```

**Expected Answer:**
Logs `1`

**Why:** `.bind()` creates hard binding. `.call()` can't override it.

**Priority:** new > explicit > implicit > default

---

## Question 6: Lost `this`

**Q:** Why does this fail and how to fix?

```javascript
const obj = {
  value: 10,
  getValue: function() {
    return this.value;
  }
};

setTimeout(obj.getValue, 100);
```

**Expected Answer:**
**Fails** because `setTimeout` calls function standalone (default binding).

**Fixes:**
```javascript
setTimeout(() => obj.getValue(), 100);     // Arrow wrapper
setTimeout(obj.getValue.bind(obj), 100);   // Bind
```

---

## Question 7: Arrow as Method

**Q:** What's wrong here?

```javascript
const obj = {
  value: 42,
  getValue: () => this.value
};

obj.getValue();
```

**Expected Answer:**
Returns `undefined`

**Why:**
- Arrow inherits `this` from where it's **defined** (global scope)
- NOT where it's called (obj)
- `this` = global, not obj

**Fix:** Use regular function for object methods.

---

## Question 8: new Binding

**Q:** What does `new` do to `this`?

**Expected Answer:**
1. Creates new empty object
2. Links to prototype
3. Binds `this` to new object
4. Executes constructor
5. Returns new object (unless constructor returns object)

**Follow-up:** What if constructor returns an object?

**Answer:** That object is returned instead of `this`.

---

## Question 9: Class Methods

**Q:** Why does this fail?

```javascript
class Counter {
  count = 0;
  increment() {
    this.count++;
  }
}

const c = new Counter();
const inc = c.increment;
inc();
```

**Expected Answer:**
TypeError: `this` is undefined

**Why:**
- Class methods run in strict mode
- `inc()` is standalone call → `this` = undefined

**Fixes:**
```javascript
// Bind in constructor
this.increment = this.increment.bind(this);

// Or use arrow field
increment = () => { this.count++; };
```

---

## Question 10: Subtle Behavior

**Q:** Predict the output:

```javascript
const obj = {
  value: 1,
  outer: function() {
    function inner() {
      console.log(this.value);
    }
    inner();
  }
};

obj.outer();
```

**Expected Answer:**
`undefined`

**Why:**
- `inner()` is standalone call (not `obj.inner()`)
- Default binding → `this` = global/undefined

**Fix:** Use arrow function for `inner`.

---

## Interview Traps

### Trap 1:
```javascript
function fn() { return this; }
console.log(fn() === fn.call(null));
```
**Answer:** False in strict mode (undefined !== null), True in non-strict (both global).

### Trap 2:
```javascript
const obj = {
  method: function() {
    return () => this;
  }
};

const arrow = obj.method();
arrow.call({});  // ?
```
**Answer:** Returns `obj` (arrows ignore .call).

### Trap 3:
```javascript
function Fn() {
  this.value = 1;
  return { value: 2 };
}
console.log(new Fn().value);
```
Answer:** `2` (constructor return overrides `this`).

---

## Precision Questions

### Q1: "this refers to the calling object." Fix this.

**Better:** "`this` is determined by the call-site using four binding rules in priority order: new > explicit > implicit > default."

### Q2: When is `this` undefined?

**Answer:**
- Strict mode + default binding
- Class methods called standalone
- Arrow can inherit undefined

### Q3: Why did JavaScript design `this` this way?

**Answer:**
- Dynamic binding enables flexible code reuse
- Same function can work with different objects
- Enables patterns like mixins and delegation
- Trade-off: More confusing vs more flexible
