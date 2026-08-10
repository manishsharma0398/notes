# Cumulative Exercise — Python Object Debugger CLI

## Project Brief

Build a command-line tool called `pyobj` that lets you interactively inspect Python objects and diagnose identity/equality bugs.

This is Chapter 0 only — so the cumulative and chapter exercises are the same scope here. As you complete more chapters, future cumulative exercises will layer on top of this.

---

## What You're Building

```
$ python pyobj.py
pyobj> inspect 42
  value   : 42
  type    : int
  id      : 0x7f3c1a2b3d40
  refcount: 1

pyobj> inspect "hello world"
  value   : 'hello world'
  type    : str
  id      : 0x7f3c1a2b4e50
  refcount: 1

pyobj> chain bool
  MRO: bool → int → object

pyobj> interned 256
  256 is in the integer cache (CPython small int)

pyobj> interned 257
  257 is NOT in the integer cache

pyobj> exit
```

---

## Phases

### Phase 1 — `inspect` command
- Parse user input: `inspect <expression>`
- `eval()` the expression in a safe local dict
- Print: value (`repr`), type, id (hex), refcount (adjusted)
- Handle `eval()` errors gracefully with a clear message

**Success criteria:**
- [ ] `inspect 42` prints correct type, id, refcount
- [ ] `inspect [1,2,3]` works
- [ ] `inspect True` shows type as `bool`
- [ ] Invalid expressions print an error, not a traceback

### Phase 2 — `chain` command
- Parse: `chain <type_name>`
- Look up the type by name (use a dict of builtins: `int`, `str`, `list`, `bool`, `dict`, `float`)
- Print the MRO as `TypeA → TypeB → TypeC`

**Success criteria:**
- [ ] `chain bool` prints `bool → int → object`
- [ ] `chain list` prints `list → object`
- [ ] Unknown type name prints a clear error

### Phase 3 — `interned` command
- Parse: `interned <integer>`
- Check if the integer is in CPython's small int cache
- Print whether it is cached or not

**Success criteria:**
- [ ] Values -5 to 256 are detected as cached
- [ ] Values outside this range are detected as not cached
- [ ] Non-integer input prints a clear error

### Phase 4 — REPL loop
- Wrap everything in a `while True` loop with a `pyobj> ` prompt
- `exit` or `quit` exits cleanly
- `Ctrl+C` prints a message and exits gracefully (handle `KeyboardInterrupt`)

**Success criteria:**
- [ ] The REPL runs until `exit` or `quit`
- [ ] `Ctrl+C` does not crash with a traceback
- [ ] Unknown commands print `Unknown command: <cmd>`

---

## Constraints

- No external libraries — standard library only (`sys`, `builtins`)
- Do not use `exec()` for the `inspect` command — use `eval()` with a controlled namespace
- All output must be readable and clearly labelled

---

## What Makes a Strong Solution

- Clean separation between parsing, evaluation, and output
- Sensible error messages that don't expose raw Python tracebacks to the user
- The `inspect` command works for any valid Python literal or expression, not just simple values
