# Chapter 01 — Interview Questions

## Q1: How does CPython execute Python code? Walk me through the pipeline.

**Expected answer** (in order):

1. **Tokenize** — the source is broken into tokens (keywords, identifiers, operators).
2. **Parse** → **AST** — tokens are parsed into an Abstract Syntax Tree representing the code's structure.
3. **Compile** → **Code Object** — the AST is compiled into a code object containing bytecode instructions and metadata (constants, variable names, etc.).
4. **Eval Loop** — the `ceval.c` eval loop reads each bytecode instruction and dispatches to the corresponding C implementation.
5. There is **no JIT** — bytecode is interpreted directly forever.

**JS trap**: V8 takes this further — it profiles hot functions and JIT-compiles them to native machine code. CPython never does this. That's the core performance difference.

---

## Q2: What is a code object in Python? What does it contain?

**Expected answer:**
A code object (`types.CodeType`) is the compiled, immutable representation of a block of code (function, class body, module). It contains:

- `co_code` — the bytecode bytes
- `co_consts` — constants referenced in the code
- `co_varnames` — local variable names
- `co_argcount` — number of positional arguments
- `co_filename` — source file
- `co_firstlineno` — starting line number

Accessible via `fn.__code__`. Every function has one. Code objects are created at compile time, not at call time.

**Follow-up**: _What's the difference between a code object and a function object?_
A code object is just bytecode + metadata. A function object (`types.FunctionType`) wraps a code object and adds a closure (reference to enclosing scope), default argument values, and the global namespace it runs in.

---

## Q3: What is a frame object? When is it created and destroyed?

**Expected answer:**
A frame object is the runtime execution context for a single function call. It contains:

- A reference to the code object being executed
- The current instruction pointer
- The local variable bindings
- The value stack (where intermediate expression results live)

A frame is created each time a function is **called** and destroyed when the function **returns**. Frames are chained — each frame has a `f_back` pointer to the calling frame, forming the call stack.

Accessible at runtime via `sys._getframe()` or from exceptions via `tb.tb_frame`.

---

## Q4: Why is CPython slow compared to V8 for CPU-bound work?

**Expected answer** (three real reasons):

1. **No JIT compiler** — every bytecode instruction is interpreted through the C `switch` statement in `ceval.c`. V8 JIT-compiles hot code to native CPU instructions.
2. **Dynamic dispatch on every operation** — even `a + b` requires a type lookup and calling `a.__add__(b)` through CPython's C API. V8 can specialize `+` for known types after profiling.
3. **Object overhead** — every Python value is a heap-allocated object with reference counting. Small integers are cached (-5 to 256), but anything else allocates. V8 can use unboxed values for primitives.

**Never acceptable answer**: "Python is a scripting language" or "Python is interpreted" — these don't explain the mechanism.

---

## Q5: What is `__pycache__` and what's in a `.pyc` file?

**Expected answer:**
`__pycache__` contains cached compiled bytecode. When you import a module, CPython:

1. Checks if a `.pyc` file exists for the current Python version
2. Checks if the `.py` source file has changed (by comparing timestamp + size)
3. If unchanged, loads the `.pyc` directly — skipping tokenization, parsing, and compilation

A `.pyc` file contains:

- A magic number (identifies Python version)
- A timestamp + file size (for invalidation)
- The serialized code object (via `marshal` module)

**JS trap**: Node.js has no `.pyc` equivalent that's transparent to the user. V8 has an internal code cache but it's not user-visible or easily inspectable. Python's approach is explicit and inspectable — `marshal.load()` can read a `.pyc` directly.
