# Chapter 8 Worksheet — Type Coercion and Equality

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, write the **trace**, not just the result — name the operation (`ToPrimitive`, `ToNumber`, the `==` step number, or "relational, not equality").

---

## Program 1 — Output Tracer

```javascript
"use strict";

console.log(1 + "2" + 3);       // << A
console.log(1 + 2 + "3");       // << B
console.log("5" - "2" + "1");   // << C
console.log(+"" + +"0" + +[]);  // << D
```

```javascript
"use strict";

console.log([] == false);  // << E
console.log([0] == false); // << F
console.log([1] == true);  // << G
console.log([2] == true);  // << H
```

```javascript
"use strict";

console.log(null == 0);         // << I
console.log(null >= 0);         // << J
console.log(undefined == null); // << K
console.log(undefined >= null); // << L
```

```javascript
"use strict";

const d = new Date(0);
console.log(typeof (d + 1)); // << M
console.log(typeof (d - 1)); // << N
```

```javascript
"use strict";

console.log([NaN].includes(NaN));             // << O
console.log([NaN].indexOf(NaN));              // << P
console.log(new Set([0, -0, NaN, NaN]).size); // << Q
```

Answer:

```
A:
Why:

B:
Why:

C:
Why:

D:
Why:

E:
Why:

F:
Why:

G:
Why:

H:
Why:

I:
Why:

J:
Why:

K:
Why:

L:
Why:

M:
Why:

N:
Why:

O:
Why:

P:
Why:

Q:
Why:
```

---

## Program 2 — True/False Reasoning

```
1. "" == 0
Answer:
Why:

2. "" == "0"
Answer:
Why:

3. [] == ![]
Answer:
Why:

4. [] is falsy
Answer:
Why:

5. null == false
Answer:
Why:

6. "10" < "9"
Answer:
Why:

7. 3 > 2 > 1 evaluates to true
Answer:
Why:

8. Number("010") === 8
Answer:
Why:

9. isNaN("hello") and Number.isNaN("hello") return the same value
Answer:
Why:

10. 1n == 1 is true but 1n === 1 is false
Answer:
Why:

11. Object.is(0, -0) and 0 === -0 return the same value
Answer:
Why:

12. typeof (new Date() + 1) is "string"
Answer:
Why:
```

---

## Program 3 — Coercion Detective

```javascript
"use strict";

function trace(label) {
  return {
    valueOf() {
      console.log(label, "valueOf");
      return 10;
    },
    toString() {
      console.log(label, "toString");
      return "TEN";
    },
  };
}

const a = trace("a");

console.log(`${a}`);    // << R
console.log(a + 1);     // << S
console.log(a * 2);     // << T
console.log(String(a)); // << U
console.log(a == 10);   // << V
console.log(a > 5);     // << W
```

For each: which method is called, what is the result, and which hint decided it.

```
R: method =            result =
Hint & why:

S: method =            result =
Hint & why:

T: method =            result =
Hint & why:

U: method =            result =
Hint & why:

V: method =            result =
Hint & why:

W: method =            result =
Hint & why:
```

```javascript
"use strict";

const money = {
  amount: 1999, // cents
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `$${(this.amount / 100).toFixed(2)}`;
    return `Money(${this.amount})`; // hint "default"
  },
};

console.log(+money);        // << X
console.log(`${money}`);    // << Y
console.log(money + "");    // << Z
console.log(money > 1000);  // << AA
console.log(money == 1999); // << AB
```

```
X:
Why (which hint?):

Y:
Why (which hint?):

Z:
Why (which hint?):

AA:
Why (which hint?):

AB:
Why (which hint, and what happens to the primitive it returns?):
```

---

## Program 4 — Implement `looseEqual`

Constraint: no `==` or `!=` anywhere inside `looseEqual` or `toPrimitive`.

```javascript
"use strict";

function looseEqual(a, b) {
  // Write your implementation here
}

function toPrimitive(obj) {
  // Write your implementation here ("default" hint)
}

// Tests:
console.log(looseEqual(null, undefined));         // true
console.log(looseEqual(null, 0));                 // false
console.log(looseEqual(undefined, false));        // false
console.log(looseEqual("1", 1));                  // true
console.log(looseEqual("", 0));                   // true
console.log(looseEqual("", "0"));                 // false
console.log(looseEqual("0", 0));                  // true
console.log(looseEqual([], false));               // true
console.log(looseEqual([], ![]));                 // true
console.log(looseEqual([1], true));               // true
console.log(looseEqual([2], true));               // false
console.log(looseEqual(NaN, NaN));                // false
console.log(looseEqual({ valueOf: () => 1 }, 1)); // true
console.log(looseEqual({}, {}));                  // false
```

Your implementation:

```javascript
function looseEqual(a, b) {
  // Write here
}

function toPrimitive(obj) {
  // Write here
}
```

Matrix verification (paste your result):

```javascript
const values = [
  null, undefined, true, false, 0, -0, 1, NaN,
  "", "0", "1", "false", [], [0], [1], {}, { valueOf: () => 1 },
];

let mismatches = 0;
for (const a of values) {
  for (const b of values) {
    if (looseEqual(a, b) !== (a == b)) {
      mismatches++;
      console.log("MISMATCH:", String(a), "vs", String(b));
    }
  }
}
console.log(mismatches === 0 ? "all 289 pairs agree" : `${mismatches} mismatches`);
```

```
Matrix result:

Any mismatches you had to debug, and what the cause was:
```

Self-assessment:

```
- [ ] All 14 listed tests pass
- [ ] Matrix reports zero mismatches across all 289 pairs
- [ ] No == or != inside looseEqual or toPrimitive
- [ ] The converting steps recurse rather than compare inline
- [ ] toPrimitive checks Symbol.toPrimitive before valueOf/toString
- [ ] Bonus: step 12 implemented (looseEqual(1n, 1) === true, looseEqual(1n, 1.5) === false)
```

---
