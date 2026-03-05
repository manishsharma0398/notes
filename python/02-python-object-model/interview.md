# Chapter 02 — Interview Questions

## Q1: What does "everything is an object" actually mean in Python? How is it different from JavaScript?

**Expected answer:**
In Python, every value — integers, strings, functions, classes, `None`, `True`, even `type` itself — is a heap-allocated C struct (`PyObject`) with:

- An `ob_refcnt` (reference count)
- An `ob_type` (pointer to the type object)
- The actual data

There are no primitives. There is no distinction between "value types" and "reference types". A Python `int` is a full object with methods (`bit_length()`, `__add__`, etc.) and lives on the heap.

In JavaScript, `42`, `"hello"`, `true` are **primitives** — they are NOT objects, they live as stack/inline values, and JS has to auto-box them as `Number`, `String`, `Boolean` objects when you call methods on them. Python never needs this — `(42).bit_length()` works because `42` already is a proper object.

**CPython source**: `Include/object.h` defines `PyObject` struct; `Objects/longobject.c` implements the int object.

---

## Q2: What is the difference between `is` and `==`? When should you use each?

**Expected answer:**

- `is` compares **object identity** — it checks if `id(a) == id(b)`, i.e., whether `a` and `b` point to the exact same object in memory. It's a raw C pointer comparison with no method call.
- `==` compares **value equality** — it calls `a.__eq__(b)`, which can be overridden.

**When to use `is`:**

- `if x is None:` — idiomatic None check (None is a singleton)
- `if x is not None:` — same
- Rarely: `if x is True:` / `if x is False:`

**Never use `is` for:**

- Integers, strings, lists, dicts — even if it "works" due to CPython's int cache or string interning. The cache range is an implementation detail that changes between versions (expanded from 256 to 1024 in 3.12).

**JS developer trap**: In JS, `===` does value comparison for primitives AND reference comparison for objects. Python separates these cleanly: `==` always does value, `is` always does identity.

---

## Q3: What does `type(type)` return and why?

**Expected answer:** `<class 'type'>`. `type` is its own metaclass — its type is itself.

The full metaclass loop:

```python
type(int)     # <class 'type'>   — int is an instance of type
type(type)    # <class 'type'>   — type is an instance of itself
type(object)  # <class 'type'>   — object is an instance of type
issubclass(type, object)    # True — type inherits from object
issubclass(object, type)    # False — object does NOT inherit from type
```

When you write `class Foo: pass`, Python internally calls `type("Foo", (object,), {...})`. `type` is both the built-in function for checking types AND the metaclass (factory) for creating classes.

**JS comparison**: JavaScript has no equivalent. `typeof class Dog {}` returns `"function"` — classes are just syntactic sugar over constructor functions.

---

## Q4: Why does `id()` sometimes return the same value for different objects?

**Expected answer:**
`id(x)` returns the **memory address** of `x` in CPython. After an object is garbage collected (refcount hits 0), its memory is freed and can be reused by a new object. If you:

1. Delete a reference (`del x`)
2. Create a new object

...the new object may be allocated at the same address:

```python
x = [1, 2]
addr = id(x)
del x
y = [3, 4]
id(y) == addr   # often True
```

This is NOT a bug. It's the consequence of CPython's reference-counting GC + malloc. Two objects **alive at the same time** will NEVER share an `id`. Only a destroyed object's address can be reused.

**Practical implication**: Never store `id()` values to compare against later — by the time you compare, the original object may be dead and its address reused.

---

## Q5: What is `__dict__` on a Python object? Which objects don't have it?

**Expected answer:**
`__dict__` is the dictionary that stores an object's **instance attributes**. When you do `obj.foo = 1`, Python stores `{"foo": 1}` in `obj.__dict__`.

Objects that do NOT have `__dict__` on instances:

1. **Built-in type instances**: `int`, `str`, `list`, `tuple`, etc. — their data is stored in C struct fields, not a dict.
2. **Objects with `__slots__`**: When a class defines `__slots__`, Python skips the `__dict__` allocation and stores instance attributes in fixed slots — faster and more memory-efficient.

```python
(42).__dict__          # AttributeError
[].__dict__            # AttributeError

class MyClass: pass
MyClass().__dict__     # {} — user-defined classes get __dict__ by default

class Slotted:
    __slots__ = ['x']
Slotted().__dict__     # AttributeError — slots eliminate __dict__
```

Note: the **class itself** always has a `__dict__` (as a `mappingproxy`), even for `int`, `str`, etc.
