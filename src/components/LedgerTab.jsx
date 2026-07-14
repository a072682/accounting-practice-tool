import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatNumber, isDebitNormal, openingNetBalance, sortAccountsByCode } from '../utils/accounting';

export default function LedgerTab() {
  const { accounts, openingBalances, inventoryItems, noteCards, entries } = useApp();
  const sorted = sortAccountsByCode(accounts.filter((a) => !a.isSummary));
  const [accountId, setAccountId] = useState(sorted[0]?.id || '');

  const account = accounts.find((a) => a.id === accountId);

  function itemInfo(line) {
    if (!line.itemId) return '';
    const item = inventoryItems.find((it) => it.id === line.itemId);
    return ` ［${item?.name || '(已刪除品項)'} x ${formatNumber(line.qty)}］`;
  }

  function noteInfo(line) {
    if (!line.noteId) return '';
    const card = noteCards.find((c) => c.id === line.noteId);
    return card ? ` ［${card.party || '(未命名)'}／${card.noteNumber || '(無號碼)'}］` : ' ［已刪除票據］';
  }

  function remarkInfo(line) {
    return line.note ? ` ［${line.note}］` : '';
  }

  const rows = [];
  if (account) {
    let running = openingNetBalance(account, openingBalances);
    const debitNormal = isDebitNormal(account);
    rows.push({ date: '', description: '期初餘額', debit: null, credit: null, balance: running });

    entries
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .forEach((entry) => {
        entry.debits.forEach((d) => {
          if (d.accountId === account.id) {
            running += debitNormal ? Number(d.amount) : -Number(d.amount);
            rows.push({
              date: entry.date,
              description: entry.description + itemInfo(d) + noteInfo(d) + remarkInfo(d),
              debit: Number(d.amount),
              credit: null,
              balance: running,
            });
          }
        });
        entry.credits.forEach((c) => {
          if (c.accountId === account.id) {
            running += debitNormal ? -Number(c.amount) : Number(c.amount);
            rows.push({
              date: entry.date,
              description: entry.description + itemInfo(c) + noteInfo(c) + remarkInfo(c),
              debit: null,
              credit: Number(c.amount),
              balance: running,
            });
          }
        });
      });
  }

  return (
    <div>
      <h2>分類帳</h2>
      <label>
        選擇科目：
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {sorted.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.code} {acc.name}
            </option>
          ))}
        </select>
      </label>

      {account && (
        <table className="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>摘要</th>
              <th>借方</th>
              <th>貸方</th>
              <th>餘額</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>{row.date}</td>
                <td>{row.description}</td>
                <td className="num-cell">{row.debit != null ? formatNumber(row.debit) : ''}</td>
                <td className="num-cell">{row.credit != null ? formatNumber(row.credit) : ''}</td>
                <td className="num-cell">{formatNumber(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
