const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BankAccounts = require('../lib/bank-accounts.js');

test('manual account balances validate and add to other savings', () => {
  const first = BankAccounts.validateAccount({ label: 'Student savings', balance: '12500.50' });
  const second = BankAccounts.validateAccount({ label: 'Checking', balance: '2500' });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const accounts = [first.account, second.account];
  assert.equal(BankAccounts.totalBalance(accounts), 15000.5);
  assert.equal(BankAccounts.totalSavings('1000', accounts), 16000.5);
});

test('manual account entry rejects missing labels and unsafe balances', () => {
  for (const account of [
    { label: '', balance: '10' },
    { label: 'A'.repeat(61), balance: '10' },
    { label: 'Savings', balance: '' },
    { label: 'Savings', balance: '-1' },
    { label: 'Savings', balance: 'NaN' },
    { label: 'Savings', balance: 'Infinity' }
  ]) assert.equal(BankAccounts.validateAccount(account).ok, false);
  assert.equal(BankAccounts.validateAccount({ label: 'Long-term savings', balance: '1e9' }).ok, true);
  assert.equal(Number.isNaN(BankAccounts.totalSavings('-1', [])), true);
});

test('planner combines manual account balances without sending or saving them remotely', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'planner.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(html, /lib\/bank-accounts\.js/);
  assert.match(html, /Do not enter an account number, password, card number, or one-time code/);
  assert.match(html, /clear when you reload or clear the planner/);
  assert.match(app, /BankAccounts\.totalSavings\(manualSavings, bankAccounts\)/);
  assert.match(app, /byId\("resetProfile"\).*bankAccounts=\[\]/);
  assert.doesNotMatch(app, /localStorage|sessionStorage/);
});
