const start = Date.now();

const timer1 = setTimeout(() => {
  const end = Date.now();
  console.log("Timer 1");
  console.log(`Timer 1 ran after ${end - start}ms`);
}, 1000);

const timer2 = setTimeout(() => {
  const end = Date.now();
  console.log("Timer 2");
  console.log(`Timer 2 ran after ${end - start}ms`);
}, 2000);

const timer3 = setTimeout(() => {
  const end = Date.now();
  console.log("Timer 3");
  console.log(`Timer 3 ran after ${end - start}ms`);
}, 3000);

const blockEventLoop = () => {
  const end = Date.now() + 10000;
  while (Date.now() < end) {}
};

blockEventLoop();

const end = Date.now();
console.log(`Event loop blocked for ${end - start}ms`);

// Timers execute in the timers phase of the event loop
// for timers to execute all synchronous code must finish executing
// time in the timers is a minimum not an exact time
// by the time blockEventLoop finishes executing the timers have expired and all setTimeouts will run together
