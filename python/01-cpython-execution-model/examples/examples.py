"""
Chapter 01 - Example 01: Inspecting bytecode with dis
"""
import dis

def add(a, b):
    return a + b

print("=== Simple add function ===")
dis.dis(add)

# ──────────────────────────────────────────────────

def loop_sum(n):
    total = 0
    for i in range(n):
        total += i
    return total

print("\n=== Loop with accumulator ===")
dis.dis(loop_sum)


"""
Chapter 01 - Example 02: Inspecting AST
"""
import ast

source = """
x = 1 + 2
if x > 2:
    print(x)
"""

tree = ast.parse(source)
print("\n=== AST dump ===")
print(ast.dump(tree, indent=2))


"""
Chapter 01 - Example 03: Code objects — what gets compiled
"""
def greet(name):
    return f"Hello, {name}"

code = greet.__code__
print("\n=== Code object attributes ===")
print(f"co_name:      {code.co_name}")
print(f"co_varnames:  {code.co_varnames}")   # local variable names
print(f"co_consts:    {code.co_consts}")     # constants
print(f"co_argcount:  {code.co_argcount}")   # number of arguments
print(f"co_stacksize: {code.co_stacksize}")  # max value stack depth needed
print(f"co_filename:  {code.co_filename}")


"""
Chapter 01 - Example 04: Frame objects — live call stack
"""
import sys

def show_frame():
    frame = sys._getframe()
    print(f"\nFunction:  {frame.f_code.co_name}")
    print(f"File:      {frame.f_code.co_filename}")
    print(f"Line:      {frame.f_lineno}")
    print(f"Locals:    {frame.f_locals}")

    # Walk up the call stack
    caller = frame.f_back
    if caller:
        print(f"Caller:    {caller.f_code.co_name}")

def calling_function():
    x = 99
    show_frame()

calling_function()


"""
Chapter 01 - Example 05: .pyc bytecode caching
"""
import importlib, sys

# When you import a module, Python compiles it and caches the bytecode
# in __pycache__/<module>.cpython-<version>.pyc
# You can see this by checking __pycache__ after importing any module.

# Python version info
print(f"\nPython version:        {sys.version}")
print(f"Implementation:        {sys.implementation.name}")
print(f"Is CPython:            {sys.implementation.name == 'cpython'}")
# → CPython: True
# → PyPy:    False


"""
Chapter 01 - Example 06: Measuring the bytecode interpretation cost
"""
import timeit

# Pure Python loop — every iteration goes through the eval loop
python_loop = timeit.timeit(
    "total = sum(range(1_000_000))",
    number=10
)
print(f"\nPython sum(range(1M)) x10: {python_loop:.3f}s")

# The same loop in a C builtin — bypasses the Python eval loop entirely
# sum() is implemented in C, so it runs native code, not interpreted bytecode
# This is why builtins are much faster than equivalent Python code
