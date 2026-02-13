# Chapter 21: Numeric Edge Cases (NaN, Infinity, Floating-Point)

## NaN (Not-a-Number)

**Special number value** representing invalid result.

```javascript
console.log(typeof NaN);  // "number" (!)

// Creates NaN:
Number("abc");     // NaN
0 / 0;            // NaN
Math.sqrt(-1);    // NaN
```

**NaN is unique:**

```javascript
NaN === NaN;       // false (!)
NaN == NaN;        // false
Object.is(NaN, NaN);  // true

// Check for NaN:
isNaN(NaN);           // true
Number.isNaN(NaN);    // true (safer)
```

**isNaN vs Number.isNaN:**

```javascript
isNaN("hello");         // true (coerces to NaN)
Number.isNaN("hello");  // false (no coercion)
```

## Infinity

```javascript
1 / 0;      // Infinity
-1 / 0;     // -Infinity

Infinity + 1;      // Infinity
Infinity * 2;      // Infinity
Infinity - Infinity;  // NaN
```

## Floating-Point Precision

JavaScript uses **IEEE 754** double-precision (64-bit).

**Problem:**

```javascript
0.1 + 0.2;  // 0.30000000000000004 (!)
0.1 + 0.2 === 0.3;  // false
```

**Why:** Binary can't exactly represent 0.1 and 0.2.

**Solutions:**

```javascript
// 1. Round
Math.round((0.1 + 0.2) * 100) / 100;  // 0.3

// 2. toFixed
(0.1 + 0.2).toFixed(2);  // "0.30" (string!)

// 3. Epsilon comparison
Math.abs(a - b) < Number.EPSILON;
```

## Number Limits

```javascript
Number.MAX_VALUE;          // ~1.8e308
Number.MIN_VALUE;          // ~5e-324 (smallest positive)
Number.MAX_SAFE_INTEGER;   // 2^53 - 1 = 9007199254740991
Number.MIN_SAFE_INTEGER;   // -(2^53 - 1)
```

**Safe integers:**

```javascript
Number.isSafeInteger(9007199254740991);  // true
Number.isSafeInteger(9007199254740992);  // false
```

## Special Values

```javascript
-0 === 0;  // true
Object.is(-0, 0);  // false

1 / 0;    // Infinity
1 / -0;   // -Infinity
```

## parseInt and parseFloat

```javascript
parseInt("123");      // 123
parseInt("123abc");   // 123 (!)
parseInt("abc123");   // NaN

parseInt("10", 2);    // 2 (binary)
parseInt("10", 16);   // 16 (hex)

parseFloat("3.14");   // 3.14
parseFloat("3.14more");  // 3.14 (!)
```

## Key Takeaways

1. **NaN !== NaN** (use Number.isNaN)
2. **Floating-point** is imprecise (use epsilon)
3. **Safe integers** limited to ±2^53
4. **-0 exists** (Object.is distinguishes)
5. **parseInt/parseFloat** partial parsing

## Next: Modules
