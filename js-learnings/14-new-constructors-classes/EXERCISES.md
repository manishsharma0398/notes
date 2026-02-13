# Chapter 14: Prediction Exercise

## Exercise 1: new Behavior

```javascript
function Test() {
    this.x = 1;
    return 42;
}
const obj = new Test();
console.log(obj);
```

**Prediction:** ___________

---

## Exercise 2: Class Without new

```javascript
class Person {
    constructor(name) {
        this.name = name;
    }
}

try {
    const p = Person("Alice");
} catch (e) {
    console.log("Error:", e.message);
}
```

**Prediction:** ___________

---

## Exercise 3: super Order

```javascript
class Child extends Parent {
    constructor() {
        this.x = 1;
        super();
    }
}
```

**Prediction:** What happens? ___________

---

## Exercise 4: Private Fields

```javascript
class Test {
    #x = 1;
}
const t = new Test();
console.log(t.#x);
```

**Prediction:** ___________

---

## Exercise 5: Static Inheritance

```javascript
class Parent {
    static greet() { return "Hello"; }
}
class Child extends Parent {}

console.log(Child.greet());
```

**Prediction:** ___________

---

## Exercise 6: Arrow Method

```javascript
class Counter {
    count = 0;
    increment = () => { this.count++; }
}
const c = new Counter();
const fn = c.increment;
fn();
console.log(c.count);
```

**Prediction:** ___________

---

## After Predictions

1. Run each exercise
2. Understand new mechanics
3. Explain class features
4. Identify common traps
