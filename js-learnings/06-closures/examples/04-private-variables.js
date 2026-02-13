// Example 4: Private Variables (Encapsulation)
// Demonstrates: Using closures to create truly private data

function createBankAccount(initialBalance, accountHolder) {
    // These variables are completely private
    let balance = initialBalance;
    let holder = accountHolder;
    let transactionHistory = [];

    // Private helper function
    function recordTransaction(type, amount) {
        transactionHistory.push({
            type,
            amount,
            timestamp: new Date(),
            balanceAfter: balance
        });
    }

    // Public API (the only way to interact with private data)
    return {
        deposit(amount) {
            if (amount <= 0) {
                throw new Error('Deposit amount must be positive');
            }
            balance += amount;
            recordTransaction('deposit', amount);
            return balance;
        },

        withdraw(amount) {
            if (amount <= 0) {
                throw new Error('Withdrawal amount must be positive');
            }
            if (amount > balance) {
                throw new Error('Insufficient funds');
            }
            balance -= amount;
            recordTransaction('withdrawal', amount);
            return balance;
        },

        getBalance() {
            return balance;
        },

        getHolder() {
            return holder;
        },

        getTransactionHistory() {
            // Return a copy to prevent external modification
            return transactionHistory.map(t => ({ ...t }));
        }
    };
}

const account = createBankAccount(1000, 'John Doe');

console.log('Initial balance:', account.getBalance());  // 1000
console.log('Account holder:', account.getHolder());    // John Doe

account.deposit(500);
console.log('After deposit:', account.getBalance());   // 1500

account.withdraw(200);
console.log('After withdrawal:', account.getBalance()); // 1300

// Try to access private variables directly (won't work!)
console.log('\nTrying to access private data:');
console.log('account.balance:', account.balance);  // undefined
console.log('account.holder:', account.holder);    // undefined
console.log('account.transactionHistory:', account.transactionHistory);  // undefined

// Even trying to modify won't work
account.balance = 9999999;
console.log('After trying to set balance directly:', account.getBalance());  // Still 1300

console.log('\nTransaction History:');
console.log(account.getTransactionHistory());
