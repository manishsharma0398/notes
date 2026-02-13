# Chapter 20 Notes
**freeze:** Shallow immutability  
**seal:** No add/delete, allows modify  
**preventExtensions:** No add

## Copying
**Shallow:** `{...obj}` or `Object.assign()`  
**Deep:** `structuredClone()` or JSON (limited)

## One-Sentence
JavaScript objects are mutable by default with Object.freeze() providing shallow immutability, while copying requires distinguishing between shallow copies (spread operator) that share nested references and deep copies (structuredClone) that recursively clone all levels.
