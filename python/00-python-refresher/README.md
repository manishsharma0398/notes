# Chapter 00 — Python Refresher

> **Goal**: Calibrate your JS instincts to Python. Not beginner material — this is a fast,
> precise mapping of Python fundamentals for a developer who already thinks in JavaScript.

---

## 1. Variables — Name Bindings, Not Typed Containers

### JS mental model trap

In JS, `const`/`let`/`var` declare a _slot_ in memory with optional type constraints.

```js
// JavaScript
let x = 10;
const name = "Alice";
```

```python
# Python
x = 10
name = "Alice"
```

**Looks the same. Behaves differently.**

In Python, `x = 10` does NOT declare a variable. It:

1. Creates an `int` object with value `10` in memory.
2. **Binds** the name `x` to that object.

There is no `const`, no `let`, no `var`. Every name is just a label that can be rebound to any object at any time.

```python
x = 10       # x → int(10)
x = "hello"  # x → str("hello"), the int object may be GC'd
x = [1, 2]   # x → list([1,2])
```

This is legal. Python will not complain. **The type lives on the object, not the name.**

```
Memory:
  x ──────────────► [list object: 1, 2]
                     (type=list, refcount=1)
```

**Interview trap**: "Are Python variables typed?" — No. Names are untyped. Objects are typed.

---

## 2. Built-in Data Types

| Python Type | JS Equivalent           | Key Difference                                       |
| ----------- | ----------------------- | ---------------------------------------------------- |
| `int`       | `number`                | Arbitrary precision — no overflow                    |
| `float`     | `number`                | IEEE 754 double, same as JS                          |
| `bool`      | `boolean`               | **Subclass of `int`** — `True == 1`, `False == 0`    |
| `str`       | `string`                | Immutable, full Unicode (UTF-8 internally)           |
| `bytes`     | `Buffer` / `Uint8Array` | Raw bytes, not a string                              |
| `list`      | `Array`                 | Mutable, ordered, heterogeneous                      |
| `tuple`     | (no equivalent)         | Immutable list — use for fixed data                  |
| `dict`      | `Object` / `Map`        | Ordered (since Python 3.7), keys can be any hashable |
| `set`       | `Set`                   | Unordered, unique values, mutable                    |
| `frozenset` | (no equivalent)         | Immutable set — can be used as dict key              |
| `None`      | `null`                  | **No `undefined` in Python**                         |

### `int` — Arbitrary Precision

```js
// JavaScript
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991
9007199254740991 + 1 === 9007199254740992; // false — precision lost
```

```python
# Python
x = 9007199254740991 + 1
print(x)  # 9007199254740992 — perfectly correct, always
```

Python `int` never overflows. It allocates more memory as needed.

### `bool` is a subclass of `int`

```python
print(True + True)   # 2
print(True * 5)      # 5
print(isinstance(True, int))  # True
```

This shocks JS developers. In Python, `True` literally IS `1` and `False` IS `0`.

### `tuple` — The Immutable List

```js
// JavaScript — no direct equivalent. Closest is Object.freeze([1, 2, 3])
const t = Object.freeze([1, 2, 3]);
```

```python
# Python
t = (1, 2, 3)
t[0] = 99  # TypeError: 'tuple' object does not support item assignment
```

