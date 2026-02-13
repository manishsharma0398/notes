// Chapter 22: Modules
// Export
export const foo = 1;
export default function bar() { }

// Import
import bar, { foo } from './module.js';

// Dynamic import
const mod = await import('./module.js');

// Live bindings
export let count = 0;
export function inc() { count++; }
