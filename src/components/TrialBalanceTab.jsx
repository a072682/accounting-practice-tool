import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, isDebitNormal, sortAccountsByCode } from '../utils/accounting';

export default function TrialBalanceTab() {
  const { accounts, openingBalances, entries } = useApp();
  const [hideZero, setHideZero] = useState(true);
  const sorted = sortAccountsByCode(accounts.filter((a) => !a.isSummary));
  const balances = computeEndingBalances(accounts, openingBalances, entries);

  // 借貸總額仍依「全部科目」計算，不受「隱藏零餘額科目」開關影響，避免誤以為報表本身不平衡
  let debitTotal = 0;
  let creditTotal = 0;

  const rows = sorted
    .map((acc) => {
      const balance = balances[acc.id] || 0;
      const debitNormal = isDebitNormal(acc);
      let debitAmount = 0;
      let creditAmount = 0;
      if (debitNormal) {
        if (balance >= 0) debitAmount = balance;
        else creditAmount = -balance;
      } else {
        if (balance >= 0) creditAmount = balance;
        else debitAmount = -balance;
      }
      debitTotal += debitAmount;
      creditTotal += creditAmount;
      return { acc, debitAmount, creditAmount };
    })
    .filter((row) => !hideZero || Math.abs(row.debitAmount) > 0.005 || Math.abs(row.creditAmount) > 0.005);

  const balanced = Math.abs(debitTotal - creditTotal) < 0.005;

  return (
    <div>
      <h2>試算表</h2>
      <label className="checkbox-label">
        <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
        隱藏零餘額科目
      </label>
      <table className="data-table">
        <thead>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th>類型</th>
            <th>借方餘額</th>
            <th>貸方餘額</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ acc, debitAmount, creditAmount }) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td>{acc.type}</td>
              <td className="num-cell">{debitAmount ? formatNumber(debitAmount) : ''}</td>
              <td className="num-cell">{creditAmount ? formatNumber(creditAmount) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>合計</th>
            <th className="num-cell">{formatNumber(debitTotal)}</th>
            <th className="num-cell">{formatNumber(creditTotal)}</th>
          </tr>
        </tfoot>
      </table>
      {balanced ? (
        <p className="ok-text">借貸總額相符 ✓</p>
      ) : (
        <p className="error-text">
          借貸總額不相符！差額 {formatNumber(debitTotal - creditTotal)}
        </p>
      )}
    </div>
  );
}
