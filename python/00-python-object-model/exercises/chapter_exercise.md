# Chapter Exercise — Object Model Inspector

## Problem Statement

You will build a small utility that inspects Python objects and reveals what the object model is actually doing — identity, type hierarchy, reference counts, and interning behavior.

This exercise applies **only Chapter 0 concepts**: `id()`, `type()`, `isinstance()`, `is`, `==`, `sys.getrefcount()`, and name binding.

---

## Acceptance Criteria

- [ ] `inspect_object(obj)` prints: value, type, id (as hex), and refcount
- [ ] `are_same(a, b)` returns `True` if `a is b`, with a printed explanation of why
- [ ] `type_chain(obj)` returns the full MRO of the object's type as a list of names
- [ ] `is_interned_int(n)` returns `True` if `n` is in CPython's small int cache (hint: use `is`)
- [ ] `trace_binding(names_and_values)` shows how rebinding changes identity but not other names

---

## Starter Skeleton

```python
# object_inspector.py
import sys


def inspect_object(obj) -> None:
    """
    Print: repr, type, id (hex), and sys.getrefcount - 1 (subtract the call itself).
    """
    # TODO: implement
    pass


def are_same(a, b) -> bool:
    """
    Return True if a is b.
    Also print: "Same object" or "Different objects" with their ids.
    """
    # TODO: implement
    pass


def type_chain(obj) -> list[str]:
    """
    Return a list of class names in the MRO of type(obj).
    e.g. for True → ['bool', 'int', 'object']
    Hint: use type(obj).__mro__
    """
    # TODO: implement
    pass


def is_interned_int(n: int) -> bool:
    """
    Return True if n is the exact same object as a freshly created int of the same value.
    This detects whether CPython reused a cached object.
    Hint: create a new int with the same value and use 'is'.
    """
    # TODO: implement
    # Hint: int(n) always creates... wait, does it? Think carefully.
    pass


def trace_binding() -> None:
    """
    Demonstrate that rebinding a name does not affect other names pointing to the same object.
    
    Steps:
    1. Create a list and bind it to 'original'
    2. Bind 'alias' to the same list
    3. Print ids to show they are the same
    4. Rebind 'alias' to a new list
    5. Print ids to show 'original' is unchanged
    6. Mutate through 'original' and show 'alias' (new list) is unaffected
    """
    # TODO: implement
    pass


if __name__ == "__main__":
    print("=== inspect_object ===")
    inspect_object(42)
    inspect_object("hello")
    inspect_object([1, 2, 3])
    inspect_object(True)

    print("\n=== are_same ===")
    a = [1, 2, 3]
    b = [1, 2, 3]
    c = a
    are_same(a, b)
    are_same(a, c)

    print("\n=== type_chain ===")
    print(type_chain(True))     # ['bool', 'int', 'object']
    print(type_chain(42))       # ['int', 'object']
    print(type_chain([]))       # ['list', 'object']

    print("\n=== is_interned_int ===")
    for n in [-6, -5, 0, 100, 256, 257, 1000]:
        print(f"  {n}: interned = {is_interned_int(n)}")

    print("\n=== trace_binding ===")
    trace_binding()
```

---

## Hints

<details>
<summary>Hint 1: sys.getrefcount adjustment</summary>

`sys.getrefcount(obj)` always returns one more than the "real" count because passing `obj` as an argument creates a temporary reference. Subtract 1 before printing.

</details>

<details>
<summary>Hint 2: is_interned_int</summary>

The trick is that `int(n)` might return the cached object for small values. Use a different approach: construct the integer value through an expression that forces object creation, then use `is` to compare. Try `n + 0` as an identity-breaking operation... but wait, does it actually break identity for small ints? Run it and see.

</details>

<details>
<summary>Hint 3: type_chain using __mro__</summary>

`type(obj).__mro__` returns a tuple of class objects. Use a list comprehension to get their names via `cls.__name__`.

</details>

---

## What to Verify

- [ ] `inspect_object(True)` shows type as `bool`, not `int`
- [ ] `are_same([1,2,3], [1,2,3])` correctly returns `False` (different objects)
- [ ] `type_chain(True)` includes both `bool` and `int` in the chain
- [ ] `is_interned_int(256)` returns `True`, `is_interned_int(257)` returns `False`
- [ ] `trace_binding()` clearly shows that rebinding one name does not affect another
