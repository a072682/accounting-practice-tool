import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { entryCreditTotal, entryDebitTotal, formatNumber, sortAccountsByCode } from '../utils/accounting';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLine() {
  return { accountId: '', amount: '' };
}

function LineEditor({ label, lines, setLines, accounts }) {
  function updateLine(idx, patch) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines([...lines, emptyLine()]);
  }
  function removeLine(idx) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  return (
    <div className="line-editor">
      <h4>{label}</h4>
      {lines.map((line, idx) => (
        <div className="line-row" key={idx}>
          <select
            value={line.accountId}
            onChange={(e) => updateLine(idx, { accountId: e.target.value })}
          >
            <option value="">選擇科目</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} {acc.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="num-input"
            placeholder="金額"
            value={line.amount}
            onChange={(e) => updateLine(idx, { amount: e.target.value })}
          />
          {lines.length > 1 && (
            <button type="button" onClick={() => removeLine(idx)}>
              移除
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addLine}>
        + 新增一筆{label}
      </button>
    </div>
  );
}

export default function JournalEntryTab() {
  const { accounts, entries, addEntry, deleteEntry } = useApp();
  const sorted = sortAccountsByCode(accounts);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [debits, setDebits] = useState([emptyLine()]);
  const [credits, setCredits] = useState([emptyLine()]);
  const [error, setError] = useState('');

  const debitTotal = entryDebitTotal({ debits });
  const creditTotal = entryCreditTotal({ credits });
  const diff = debitTotal - creditTotal;
  const balanced = Math.abs(diff) < 0.005 && debitTotal > 0;

  function resetForm() {
    setDate(today());
    setDescription('');
    setDebits([emptyLine()]);
    setCredits([emptyLine()]);
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const validDebits = debits.filter((l) => l.accountId && Number(l.amount) > 0);
    const validCredits = credits.filter((l) => l.accountId && Number(l.amount) > 0);

    if (!description.trim()) {
      setError('請輸入摘要說明');
      return;
    }
    if (validDebits.length === 0 || validCredits.length === 0) {
      setError('借方與貸方至少各需一筆有效分錄');
      return;
    }
    const dTotal = validDebits.reduce((s, l) => s + Number(l.amount), 0);
    const cTotal = validCredits.reduce((s, l) => s + Number(l.amount), 0);
    if (Math.abs(dTotal - cTotal) >= 0.005) {
      setError(`借貸不平衡！借方合計 ${formatNumber(dTotal)}，貸方合計 ${formatNumber(cTotal)}`);
      return;
    }

    addEntry({
      date,
      description: description.trim(),
      debits: validDebits.map((l) => ({ accountId: l.accountId, amount: Number(l.amount) })),
      credits: validCredits.map((l) => ({ accountId: l.accountId, amount: Number(l.amount) })),
    });
    resetForm();
  }

  function accountLabel(id) {
    const acc = accounts.find((a) => a.id === id);
    return acc ? `${acc.code} ${acc.name}` : '(已刪除科目)';
  }

  return (
    <div>
      <h2>分錄輸入</h2>
      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="entry-header">
          <label>
            日期
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            摘要說明
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="交易摘要" />
          </label>
        </div>

        <div className="entry-lines">
          <LineEditor label="借方" lines={debits} setLines={setDebits} accounts={sorted} />
          <LineEditor label="貸方" lines={credits} setLines={setCredits} accounts={sorted} />
        </div>

        <div className="entry-check">
          <span>借方合計：{formatNumber(debitTotal)}</span>
          <span>貸方合計：{formatNumber(creditTotal)}</span>
          {balanced ? (
            <span className="ok-text">借貸平衡 ✓</span>
          ) : (
            <span className="error-text">借貸不平衡（差額 {formatNumber(diff)}）</span>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={!balanced}>
          儲存分錄
        </button>
      </form>

      <h3>已登錄分錄</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>摘要</th>
            <th>借方</th>
            <th>貸方</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.date}</td>
              <td>{entry.description}</td>
              <td>
                {entry.debits.map((d, i) => (
                  <div key={i}>
                    {accountLabel(d.accountId)} <span className="num-cell">{formatNumber(d.amount)}</span>
                  </div>
                ))}
              </td>
              <td>
                {entry.credits.map((c, i) => (
                  <div key={i}>
                    {accountLabel(c.accountId)} <span className="num-cell">{formatNumber(c.amount)}</span>
                  </div>
                ))}
              </td>
              <td>
                <button onClick={() => deleteEntry(entry.id)}>刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
