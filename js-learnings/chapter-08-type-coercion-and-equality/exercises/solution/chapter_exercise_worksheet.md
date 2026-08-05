# Chapter 8 Worksheet — Type Coercion and Equality

Work entirely in this file. Fill in every `Answer:` block. Do NOT run the code first.

For every answer, write the **trace**, not just the result — name the operation (`ToPrimitive`, `ToNumber`, the `==` step number, or "relational, not equality").

---

## Program 1 — Output Tracer

```javascript
"use strict";

console.log(1 + "2" + 3); // << A
console.log(1 + 2 + "3"); // << B
console.log("5" - "2" + "1"); // << C
console.log(+"" + +"0" + +[]); // << D
```

```javascript
"use strict";

console.log([] == false); // << E
console.log([0] == false); // << F
console.log([1] == true); // << G
console.log([2] == true); // << H
```

```javascript
"use strict";

console.log(null == 0); // << I
console.log(null >= 0); // << J
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

console.log([NaN].includes(NaN)); // << O
console.log([NaN].indexOf(NaN)); // << P
console.log(new Set([0, -0, NaN, NaN]).size); // << Q
```

Answer:

```
A: "123"
Why: 1 + "2" = "12" as both primitive so we look at operator which is +, so, we convert the non-string to string and do the string concat.Now, we have "12"+3 for the same reason "123"

B: "33"
Why: 1+2 => both primitve(number) so a simple numeric addition = 3.Now, 3+"3" -> both primtive and the operator is + and one operand is a string so convert the non-string to string and do string concat

C: "31"
Why: "5" - "2" = 3 as both side primtive with - operator so both gets converted to number and normal subtraction is done. 3 + "1" = 31 as both primitive with + operator so convert both to string and do string concat

D: 0
Why:
+""  => ToNumber("")  => StringToNumber("")  => 0
+"0" => ToNumber("0") => StringToNumber("0") => 0
+[]  => ToNumber([])  => ToPrimitive([], hint "number")
          valueOf()  → returns [] itself, not a primitive → skip
          toString() → [].join(",") → ""
        => StringToNumber("") => 0
0 + 0 + 0 => 0  (numeric throughout — no string operand ever appears)


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

console.log(`${a}`); // << R
console.log(a + 1); // << S
console.log(a * 2); // << T
console.log(String(a)); // << U
console.log(a == 10); // << V
console.log(a > 5); // << W
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

console.log(+money); // << X
console.log(`${money}`); // << Y
console.log(money + ""); // << Z
console.log(money > 1000); // << AA
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
console.log(looseEqual(null, undefined)); // true
console.log(looseEqual(null, 0)); // false
console.log(looseEqual(undefined, false)); // false
console.log(looseEqual("1", 1)); // true
console.log(looseEqual("", 0)); // true
console.log(looseEqual("", "0")); // false
console.log(looseEqual("0", 0)); // true
console.log(looseEqual([], false)); // true
console.log(looseEqual([], ![])); // true
console.log(looseEqual([1], true)); // true
console.log(looseEqual([2], true)); // false
console.log(looseEqual(NaN, NaN)); // false
console.log(looseEqual({ valueOf: () => 1 }, 1)); // true
console.log(looseEqual({}, {})); // false
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
  null,
  undefined,
  true,
  false,
  0,
  -0,
  1,
  NaN,
  "",
  "0",
  "1",
  "false",
  [],
  [0],
  [1],
  {},
  { valueOf: () => 1 },
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
console.log(
  mismatches === 0 ? "all 289 pairs agree" : `${mismatches} mismatches`,
);
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

## Program 5 — Rapid-Fire Grid

24 booleans. Write the value **and** the deciding step. Near-identical pairs are placed next to each other on purpose — answer each line on its own, not by analogy to the one above it.

**Grid A — `[]` and its negation**

```javascript
[] == ![]; // << 1
true == []; // << 2
!![]; // << 3
true == ![]; // << 4
false == []; // << 5
false == ![]; // << 6
```

**Grid B — nesting, double negation, identity**

```javascript
[[]] == 0; // << 7
[[]] == ""; // << 8
!!"true" == !!"false"; // << 9
!!"true" === !!"false"; // << 10
NaN === NaN; // << 11
Number.MIN_VALUE > 0; // << 12
```

**Grid C — falsy values vs `==`, and chained relationals**

```javascript
!!null; // << 13
null == false; // << 14
0 == false; // << 15
"" == false; // << 16
1 < 2 < 3; // << 17
3 > 2 > 1; // << 18
```

**Grid D — single-element arrays**

```javascript
[""] == ""; // << 19
[0] == ""; // << 20
[null] == ""; // << 21
[null] == 0; // << 22
[undefined] == ""; // << 23
[undefined] == 0; // << 24
```

Answer:

```
1:
Why:

2:
Why:

3:
Why:

4:
Why:

5:
Why:

6:
Why:

7:
Why:

8:
Why:

9:
Why:

10:
Why:

11:
Why:

12:
Why:

13:
Why:

14:
Why:

15:
Why:

16:
Why:

17:
Why:

18:
Why:

19:
Why:

20:
Why:

21:
Why:

22:
Why:

23:
Why:

24:
Why:
```

Cross-checks:

```
Items 1, 14, 18 also appear in Programs 1–2. Do your two answers agree? If not, which is right and why:

Ran every == line through looseEqual from Program 4 — any disagreements:
```

Self-assessment:

```
- [ ] All 24 booleans correct
- [ ] Each has a named mechanism (== step number / ToPrimitive / ToBoolean / relational)
- [ ] The pairs that differ (1 vs 4, 7 vs 8, 9 vs 10, 17 vs 18, 19 vs 20) — I can say what flipped each one
- [ ] Every == line agrees with my looseEqual
```

---
