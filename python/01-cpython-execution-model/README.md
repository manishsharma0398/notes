# Chapter 01 — CPython Execution Model

> **Goal**: Understand precisely how Python code runs — from the source file you write
> to the machine instructions that execute. And why this is fundamentally different from V8.

---

## The Big Picture — JS vs Python Runtime

```
JavaScript (V8):
  Source (.js)
    → Parse → AST
    → Ignition (bytecode interpreter)
    → Sparkplug (baseline JIT)
    → Maglev / TurboFan (optimizing JIT)
    → Native machine code

Python (CPython 3.12 and earlier):
  Source (.py)
    → Parse → AST
    → Compile → Bytecode (.pyc)
    → CPython interpreter loop (eval loop)
    → (No JIT — pure interpretation)

Python (CPython 3.13+):
  Source (.py)
    → Parse → AST
    → Compile → Bytecode (.pyc)
    → CPython interpreter loop (eval loop)
    → Optimizer (traces hot bytecode segments)
    → Experimental copy-and-patch JIT (disabled by default, built with --enable-experimental-jit)
```

**The critical difference**: V8 has a mature, always-on, multi-tier JIT that compiles hot code
to native machine code automatically. CPython 3.13+ introduced an **experimental** JIT
(copy-and-patch style — see `Python/jit.c` in the source, guarded by `#ifdef _Py_JIT`),
but it is **not enabled by default** and is far less mature than V8's JIT.

For practical purposes in production: **CPython does not JIT your code by default.**
The bytecode interpreter loop is what runs your Python.

> **Source verification**: `Python/jit.c` in this CPython repo opens with `#ifdef _Py_JIT` —
> the entire JIT is compile-time optional. `Python/optimizer.c` handles the tier-2 optimizer
> that feeds the JIT when enabled.

---

## Stage 1 — Source to AST

When you run `python script.py`, CPython first **parses** the source code into an
Abstract Syntax Tree (AST).

```python
import ast

source = """
x = 1 + 2
print(x)
"""

tree = ast.parse(source)
print(ast.dump(tree, indent=2))
```

Output (simplified):

```
Module(
  body=[
    Assign(
      targets=[Name(id='x')],
      value=BinOp(
        left=Constant(value=1),
        op=Add(),
        right=Constant(value=2)
      )
    ),
    Expr(
      value=Call(
        func=Name(id='print'),
        args=[Name(id='x')]
      )
    )
  ]
)
```

The AST describes the structure of your code as a tree of nodes — not its meaning or
how it runs, just its syntactic structure.

**JS mental model**: V8 also parses to an AST. This stage is identical in concept.

---

## Stage 2 — AST to Bytecode

CPython compiles the AST into **bytecode** — a sequence of instructions for the CPython
virtual machine. This is NOT machine code. It runs on a virtual machine (the eval loop).

```python
import dis

def add(a, b):
    return a + b

dis.dis(add)
```

Output:

```
  2           0 RESUME          0

  3           2 LOAD_FAST       0 (a)
              4 LOAD_FAST       1 (b)
              6 BINARY_OP      0 (+)
             10 RETURN_VALUE
```

Each line is one **bytecode instruction**:

- `LOAD_FAST 0` — push local variable `a` onto the value stack
- `LOAD_FAST 1` — push local variable `b` onto the value stack
- `BINARY_OP 0 (+)` — pop two values, add them, push result
- `RETURN_VALUE` — pop top of stack and return it

**JS mental model trap**: V8's bytecode is similar in concept, but V8 also has a JIT
that watches hot code and compiles it to native machine code. CPython has no such step.
Bytecode is the final form CPython runs.

---

## Stage 3 — The Eval Loop (ceval.c)

The bytecode is executed by the **CPython eval loop** — a giant `switch` statement in
the C file `Python/ceval.c`. It's a loop that:

1. Reads the next bytecode instruction
2. Dispatches to the corresponding C code block
3. Executes it
4. Repeats

```
While True:
  opcode = next instruction in bytecode
  switch(opcode):
    case LOAD_FAST:   push locals[arg] onto stack
    case BINARY_OP:   pop two, compute, push result
    case CALL:        set up new frame, enter nested eval loop
    case RETURN_VALUE: pop result, exit current frame
    ...
```

This loop runs for **every single instruction** of your program. No shortcuts, no
compilation to machine code. Every `+`, every function call, every attribute lookup
goes through this switch statement.

```
ASCII Diagram — The Eval Loop:

  Python source
       │
       ▼
  [ Parser ]  ──►  AST
       │
       ▼
  [ Compiler ]  ──►  Bytecode (stored in code objects)
       │
       ▼
  [ CPython Eval Loop ]  ──►  (runs forever, one instruction at a time)
       │
       ▼
  Result / side effects
```

---

## Code Objects — What Actually Gets Compiled

Every function, class body, and module compiles into a **code object** (`types.CodeType`).
A code object contains:

- The bytecode instructions
- Constants used (numbers, strings)
- Names of variables and attributes
- Information for the debugger (line numbers)

```python
def greet(name):
    return f"Hello, {name}"

code = greet.__code__
print(code.co_code)        # raw bytecode bytes
print(code.co_varnames)    # ('name',) — local variable names
print(code.co_consts)      # (None, 'Hello, ') — constants
print(code.co_filename)    # the source file
print(code.co_firstlineno) # line number where function starts
```

