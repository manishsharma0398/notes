# Chapter 01 — Exercises

Attempt all exercises before opening `answers.md`.

---

## Exercise 1 — Prediction

Without running it, what does `dis.dis` output for this function?
Describe what each instruction does.

```python
import dis

def multiply(x, y):
    result = x * y
    return result

dis.dis(multiply)
```

Your answer: list the bytecode instructions you expect and what each one does.

---

## Exercise 2 — Prediction

What is the output of this code? Explain why.

```python
def make_adder(n):
    def adder(x):
        return x + n
    return adder

add5 = make_adder(5)

print(add5.__code__.co_name)
print(add5.__code__.co_varnames)
print(add5.__code__.co_freevars)  # <- think carefully about this one
```

---

## Exercise 3 — Debugging

A junior developer says:

> "Python is slow just because it's an interpreted language. If we switch to a compiled
> language it will be 100x faster."

What is **wrong** with this explanation? What is the **actual** reason CPython is slower
than V8 for CPU-bound work? Give at least 3 precise technical reasons.

---

## Exercise 4 — Prediction

```python
x = 1000
y = 1000
print(x is y)

a = 5
b = 5
print(a is b)
```

What does each `is` check print and why? What does this tell you about CPython's memory model?

_(Hint: this is related to how CPython manages integer objects in memory.)_

---

## Exercise 5 — Rewrite / Investigation

You have this JavaScript:

```js
// In V8, you can roughly simulate bytecode inspection via:
// --print-bytecode flag or Node.js inspector
// But you can't do it from code directly.
function add(a, b) {
  return a + b;
}
```

In Python, write code that:

1. Defines an equivalent `add(a, b)` function
2. Prints all its bytecode instructions using `dis`
3. Prints its code object's `co_varnames` and `co_consts`
4. Prints the name of the function that _called_ `add` using frame inspection

---

## Exercise 6 — Design

Explain in your own words (no code):

1. What happens step by step when Python runs `import my_module` for the first time?
2. What happens the second time you import the same module in the same process?
3. Why is the second import almost instant?

_(This is the `sys.modules` caching question — covered in depth in Chapter 19, but
your knowledge of the CPython pipeline should let you reason about it now.)_
