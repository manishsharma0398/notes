# Chapter 00 — Exercises

Attempt all exercises before opening `answers.md`.
**Do not read the answers file until you have written your answers here.**

---

## Exercise 1 — Prediction

What is the output of this code? Explain each line.

```python
x = [1, 2, 3]
y = x
y += [4]
print(x)
print(y)
print(x is y)
```

Your answer:

```
1. x = ?
2. y = ?
3. x is y = ?
4. Why?
```

---

## Exercise 2 — Prediction

What does this print? Why?

```python
def fn(a, b=[], c={}):
    b.append(a)
    c[a] = a * 2
    return b, c

print(fn(1))
print(fn(2))
print(fn(3))
```

---

## Exercise 3 — Debugging

This code is written by a developer coming from JavaScript. Find **all the bugs** and explain why each one is wrong in Python.

```python
def process(items):
    result = {}

    result = {i: item * 2 for i, item in enumerate(items) if isinstance(item, int)}

    for i in range(len(items)):
        item = items[i]
        if type(item) == int:
            result[i] = item * 2

    if result == null:
        return []

    return result.values()
```

How many bugs can you find? Fix each one with idiomatic Python.

---

## Exercise 4 — Rewrite

Rewrite this JavaScript in idiomatic Python:

```js
function getUser(users, id) {
  const user = users.find((u) => u.id === id);
  if (user === undefined) {
    return null;
  }
  return {
    name: user.name.toUpperCase(),
    active: user.active ?? false,
  };
}
```

---

## Exercise 5 — Prediction

What does this print? Why is the output surprising for a JS developer?

```python
print(True + True + True)
print(True * 10)
print(False == 0)
print(True == 1)
print(isinstance(True, int))
print(bool(float('nan')))
print(bool([]))
print(bool([0]))
```

---

## Exercise 6 — Design

Write a Python function `search(matrix, target)` that:

- Takes a 2D list (list of lists of ints)
- Searches for `target`
- Returns `(row, col)` if found
- Uses `for/else` correctly — no boolean flag variable allowed

```python
matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
]
print(search(matrix, 5))   # (1, 1)
print(search(matrix, 99))  # None
```
