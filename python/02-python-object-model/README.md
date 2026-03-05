# Chapter 02 — Python Object Model

> **Goal**: Understand what "everything is an object" actually means in CPython — at the memory level.
> Learn `id()`, `is` vs `==`, the type hierarchy, and why this is fundamentally different from JS.

---

## 1. The Mental Model — Nothing Like JS

### JS mental model

In JavaScript, values are either **primitives** (number, string, boolean, null, undefined, Symbol, BigInt)
or **objects** (everything else). Primitives are stack-allocated value types; objects are heap-allocated
reference types.

```js
// JavaScript
typeof 42; // "number"  — primitive, not an object
typeof "hello"; // "string"  — primitive, not an object
typeof {}; // "object"
typeof []; // "object"
typeof null; // "object"  ← famous bug
(42).toString(); // "42" — JS auto-boxes primitive to Number object to call method
```

### Python mental model — everything is an object. Full stop.

```python
# Python
type(42)           # <class 'int'>       — int IS an object
type("hello")      # <class 'str'>       — str IS an object
type([])           # <class 'list'>      — list IS an object
type(None)         # <class 'NoneType'>  — None IS an object
type(len)          # <class 'builtin_function_or_method'>  — functions are objects
type(int)          # <class 'type'>      — types are objects too

# No auto-boxing needed — all objects already have methods
(42).bit_length()  # 6  — int object, direct method call
```

**There are no primitives in Python.** Every value is a heap-allocated object with:

- A **type pointer** (what kind of object is this?)
- A **reference count** (how many names/containers point to this?)
- A **value** (the actual data)

---

## 2. `id()` — The Identity of an Object

`id(x)` returns the **memory address** of the object `x` points to. In CPython, this is
literally the C pointer value cast to an integer.

```python
x = [1, 2, 3]
print(id(x))        # e.g. 140234567890  — a memory address

y = x
print(id(y))        # same address — x and y point to the same object
print(id(x) == id(y))  # True
```

```js
// JavaScript has no equivalent of id()
// You can't get the memory address of a JS value
// The closest is: same reference check with ===
const x = [1, 2, 3];
const y = x;
console.log(x === y); // true — same reference, but no address
```

**CPython guarantees**: Two objects that exist at the same time will NEVER have the same `id`.
But the same address CAN be reused after an object is garbage collected:

```python
x = [1, 2, 3]
addr = id(x)
del x            # x is GC'd (if refcount hits 0)
y = [4, 5, 6]
print(id(y) == addr)  # May be True! Same address reused for new object
```

---

## 3. `is` vs `==` — Identity vs Equality

This is the most important distinction in the Python object model.

| Operator | Checks                                   | Calls                            |
| -------- | ---------------------------------------- | -------------------------------- |
| `is`     | Same object in memory (`id(a) == id(b)`) | Nothing — raw pointer comparison |
| `==`     | Same value                               | `a.__eq__(b)` — can be custom    |
| `is not` | Different objects                        | Nothing                          |
| `!=`     | Different values                         | `a.__ne__(b)`                    |

```js
// JavaScript
([1, 2] ===
  [1, 2][(1, 2)]) == // false — different references
  [1, 2]; // false — same, no value comparison for objects

// JS has no way to do deep value comparison without a library
```

```python
# Python
a = [1, 2, 3]
b = [1, 2, 3]

print(a == b)    # True  — same value (list.__eq__ compares elements)
print(a is b)    # False — different objects in memory

c = a
print(a is c)    # True  — same object
```

### The trap: `is` with strings and ints (interning)

```python
# Small ints are cached (CPython implementation detail)
x = 5
y = 5
print(x is y)    # True — same cached object (don't rely on this!)

# CPython 3.12+: int cache extends to 1024
x = 1000
y = 1000
print(x is y)    # True in 3.12+ (cached), False in 3.11-

# String interning (for identifiers / compile-time constants)
a = "hello"
b = "hello"
print(a is b)    # True — interned at compile time (don't rely on this!)

a = "hello world"
b = "hello world"
print(a is b)    # Depends on context and Python version — UNPREDICTABLE
```

