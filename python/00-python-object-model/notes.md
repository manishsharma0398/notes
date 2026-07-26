# Chapter 00 — The Python Object Model
## Revision Notes

### The One Rule
Everything in Python is an object. A variable is a name bound to an object — not a box containing a value.

### Object Anatomy (CPython)
Every object has exactly three things:
- **Identity** → `id(obj)` → memory address (unique during object lifetime)
- **Type** → `type(obj)` → the type object it belongs to
- **Value** → the data it holds

### Name Binding
| Operation | What happens |
|---|---|
| `x = obj` | Creates/updates binding of name `x` to `obj` in current namespace |
| `y = x` | `y` and `x` now point to the **same object** |
| `x = other` | `x` is rebound; `y` still points to the original object |
| `del x` | Removes the binding; may deallocate if refcount hits 0 |

### `is` vs `==`
| | `is` | `==` |
|---|---|---|
| Checks | Identity (same object?) | Equality (same value?) |
| Calls | Nothing (pointer compare) | `__eq__()` |
| Use for | `None`, `True`, `False` | Everything else |

### Type Hierarchy
```
42      → instance of → int
int     → instance of → type
type    → instance of → type   (type is its own metaclass)

bool    → subclass of → int
int     → subclass of → object
```

### `type()` vs `isinstance()`
- `type(x) == int` → exact type only, does NOT check subclasses
- `isinstance(x, int)` → checks full inheritance chain ✅ prefer this

### Reference Counting
- `ob_refcnt` on every object tracks how many names/containers point to it
- Hits 0 → object is immediately deallocated (no GC needed for the common case)
- `sys.getrefcount(x)` → always +1 because the call itself is a reference

### Integer Cache
- CPython pre-allocates integers for **-5 to 256**
- `x is y` for small ints may be `True` — this is an implementation detail, never rely on it
- Always use `==` for value comparison

### Singletons
- `None`, `True`, `False` are singletons — always use `is` to compare against them
- `True` and `False` are instances of `bool`, which is a subclass of `int`

### Key Traps
1. `a = b = []` → both names point to the **same list** — mutations are shared
2. `a is b` returning `True` for equal strings/ints is a CPython detail, not guaranteed
3. `type(True) == int` is `False` even though `isinstance(True, int)` is `True`
4. `sys.getrefcount()` always reports one more reference than you expect
