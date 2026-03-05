# Chapter 01 — Exercise Answers

⚠️ **Only open this after you have attempted all problems in `problems.md`.**

---

## Exercise 1 — Answer

```
  2           0 RESUME          0

  3           2 LOAD_FAST       0 (x)
              4 LOAD_FAST       1 (y)
              6 BINARY_OP      5 (*)
             10 STORE_FAST      2 (result)

  4          12 LOAD_FAST       2 (result)
             14 RETURN_VALUE
```

Walkthrough:

- `LOAD_FAST 0 (x)` — push local `x` onto the value stack
- `LOAD_FAST 1 (y)` — push local `y` onto the value stack
- `BINARY_OP 5 (*)` — pop `x` and `y`, multiply, push result
- `STORE_FAST 2 (result)` — pop result, store as local `result`
- `LOAD_FAST 2 (result)` — push `result` back onto stack
- `RETURN_VALUE` — pop and return

Note: the simpler `return x * y` would skip `STORE_FAST` + `LOAD_FAST` — the compiler does **not** optimize across these two forms automatically in CPython.

---

## Exercise 2 — Answer

```python
print(add5.__code__.co_name)       # 'adder'
print(add5.__code__.co_varnames)   # ('x',)     — local variables
print(add5.__code__.co_freevars)   # ('n',)     — closed-over variables
```

**Key insight**: `co_freevars` contains `n` — the variable from the enclosing `make_adder` scope that `adder` closes over.

- `co_varnames` = locals defined **inside** the function
- `co_freevars` = names referenced from an **enclosing** scope (closure variables)

The value of `n` is not in the code object — it's stored in `add5.__closure__`:

```python
print(add5.__closure__)            # (<cell contents: 5>,)
print(add5.__closure__[0].cell_contents)  # 5
```

This is how closures are implemented in CPython — a `cell` object holds the shared binding.

---

## Exercise 3 — Answer

The junior developer's explanation is incomplete. Three precise technical reasons CPython is slower than V8:

1. **No JIT compiler**: CPython interprets every bytecode instruction through `ceval.c`'s switch statement on every execution — even if the same code runs a million times. V8 detects hot code and compiles it to native CPU instructions, eliminating the interpreter overhead entirely.

2. **Dynamic dispatch on every operation**: In CPython, `a + b` cannot be compiled to a native `ADD` instruction because Python doesn't know the types of `a` and `b` at compile time. Every `+` calls `a.__add__(b)` through CPython's C API — a type lookup + C function call per operation. V8 profiles types and specializes operations for known types.

3. **Object allocation and reference counting overhead**: Every Python value (including small integers outside -5–256 range) is a heap-allocated object with a reference count. Each assignment increments a ref count; each name going out of scope decrements it. This is constant overhead on every operation. V8 uses unboxed representations for primitives in JIT-compiled code.

"Interpreted language" is too vague — PyPy is also Python and is 5–10x faster than CPython for many workloads precisely because it has a JIT.

---

## Exercise 4 — Answer

```python
x = 1000
y = 1000
print(x is y)   # True in CPython 3.12+ — 1000 IS in the expanded cache!

a = 1025
b = 1025
print(a is b)   # False — outside the cache range
```

**Why**: CPython caches integer objects. The range is implementation-defined and version-dependent:

- CPython ≤3.11: **-5 to 256** inclusive
- CPython 3.12+: **-5 to 1024** inclusive

Source (`Include/internal/pycore_runtime_structs.h` in this repo):

```c
#define _PY_NSMALLNEGINTS  5     // negative: -5 to -1
#define _PY_NSMALLPOSINTS  1025  // positive: 0 to 1024 (exclusive upper bound)
```

**Critical implication**: **Never use `is` to compare integers** (or any values). The cache
range is a CPython implementation detail — not guaranteed by the Python spec, and it changes
between versions (as it just did from 256 to 1024).

```python
# WRONG (works "by accident" for small ints)
if x is 5:  ...

# RIGHT
if x == 5:  ...
```

---

## Exercise 5 — Answer

```python
import dis, sys

def add(a, b):
    return a + b

# 1. Disassemble
print("=== Bytecode ===")
dis.dis(add)

# 2. Code object attributes
print(f"\nco_varnames: {add.__code__.co_varnames}")  # ('a', 'b')
print(f"co_consts:   {add.__code__.co_consts}")     # (None,)

# 3. Frame inspection — wrap add to capture the caller
def caller():
    def add_with_frame(a, b):
        frame = sys._getframe()
        caller_name = frame.f_back.f_code.co_name
        print(f"\nCaller of add: {caller_name}")
        return a + b
    return add_with_frame(3, 4)

caller()  # Caller of add: caller
```

**JS comparison**: In JavaScript you cannot inspect bytecode or frames from within user code (outside DevTools). Python exposes these as first-class objects — a major advantage for metaprogramming and introspection.

---

## Exercise 6 — Answer

**First import of `my_module`:**

1. Python checks `sys.modules` — not found.
2. Python finds the `.py` file on `sys.path`.
3. The file is tokenized and parsed into an AST.
4. The AST is compiled into a code object (bytecode).
5. The bytecode is cached as `__pycache__/my_module.cpython-XY.pyc`.
6. A new module object is created and added to `sys.modules`.
7. The module's code object is executed in the module's namespace — this runs all top-level statements and defines all functions/classes.

**Second import (same process):**

1. Python checks `sys.modules` — **found**.
2. Returns the cached module object immediately.
3. No file reading, no parsing, no compilation, no execution.

**Why the second import is instant**: `sys.modules` is a dict. The lookup is O(1). The entire module object (with all its functions and state) is already in memory. This is why `import` in Python is cheap after the first time — it's just a dict lookup.

Note: even the `.pyc` file is only read on the **first import of a new Python process**. Within a running process, it's always `sys.modules`.
