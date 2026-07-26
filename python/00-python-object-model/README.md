# Chapter 00 — The Python Object Model

## Why This Is Chapter 0

Every Python behavior you will ever encounter — variables, functions, classes, `None`, `True`, `1`, `[]` — is explained by one unified idea:

> **Everything in Python is an object. Types are objects. Functions are objects. Classes are objects. Even `type` itself is an object.**

This is not a slogan. It is a precise, mechanical statement about how CPython allocates and tracks memory. Once you understand what an object *actually is* at the C level, scoping, mutability, identity, and reference counting all fall into place.

---

## 1. What Is a Python Object?

At the CPython level, every Python object is a C struct. The minimal version is `PyObject`, defined in `Include/object.h`:

```
PyObject
├── ob_refcnt   (Py_ssize_t)  — reference count
└── ob_type     (PyTypeObject *) — pointer to the object's type
```

That's it. Every single Python object — an integer, a string, a list, a class, a function — starts with these two fields. For objects with a fixed size (like `int`), CPython extends this with a value field. For variable-size objects (like `list` or `str`), it adds `ob_size` to track length.

```
PyVarObject (extends PyObject)
├── ob_refcnt
├── ob_type
└── ob_size   (Py_ssize_t) — number of items
```

This is why `len()` on a list is O(1) — `ob_size` is stored directly on the object.

### ASCII Diagram

```
Memory layout of a Python int (value = 42):

┌─────────────────────────┐
│  ob_refcnt  = 1         │  ← how many names point here
│  ob_type    = <int>     │  ← pointer to int type object
│  ob_digit   = 42        │  ← the actual value
└─────────────────────────┘
       ↑
       │
   x ──┘   (x = 42  means x is a name bound to this object)
```

---

## 2. Variables Are Name Bindings, Not Containers

In most languages, a variable is a box that holds a value. In Python, a variable is a **name** that is **bound to** an object. The object exists independently.

```python
x = 42
y = x
x = 100
print(y)  # 42 — not 100
```

What happened:
1. CPython creates an `int` object with value `42`. `x` is bound to it.
2. `y = x` binds `y` to the **same object**. Now two names point to one object. `ob_refcnt` goes from 1 → 2.
3. `x = 100` creates a new `int` object (value `100`) and rebinds `x` to it. The original `42` object's `ob_refcnt` drops from 2 → 1 (only `y` still points to it).

The `42` object was never modified. The name `x` was just redirected.

This is why Python has no concept of "undefined" like JavaScript — a name either exists in a namespace or it doesn't. If it exists, it points to an object.

---

## 3. `id()`, `type()`, `isinstance()`

### `id()`
Returns the memory address of the object (in CPython). This is the unique identity of the object during its lifetime.

```python
x = [1, 2, 3]
print(id(x))        # e.g. 140234567890
print(hex(id(x)))   # e.g. 0x7f9a1b2c3d50
```

Two objects with the same `id` at the same time are the same object. Two objects that had the same `id` at different times may not be — CPython reuses addresses after objects are deallocated.

### `type()`
Returns the `ob_type` of an object — the type object it belongs to.

```python
type(42)        # <class 'int'>
type("hello")   # <class 'str'>
type([])        # <class 'list'>
type(int)       # <class 'type'>   ← int is itself an object, of type 'type'
type(type)      # <class 'type'>   ← type is its own type
```

The last two lines reveal something important: **types are objects too**, and their type is `type`. This is not circular — `type` is the root metaclass.

### `isinstance()`
Checks against the full inheritance chain, not just the immediate type.

```python
isinstance(42, int)     # True
isinstance(True, int)   # True  ← bool is a subclass of int
isinstance(True, bool)  # True
type(True) == int       # False ← type() checks exact type only
```

Prefer `isinstance()` over `type() ==` in real code — it respects inheritance.

---

## 4. `is` vs `==` — Identity vs Equality

| Operator | What it checks | What it calls |
|---|---|---|
| `is` | Are the two names bound to the **same object**? (`id(a) == id(b)`) | Nothing — direct pointer comparison |
| `==` | Do the two objects have **equal value**? | `a.__eq__(b)` |

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a

a == b   # True  — same value
a is b   # False — different objects in memory
a is c   # True  — c is bound to the same object as a
```

### The Trap: `is` With Small Integers and Interned Strings

```python
x = 256
y = 256
x is y   # True  ← CPython caches small ints (-5 to 256)

