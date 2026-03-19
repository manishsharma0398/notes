"""
Chapter 02 - Example 01: id() and object identity
"""
x = [1, 2, 3]
y = x          # alias — same object
z = [1, 2, 3]  # new object — same value, different identity

print(f"id(x) = {id(x)}")
print(f"id(y) = {id(y)}")
print(f"id(z) = {id(z)}")
print(f"x is y: {x is y}")   # True — same object
print(f"x is z: {x is z}")   # False — different objects
print(f"x == z: {x == z}")   # True — same value

# id() reuse after GC
a = [99, 100]
addr = id(a)
del a           # delete the name — refcount drops to 0 if no other refs
b = [99, 100]   # new allocation — may reuse the same address
print(f"Address reused: {id(b) == addr}")  # often True in CPython


"""
Chapter 02 - Example 02: is vs == in detail
"""
# None — always use `is` for None checks
x = None
print(x is None)     # True  — correct idiom
print(x == None)     # True  — works but triggers __eq__, not idiomatic

# Booleans — singletons
print(True is True)  # True  — always, True is a singleton
print(False is False) # True  — always

# Strings — interning applies to identifier-like strings
a = "hello"
b = "hello"
print(a is b)        # True in CPython (interned at compile time)

a = "hello world!"
b = "hello world!"
print(a is b)        # True if in same module/code block, False otherwise — UNPREDICTABLE

# Integers — cache range
x = 256; y = 256
print(f"256 is 256: {x is y}")   # True in all CPython (within cache)

x = 1024; y = 1024
print(f"1024 is 1024: {x is y}") # True in CPython 3.12+ (expanded cache)

x = 1025; y = 1025
print(f"1025 is 1025: {x is y}") # False — outside cache range


"""
Chapter 02 - Example 03: type() vs isinstance()
"""
class Animal: pass
class Dog(Animal): pass

d = Dog()

print(type(d))             # <class '__main__.Dog'>
print(type(d) is Dog)      # True
print(type(d) is Animal)   # False — type() does NOT check inheritance

print(isinstance(d, Dog))     # True
print(isinstance(d, Animal))  # True  — checks full inheritance chain
print(isinstance(d, object))  # True  — everything is an object

# Multiple types check
x = 42
print(isinstance(x, (int, str)))   # True — isinstance accepts a tuple of types


"""
Chapter 02 - Example 04: Everything is an object — even types
"""
print(type(42))         # <class 'int'>
print(type(int))        # <class 'type'>    — int is an instance of type
print(type(type))       # <class 'type'>    — type is its own type
print(type(object))     # <class 'type'>    — object is an instance of type

# The metaclass loop
print(isinstance(int, type))       # True — int is an instance of type
print(isinstance(type, type))      # True — type is an instance of itself
print(isinstance(object, type))    # True
print(issubclass(type, object))    # True — type inherits from object
print(issubclass(object, type))    # False — object does NOT inherit from type


"""
Chapter 02 - Example 05: __dict__ — objects as namespaces
"""
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(3, 4)
print(p.__dict__)         # {'x': 3, 'y': 4}

p.z = 10                  # add attribute at runtime — works!
print(p.__dict__)         # {'x': 3, 'y': 4, 'z': 10}

# Built-in types don't have __dict__ on instances
try:
    (42).__dict__
except AttributeError as e:
    print(f"int has no __dict__: {e}")

# But the type itself does
print(type(int.__dict__))   # <class 'mappingproxy'>
print('bit_length' in int.__dict__)  # True


"""
Chapter 02 - Example 06: Functions are objects
"""
def add(a, b):
    return a + b

print(type(add))              # <class 'function'>
print(add.__name__)           # 'add'
print(add.__code__.co_varnames)  # ('a', 'b')
print(add.__defaults__)       # None (no defaults)

# Functions can be stored, passed, and assigned
operations = [add, max, min]
print(operations[0](3, 4))   # 7


"""
Chapter 02 - Example 07: Creating a class dynamically with type()
"""
# type(name, bases, namespace) creates a class
Person = type(
    "Person",              # class name
    (object,),             # base classes
    {                      # class body (methods and attributes)
        "species": "Homo sapiens",
        "__init__": lambda self, name: setattr(self, "name", name),
        "greet": lambda self: f"Hi, I am {self.name}",
    }
)

p = Person("Alice")
print(p.greet())           # "Hi, I am Alice"
print(Person.species)      # "Homo sapiens"
print(type(Person))        # <class 'type'>  — Person was created by type

# This is EXACTLY what 'class Person: ...' does internally
