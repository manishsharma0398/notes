# Chapter 01 — Notes & JS-vs-Python Cheatsheet

## CPython Pipeline (One-liner Summary)

```
.py → Tokenize → AST → Bytecode (Code Object) → CPython Eval Loop → Result
```

## JS vs CPython Runtime Comparison

| Stage      | V8 (JavaScript)                                         | CPython (Python)                                                                           |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Parse      | Source → AST                                            | Source → AST                                                                               |
| Compile    | AST → bytecode                                          | AST → bytecode                                                                             |
| Execute    | Bytecode → JIT → native machine code (always-on)        | Bytecode → eval loop (interpreted by default)                                              |
| JIT        | Multi-tier, always-on (Ignition → Sparkplug → TurboFan) | Experimental copy-and-patch JIT in 3.13+, **off by default** (`--enable-experimental-jit`) |
| Hot code   | Compiled to native CPU instructions automatically       | Still interpreted unless JIT explicitly enabled                                            |
| Inspection | Internal, not easily accessible                         | `dis`, `ast`, `__code__`, `sys._getframe()`                                                |
| Cache      | V8 code cache (opaque)                                  | `__pycache__/*.pyc` (transparent, inspectable)                                             |

## Key Objects

| Object         | What it is                                                               | How to access     |
| -------------- | ------------------------------------------------------------------------ | ----------------- |
| `code object`  | Compiled bytecode + metadata for one function/module                     | `fn.__code__`     |
| `frame object` | Runtime execution context — local vars, instruction pointer, value stack | `sys._getframe()` |
| `.pyc file`    | Cached bytecode on disk                                                  | `__pycache__/`    |

## Key `code` Object Attributes

```python
fn.__code__.co_name        # function name
fn.__code__.co_varnames    # local variable names (tuple)
fn.__code__.co_consts      # constants (tuple)
fn.__code__.co_argcount    # number of positional args
fn.__code__.co_stacksize   # max depth of value stack
fn.__code__.co_filename    # source file path
fn.__code__.co_firstlineno # first line of function in source
```

## Key Bytecode Instructions

| Instruction         | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `LOAD_FAST`         | Push a local variable onto the value stack      |
| `LOAD_CONST`        | Push a constant onto the value stack            |
| `STORE_FAST`        | Pop stack top, store in local variable          |
| `BINARY_OP`         | Pop two values, apply operator, push result     |
| `CALL`              | Call a function — sets up a new frame           |
| `RETURN_VALUE`      | Pop stack top and return from the current frame |
| `JUMP_FORWARD`      | Unconditional jump in bytecode                  |
| `POP_JUMP_IF_FALSE` | Conditional jump (used for `if`)                |

## Why CPython is Slow — The 3-Line Answer

1. No JIT — bytecode is interpreted instruction-by-instruction, always.
2. Every operation is a dynamic dispatch — even `a + b` calls `a.__add__(b)` via C API.
3. Every Python object is heap-allocated with reference counting overhead.

## Performance Implication

- **Built-in functions** (`sum`, `len`, `sorted`, `map`) run in C — bypass the eval loop.
- **List comprehensions** are faster than `for` loops for the same reason — the inner loop runs in C.
- Use NumPy/Pandas for numerical work — they bypass CPython's eval loop with C extensions.
