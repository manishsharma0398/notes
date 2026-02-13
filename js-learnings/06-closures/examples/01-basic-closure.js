// Example 1: Basic Closure - Counter
// Demonstrates: Function retaining access to outer variable

function createCounter() {
  let count = 0;
  
  function increment() {
    count++;
    return count;
  }
  
  return increment;
}

const counter1 = createCounter();
console.log('Counter 1:');
console.log(counter1());  // 1
console.log(counter1());  // 2
console.log(counter1());  // 3

const counter2 = createCounter();
console.log('\nCounter 2 (separate closure):');
console.log(counter2());  // 1 (separate count variable!)
console.log(counter2());  // 2

console.log('\nCounter 1 again:');
console.log(counter1());  // 4 (still has its own count)
