# Chapter 21 Interview
## Q1: NaN Equality
**Q:** Why NaN !== NaN?  
**A:** Spec defines it, use Number.isNaN() to check

## Q2: Floating-Point
**Q:** Why 0.1 + 0.2 !== 0.3?  
**A:** Binary can't exactly represent 0.1 and 0.2

## Q3: Safe Integers
**Q:** What's MAX_SAFE_INTEGER?  
**A:** 2^53 - 1, beyond this precision is lost