**Rule**: Use `is` ONLY for:

- `x is None` — the idiomatic None check (None is a singleton)
- `x is True` / `x is False` — rarely needed; prefer `if x:` or `if not x:`

**Never** use `is` to compare integers, strings, or any non-singleton values.

```python
# RIGHT — checking for None
if x is None:
    ...

if x is not None:
    ...

# WRONG — looks like it works, silently breaks
if x is 42:        # SyntaxWarning in Python 3.8+
    ...
```

---

## 4. Everything Is an Object — The Type Hierarchy

```
                  object
                    │
          ┌─────────┼─────────┐
         int      str        list
          │
         bool
```

Every class inherits from `object`. `object` is the root of the type hierarchy.

```python
print(issubclass(int, object))    # True
print(issubclass(str, object))    # True
print(issubclass(bool, int))      # True
print(issubclass(bool, object))   # True (via int)

# Every object has these from object:
x = 42
print(dir(x))  # __class__, __eq__, __hash__, __repr__, __str__, ...
```

**JS comparison:**

```js
// JavaScript
42 instanceof
  Number(
    // false — 42 is a primitive, not a Number object
    new Number(42),
  ) instanceof
  Number(
    // true — boxed
    new Number(42),
  ) instanceof
  Object; // true — everything inherits from Object

// JS has a similar hierarchy but primitives break out of it
```

---

## 5. `type()` vs `isinstance()` — Deep Dive

```python
# type() — exact class, no inheritance
type(True)         # <class 'bool'>     — exact
type(True) is bool # True
type(True) is int  # False — even though bool inherits from int

# isinstance() — checks the full MRO (inheritance chain)
isinstance(True, bool)   # True
isinstance(True, int)    # True — bool IS a subclass of int
isinstance(True, object) # True — everything is an object
```

### `type()` has a second form — creating classes dynamically

```python
# type(name, bases, dict) — creates a new class at runtime
MyClass = type("MyClass", (object,), {"x": 42, "greet": lambda self: "hi"})
obj = MyClass()
print(obj.x)       # 42
print(obj.greet()) # "hi"
print(type(MyClass))  # <class 'type'>
```

This reveals something crucial: **`type` is both a function and the metaclass of all classes**.
When you write `class Foo:`, Python internally calls `type("Foo", (object,), {...})`.

---

## 6. The PyObject — What Lives in Memory

Every Python object in CPython is (at minimum) a C struct `PyObject`:

```c
// From CPython: Include/object.h
typedef struct _object {
    Py_ssize_t ob_refcnt;    // reference count (GC)
    PyTypeObject *ob_type;   // pointer to the type object
} PyObject;
```

For an `int` (which in 3.12+ is `PyLongObject`):

```c
typedef struct {
    PyObject ob_base;  // the common header
    // ... digit array for arbitrary precision
} PyLongObject;
```

```
Memory layout of x = 42:

  x (name in locals dict)
     │
     ▼
  ┌──────────────────────────────┐
  │  ob_refcnt:  1               │  ← reference count
  │  ob_type:  → <int type obj> │  ← pointer to int type
  │  value: 42                   │  ← the actual number
  └──────────────────────────────┘
```

This is why every Python value has overhead — even `True` or `1` carries a refcount + type pointer.
Compare to V8 where small integers can be stored as tagged 31-bit values directly on the stack.

---

## 7. Objects as Namespaces — `__dict__`

Most Python objects store their attributes in a dictionary called `__dict__`:

```python
class Dog:
    def __init__(self, name):
        self.name = name

d = Dog("Rex")
print(d.__dict__)         # {'name': 'Rex'}
d.age = 3                 # adding attribute at runtime
print(d.__dict__)         # {'name': 'Rex', 'age': 3}
```

