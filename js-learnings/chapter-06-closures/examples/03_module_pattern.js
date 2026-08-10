// Example 3: Module pattern — private state via closures

const BankAccount = (function () {
  // These are private — unreachable from outside
  let balance = 0;
  const transactionLog = [];

  function recordTransaction(type, amount) {
    transactionLog.push({ type, amount, balance, timestamp: Date.now() });
  }

  // Only these are exposed
  return {
    deposit(amount) {
      if (amount <= 0) throw new Error("Deposit must be positive");
      balance += amount;
      recordTransaction("deposit", amount);
      return balance;
    },

    withdraw(amount) {
      if (amount > balance) throw new Error("Insufficient funds");
      balance -= amount;
      recordTransaction("withdrawal", amount);
      return balance;
    },

    getBalance() {
      return balance;
    },

    getHistory() {
      return [...transactionLog]; // return a copy, not the live reference
    }
  };
})();

BankAccount.deposit(500);
BankAccount.deposit(200);
BankAccount.withdraw(100);

console.log(BankAccount.getBalance()); // 600
console.log(BankAccount.getHistory());

// These are completely inaccessible:
// BankAccount.balance    → undefined
// BankAccount.transactionLog → undefined
// BankAccount.recordTransaction → undefined
