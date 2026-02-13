# Chapter 24 Notes
**undefined:** Not assigned  
**null:** Intentionally empty  
**typeof null:** "object" (historical bug)

## Equality
`undefined == null` (true)  
`undefined === null` (false)

## Modern Syntax
**Optional chaining:** `obj?.prop`  
**Nullish coalescing:** `value ?? default`

## One-Sentence
JavaScript distinguishes undefined (unassigned) from null (intentional emptiness), though undefined == null is true, with modern optional chaining (?.) and nullish coalescing (??) operators providing safer handling of potentially missing values.
