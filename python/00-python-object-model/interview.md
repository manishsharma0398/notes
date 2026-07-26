# Chapter 00 — Interview Questions

## Q1 — Internals: What does CPython do when you write `x = 42`?

**What most people say:** "It stores 42 in x."

**Correct answer:**
1. CPython evaluates the right-hand side — it looks up the integer `42` in the small int cache (since 42 is between -5 and 256) and retrieves the pre-allocated `PyObject` for it.
2. It binds the name `"x"` to that object in the current namespace (which is a dict — `locals()` or the module's `__dict__`).
3. `ob_refcnt` on the `42` object is incremented.

The name `x` is just a string key in a dictionary. The object `42` exists independently.

**Follow-up trap:** "What if I then do `y = x; x = 100`? What is `y`?"
Answer: `y` is still `42`. `x = 100` rebinds `x` to a new object; it does not modify the `42` object that `y` still references.

---

## Q2 — Trap: When is `a is b` True for two variables with equal values?

**Answer:**
It depends on the type and the value:

- **Small integers (-5 to 256):** CPython caches these, so `a is b` is `True` for the same value. Implementation detail — not guaranteed.
- **String literals that look like identifiers:** CPython may intern them, causing `is` to return `True`. Also not guaranteed for all strings.
- **`None`, `True`, `False`:** Always singletons — `is` is always `True`.
- **Lists, dicts, user objects:** Never rely on `is` returning `True` for equal-valued objects. Use `==`.

**Key point:** `is` checks memory address (`id(a) == id(b)`), not value. Using `is` to compare values is a bug waiting to happen.

---

## Q3 — Why does `isinstance(True, int)` return `True`?

**Answer:**
Because `bool` is a subclass of `int` in Python. `True` and `False` are the only two instances of `bool`. Since `bool` inherits from `int`, they are also valid `int` instances.

This means:
```python
True + True    # 2
True * 5       # 5
False + 1      # 1
```

`isinstance()` walks the MRO (Method Resolution Order) of the object's type and returns `True` if any class in the chain matches. `type(True) == int` returns `False` because `type()` returns the exact type (`bool`), not its parents.

**Why does Python do this?** `bool` was added in Python 2.3. Before that, `0` and `1` were used for False/True. To maintain backward compatibility, `bool` was made a subclass of `int` so that boolean values work in arithmetic contexts.

---

## Q4 — Prediction (answer before running)

What does this print? Explain each line.

```python
import sys

a = []
b = a
print(sys.getrefcount(a))   # ?

c = [a, a, a]
print(sys.getrefcount(a))   # ?

del b
print(sys.getrefcount(a))   # ?

c.clear()
print(sys.getrefcount(a))   # ?
```

<details>
<summary>Answer (read after attempting)</summary>

```
3   — a, b, and the getrefcount() argument
6   — a, b, c[0], c[1], c[2], and the getrefcount() argument
5   — del b removed one binding; c still holds 3 references
2   — c.clear() removed all 3 items from the list; only a and getrefcount() remain
```

</details>
