# Chapter 22: Modules (ESM semantics, loading, live bindings)

## ES Modules (ESM)

Modern JavaScript module system.

**Export:**

```javascript
// math.js
export const PI = 3.14;
export function add(a, b) {
    return a + b;
}

// Default export
export default class Calculator {}
```

**Import:**

```javascript
import Calculator, { PI, add } from './math.js';
import * as math from './math.js';
```

## Named vs Default Export

```javascript
// Named: can have multiple
export const foo = 1;
export const bar = 2;

// Default: only one
export default function() {}

// Import both
import MyFunc, { foo, bar } from './module.js';
```

## Live Bindings

**ESM exports are live bindings**, not copies.

```javascript
// counter.js
export let count = 0;
export function increment() {
    count++;
}

// main.js
import { count, increment } from './counter.js';
console.log(count);  // 0
increment();
console.log(count);  // 1 (updated!)
```

**Can't modify:**

```javascript
import { count } from './counter.js';
count++;  // Error: Assignment to constant variable
```

## Module Semantics

1. **Singleton:** Module code runs once
2. **Strict mode:** Always in strict mode
3. **Top-level this:** undefined (not global)
4. **Static structure:** Imports/exports must be top-level

## Dynamic Imports

```javascript
// Static (must be top-level)
import { foo } from './module.js';

// Dynamic (can be anywhere)
const module = await import('./module.js');
console.log(module.foo);

// Conditional loading
if (condition) {
    const { feature } = await import('./feature.js');
}
```

## CommonJS vs ESM

| Feature | CommonJS | ESM |
|---------|----------|-----|
| Syntax | `require()` | `import` |
| Loading | Synchronous | Asynchronous |
| Binding | Copy | Live |
| This | exports object | undefined |

## Circular Dependencies

**ESM handles better:**

```javascript
// a.js
import { b } from './b.js';
export const a = 1;

// b.js
import { a } from './a.js';
export const b = 2;
// Works! a is undefined initially, then populated
```

## Key Concepts

1. **Static imports:** Top-level only
2. **Live bindings:** Exports update
3. **Singleton:** Runs once
4. **Strict mode:** Always
5. **Dynamic imports:** async, conditional

## Next: Strict Mode
