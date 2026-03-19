# Chapter 02 — Exercises

Attempt all exercises before opening `answers.md`.

---

## Exercise 1 — Prediction

What is the output of each line? Explain why.

```python
a = []
b = []
c = a

print(a is b)
print(a is c)
print(a == b)
print(id(a) == id(b))
print(id(a) == id(c))
```

---

## Exercise 2 — Prediction

What does this print? Think carefully about each line before predicting.

```python
class Dog:
    tricks = []   # ← class variable, NOT instance variable

    def add_trick(self, trick):
        self.tricks.append(trick)

a = Dog()
b = Dog()

a.add_trick("sit")
b.add_trick("paw")

print(a.tricks)
print(b.tricks)
print(a.tricks is b.tricks)
```

Why might a JS developer be surprised by this? What is the fix?

---

## Exercise 3 — Debugging

A developer wrote this code to check if a value is the integer `0`:

```python
def is_zero(x):
    return x is 0

print(is_zero(0))      # Expected: True
print(is_zero(False))  # Expected: False
print(is_zero(0.0))    # Expected: False
```

1. What is wrong with using `is 0`?
2. What are the actual outputs?
3. Rewrite `is_zero` correctly in idiomatic Python.

---

## Exercise 4 — Prediction

```python
print(type(42))
print(type(type(42)))
print(type(int))
print(type(type))
print(isinstance(int, type))
print(isinstance(type, object))
print(issubclass(bool, int))
print(issubclass(type, object))
```

Predict all 8 outputs and explain the ones that surprise you.

---

## Exercise 5 — Rewrite

Rewrite this JavaScript in idiomatic Python. Pay attention to `===` vs `==` vs `is`:

```js
function checkValue(x) {
  if (x === null) {
    return "null";
  }
  if (x === undefined) {
    return "undefined";
  }
  if (typeof x === "number" && x === 0) {
    return "zero number";
  }
  if (Array.isArray(x) && x.length === 0) {
    return "empty array";
  }
  return "something else";
}
```

---

## Exercise 6 — Design

Without using the `class` keyword, create a Python "class" called `Counter` that:

- Has an instance variable `count` starting at `0`
- Has methods `increment()` and `reset()`
- Can be instantiated with `c = Counter()`

Use only `type(name, bases, dict)` to define it.
