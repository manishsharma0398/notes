"""
Example 02 — id(), type(), isinstance(), is vs ==

Explore object identity, type checking, and the integer cache.
"""
import sys

# --- 1. id() is the memory address ---
x = "hello"
print(f"id(x) = {id(x)}")
print(f"hex:   {hex(id(x))}")
print()

# --- 2. type() vs isinstance() ---
print(type(42))           # <class 'int'>
print(type(True))         # <class 'bool'>
print(type(True) == int)  # False — bool is not int exactly
print(isinstance(True, int))   # True — bool IS a subclass of int
print(isinstance(True, bool))  # True
print()

# --- 3. Types are objects ---
print(type(int))          # <class 'type'>
print(type(type))         # <class 'type'> — type is its own type
print(isinstance(int, type))   # True — int is an instance of type
print()

# --- 4. is vs == ---
a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(f"a == b: {a == b}")   # True  — equal value
print(f"a is b: {a is b}")   # False — different objects
print(f"a is c: {a is c}")   # True  — same object
print()

# --- 5. Integer cache (-5 to 256) ---
x = 256
y = 256
print(f"256: x is y = {x is y}")   # True  — cached

x = 257
y = 257
print(f"257: x is y = {x is y}")   # False — not cached (usually)
print()

# --- 6. Reference counting ---
lst = []
print(f"refcount of lst: {sys.getrefcount(lst)}")   # 2 (lst + getrefcount arg)

other = lst
print(f"after other = lst: {sys.getrefcount(lst)}")  # 3

del other
print(f"after del other: {sys.getrefcount(lst)}")    # 2 again
print()

# --- 7. None is a singleton ---
a = None
b = None
print(f"a is b (both None): {a is b}")   # True — always
print(f"id(None): {id(None)}")
