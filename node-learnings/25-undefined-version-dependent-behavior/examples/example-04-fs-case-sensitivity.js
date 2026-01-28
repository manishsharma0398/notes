const fs = require('fs');
const path = require('path');

console.log('Testing file system case sensitivity\n');
console.log(`Platform: ${process.platform}`);
console.log(`Node version: ${process.version}\n`);

// Create test file
const testDir = path.join(__dirname, 'test-case-sensitivity');
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
}

const testFile = path.join(testDir, 'TestFile.txt');
fs.writeFileSync(testFile, 'Hello World');

// Try accessing with different case
const variations = [
    'TestFile.txt',   // Exact match
    'testfile.txt',   // All lowercase
    'TESTFILE.TXT',   // All uppercase
    'testFile.txt'    // Different casing
];

console.log('Attempting to read with different casings:\n');

variations.forEach(name => {
    const attemptPath = path.join(testDir, name);
    try {
        const content = fs.readFileSync(attemptPath, 'utf8');
        console.log(`✅ ${name}: SUCCESS (read: "${content}")`);
    } catch (err) {
        console.log(`❌ ${name}: FAILED (${err.code})`);
    }
});

console.log('\n⚠️  Platform Behavior:');
console.log('Windows/macOS: Case-insensitive file systems');
console.log('  → All variations above will succeed');
console.log('Linux: Case-sensitive file system');
console.log('  → Only exact match "TestFile.txt" succeeds');

console.log('\n🚨 Production Risk:');
console.log('const data = require("./Config.json");');
console.log('  → Works on Windows (dev machine)');
console.log('  → Breaks on Linux if file is "config.json"');

console.log('\n✅ Best Practice:');
console.log('1. Always use exact case in file paths');
console.log('2. Use lowercase filenames for cross-platform compatibility');
console.log('3. Test on Linux even if developing on Windows/Mac');
console.log('4. Use path.normalize() for path handling');

// Cleanup
try {
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);
    console.log('\nTest cleanup complete');
} catch (err) {
    console.error('Cleanup error:', err.message);
}
