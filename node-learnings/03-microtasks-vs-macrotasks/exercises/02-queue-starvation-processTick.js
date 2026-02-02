const recursiveProcessTick = (count) => {
  if (count >= 1000) process.exit(0);
  console.log("Inside recursiveProcessTick", count);
  process.nextTick(() => recursiveProcessTick(count + 1));
};

recursiveProcessTick(0);

setTimeout(() => {
  console.log("This will never execute");
}, 0);
