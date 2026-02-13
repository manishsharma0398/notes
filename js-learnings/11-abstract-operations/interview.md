# Chapter 11 Interview Questions: Abstract Operations

## Question 1: What are Abstract Operations?

**Q:** What are abstract operations and why are they important?

**Expected Answer:**
- Internal ECMAScript specification algorithms
- NOT callable from JavaScript
- Define how type conversions work
- Explain coercion behavior
- Key ones: ToPrimitive, ToNumber, ToString, ToBoolean

## Question 2: ToPrimitive

**Q:** Explain the ToPrimitive algorithm.

**Expected Answer:**
- Converts object to primitive
- For number hint: try valueOf(), then toString()
- For string hint: try toString(), then valueOf()
- Both must return primitive or TypeError
- `Symbol.toPrimitive` overrides both

**Follow-up:** What determines the hint?

**Answer:** Numeric operations use "number", string operations use "string"

## Question 3: ToNumber Surprises

**Q:** What do these return?

```javascript
Number(null);
Number(undefined);
Number("");
Number([]);
```

**Expected Answer:**
- null → 0
- undefined → NaN
- "" → 0
- [] → 0

## Question 4: Falsy Values

**Q:** List all falsy values in JavaScript.

**Expected Answer:**
Only 7:
1. false
2. 0
3. -0
4. ""
5. null
6. undefined
7. NaN

**Follow-up:** Is "0" falsy?

**Answer:** No! "0" is truthy (non-empty string)

## Question 5: Abstract Equality

**Q:** Explain step-by-step: `[] == ![]`

**Expected Answer:**
1. ![] → false ([] is truthy)
2. [] == false
3. ToPrimitive([]) → ""
4. "" == false
5. ToNumber(false) → 0
6. "" == 0
7. ToNumber("") → 0
8. 0 == 0 → true

## Question 6: null Trap

**Q:** Why different results?

```javascript
null == 0   // ?
null >= 0   // ?
```

**Expected Answer:**
- `null == 0` → false (special rule: null only equals undefined)
- `null >= 0` → true (relational comparison uses ToNumber(null) → 0)

## Question 7: Plus Operator

**Q:** Why different results?

```javascript
"5" + 3     // ?
"5" - 3     // ?
```

**Expected Answer:**
- "5" + 3 → "53" (+ is overloaded: string → concatenation)
- "5" - 3 → 2 (- always numeric: ToNumber both)

## Question 8: Custom ToPrimitive

**Q:** What gets logged?

```javascript
const obj = {
  valueOf() { return 10; },
  toString() { return "20"; }
};

console.log(obj + 5);
console.log(String(obj));
```

**Expected Answer:**
- obj + 5 → 15 (numeric context: valueOf first)
- String(obj) → "20" (string context: toString first)

## Question 9: Boolean Comparison Trap

**Q:** Why is this false?

```javascript
"2" == true
```

**Expected Answer:**
1. ToNumber(true) → 1
2. "2" == 1
3. ToNumber("2") → 2
4. 2 == 1 → false

## Question 10: Best Practice

**Q:** Why prefer `===` over `==`?

**Expected Answer:**
- No type coercion (predictable)
- Faster (no conversion steps)
- Catches type mismatches early
- Only use `==` when you specifically need coercion
- Exception: `x == null` checks both null and undefined

---

## Precision Questions

### Q1: "JavaScript converts types automatically." Be more precise.

**Better:** "JavaScript uses abstract operations like ToNumber, ToString, and ToPrimitive to coerce values when operators or comparisons expect different types, following specific algorithms defined in the ECMAScript specification."

### Q2: Why does JavaScript have these complex coercion rules?

**Answer:**
- Ergonomics (e.g., `"5" * 2` works)
- Backwards compatibility
- Trade-off: flexibility vs predictability
- Historical design decisions

### Q3: What would break without ToPrimitive?

**Answer:**
- Can't use objects in arithmetic
- No string concatenation with objects
- No implicit conversions in comparisons
- Would need explicit `.valueOf()` everywhere
