function memoize(fn, keyFn = (x) => x) {
  // TODO: cache results per function instance (not a shared cache!)
  //   - keyFn maps an argument to a cache key
  //   - default keyFn uses the argument itself — which means object/function
  //     arguments are compared by IDENTITY. Document that in a comment.
  //   - preserve name and length
  //   - expose cache stats on the returned function itself (it IS an object)
}

let calls = 0;
const slow = (x) => {
  calls++;
  return x * 2;
};
const fast = memoize(slow);
console.log(fast(5), fast(5), calls); // 10 10 1
console.log(fast.hits, fast.misses); // 1 1

const other = memoize(slow);
other(5);
console.log(calls); // 2 — separate cache per instance
