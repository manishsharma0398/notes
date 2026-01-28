// Example 116: Interval leak vs clearInterval

// BAD: setInterval per tenant with no clearInterval

function startLeakyIntervals(count) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = setInterval(() => {
      // Some background work
    }, 1000);
    ids.push(id);
  }
  return ids; // But we never clear them
}

// GOOD: Track and clear intervals when shutting down or when tenant is removed

class IntervalManager {
  constructor() {
    this.intervals = new Set();
  }

  add(fn, ms) {
    const id = setInterval(fn, ms);
    this.intervals.add(id);
    return id;
  }

  clear(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  clearAll() {
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals.clear();
  }
}

function demo() {
  console.log('=== Interval leak demo ===');

  const leakyIds = startLeakyIntervals(1000);
  console.log('Leaky intervals created:', leakyIds.length);

  const manager = new IntervalManager();
  for (let i = 0; i < 1000; i++) {
    manager.add(() => {}, 1000);
  }
  console.log('Managed intervals created:', manager.intervals.size);

  // Clear managed intervals after a short time
  setTimeout(() => {
    manager.clearAll();
    console.log('Managed intervals after clearAll:', manager.intervals.size);
    console.log('Leaky intervals are still running (no references but still scheduled).');
  }, 3000);
}

demo();

// Run:
//   node example-116-interval-leak.js
//
// Takeaways:
// - Intervals keep callbacks and their closures alive.
// - Without clearInterval, they accumulate and keep data reachable.
// - Use a manager to track and clear intervals explicitly.

