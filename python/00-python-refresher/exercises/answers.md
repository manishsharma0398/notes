# Chapter 00 — Exercise Answers

⚠️ **Only open this after you have attempted all problems in `problems.md`.**

---

## Exercise 1 — Answer

```python
x = [1, 2, 3]
y = x          # y and x point to the SAME list
y += [4]       # += on a list calls list.__iadd__ → in-place extend (mutates)
print(x)       # [1, 2, 3, 4]
print(y)       # [1, 2, 3, 4]
print(x is y)  # True — still the same object
```

**Key insight**: `+=` on a list mutates in place (calls `__iadd__`). It does NOT rebind `y` to a new list. So `x` and `y` both still point to the same object.

**Contrast with immutable types**:

```python
a = 5
b = a
b += 1
print(a)      # 5 — unchanged (int is immutable, b was rebound to new int 6)
print(a is b) # False
```

---

## Exercise 2 — Answer

```
fn(1) → ([1], {1: 2})
fn(2) → ([1, 2], {1: 2, 2: 4})
fn(3) → ([1, 2, 3], {1: 2, 2: 4, 3: 6})
```

Both `b=[]` and `c={}` are created **once at function definition**. Every call mutates and reuses them. This is the mutable default argument trap — one of the most famous Python gotchas.

**Fix**:

```python
def fn(a, b=None, c=None):
    if b is None: b = []
    if c is None: c = {}
    b.append(a)
    c[a] = a * 2
    return b, c
```

---

## Exercise 3 — Answer

**Bug 1**: `for i in range(len(items))` — un-Pythonic. Use `enumerate()`:

```python
for i, item in enumerate(items):
```

**Bug 2**: `type(item) == int` — use `isinstance()` to respect subclasses:

```python
if isinstance(item, int):
```

**Bug 3**: `null` does not exist in Python. The correct value is `None`:

```python
if result == None:   # works but not idiomatic
if not result:       # idiomatic (empty dict is falsy)
```

**Bug 4**: `result.values()` returns a **view object**, not a list. It may be fine depending on use, but usually you want:

```python
return list(result.values())
```

**Fixed idiomatic version**:

```python
def process(items):
    result = {i: item * 2 for i, item in enumerate(items) if isinstance(item, int)}
    return list(result.values()) if result else []
```

---

## Exercise 4 — Answer

```python
def get_user(users, user_id):
    # Use next() with a default — idiomatic Python alternative to .find()
    user = next((u for u in users if u["id"] == user_id), None)
    if user is None:
        return None
    return {
        "name": user["name"].upper(),
        "active": user.get("active", False),  # .get() replaces ?? for dicts
    }
```

**Notes**:

- `next(generator, default)` is the Python equivalent of `.find()` with a fallback.
- `dict.get("key", default)` replaces the JS nullish coalescing `??` for dict lookups.
- Python `==` compares values, so no need for `===`. There is no `===` in Python.

---

## Exercise 5 — Answer

```python
print(True + True + True)     # 3     — bool is subclass of int; True == 1
print(True * 10)               # 10    — True * 10 = 1 * 10
print(False == 0)              # True  — False IS 0
print(True == 1)               # True  — True IS 1
print(isinstance(True, int))   # True  — bool inherits from int
print(bool(float('nan')))      # True  ← JS developer surprise (JS: NaN is falsy)
print(bool([]))                # False — empty list is falsy
print(bool([0]))               # True  — non-empty list is TRUTHY even if it contains 0
```

The last one catches many developers: `[0]` contains a falsy value, but the **list itself is truthy** because it's non-empty.

---

## Exercise 6 — Answer

```python
def search(matrix, target):
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if val == target:
                return (r, c)
        # No need for for/else on outer loop here since we return directly
    return None  # target not found

# Alternative using for/else on inner loop:
def search_v2(matrix, target):
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if val == target:
                break
        else:
            continue   # inner loop completed without break — not found in this row
        return (r, c)  # inner break was hit — found!
    return None
```

The `for/else` + `continue` + `break` pattern in `search_v2` is a classic Python idiom for breaking out of nested loops cleanly without a flag variable.
