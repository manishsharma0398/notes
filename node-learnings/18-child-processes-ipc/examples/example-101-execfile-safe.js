// Example 101: execFile() for safer execution
// This demonstrates execFile() to avoid shell injection

const { execFile } = require('child_process');

// Safe: execFile() doesn't use shell
const userInput = 'file.txt'; // User input

// GOOD: execFile() executes file directly (no shell)
execFile('cat', [userInput], (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  console.log(stdout);
});

// BAD: exec() uses shell (vulnerable to injection)
// exec(`cat ${userInput}`, ...); // DANGEROUS if userInput contains '; rm -rf /'

// What happens:
// 1. execFile() executes 'cat' directly (no shell)
// 2. Arguments passed as array (safe)
// 3. No shell interpretation (prevents injection)
// Benefits: Safer than exec(), avoids shell injection