Tuples are used for fixed-size, heterogeneous data (e.g., a `(name, age)` record).
They are faster than lists and can be used as dictionary keys (because they're hashable).

### `None` — No `undefined`

```js
// JavaScript
let x; // x is undefined
let y = null; // y is null
```

```python
# Python
x = None   # the only "nothing" value in Python
# There is NO undefined in Python. Accessing an unbound name raises NameError.
```

```python
x  # NameError: name 'x' is not defined
```

---

## 3. Type Checking — `type()` vs `isinstance()`

### JS mental model trap

```js
// JavaScript
typeof 42; // "number"
typeof "hello"; // "string"
typeof null; // "object"  ← famous bug
typeof []; // "object"  ← useless
```

```python
# Python
type(42)         # <class 'int'>
type("hello")    # <class 'str'>
type(None)       # <class 'NoneType'>
type([])         # <class 'list'>
```

`type()` returns the **exact** class. It does NOT traverse the inheritance chain.

```python
isinstance(True, int)    # True  — because bool inherits from int
type(True) == int        # False — because exact type is bool, not int
```

**Rule**: Prefer `isinstance()` for type checking. Use `type() ==` only when you need exact type match (rare).

---

## 4. Truthiness — Where JS and Python Diverge

| Value           | JS        | Python                                                   |
| --------------- | --------- | -------------------------------------------------------- |
| `0`             | falsy     | falsy                                                    |
| `""`            | falsy     | falsy                                                    |
| `[]`            | **falsy** | **truthy** ⚠️                                            |
| `{}`            | **falsy** | **truthy** ⚠️                                            |
| `null` / `None` | falsy     | falsy                                                    |
| `undefined`     | falsy     | N/A                                                      |
| `"0"`           | truthy    | truthy                                                   |
| `NaN`           | falsy     | N/A (Python uses `float('nan')`, which is **truthy**) ⚠️ |

### The critical JS trap — empty list and dict are TRUTHY in Python:

```js
// JavaScript
if ([]) {
} // NOT executed — [] is falsy in JS
if ({}) {
} // NOT executed — {} is falsy in JS
```

```python
# Python
if []:  # NOT executed — empty list is falsy ✓ (same)
    pass

if {}:  # NOT executed — empty dict is falsy ✓ (same)
    pass

# Wait — both are falsy?
# Yes! But ONLY when empty.
x = [1]
if x:   # executed — non-empty list is TRUTHY
    pass
```

Actually Python and JS agree on empty containers being falsy. But the key difference:

```python
import math
float('nan')  # nan
bool(float('nan'))  # True ← NaN is TRUTHY in Python!
```

```js
Boolean(NaN); // false ← NaN is FALSY in JS
```

**Python falsy values, exhaustive list:**

- `None`
- `False`
- `0`, `0.0`, `0j` (complex zero)
- `""`, `b""` (empty string, empty bytes)
- `[]`, `()`, `{}`, `set()` (empty containers)
- Objects whose `__bool__` or `__len__` returns `False`/`0`

---

## 5. String Formatting

```js
// JavaScript
const name = "Alice";
const age = 30;
console.log(`Hello, ${name}! You are ${age}.`); // template literals
```

```python
# Python — 3 ways (know all 3, prefer f-strings)

name = "Alice"
age = 30

# 1. f-strings (Python 3.6+) — preferred
print(f"Hello, {name}! You are {age}.")

# 2. .format()
print("Hello, {}! You are {}.".format(name, age))

# 3. % formatting (old, avoid in new code)
print("Hello, %s! You are %d." % (name, age))
```

f-strings evaluate expressions at runtime:

```python
print(f"2 + 2 = {2 + 2}")          # "2 + 2 = 4"
print(f"{name.upper()!r}")          # "'ALICE'" — !r calls repr()
print(f"{3.14159:.2f}")             # "3.14" — format specifier
```

---

## 6. Control Flow — The `else` on Loops (No JS Equivalent)

```js
// JavaScript
for (let i = 0; i < 5; i++) { ... }
while (condition) { ... }
// No for/else or while/else
```

```python
# Python
for i in range(5):
    if i == 3:
        break
else:
    # Runs ONLY if the loop completed WITHOUT hitting a break
    print("Loop finished without break")
```

```python
# Real use case: search with for/else
def find_prime(numbers):
    for n in numbers:
        for factor in range(2, n):
            if n % factor == 0:
                break       # n is not prime
        else:
            return n        # inner loop completed — n is prime
    return None
```

The `else` on a loop runs when the loop exits **normally** (no `break`). This is genuinely useful and has **no JS equivalent**.

---

## 7. Functions — `*args`, `**kwargs`, Default Arguments

```js
// JavaScript
function greet(name = "World", ...rest) {
  console.log(rest); // array of extra args
}
```

```python
# Python
def greet(name="World", *args, **kwargs):
    print(args)    # tuple of extra positional args
    print(kwargs)  # dict of extra keyword args

greet("Alice", 1, 2, x=10, y=20)
# args   = (1, 2)
# kwargs = {'x': 10, 'y': 20}
```

### ⚠️ Mutable Default Argument Trap (classic Python gotcha)

```js
// JavaScript — no equivalent trap (new array created each call)
function add(item, arr = []) {
  arr.push(item);
  return arr;
}
add(1); // [1]
add(2); // [2]  ← fresh array each call
```

```python
# Python — THE most famous Python footgun
def add(item, lst=[]):   # ← default list is created ONCE, at function definition
    lst.append(item)
    return lst

add(1)  # [1]
add(2)  # [1, 2]  ← SAME list! Not a fresh one!
add(3)  # [1, 2, 3]
```

**Fix**: Use `None` as default:

```python
def add(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst
```

---

## 8. Comprehensions — Syntax and Scoping

```js
// JavaScript
const squares = [1, 2, 3, 4, 5].map((x) => x ** 2);
const evens = [1, 2, 3, 4, 5].filter((x) => x % 2 === 0);
```

```python
# Python — comprehensions are more powerful and idiomatic
squares = [x ** 2 for x in range(1, 6)]
evens   = [x for x in range(1, 6) if x % 2 == 0]

# dict comprehension
sq_map = {x: x**2 for x in range(5)}    # {0:0, 1:1, 2:4, 3:9, 4:16}

# set comprehension
sq_set = {x**2 for x in range(5)}       # {0, 1, 4, 9, 16}

# generator expression (lazy — no brackets)
sq_gen = (x**2 for x in range(5))       # not computed yet
```

### Scoping difference

```js
// JavaScript — var leaks out of for loops
for (var i = 0; i < 3; i++) {}
console.log(i); // 3 — i leaked!
```

```python
# Python — list comprehensions have their OWN scope (Python 3)
result = [x for x in range(3)]
print(x)  # NameError: name 'x' is not defined
```

In Python 3, the loop variable inside a comprehension does **not** leak into the outer scope.

---

## 9. `None` vs `undefined` — What Replaces `undefined`?

Python has **no `undefined`**. Accessing a name that has never been bound raises `NameError`.

```python
print(x)    # NameError: name 'x' is not defined
```

For optional values, Python uses `None` explicitly:

```python
def get_user(id):
    # Returns User or None — caller must check
    return db.find(id) or None
```

For missing dict keys:

```js
obj.missingKey; // undefined — silent
obj["missingKey"]; // undefined — silent
```

```python
d = {}
d['missing']           # KeyError — raises an exception
d.get('missing')       # None — safe access
d.get('missing', 0)    # 0 — with a default value
```

---

## 10. Basic OOP — `class`, `self`, `__init__`

```js
// JavaScript
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound.`;
  }
}
```

```python
# Python
class Animal:
    def __init__(self, name):      # constructor
        self.name = name           # instance attribute

    def speak(self):               # self is EXPLICIT — always first param
        return f"{self.name} makes a sound."
