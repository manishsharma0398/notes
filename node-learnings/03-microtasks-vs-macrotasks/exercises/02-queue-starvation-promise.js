const recursivePromise = (count) => {
  if (count >= 1000) process.exit(0);
  console.log("Inside recursivePromise", count);
  Promise.resolve().then(() => recursivePromise(count + 1));
};

recursivePromise(0);

setTimeout(() => {
  console.log("This will never execute");
}, 0);
