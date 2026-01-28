/**
 * Example 69: Allocation Patterns That Trigger GC
 * 
 * Demonstrates different allocation patterns and their impact on GC:
 * - High-frequency small allocations (triggers minor GC often)
 * - Large object allocations (promotes to old gen quickly)
 * - String operations (creates many temporary objects)
 * - Array operations (creates new arrays)
 * 
 * Run with: node --expose-gc --trace-gc example-69-allocation-patterns.js
 * 
 * What to observe:
 * - Which patterns trigger GC most frequently
 * - How different operations affect heap growth
 * - GC frequency vs pause time trade-off
 */

const { performance } = require('perf_hooks');
const v8 = require('v8');

function getHeapStats() {
  const stats = v8.getHeapStatistics();
  return {
    used: (stats.usedHeapSize / 1024 / 1024).toFixed(2),
    total: (stats.totalHeapSize / 1024 / 1024).toFixed(2)
  };
}

console.log('=== Allocation Patterns and GC Impact ===\n');

// Pattern 1: High-frequency small allocations
console.log('--- Pattern 1: High-frequency small allocations ---');
const start1 = performance.now();
const heapBefore1 = getHeapStats();
console.log(`Heap before: ${heapBefore1.used} MB`);

const smallObjects = [];
for (let i = 0; i < 1000000; i++) {
  smallObjects.push({
    id: i,
    value: Math.random(),
    timestamp: Date.now()
  });
}

const end1 = performance.now();
const heapAfter1 = getHeapStats();
console.log(`Heap after: ${heapAfter1.used} MB`);
console.log(`Time: ${(end1 - start1).toFixed(2)}ms`);
console.log(`Heap growth: ${(parseFloat(heapAfter1.used) - parseFloat(heapBefore1.used)).toFixed(2)} MB`);
console.log('→ Triggers minor GC frequently (many small objects)\n');

if (global.gc) {
  global.gc();
  console.log(`After GC: ${getHeapStats().used} MB\n`);
}

// Pattern 2: Large object allocations
console.log('--- Pattern 2: Large object allocations ---');
const start2 = performance.now();
const heapBefore2 = getHeapStats();
console.log(`Heap before: ${heapBefore2.used} MB`);

const largeObjects = [];
for (let i = 0; i < 1000; i++) {
  largeObjects.push({
    id: i,
    data: Buffer.alloc(1024 * 100), // 100 KB per object
    nested: {
      array: new Array(1000).fill(Math.random()),
      deep: {
        level1: { level2: { level3: { value: Math.random() } } }
      }
    }
  });
}

const end2 = performance.now();
const heapAfter2 = getHeapStats();
console.log(`Heap after: ${heapAfter2.used} MB`);
console.log(`Time: ${(end2 - start2).toFixed(2)}ms`);
console.log(`Heap growth: ${(parseFloat(heapAfter2.used) - parseFloat(heapBefore2.used)).toFixed(2)} MB`);
console.log('→ Promotes to old generation quickly (large objects)\n');

if (global.gc) {
  global.gc();
  console.log(`After GC: ${getHeapStats().used} MB\n`);
}

// Pattern 3: String concatenation (creates many temporary strings)
console.log('--- Pattern 3: String concatenation ---');
const start3 = performance.now();
const heapBefore3 = getHeapStats();
console.log(`Heap before: ${heapBefore3.used} MB`);

let result = '';
for (let i = 0; i < 100000; i++) {
  result += `item-${i}-${Math.random()}-`; // Creates new string each time
}

const end3 = performance.now();
const heapAfter3 = getHeapStats();
console.log(`Heap after: ${heapAfter3.used} MB`);
console.log(`Time: ${(end3 - start3).toFixed(2)}ms`);
console.log(`Heap growth: ${(parseFloat(heapAfter3.used) - parseFloat(heapBefore3.used)).toFixed(2)} MB`);
console.log('→ Creates many temporary strings (GC pressure)\n');

if (global.gc) {
  global.gc();
  console.log(`After GC: ${getHeapStats().used} MB\n`);
}

// Pattern 4: Array operations (slice, map, filter create new arrays)
console.log('--- Pattern 4: Array operations (creates new arrays) ---');
const start4 = performance.now();
const heapBefore4 = getHeapStats();
console.log(`Heap before: ${heapBefore4.used} MB`);

const baseArray = new Array(100000).fill(0).map((_, i) => ({
  id: i,
  value: Math.random()
}));

// Multiple array operations create new arrays
const doubled = baseArray.map(x => ({ ...x, value: x.value * 2 }));
const filtered = doubled.filter(x => x.value > 0.5);
const sliced = filtered.slice(0, 10000);
const sorted = sliced.sort((a, b) => a.value - b.value);

const end4 = performance.now();
const heapAfter4 = getHeapStats();
console.log(`Heap after: ${heapAfter4.used} MB`);
console.log(`Time: ${(end4 - start4).toFixed(2)}ms`);
console.log(`Heap growth: ${(parseFloat(heapAfter4.used) - parseFloat(heapBefore4.used)).toFixed(2)} MB`);
console.log('→ Creates multiple intermediate arrays (GC pressure)\n');

if (global.gc) {
  global.gc();
  console.log(`After GC: ${getHeapStats().used} MB\n`);
}

// Pattern 5: Object pooling (reuse objects)
console.log('--- Pattern 5: Object pooling (reuse objects) ---');
const start5 = performance.now();
const heapBefore5 = getHeapStats();
console.log(`Heap before: ${heapBefore5.used} MB`);

// Object pool
const pool = [];
const POOL_SIZE = 1000;

// Pre-allocate pool
for (let i = 0; i < POOL_SIZE; i++) {
  pool.push({ id: 0, value: 0, timestamp: 0 });
}

// Reuse objects from pool
for (let i = 0; i < 100000; i++) {
  const obj = pool[i % POOL_SIZE];
  obj.id = i;
  obj.value = Math.random();
  obj.timestamp = Date.now();
  // Use obj...
}

const end5 = performance.now();
const heapAfter5 = getHeapStats();
console.log(`Heap after: ${heapAfter5.used} MB`);
console.log(`Time: ${(end5 - start5).toFixed(2)}ms`);
console.log(`Heap growth: ${(parseFloat(heapAfter5.used) - parseFloat(heapBefore5.used)).toFixed(2)} MB`);
console.log('→ Minimal allocations (reuses objects)\n');

if (global.gc) {
  global.gc();
  console.log(`After GC: ${getHeapStats().used} MB\n`);
}

console.log('=== Summary ===');
console.log('1. High-frequency small allocations → Frequent minor GC');
console.log('2. Large object allocations → Quick promotion to old gen');
console.log('3. String concatenation → Many temporary strings');
console.log('4. Array operations → Multiple intermediate arrays');
console.log('5. Object pooling → Minimal allocations (optimization)');