```

Key differences:

- **`self` is explicit** — Python does not inject `this` automatically. You must declare it as the first parameter of every instance method.
- **`__init__`** is the initializer, not the constructor. Object allocation happens in `__new__` (covered in Chapter 14).
- **No access modifiers** — no `private`, `public`, `protected`. Convention: `_private`, `__name_mangled`.

---

## 11. Python Indentation as Syntax

```js
// JavaScript — braces define blocks
function foo() {
  if (true) {
    doSomething();
  }
}
```

```python
# Python — indentation IS the syntax
def foo():
    if True:
        do_something()   # 4 spaces — standard per PEP 8
```

- **Mixing tabs and spaces** raises `TabError` — Python 3 forbids it.
- **Wrong indentation level** raises `IndentationError`.
- PEP 8 mandates **4 spaces** per level. Never use tabs in new Python code.

---

## 12. Common JS Patterns → Python Equivalents

| JS Pattern                    | Python Equivalent           | Notes                                    |
| ----------------------------- | --------------------------- | ---------------------------------------- |
| `console.log(x)`              | `print(x)`                  |                                          |
| `x ?? y` (nullish coalescing) | `x if x is not None else y` | `or` won't work — `0` and `""` are falsy |
| `x?.foo` (optional chaining)  | `getattr(x, 'foo', None)`   | No `?.` syntax                           |
| `arr.push(x)`                 | `lst.append(x)`             |                                          |
| `arr.pop()`                   | `lst.pop()`                 | Same name, same behavior                 |
| `Object.keys(obj)`            | `dict.keys()`               |                                          |
| `Object.entries(obj)`         | `dict.items()`              | Returns `(key, value)` tuples            |
| `Array.isArray(x)`            | `isinstance(x, list)`       |                                          |
| `JSON.stringify(x)`           | `json.dumps(x)`             |                                          |
| `JSON.parse(s)`               | `json.loads(s)`             |                                          |
| `Promise.all([...])`          | `asyncio.gather(...)`       | (Chapter 17)                             |
| `try/catch/finally`           | `try/except/finally`        | `catch` → `except`                       |
| `throw new Error("msg")`      | `raise ValueError("msg")`   |                                          |
| `===`                         | `==`                        | Python `==` always does value comparison |
| `!==`                         | `!=`                        |                                          |
| `===` identity check          | `is`                        | `x is y` checks same object in memory    |

---

## ASCII Diagram — Python Name Binding

```
Python memory model:

  Code:                    Memory (heap):
  ─────                    ──────────────
  x = [1, 2, 3]     ──►   [list object]  ← x points here
  y = x              ──►   (same object)  ← y ALSO points here!

  y.append(4)        →     [list object: 1, 2, 3, 4]
  print(x)           →     [1, 2, 3, 4]  ← x sees the change!

  → x and y are two names for the SAME object.
  → This is aliasing. In JS, same behavior for objects/arrays.
  → In Python, this applies to ALL mutable types.
```

---

## Revision Notes → see `notes.md`

## Interview Questions → see `interview.md`

## Exercises → see `exercises/problems.md`
