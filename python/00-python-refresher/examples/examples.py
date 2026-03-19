"""
Chapter 00 - Example 01: Name Binding vs Typed Variables
"""

# In Python, names are just labels. Types live on objects.
x = 10
print(type(x))   # <class 'int'>

x = "hello"
print(type(x))   # <class 'str'>  — same name, different object

x = [1, 2, 3]
print(type(x))   # <class 'list'>


"""
Chapter 00 - Example 02: Aliasing — Two Names, One Object
"""
x = [1, 2, 3]
y = x           # y is NOT a copy — it's another name for the same list

y.append(4)
print(x)        # [1, 2, 3, 4] — x sees the change!

# To make a copy:
z = x.copy()    # shallow copy
z.append(5)
print(x)        # [1, 2, 3, 4] — x unchanged


"""
Chapter 00 - Example 03: Truthiness Traps
"""
# Python falsy values
falsy = [None, False, 0, 0.0, "", b"", [], (), {}, set()]
for v in falsy:
    print(f"{v!r:15} → {bool(v)}")

# NaN is TRUTHY in Python (unlike JS where NaN is falsy)
import math
print(bool(float('nan')))  # True ← surprises JS developers


"""
Chapter 00 - Example 04: Mutable Default Argument Bug
"""
def broken_add(item, lst=[]):
    lst.append(item)
    return lst

print(broken_add(1))  # [1]
print(broken_add(2))  # [1, 2]  ← NOT what you'd expect from JS!
print(broken_add(3))  # [1, 2, 3]

def fixed_add(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst

print(fixed_add(1))  # [1]
print(fixed_add(2))  # [2]  ← fresh list each time


"""
Chapter 00 - Example 05: for/else — no JS equivalent
"""
def find_first_prime(numbers):
    for n in numbers:
        if n < 2:
            continue
        for factor in range(2, int(n**0.5) + 1):
            if n % factor == 0:
                break
        else:
            # Only runs if inner loop completed without break
            return n   # n is prime
    return None

print(find_first_prime([4, 6, 7, 8, 9]))  # 7


"""
Chapter 00 - Example 06: Type Checking
"""
print(isinstance(True, int))       # True  — bool IS an int
print(type(True) == int)           # False — exact type is bool
print(type(True) == bool)          # True

# isinstance handles inheritance correctly — prefer it
class Animal: pass
class Dog(Animal): pass

d = Dog()
print(isinstance(d, Animal))  # True
print(type(d) == Animal)      # False


"""
Chapter 00 - Example 07: dict.get() vs direct access
"""
d = {"name": "Alice"}

# This raises KeyError — unlike JS which gives undefined
# print(d["missing"])  ← KeyError

print(d.get("missing"))         # None  — safe
print(d.get("missing", "N/A"))  # "N/A" — with default


"""
Chapter 00 - Example 08: Comprehension scope (Python 3)
"""
result = [i for i in range(5)]
# print(i)  ← NameError in Python 3 — i does not leak out

# But regular for loops DO leak:
for j in range(5):
    pass
print(j)  # 4 — loop variable leaks in regular for loops