x = 257
y = 257
x is y   # False in many contexts — different objects
```

CPython pre-allocates integer objects for values -5 to 256 (inclusive). This is an implementation detail, not a language guarantee. **Never use `is` to compare values. Use `==`.**

The only correct uses of `is`:
```python
x is None    # ✅ None is a singleton
x is True    # ✅ True is a singleton
x is False   # ✅ False is a singleton
```

---

## 5. Types Are Objects

This is the part most developers skip, and it causes confusion with metaclasses and decorators later.

```python
int           # this is an object
type(int)     # <class 'type'>
id(int)       # it has a memory address
int.mro()     # it has methods
```

When you write `class Foo: ...`, CPython:
1. Creates a new object of type `type` (the metaclass)
2. Binds the name `Foo` to it in the current namespace

```python
class Foo:
    pass

type(Foo)      # <class 'type'>
type(Foo())    # <class '__main__.Foo'>
isinstance(Foo, type)   # True — Foo is an instance of type
```

The full type chain:

```
42        is an instance of    int
int       is an instance of    type
type      is an instance of    type     ← type is its own metaclass

bool      is a subclass of     int
int       is a subclass of     object
object    is a subclass of     (nothing — it's the root)
```

---

## 6. Reference Counting

CPython tracks how many names (or containers) refer to each object via `ob_refcnt`. When the count hits 0, the object is immediately deallocated (in the common case — the cyclic GC handles cycles separately, covered in a later chapter).

```python
import sys

x = []
sys.getrefcount(x)   # 2 — one for x, one for the getrefcount() argument itself

y = x
sys.getrefcount(x)   # 3 — x, y, and the getrefcount() argument

del y
sys.getrefcount(x)   # 2 again
```

> `sys.getrefcount()` always returns one more than you expect because passing the object to the function creates a temporary reference.

### When Does `ob_refcnt` Increase?

- A name is bound to the object: `x = obj`
- The object is stored in a container: `lst.append(obj)`
- The object is passed as a function argument
- The object is returned from a function

### When Does `ob_refcnt` Decrease?

- A name is rebound: `x = something_else`
- A name is deleted: `del x`
- The object is removed from a container
- A function call returns and its local frame is torn down

---

## 7. The Integer Cache and String Interning

### Integer Cache (-5 to 256)

CPython pre-creates integer objects for -5 through 256 at interpreter startup and reuses them. This means:

```python
a = 100
b = 100
a is b   # True — same cached object

a = 1000
b = 1000
a is b   # False — new objects created each time (in a script; may differ in REPL)
```

This is a **CPython implementation detail**, not a Python language guarantee. PyPy, Jython, and other runtimes may cache different ranges or not at all.

### String Interning

CPython interns (caches) string literals that look like valid Python identifiers. Other strings may or may not be interned depending on context.

```python
a = "hello"
b = "hello"
a is b   # True — both interned to the same object

a = "hello world"   # has a space — may not be interned
b = "hello world"
a is b   # False (or True, depending on context — don't rely on it)
```

You can force interning with `sys.intern()`:
```python
import sys
a = sys.intern("hello world")
b = sys.intern("hello world")
a is b   # True
```

**Rule**: Never rely on string identity. Always use `==` for string comparison.

---

## 8. `None`, `True`, `False` Are Singletons

```python
type(None)   # <class 'NoneType'>
id(None)     # always the same address
None is None # True — always

a = None
b = None
a is b       # True — there is only one None object
```

`True` and `False` are the only instances of `bool`. They are also integers:
```python
True + True   # 2
True == 1     # True
False == 0    # True
```

This is because `bool` is a subclass of `int`.

---

## 9. Mental Model Summary

```
Python execution = binding names to objects in namespaces

An object has:
  - identity  → id()    → memory address
  - type      → type()  → what kind of object it is
  - value     → whatever data it holds

A name has:
  - no type (names are just strings in a dict)
  - a binding (which object it currently points to)

Assignment  → creates/updates a binding
del         → removes a binding (may deallocate the object if refcount hits 0)
is          → compares identities (memory addresses)
==          → compares values (calls __eq__)
```

---

## Common Misconceptions

| What devs think | What actually happens |
|---|---|
| `x = 5` stores 5 in x | `x` is a name bound to an `int` object with value 5 |
| Two variables with equal value are the same object | Not necessarily — depends on interning/caching |
| `is` is a faster `==` | They check different things — `is` should never replace `==` for values |
| `type(x) == int` is the same as `isinstance(x, int)` | `type()` checks exact type, `isinstance()` checks inheritance |
| Deleting a variable frees its memory | `del` removes the binding; memory is freed only when `ob_refcnt` hits 0 |
