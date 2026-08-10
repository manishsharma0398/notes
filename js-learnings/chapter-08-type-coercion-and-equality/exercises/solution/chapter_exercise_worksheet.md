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
Why: + is left-associative so the expression is (1 + "2") + 3.As, it is a binary + operation, the hint passed to toPrimtive(input, hint) will be default. As, here neither 1 or "2" is a Date hence the default args will be number. As, both the operands are primitive they pass straight through the function without changing anything.
Now, since one operand is a string, the other operand will also be converted to string and string concat is done => 1 + "2" = "12". Now, we have "12"+3 which exactly fits as above discussed so, the result will be "123"

B: "33"
Why: + is left-associative so the expression will be (1 + 2) + "3". As it is a binary + operation, the hint passed to toPrimtive(input, hint) will be default. As, here neither 1 or 2 is a Date hence the default args will be number. As, both the operands are primitive they pass straight through the function without changing anything.
Now, since neither one operand is a string, both operand will be converted to number, which they already are. So, numeric addition is done => 1 + 2 = 3.
3+"3" => both are primitives so toPrimtive() will be a noOp.The operator is + and one operand is a string.Hence, convert the non-string to string and do string concat that is why we have "33"

C: "31"
Why: -,+ both are left-associative and both have the same priority so the expression will be ("5" - "2") + "1". As, it is a binary - operation, the hint passed to toPrimtive(input, hint) will be number. As, both the operands are primitive they pass straight through the function without changing anything.
Now, since - is a numeric only operator both operand will be converted to number. So, subtraction is done => 5-2 = 3.
3+"1" => both are primitives so toPrimtive() will be a noOp.The operator is + and one operand is a string.Hence, convert the non-string to string and do string concat that is why we have "31"

D: 0
Why: + is left-associative so the expression will be (+"" + +"0") + +[].
+"" => ToNumber("") => Number("") => 0
+"0" => ToNumber("0") => Number("0") => 0
Hence, 0 + 0 equals 0.
Now, 0 + +[]
+[] = toPrimitive([], number) => [].valueOf() = [] => [].toString() = "". Now, +"" = Number("") which is 0
Now, neither are string so, numeric addition , finally 0+0=0

E: true
Why: Here, == rule triggers. Operands are of different type and neither both are undefined or null. Now, we have one operand boolean i.e false , it will first be converted to number Number(false) = 0. Now, [] is an object so [] will also need to be converted to primitive => toPrimitive([], "default") => since, [] is an Object and have no Symbol.toPrimitive. Hence, [].valueOf() = [] => [].toString() = ""
Now, the expression is "" == 0
"" needs to be converted to number , Number("") = 0
finally 0 == 0 => true

F: true
Why: == rule triggers.
Number(false) = 0
ToPrimitive([0], "default") => [0].valueOf() = [0] => [0].toString() => "0"
Now, "0" == 0
Number("0") => 0
finally, 0 == 0 same type, so compare the value => true

G: true
Why: == rule triggers.
Number(true) = 1
ToPrimitive([1], "default") => [1].valueOf() = [1] => [1].toString() => "1"
Now, "1" == 1
Number("1") => 1
finally, 1 == 1 same type, so compare the value => true

H: false
Why: == rule triggers.
Number(true) = 1
ToPrimitive([2], "default") => [2].valueOf() = [2] => [2].toString() => "2"
Number("2") => 2
finally, 1 == 2 same type, so compare the value => false

console.log(null == 0); // << I
I: false
Why: == rule triggers. Falls on the last case so , false

console.log(null >= 0); // << J
J: true
Why: Number(null) = 0
finally, 0 >= 0 same type, so compare the value => true

console.log(undefined == null); // << K
K: true
Why: As, one is undefined and other is null (2nd == rule)

console.log(undefined >= null); // << L
L: false
Why: Number(undefined) = NaN
Number(null) = 0
NaN >= 0 => false. NaN comparision is always false in relational comparision.

"use strict";

const d = new Date(0);
console.log(typeof (d + 1)); // << M
console.log(typeof (d - 1)); // << N

M: string
Why: toPrimitive(d, "default") => d is a Date hence, it has Symbol.toprimitive() hence, it will be called by deefault hint, for Date the default hint will be string that's why  d.toString() => "..... 2026 ...." now, primitive so skips valueOf()
now, one operand is a string so a string concat happens , hence, final result "..... 2026 ....1"

N: number
Why: toPrimitive(d, "number") => d.valueOf() = 0 now, primitive so, skips toString()
0 -1 =-1

"use strict";

console.log([NaN].includes(NaN)); // << O
console.log([NaN].indexOf(NaN)); // << P
console.log(new Set([0, -0, NaN, NaN]).size); // << Q

O: true
Why: includes uses SameValueZero

P: true
Why: indexOf uses ===

Q: 2
Why:
```

---

## Program 2 — True/False Reasoning

```
1. "" == 0
Answer: true
Why: Number("") => 0

2. "" == "0"
Answer: false
Why: As, same type so, compare value

3. [] == ![]
Answer: true
Why:
![] = !Boolean([]) => !true => false

Now, [] == false
Boolean(false) = false

[] == false

Number(false) = 0

[] == 0

toPrimitive([], "number") => [].valueOf() = [] => [].toString() = ""
"" == 0
Number("") = 0
0 == 0 => true

4. [] is falsy
Answer: false
Why: Boolean([]) = true only false when false,NaN,null,undefined,0,-0,"",0n

5. null == false
Answer: false
Why: Boolean(false) = 0 => null == 0 => false

6. "10" < "9"
Answer: true
Why: Both side string so lexographic comparision 1 < 9 => true

7. 3 > 2 > 1 evaluates to true
Answer: No
Why: 3 > 2 = true => true > 1 => Number(true) = 1 => 1 > 1 => false

8. Number("010") === 8
Answer: false
Why: Number("010") = 10

9. isNaN("hello") and Number.isNaN("hello") return the same value
Answer: false
Why: isNaN("hello") = true
Number.isNaN("hello") = false

10. 1n == 1 is true but 1n === 1 is false
Answer: correct
Why: 1n == 1 compares math numbers (1 vs 1), 1n === 1 compares types (big int vs number)

11. Object.is(0, -0) and 0 === -0 return the same value
Answer:
Why:

12. typeof (new Date() + 1) is "string"
Answer: yes
Why: toPrimitive("new Date()", default) => since, date has Symbol.isPrimitive() it's default will be string => ".....2026....".toString() = ".....2026...." primitive now
since one operand is string so we string concat it
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
