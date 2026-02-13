# Chapter 21 Notes
**NaN:** Not-a-Number, NaN !== NaN  
**Infinity:** 1/0, -Infinity  
**Floating-point:** Imprecise (0.1 + 0.2 !== 0.3)  
**Safe integers:** ±(2^53 - 1)  
**-0:** Exists, Object.is(-0, 0) is false

## One-Sentence
JavaScript numbers follow IEEE 754 double-precision with edge cases including NaN (which doesn't equal itself), Infinity, floating-point imprecision (0.1 + 0.2 !== 0.3), safe integer limits at ±2^53-1, and the existence of negative zero distinguishable only via Object.is.
