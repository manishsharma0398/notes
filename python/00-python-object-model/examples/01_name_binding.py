"""
Example 01 — Name binding vs value storage

Run this and read the output carefully.
Compare id() values to understand what 'same object' means.
"""

# --- 1. Two names, one object ---
x = 42
y = x

print(f"x = {x}, id(x) = {id(x)}")
print(f"y = {y}, id(y) = {id(y)}")
print(f"x is y: {x is y}")   # True — same object (int cache)
print()

# --- 2. Rebinding x does NOT affect y ---
x = 100
print(f"After x = 100:")
print(f"x = {x}, id(x) = {id(x)}")
print(f"y = {y}, id(y) = {id(y)}")
print(f"x is y: {x is y}")   # False — x was rebound
print()

# --- 3. Lists: two names, one mutable object ---
a = [1, 2, 3]
b = a               # b is bound to the SAME list object

print(f"a = {a}, id(a) = {id(a)}")
print(f"b = {b}, id(b) = {id(b)}")
print(f"a is b: {a is b}")   # True
print()

b.append(4)         # mutates the object both names point to
print(f"After b.append(4):")
print(f"a = {a}")   # [1, 2, 3, 4] — a sees the change too
print(f"b = {b}")   # [1, 2, 3, 4]
print()

# --- 4. b = [...] rebinds b, does NOT affect a ---
b = [1, 2, 3, 4, 5]
print(f"After b = [1, 2, 3, 4, 5]:")
print(f"a = {a}")   # [1, 2, 3, 4] — unchanged
print(f"b = {b}")   # [1, 2, 3, 4, 5] — new object
print(f"a is b: {a is b}")   # False
