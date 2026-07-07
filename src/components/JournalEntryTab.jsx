import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  computeInventoryState,
  computeNoteState,
  entryCreditTotal,
  entryDebitTotal,
  formatNumber,
  inventoryAvgCost,
  isDebitNormal,
  isNoteIncreaseLine,
  sortAccountsByCode,
} from '../utils/accounting';

const today = () => new Date().toISOString().slice(0, 10);

function emptyLine() {
  return {
    accountId: '',
    amount: '',
    itemId: '',
    qty: '',
    unitCost: '',
    noteId: '',
    party: '',
    noteNumber: '',
    issueDate: '',
    dueDate: '',
    bankAccount: '',
  };
}

// mode: 'debit'（進貨，增加存貨數量，單位成本可手動輸入）
//       'credit'（銷貨，減少存貨數量，成本依目前加權平均單位成本自動計算）
function LineEditor({ label, mode, lines, setLines, accounts, inventoryItems, inventoryState, noteCards, noteState }) {
  function updateLine(idx, patch) {
    setLines(
      lines.map((l, i) => {
        if (i !== idx) return l;
        let merged = { ...l, ...patch };
        const account = accounts.find((a) => a.id === merged.accountId);

        if ('accountId' in patch) {
          merged = {
            ...merged,
            itemId: '',
            qty: '',
            unitCost: '',
            noteId: '',
            party: '',
            noteNumber: '',
            issueDate: '',
            dueDate: '',
            bankAccount: '',
            amount: account?.isInventory ? '' : merged.amount,
          };
        }

        if (account?.isInventory) {
          const qty = Number(merged.qty) || 0;
          if (mode === 'debit') {
            const unitCost = Number(merged.unitCost) || 0;
            merged.amount = qty && unitCost ? qty * unitCost : '';
          } else {
            const avgCost = inventoryAvgCost(inventoryState, merged.itemId);
            merged.unitCost = avgCost;
            merged.amount = qty && avgCost ? qty * avgCost : '';
          }
        }

        // 【修改四】沖銷既有票據時，預設帶入該票據目前的未沖銷餘額作為金額（可手動調整為部分沖銷）
        if (account?.isNoteAccount && !isNoteIncreaseLine(account, mode) && 'noteId' in patch) {
          const remaining = noteState[patch.noteId]?.remaining || 0;
          if (!merged.amount) merged.amount = remaining || '';
        }
        return merged;
      })
    );
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
      {lines.map((line, idx) => {
        const account = accounts.find((a) => a.id === line.accountId);
        const items = account?.isInventory ? inventoryItems.filter((it) => it.accountId === account.id) : [];
        const available = line.itemId ? inventoryState[line.itemId]?.qty || 0 : 0;
        const insufficient = mode === 'credit' && line.itemId && Number(line.qty) > available;

        const noteIncrease = account?.isNoteAccount && isNoteIncreaseLine(account, mode);
        const noteSettle = account?.isNoteAccount && !isNoteIncreaseLine(account, mode);
        const settleOptions = noteSettle
          ? noteCards.filter((c) => c.accountId === account.id && (noteState[c.id]?.remaining || 0) > 0.005)
          : [];
        const settleRemaining = line.noteId ? noteState[line.noteId]?.remaining || 0 : 0;
        const settleExceeded = noteSettle && line.noteId && Number(line.amount) - settleRemaining > 0.005;

        return (
          <div className="line-row-group" key={idx}>
            <div className="line-row">
              <select value={line.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}>
                <option value="">選擇科目</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} {acc.name}
                  </option>
                ))}
              </select>
              {account?.isInventory ? (
                <span className="num-cell">{line.amount === '' ? '' : formatNumber(line.amount)}</span>
              ) : (
                <input
                  type="number"
                  className="num-input"
                  placeholder="金額"
                  value={line.amount}
                  onChange={(e) => updateLine(idx, { amount: e.target.value })}
                />
              )}
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(idx)}>
                  移除
                </button>
              )}
            </div>
            {account?.isInventory && (
              <div className="line-row inventory-line">
                <select value={line.itemId} onChange={(e) => updateLine(idx, { itemId: e.target.value })}>
                  <option value="">選擇品項</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name || '(未命名品項)'}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="num-input"
                  placeholder="數量"
                  value={line.qty}
                  onChange={(e) => updateLine(idx, { qty: e.target.value })}
                />
                {mode === 'debit' ? (
                  <input
                    type="number"
                    className="num-input"
                    placeholder="單位成本"
                    value={line.unitCost}
                    onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                  />
                ) : (
                  <span className="hint-text">
                    加權平均單位成本 {formatNumber(inventoryAvgCost(inventoryState, line.itemId))}
                    　現有數量 {formatNumber(available)}
                  </span>
                )}
              </div>
            )}
            {insufficient && <p className="error-text">此品項現有數量不足（現有 {formatNumber(available)}）</p>}

            {noteIncrease && (
              <div className="line-row inventory-line">
                <input
                  placeholder={isDebitNormal(account) ? '客戶名稱' : '廠商名稱'}
                  value={line.party}
                  onChange={(e) => updateLine(idx, { party: e.target.value })}
                />
                <input
                  placeholder="票據號碼"
                  value={line.noteNumber}
                  onChange={(e) => updateLine(idx, { noteNumber: e.target.value })}
                />
                <input
                  type="date"
                  title="開票日"
                  value={line.issueDate}
                  onChange={(e) => updateLine(idx, { issueDate: e.target.value })}
                />
                <input
                  type="date"
                  title="到期日"
                  value={line.dueDate}
                  onChange={(e) => updateLine(idx, { dueDate: e.target.value })}
                />
                {!isDebitNormal(account) && (
                  <input
                    placeholder="支票帳戶"
                    value={line.bankAccount}
                    onChange={(e) => updateLine(idx, { bankAccount: e.target.value })}
                  />
                )}
              </div>
            )}
            {noteSettle && (
              <div className="line-row inventory-line">
                <select value={line.noteId} onChange={(e) => updateLine(idx, { noteId: e.target.value })}>
                  <option value="">選擇要沖銷的票據</option>
                  {settleOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.party || '(未命名)'}／{c.noteNumber || '(無號碼)'}（餘額 {formatNumber(noteState[c.id]?.remaining || 0)}）
                    </option>
                  ))}
                </select>
                {line.noteId && (
                  <span className="hint-text">未沖銷餘額 {formatNumber(settleRemaining)}</span>
                )}
              </div>
            )}
            {settleExceeded && (
              <p className="error-text">沖銷金額超過此票據未沖銷餘額（餘額 {formatNumber(settleRemaining)}）</p>
            )}
          </div>
        );
      })}
      <button type="button" onClick={addLine}>
        + 新增一筆{label}
      </button>
    </div>
  );
}

