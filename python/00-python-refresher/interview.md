# Chapter 00 — Interview Questions

## Q1: What is the difference between `is` and `==` in Python?

**Expected answer:**

- `==` compares **values** (calls `__eq__`)
- `is` compares **identity** — whether two names point to the exact same object in memory (`id(a) == id(b)`)

```python
a = [1, 2, 3]
b = [1, 2, 3]
print(a == b)   # True  — same value
print(a is b)   # False — different objects in memory

c = a
print(a is c)   # True  — same object
```

**JS trap**: JS has no `is` equivalent. `===` does value comparison for primitives and reference comparison for objects — Python separates these cleanly into `==` and `is`.

**Never use `is` to compare values.** The small int cache (`-5` to `256`) makes `is` appear to work for small ints, but it breaks above 256:

```python
x = 256; y = 256; print(x is y)  # True  (cached)
x = 257; y = 257; print(x is y)  # False (not cached)
```

---

## Q2: Why does this function produce unexpected output?

```python
def add(item, lst=[]):
    lst.append(item)
    return lst

print(add(1))
print(add(2))
print(add(3))
```

**Expected answer:**
Default argument values are evaluated **once at function definition time**, not each call. The `[]` is created once and shared across all calls. Output is `[1]`, `[1, 2]`, `[1, 2, 3]`.

Fix: use `None` as default and create a new list inside the function.

**Why JS developers get burned**: In JS, every function call creates a fresh default value. Python does not.

---

## Q3: What is the difference between `type()` and `isinstance()`? When do you use each?

**Expected answer:**

- `type(x)` returns the **exact** class of `x`. It doesn't consider inheritance.
- `isinstance(x, T)` returns `True` if `x` is an instance of `T` **or any subclass** of `T`.

```python
isinstance(True, int)    # True  — bool is a subclass of int
type(True) == int        # False — exact type of True is bool
```

Use `isinstance()` for type checking in production code. Use `type() ==` only when you specifically need to exclude subclasses (rare).

---

## Q4: What does the `else` clause on a `for` loop do? Give a real use case.

**Expected answer:**
The `else` block runs when the loop **completes normally** — i.e., it was not exited via `break`. It does NOT mean "if the loop ran zero iterations".

Real use case: searching through a collection — use `for/else` instead of a `found` flag variable:

```python
# Without for/else (JS style)
found = False
for item in items:
    if condition(item):
        found = True
        break
if not found:
    handle_not_found()

# With for/else (idiomatic Python)
for item in items:
    if condition(item):
        break
else:
    handle_not_found()
```

---

## Q5: `a = []`, `b = a`, `b.append(1)` — what is `a`?

**Expected answer:** `[1]`. `b = a` does not copy the list. Both names point to the same list object. Appending via `b` mutates the shared object, so `a` reflects the change.

**This is aliasing**, and it catches every developer coming from JS who writes `b = a` expecting a copy.

To copy: `b = a.copy()` (shallow) or `b = copy.deepcopy(a)` (deep).
