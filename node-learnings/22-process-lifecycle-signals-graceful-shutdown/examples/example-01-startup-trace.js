console.log('1: Script execution starts');

// This runs during startup phase
process.on('beforeExit', () => {
  console.log('5: beforeExit - event loop is empty');
});

process.on('exit', (code) => {
  console.log(`6: exit - process is exiting with code ${code}`);
});

setTimeout(() => {
  console.log('3: Timer callback');
}, 100);

console.log('2: Script execution ends');
// Event loop starts here
console.log('4: (implicit) Event loop processing timers');
