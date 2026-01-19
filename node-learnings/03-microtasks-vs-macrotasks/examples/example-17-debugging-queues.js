// example-17-debugging-queues.js
function processData(data, callback) {
  // Simulate async processing
  process.nextTick(() => {
    const result = data * 2;
    callback(result);
  });
}

let value = 0;

processData(5, (result) => {
  value = result;
});

console.log(value); // What's the output?
