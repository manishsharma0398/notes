# Chapter 00 — Python Refresher: Notes & JS-vs-Python Cheatsheet

## Core Mental Model Shifts

| Concept            | JS Mental Model             | Python Reality                                                                |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| Variables          | Typed slots (`const`/`let`) | Name bindings — type lives on the object                                      |
| `null`-like        | `null` and `undefined`      | Only `None` — no `undefined`                                                  |
| Type check         | `typeof`, `Array.isArray()` | `isinstance()` (preferred), `type()`                                          |
| Object copy        | `{...obj}`, `[...arr]`      | `.copy()` (shallow), `copy.deepcopy()` (deep)                                 |
| Falsy `[]`/`{}`    | Falsy                       | **Truthy** — wait, no. Empty ones ARE falsy. Non-empty are truthy. Same as JS |
| `NaN` truthiness   | Falsy                       | **Truthy** in Python                                                          |
| For loop var scope | `var` leaks, `let` doesn't  | Regular `for` leaks, comprehension `for` doesn't                              |
| Default args       | New value each call         | **Evaluated ONCE at definition** — mutable defaults are a trap                |

## Key Syntax Quick Reference

```python
# Truthiness
bool([])    # False
bool([1])   # True
bool({})    # False
bool({1:1}) # True
bool(None)  # False
bool(float('nan'))  # True ← not like JS

# Type checks
isinstance(x, int)        # preferred
isinstance(x, (int, str)) # check multiple types at once
type(x) is int            # exact type, no inheritance

# Safe dict access
d.get('key')          # None if missing
d.get('key', default) # default if missing

# Comprehensions
[x for x in lst if condition]        # list
{k: v for k, v in items}             # dict
{x for x in lst}                     # set
(x for x in lst)                     # generator (lazy)

# String formatting
f"{value}"                # f-string (prefer this)
f"{value:.2f}"            # format spec
f"{value!r}"              # repr()

# for/else
for item in collection:
    if condition:
        break
else:
    # runs only if no break occurred
    pass

# Safe mutable default
def fn(lst=None):
    if lst is None:
        lst = []
```

## Common Footguns (Memorize These)

1. **Mutable default argument** — use `None`, never `[]` or `{}`
2. **Aliasing** — `y = x` for lists/dicts means same object; use `.copy()` to copy
3. **`bool` is a subclass of `int`** — `True + True == 2`; `True` and `False` are **immortal singletons** (refcount never reaches zero, confirmed in `Objects/boolobject.c`); `bool` **cannot be subclassed**
4. **`NaN` is truthy** — always compare explicitly with `math.isnan(x)`
5. **Missing key raises `KeyError`** — use `.get()` or check with `in`
6. **Comprehension scope** — variable doesn't leak (Python 3), but regular `for` does
7. **`is` vs `==`** — `is` checks identity (same object), `==` checks value; never use `is` for value comparison
8. **Int cache range is version-dependent** — `-5` to `256` in CPython ≤3.11, expanded to `-5` to `1024` in CPython 3.12+; never rely on it