export default function JournalEntryTab() {
  const { accounts, entries, inventoryItems, noteCards, addNoteCard, addEntry, deleteEntry } = useApp();
  const selectableAccounts = sortAccountsByCode(accounts.filter((a) => !a.isSummary));
  const inventoryState = computeInventoryState(inventoryItems, entries);
  const noteState = computeNoteState(accounts, noteCards, entries);
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

  function isValidLine(line, side) {
    const account = accounts.find((a) => a.id === line.accountId);
    if (!account || !(Number(line.amount) > 0)) return false;
    if (account.isInventory && (!line.itemId || !(Number(line.qty) > 0))) return false;
    if (account.isNoteAccount) {
      if (isNoteIncreaseLine(account, side)) {
        if (!line.party.trim()) return false;
      } else if (!line.noteId) {
        return false;
      }
    }
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const validDebits = debits.filter((l) => isValidLine(l, 'debit'));
    const validCredits = credits.filter((l) => isValidLine(l, 'credit'));

    if (!description.trim()) {
      setError('請輸入摘要說明');
      return;
    }
    if (validDebits.length === 0 || validCredits.length === 0) {
      setError('借方與貸方至少各需一筆有效分錄');
      return;
    }

    // 檢查銷貨（貸方存貨）品項數量是否足夠
    const soldQtyByItem = {};
    validCredits.forEach((l) => {
      const account = accounts.find((a) => a.id === l.accountId);
      if (account?.isInventory) {
        soldQtyByItem[l.itemId] = (soldQtyByItem[l.itemId] || 0) + Number(l.qty);
      }
    });
    for (const itemId of Object.keys(soldQtyByItem)) {
      const available = inventoryState[itemId]?.qty || 0;
      if (soldQtyByItem[itemId] > available) {
        const item = inventoryItems.find((it) => it.id === itemId);
        setError(`品項「${item?.name || itemId}」現有數量不足（現有 ${formatNumber(available)}）`);
        return;
      }
    }

    // 【修改四】檢查票據沖銷金額是否超過該票據未沖銷餘額
    const settleAmountByNote = {};
    [
      ...validDebits.map((l) => ({ l, side: 'debit' })),
      ...validCredits.map((l) => ({ l, side: 'credit' })),
    ].forEach(({ l, side }) => {
      const account = accounts.find((a) => a.id === l.accountId);
      if (account?.isNoteAccount && !isNoteIncreaseLine(account, side)) {
        settleAmountByNote[l.noteId] = (settleAmountByNote[l.noteId] || 0) + Number(l.amount);
      }
    });
    for (const noteId of Object.keys(settleAmountByNote)) {
      const remaining = noteState[noteId]?.remaining || 0;
      if (settleAmountByNote[noteId] - remaining > 0.005) {
        const card = noteCards.find((c) => c.id === noteId);
        setError(`票據「${card?.party || ''} ${card?.noteNumber || noteId}」沖銷金額超過未沖銷餘額（餘額 ${formatNumber(remaining)}）`);
        return;
      }
    }

    const dTotal = validDebits.reduce((s, l) => s + Number(l.amount), 0);
    const cTotal = validCredits.reduce((s, l) => s + Number(l.amount), 0);
    if (Math.abs(dTotal - cTotal) >= 0.005) {
      setError(`借貸不平衡！借方合計 ${formatNumber(dTotal)}，貸方合計 ${formatNumber(cTotal)}`);
      return;
    }

    function toLine(l, side) {
      const account = accounts.find((a) => a.id === l.accountId);
      const base = { accountId: l.accountId, amount: Number(l.amount) };
      if (account?.isInventory) {
        return { ...base, itemId: l.itemId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0 };
      }
      if (account?.isNoteAccount) {
        if (isNoteIncreaseLine(account, side)) {
          const newId = addNoteCard(account.id, {
            party: l.party.trim(),
            amount: Number(l.amount),
            noteNumber: l.noteNumber.trim(),
            issueDate: l.issueDate,
            dueDate: l.dueDate,
            bankAccount: l.bankAccount.trim(),
          });
          return { ...base, noteId: newId };
        }
        return { ...base, noteId: l.noteId };
      }
      return base;
    }

    addEntry({
      date,
      description: description.trim(),
      debits: validDebits.map((l) => toLine(l, 'debit')),
      credits: validCredits.map((l) => toLine(l, 'credit')),
    });
    resetForm();
  }

  function accountLabel(id) {
    const acc = accounts.find((a) => a.id === id);
    return acc ? `${acc.code} ${acc.name}` : '(已刪除科目)';
  }

  function itemLabel(id) {
    const item = inventoryItems.find((it) => it.id === id);
    return item ? item.name || '(未命名品項)' : '(已刪除品項)';
  }

  function noteLabel(id) {
    const card = noteCards.find((c) => c.id === id);
    return card ? `${card.party || '(未命名)'}／${card.noteNumber || '(無號碼)'}` : '(已刪除票據)';
  }

  function renderLine(l, i) {
    return (
      <div key={i}>
        {accountLabel(l.accountId)}
        {l.itemId ? ` ［${itemLabel(l.itemId)} x ${formatNumber(l.qty)}］` : ''}
        {l.noteId ? ` ［${noteLabel(l.noteId)}］` : ''}{' '}
        <span className="num-cell">{formatNumber(l.amount)}</span>
      </div>
    );
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

        <p className="hint-text">
          當借貸方選到存貨科目時：借方＝進貨（輸入品項、數量、單位成本），貸方＝銷貨（輸入品項與數量，成本依目前加權平均單位成本自動計算）。
          當借貸方選到應收/應付票據科目時：與科目正常餘額方向同側＝新增票據（填入對象等票據卡欄位），異側＝沖銷既有票據（選擇特定一張票據，可部分沖銷）。
        </p>

        <div className="entry-lines">
          <LineEditor
            label="借方"
            mode="debit"
            lines={debits}
            setLines={setDebits}
            accounts={selectableAccounts}
            inventoryItems={inventoryItems}
            inventoryState={inventoryState}
            noteCards={noteCards}
            noteState={noteState}
          />
          <LineEditor
            label="貸方"
            mode="credit"
            lines={credits}
            setLines={setCredits}
            accounts={selectableAccounts}
            inventoryItems={inventoryItems}
            inventoryState={inventoryState}
            noteCards={noteCards}
            noteState={noteState}
          />
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
              <td>{entry.debits.map(renderLine)}</td>
              <td>{entry.credits.map(renderLine)}</td>
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
