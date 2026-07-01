import { DEBIT_NORMAL_TYPES } from '../data/defaultAccounts';

// 千分位格式化，保留原始正負號
export function formatNumber(value) {
  const n = Number(value) || 0;
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function isDebitNormal(type) {
  return DEBIT_NORMAL_TYPES.includes(type);
}

// 計算每個科目的借方合計、貸方合計（來自所有分錄）
export function sumEntriesByAccount(entries) {
  const debitTotals = {};
  const creditTotals = {};
  entries.forEach((entry) => {
    entry.debits.forEach(({ accountId, amount }) => {
      debitTotals[accountId] = (debitTotals[accountId] || 0) + Number(amount || 0);
    });
    entry.credits.forEach(({ accountId, amount }) => {
      creditTotals[accountId] = (creditTotals[accountId] || 0) + Number(amount || 0);
    });
  });
  return { debitTotals, creditTotals };
}

// 計算科目期末餘額（依正常餘額方向）
// 資產、費用：借方增加、貸方減少
// 負債、權益、收入：貸方增加、借方減少
export function computeEndingBalances(accounts, openingBalances, entries) {
  const { debitTotals, creditTotals } = sumEntriesByAccount(entries);
  const balances = {};
  accounts.forEach((acc) => {
    const opening = Number(openingBalances[acc.id] || 0);
    const debit = debitTotals[acc.id] || 0;
    const credit = creditTotals[acc.id] || 0;
    if (isDebitNormal(acc.type)) {
      balances[acc.id] = opening + debit - credit;
    } else {
      balances[acc.id] = opening + credit - debit;
    }
  });
  return balances;
}

export function sumByTypes(accounts, balances, types) {
  return accounts
    .filter((acc) => types.includes(acc.type))
    .reduce((sum, acc) => sum + (balances[acc.id] || 0), 0);
}

export function entryDebitTotal(entry) {
  return entry.debits.reduce((s, d) => s + Number(d.amount || 0), 0);
}

export function entryCreditTotal(entry) {
  return entry.credits.reduce((s, c) => s + Number(c.amount || 0), 0);
}

export function sortAccountsByCode(accounts) {
  return [...accounts].sort((a, b) => a.code.localeCompare(b.code, 'zh-Hant'));
}
