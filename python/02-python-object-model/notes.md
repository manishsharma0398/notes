# Chapter 02 — Python Object Model: Notes & JS-vs-Python Cheatsheet

## Core Mental Model

> In Python, **everything is a heap-allocated object** with a reference count, a type pointer, and data.
> There are no primitives. There is no stack allocation for values. This is fundamentally different from JS.

## JS vs Python: Value Representation

| Concept              | JavaScript                                                                                     | Python                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Primitives           | `number`, `string`, `boolean`, `null`, `undefined` are primitives (stack, no methods natively) | **None** — every value is an object                         |
| Identity check       | `===` (value for primitives, reference for objects)                                            | `is` (always identity/pointer comparison)                   |
| Value equality       | `==` (with coercion), `===` (strict)                                                           | `==` (calls `__eq__`, no coercion)                          |
| Memory address       | Not accessible                                                                                 | `id(x)` returns the C pointer value                         |
| Type check           | `typeof`, `instanceof`                                                                         | `type()` (exact), `isinstance()` (with inheritance)         |
| Dynamic attributes   | `obj.foo = 1` — works on class instances                                                       | `obj.foo = 1` — works, stored in `obj.__dict__`             |
| Functions as objects | ✅ Yes                                                                                         | ✅ Yes (and more introspectable: `__code__`, `__closure__`) |
| Classes as objects   | No — `class` is syntactic sugar, `typeof class{}` is `"function"`                              | ✅ Yes — `type(MyClass)` is `<class 'type'>`                |
| Metaclass            | No equivalent                                                                                  | `type` is the metaclass of all classes                      |

## Key Rules

```python
# Always use `is` for None
if x is None: ...
if x is not None: ...

# Always use `==` for values
if x == 42: ...
if x == "hello": ...

# Never use `is` for ints, strings, or lists — even if it "works"
# (it relies on CPython internal caching — not part of the spec)

# isinstance() > type()
isinstance(x, int)         # preferred — handles subclasses
type(x) is int             # exact match only — rarely what you want
isinstance(x, (int, str))  # can check multiple types at once
```

## The Type Hierarchy (Confirmed from CPython `typeobject.c`)

```
object        ← root of everything
  ├── int
  │     └── bool   (True/False are immortal singletons, bool cannot be subclassed)
  ├── str
  ├── list
  ├── dict
  ├── function
  └── type      ← metaclass: the type of all types (including itself)
```

## PyObject Memory Layout (from `Include/object.h`)

```
Every Python object in memory:
┌─────────────────────┐
│ ob_refcnt  (int)    │  ← reference count for GC
│ ob_type*   (ptr)    │  ← pointer to the type object
│ ... data ...        │  ← actual value (int digits, str chars, etc.)
└─────────────────────┘
```

## `id()` Facts

- `id(x)` → memory address of object `x` in CPython
- Two live objects: guaranteed different `id`
- After GC: address CAN be reused by a new object (`del x; y = ...; id(y) == old_addr` may be True)
- JS has no equivalent

## Integer Cache (Version-Dependent!)

| CPython version | Cache range |
| --------------- | ----------- |
| ≤ 3.11          | -5 to 256   |
| 3.12+           | -5 to 1024  |

**Never rely on `is` for int or str comparisons** — cache range is an implementation detail.

## `__dict__` Quick Reference

```python
obj.__dict__        # instance attributes (dict, writable)
MyClass.__dict__    # class attributes (mappingproxy, read-only view)
int.__dict__        # built-in type methods (mappingproxy)
(42).__dict__       # AttributeError — built-in instances have no __dict__
```