**JS mental model**: V8 has a similar concept in `SharedFunctionInfo` + `BytecodeArray`,
but it's internal and not easily inspectable. Python's `__code__` is a first-class
object — you can inspect, serialize, and even modify it.

---

## Frame Objects — The Call Stack in Python

When a function is called, CPython creates a **frame object** — the execution context
for that call. A frame holds:

- The code object being executed
- The current instruction pointer
- The local variable bindings
- The value stack (where intermediate results live)

```python
import sys

def inner():
    frame = sys._getframe()
    print(f"Function:  {frame.f_code.co_name}")
    print(f"File:      {frame.f_code.co_filename}")
    print(f"Line:      {frame.f_lineno}")
    print(f"Locals:    {frame.f_locals}")

def outer():
    x = 42
    inner()

outer()
```

Frames are chained together to form the **call stack**. When a function returns, its
frame is discarded.

```
Call Stack (frames chained):

  [ module frame ]
       │
       ▼
  [ outer() frame ]  →  locals: {x: 42}
       │
       ▼
  [ inner() frame ]  →  locals: {frame: <frame object>}
```

**JS mental model**: This is exactly the JS call stack. V8's frames are the same concept.
But in JS you can't inspect frames directly at runtime (without DevTools). In Python,
`sys._getframe()` gives you direct access to the live frame object.

---

## `.pyc` Files — Bytecode Caching

CPython caches the compiled bytecode in `.pyc` files inside `__pycache__/`:

```
my_module.py
__pycache__/
    my_module.cpython-311.pyc
```

On subsequent imports, if `.py` hasn't changed (checked by timestamp + size),
CPython loads the `.pyc` directly — skipping parsing and compilation.

**JS mental model**: JavaScript has no equivalent. Node.js parses and compiles JS on
every startup (or uses V8's code cache, which is more opaque and less universal).

```python
import marshal, dis

# Read bytecode from a .pyc file manually
with open("__pycache__/my_module.cpython-311.pyc", "rb") as f:
    f.read(16)              # skip magic number + timestamp header
    code = marshal.load(f)  # deserialize the code object
    dis.dis(code)           # disassemble it
```

---

## Why CPython is Slow — The Real Reason

Every Python operation that looks "simple" is expensive under CPython:

```python
x = a + b
```

What CPython actually does:

1. `LOAD_FAST` — look up `a` in the frame's locals dict
2. `LOAD_FAST` — look up `b` in the frame's locals dict
3. `BINARY_OP` — call `a.__add__(b)` via the C API
   - This involves: type check on `a`, type dispatch, calling CPython's `type->tp_as_number->nb_add`, allocating a new int object, reference counting
     > **Source**: `Include/internal/pycore_runtime_structs.h`:
     >
     > ```c
     > #define _PY_NSMALLNEGINTS  5     // cache from -5 to ...
     > #define _PY_NSMALLPOSINTS  1025  // ... up to 1024 (exclusive upper bound is 1025)
     > ```
     >
     > Combined: CPython caches integers in the range **-5 to 1024** inclusive.
     > The commonly cited "−5 to 256" range is **outdated** — it was true in Python 3.11 and earlier.
     > Python 3.12+ expanded the cache to 1024.

   This means:

   ```python
   x = 1000
   y = 1000
   print(x is y)   # True in Python 3.12+ — 1000 is now in the cache!

   x = 1025
   y = 1025
   print(x is y)   # False — outside the expanded cache range
   ```

   **The rule remains the same**: Never use `is` for value comparison. The cache range is
   an implementation detail that can change between versions.

4. `STORE_FAST` — store result back into locals

**For JS**:

```js
let x = a + b;
// V8 sees this loop is hot, infers types, emits: mov rax, [a]; add rax, [b]
// Literally 2 native instructions after JIT
```

CPython cannot do this because:

- Python is dynamically typed at runtime — `a` could be `int`, `float`, `Decimal`, anything
- CPython can't eliminate the type dispatch without a JIT
- Every `+` is a Python-level object method call

---

## Checking Python Version and Implementation

```python
import sys
import platform

print(sys.version)         # '3.11.5 (main, ...)'
print(sys.implementation)  # namespace(name='cpython', ...)
print(platform.python_implementation())  # 'CPython'
```

If you're running on PyPy:

```
platform.python_implementation() → 'PyPy'
```

---

## ASCII Diagram — Full CPython Pipeline

```
  script.py
      │
      ▼  (tokenizer → parser)
  [ AST ]
      │
      ▼  (compiler)
  [ Code Object ]
  ┌───────────────────────┐
  │ co_code: bytecode     │
  │ co_consts: constants  │
  │ co_varnames: locals   │
  │ co_filename: source   │
  └───────────────────────┘
      │
      ▼  (CPython ceval.c)
  [ Eval Loop ]  ←──────── Frame Object
  ┌────────────────┐       ┌─────────────────┐
  │ LOAD_FAST      │       │ f_code → CodeObj│
  │ BINARY_OP      │       │ f_locals → dict │
  │ CALL           │       │ f_lineno → 42   │
  │ RETURN_VALUE   │       │ value stack     │
  └────────────────┘       └─────────────────┘
      │
      ▼
  Result (Python object)
```

---

## Revision Notes → `notes.md`

## Interview Questions → `interview.md`

## Exercises → `exercises/problems.md`