```js
// JavaScript — similar — you can add properties dynamically
class Dog {
  constructor(name) {
    this.name = name;
  }
}
const d = new Dog("Rex");
d.age = 3; // works — JS objects are open
```

**Same behavior, different mechanism**: In Python, instance attributes live in `d.__dict__`.
In JS, they live in the hidden "shape" or "map" that V8 tracks. Python's is explicit and inspectable.

### What doesn't have `__dict__` by default

- Built-in types like `int`, `str`, `list` — they implement their data in C structs directly
- Classes with `__slots__` (Chapter 20)

```python
x = 42
x.__dict__   # AttributeError — int has no __dict__

# But type objects do:
print(int.__dict__)  # mappingproxy with all int methods
```

---

## 8. The `object` Base — Every Object's Inheritance

```python
x = "hello"
print(x.__class__)       # <class 'str'>
print(x.__class__.__bases__)  # (<class 'object'>,)

# object itself
print(object.__bases__)  # ()  — object has no parent

# Method Resolution Order
print(str.__mro__)
# (<class 'str'>, <class 'object'>)
```

---

## 9. Functions Are Objects Too

```python
def greet(name):
    return f"Hello, {name}"

print(type(greet))          # <class 'function'>
print(greet.__name__)       # 'greet'
print(greet.__code__)       # <code object greet ...>

# Functions can be assigned, passed, stored
funcs = [greet, len, str.upper]
print(funcs[0]("Alice"))    # "Hello, Alice"
print(funcs[1]([1, 2, 3]))  # 3
```

```js
// JavaScript — same! Functions are first-class objects
function greet(name) {
  return `Hello, ${name}`;
}
typeof greet; // "function"
greet.name; // "greet"
const f = greet; // can assign
```

This is one of the areas where Python and JS are very similar. The difference:

- Python functions have `__code__`, `__globals__`, `__closure__`, `__defaults__` — deeply inspectable
- JS functions have `name`, `length`, `prototype` — less introspectable

---

## 10. Classes Are Objects Too — And Their Type Is `type`

```python
class Animal:
    pass

print(type(Animal))    # <class 'type'>   ← Animal is itself an object!
print(type(type))      # <class 'type'>   ← type's type is itself
print(type(object))    # <class 'type'>   ← object's type is type
print(isinstance(Animal, type))   # True — Animal is an instance of type
print(isinstance(type, type))     # True — type is an instance of itself
```

This is the metaclass loop — the deepest part of the Python object model:

```
  object  ←──────────────── is a class/type
    │                              │
  type    ←──── is an instance of type (itself)
    │
  int, str, list, MyClass  ←── all instances of type
    │
  42, "hi", []   ←── instances of their respective types
```

```js
// JavaScript has no equivalent concept
// Classes in JS are syntactic sugar over prototype chains
// There is no user-inspectable "metaclass"
typeof class Dog {}; // "function" — classes are just functions in JS
```

---

## ASCII Diagram — The Python Object Model

```
  name in frame locals
         │
         ▼
  ┌──────────────────────────────────────────┐
  │  Python Object (heap allocated)          │
  │  ┌────────────────────────────────────┐  │
  │  │ ob_refcnt │ ob_type ptr │ data ... │  │
  │  └────────────────────────────────────┘  │
  │           │                               │
  │           ▼                               │
  │  ┌──────────────────────────────────────┐│
  │  │  Type Object (also a Python object!) ││
  │  │  ob_type → &PyType_Type (= type)     ││
  │  │  tp_name, tp_methods, tp_base, ...   ││
  │  └──────────────────────────────────────┘│
  └──────────────────────────────────────────┘

  ALL of the above are heap-allocated C structs.
  "Everything is an object" means: EVERYTHING follows this layout.
```

---

## Revision Notes → `notes.md`

## Interview Questions → `interview.md`

## Exercises → `exercises/problems.md`
