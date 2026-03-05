# Chapter 02 — Exercise Answers

⚠️ **Only open this after you have attempted all problems in `problems.md`.**

---

## Exercise 1 — Answer

```python
a = []
b = []
c = a

print(a is b)           # False — two separate list objects
print(a is c)           # True  — c is just another name for a
print(a == b)           # True  — both are empty lists (equal value)
print(id(a) == id(b))   # False — different memory addresses
print(id(a) == id(c))   # True  — same memory address (same object)
```

Key insight: `==` calls `list.__eq__`, which compares elements one by one.
`is` and `id()` are just pointer comparisons — same object means same address.

---

## Exercise 2 — Answer

```python
print(a.tricks)          # ['sit', 'paw']
print(b.tricks)          # ['sit', 'paw']
print(a.tricks is b.tricks)  # True — both share the SAME list
```

**Why**: `tricks = []` is a **class variable** — it's defined on the class `Dog`, not on instances.
Both `a` and `b` share the same `tricks` list via `Dog.tricks`. When you call `self.tricks.append(...)`,
you're mutating the shared class-level list through the instance — not creating a new instance variable.

**What a JS developer expects**:

```js
class Dog {
  tricks = [];
} // In JS, class fields are instance variables — each instance gets its own
const a = new Dog();
const b = new Dog();
a.tricks.push("sit");
b.tricks.push("paw");
console.log(a.tricks); // ["sit"]  — independent!
```

**Fix in Python**: Initialize in `__init__` to create per-instance lists:

```python
class Dog:
    def __init__(self):
        self.tricks = []   # new list for each instance
```

This is Exercise 2's **most important lesson**: class variables in Python are SHARED across
all instances. Instance variables must be created in `__init__`.

---

## Exercise 3 — Answer

1. **What's wrong**: `is 0` compares object identity, not value. `False == 0` (bool is a subclass of int, and `False is 0` may be True due to bool being a special case in CPython, but trusting `is` for value comparison is incorrect and unreliable.

2. **Actual outputs**:

```python
is_zero(0)      # True — 0 is in the cache; 0 IS the cached 0 object
is_zero(False)  # True ← WRONG! False IS the same object as 0 in CPython
                # (False.__index__() == 0, and CPython may intern False as 0)
is_zero(0.0)    # False — 0.0 is a float object, not the cached int 0
```

The function produces `True` for `False`, which is wrong.

3. **Correct version**:

```python
def is_zero(x):
    return x == 0 and type(x) is int

# Or if you only care about numeric zero:
def is_zero(x):
    return x == 0  # True for 0, 0.0, False — pick based on your need
```

Use `type(x) is int` if you want to exclude bool and float. Use `isinstance(x, int) and not isinstance(x, bool)` to exclude bool but include int subclasses.

---

## Exercise 4 — Answer

```python
print(type(42))               # <class 'int'>
print(type(type(42)))         # <class 'type'>  — type of int is type
print(type(int))              # <class 'type'>  — int is an instance of type
print(type(type))             # <class 'type'>  — type's type is itself!
print(isinstance(int, type))  # True  — int is an instance of type
print(isinstance(type, object)) # True — type inherits from object
print(issubclass(bool, int))  # True  — bool IS a subclass of int
print(issubclass(type, object)) # True — type inherits from object
```

The surprising ones for a JS developer:

- `type(int)` is `type` — in JS, `typeof Number` is `"function"`, not another type system object
- `type(type)` is `type` — type is its own metaclass; nothing in JS parallels this
- `isinstance(type, object)` is True AND `issubclass(type, object)` is True — type participates
  in the normal class hierarchy even though it's the metaclass

---

## Exercise 5 — Answer

```python
def check_value(x):
    if x is None:                          # JS: x === null (Python has no undefined)
        return "null"
    # No 'undefined' in Python — unbound names raise NameError, not undefined
    if isinstance(x, int) and not isinstance(x, bool) and x == 0:
        return "zero number"              # JS: typeof x === "number" && x === 0
    if isinstance(x, list) and len(x) == 0:
        return "empty array"              # JS: Array.isArray(x) && x.length === 0
    return "something else"
```

**JS → Python mapping:**

- `=== null` → `is None` (identity check for the singleton)
- `=== undefined` → no equivalent; Python raises `NameError` for unbound names
- `typeof x === "number"` → `isinstance(x, (int, float))`
- `x === 0` → `x == 0` (Python `==` doesn't coerce types like JS `==`)
- `Array.isArray(x)` → `isinstance(x, list)` (for lists) or `isinstance(x, (list, tuple))`
- `x.length` → `len(x)`

---

## Exercise 6 — Answer

```python
def _counter_increment(self):
    self.count += 1

def _counter_reset(self):
    self.count = 0

def _counter_init(self):
    self.count = 0

Counter = type(
    "Counter",
    (object,),
    {
        "__init__": _counter_init,
        "increment": _counter_increment,
        "reset": _counter_reset,
    }
)

c = Counter()
print(c.count)   # 0
c.increment()
c.increment()
print(c.count)   # 2
c.reset()
print(c.count)   # 0
print(type(c))   # <class '__main__.Counter'>
```

**Why this matters**: This is exactly what the `class` keyword desugars to.
When Python sees:

```python
class Counter:
    def __init__(self): self.count = 0
    def increment(self): self.count += 1
```

...it collects the body into a namespace dict and calls `type("Counter", (object,), namespace)`.
The `class` keyword is syntactic sugar — `type` is the real mechanism.
