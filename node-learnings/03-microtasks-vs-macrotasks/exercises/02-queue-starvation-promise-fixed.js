const recursivePromise = (count) => {
  if (count >= 10) process.exit(0);
  console.log("Inside recursivePromise", count);
  setImmediate(
    () => new Promise((resolve) => resolve(recursivePromise(count + 1))),
  );
};

recursivePromise(0);

setTimeout(() => {
  console.log("This will execute in between");
}, 0);
