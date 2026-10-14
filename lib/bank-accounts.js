"use strict";

function validateAccount({ label, balance } = {}) {
  if (typeof label !== "string" || !label.trim() || label.trim().length > 60) {
    return { ok: false, error: "Enter an account label of 1 to 60 characters." };
  }
  const text = typeof balance === "string" ? balance.trim() : balance;
  if ((typeof text !== "string" && typeof text !== "number") || text === "" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(text))) {
    return { ok: false, error: "Enter a valid non-negative balance in BDT." };
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a valid non-negative balance in BDT." };
  return { ok: true, account: { label: label.trim(), balance: amount } };
}

function totalBalance(accounts = []) {
  return accounts.reduce((total, account) => total + account.balance, 0);
}

function totalSavings(otherSavings, accounts = []) {
  const other = otherSavings === "" ? 0 : Number(otherSavings);
  if (!Number.isFinite(other) || other < 0) return NaN;
  return other + totalBalance(accounts);
}

const api = { validateAccount, totalBalance, totalSavings };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.CampusBridgeBankAccounts = api;
