// Example 1: Basic closure — ER survives after outer function returns
function makeCounter(start = 0) {
  let count = start; // lives in makeCounter's ER

  return {
    increment() { return ++count; },
    decrement() { return --count; },
    reset()     { count = start; return count; },
    value()     { return count; }
  };
}

const c = makeCounter(10);
console.log(c.increment()); // 11
console.log(c.increment()); // 12
console.log(c.decrement()); // 11
console.log(c.reset());     // 10 — reset uses `start` from the same ER

// Two independent counters — each gets its own ER
const c1 = makeCounter(0);
const c2 = makeCounter(100);
c1.increment();
c2.increment();
console.log(c1.value()); // 1
console.log(c2.value()); // 101 — completely independent
