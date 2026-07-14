import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  computeInventoryState,
  computeAdvanceState,
  computeArApState,
  computeNoteState,
  entryCreditTotal,
  entryDebitTotal,
  formatNumber,
  inventoryAvgCost,
  isAdvanceIncreaseLine,
  isAmortizedIncreaseLine,
  isArApIncreaseLine,
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
    price: '',
    noteId: '',
    arApId: '',
    advanceId: '',
    amortizationId: '',
    party: '',
    noteNumber: '',
    issueDate: '',
    dueDate: '',
    bankAccount: '',
    amortName: '',
    amortStartDate: '',
    amortMonths: '',
    amortTaxAmount: '',
    note: '',
  };
}

// 是否為觸發「品項明細輸入模式」的科目：存貨（進貨/銷貨扣庫存）、銷貨收入（售價×數量）、銷貨成本（成本×數量）
function isItemAccount(account) {
  return !!(account?.isInventory || account?.isSalesRevenueAccount || account?.isCogsAccount);
}

// 該科目是否已有專屬的明細卡輸入介面（存貨/銷貨品項、票據、應收應付帳款、預付/預收貨款、攤銷明細卡）
// 有明細卡的科目已經有自己的欄位可供補充說明，不需要再顯示通用備註欄位，避免重複輸入介面
function hasDetailCard(account) {
  return !!(
    isItemAccount(account) ||
    account?.isNoteAccount ||
    account?.isArApAccount ||
    account?.isAdvanceAccount ||
    account?.isAmortizedAccount
  );
}

// mode: 'debit'（存貨＝進貨，增加存貨數量，單位成本可手動輸入；銷貨成本＝依目前加權平均單位成本自動計算）
//       'credit'（存貨＝銷貨，減少存貨數量，成本依目前加權平均單位成本自動計算；銷貨收入＝售價可手動輸入）
function LineEditor({
  label,
  mode,
  lines,
  setLines,
  accounts,
  inventoryItems,
  inventoryState,
  noteCards,
  noteState,
  arApCards,
  arApState,
  advanceCards,
  advanceState,
}) {
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
            price: '',
            noteId: '',
            arApId: '',
            advanceId: '',
            amortizationId: '',
            party: '',
            noteNumber: '',
            issueDate: '',
            dueDate: '',
            bankAccount: '',
            amortName: '',
            amortStartDate: '',
            amortMonths: '',
            amortTaxAmount: '',
            amount: isItemAccount(account) ? '' : merged.amount,
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
        } else if (account?.isCogsAccount) {
          // 銷貨成本：品項＋數量，成本自動代入目前加權平均單位成本（僅供計算金額，不異動庫存）
          const qty = Number(merged.qty) || 0;
          const avgCost = inventoryAvgCost(inventoryState, merged.itemId);
          merged.unitCost = avgCost;
          merged.amount = qty && avgCost ? qty * avgCost : '';
        } else if (account?.isSalesRevenueAccount) {
          // 銷貨收入：品項＋售價（手動輸入）＋數量，金額＝售價×數量
          const qty = Number(merged.qty) || 0;
          const price = Number(merged.price) || 0;
          merged.amount = qty && price ? qty * price : '';
        }

        // 【修改四】沖銷既有票據時，預設帶入該票據目前的未沖銷餘額作為金額（可手動調整為部分沖銷）
        if (account?.isNoteAccount && !isNoteIncreaseLine(account, mode) && 'noteId' in patch) {
          const remaining = noteState[patch.noteId]?.remaining || 0;
          if (!merged.amount) merged.amount = remaining || '';
        }

        // 【修改七】收款/付款沖銷既有客戶/廠商欠款時，預設帶入目前未沖銷餘額作為金額（可手動調整為部分沖銷）
        if (account?.isArApAccount && !isArApIncreaseLine(account, mode) && 'arApId' in patch) {
          const remaining = arApState[patch.arApId]?.remaining || 0;
          if (!merged.amount) merged.amount = remaining || '';
        }

        // 貨到沖銷既有預付/預收貨款時，預設帶入目前未沖銷餘額作為金額（可手動調整為部分沖銷）
        if (account?.isAdvanceAccount && !isAdvanceIncreaseLine(account, mode) && 'advanceId' in patch) {
          const remaining = advanceState[patch.advanceId]?.remaining || 0;
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
        // 存貨科目的品項僅限該存貨科目底下的品項；銷貨收入／銷貨成本不綁定單一存貨科目，可選任何品項
        const items = account?.isInventory
          ? inventoryItems.filter((it) => it.accountId === account.id)
          : account?.isCogsAccount || account?.isSalesRevenueAccount
          ? inventoryItems
          : [];
        const available = line.itemId ? inventoryState[line.itemId]?.qty || 0 : 0;
        const insufficient = account?.isInventory && mode === 'credit' && line.itemId && Number(line.qty) > available;

        const noteIncrease = account?.isNoteAccount && isNoteIncreaseLine(account, mode);
        const noteSettle = account?.isNoteAccount && !isNoteIncreaseLine(account, mode);
        const settleOptions = noteSettle
          ? noteCards.filter((c) => c.accountId === account.id && (noteState[c.id]?.remaining || 0) > 0.005)
          : [];
        const settleRemaining = line.noteId ? noteState[line.noteId]?.remaining || 0 : 0;
        const settleExceeded = noteSettle && line.noteId && Number(line.amount) - settleRemaining > 0.005;

        const arApIncrease = account?.isArApAccount && isArApIncreaseLine(account, mode);
        const arApSettle = account?.isArApAccount && !isArApIncreaseLine(account, mode);
        const arApSettleOptions = arApSettle
          ? arApCards.filter((c) => c.accountId === account.id && (arApState[c.id]?.remaining || 0) > 0.005)
          : [];
        const arApSettleRemaining = line.arApId ? arApState[line.arApId]?.remaining || 0 : 0;
        const arApSettleExceeded = arApSettle && line.arApId && Number(line.amount) - arApSettleRemaining > 0.005;

        const advanceIncrease = account?.isAdvanceAccount && isAdvanceIncreaseLine(account, mode);
        const advanceSettle = account?.isAdvanceAccount && !isAdvanceIncreaseLine(account, mode);
        const advanceSettleOptions = advanceSettle
          ? advanceCards.filter((c) => c.accountId === account.id && (advanceState[c.id]?.remaining || 0) > 0.005)
          : [];
        const advanceSettleRemaining = line.advanceId ? advanceState[line.advanceId]?.remaining || 0 : 0;
        const advanceSettleExceeded =
          advanceSettle && line.advanceId && Number(line.amount) - advanceSettleRemaining > 0.005;

        // 預付費用/預收收入：與科目正常餘額方向同側＝新增一張攤銷明細卡（金額＝未稅金額，攤銷/認列依日期自動試算）
        // 異側目前無沖銷機制，維持一般金額輸入
        const amortizedIncrease = account?.isAmortizedAccount && isAmortizedIncreaseLine(account, mode);
        const amortizedIsRevenueSide = amortizedIncrease && !isDebitNormal(account);

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
              {isItemAccount(account) ? (
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
            {account && !hasDetailCard(account) && (
              <div className="line-row">
                <input
                  className="note-input"
                  placeholder="備註（選填）"
                  value={line.note}
                  onChange={(e) => updateLine(idx, { note: e.target.value })}
                />
              </div>
            )}
            {isItemAccount(account) && (
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
                {account?.isInventory && mode === 'debit' && (
                  <input
                    type="number"
                    className="num-input"
                    placeholder="單位成本"
                    value={line.unitCost}
                    onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                  />
                )}
                {account?.isInventory && mode === 'credit' && (
                  <span className="hint-text">
                    加權平均單位成本 {formatNumber(inventoryAvgCost(inventoryState, line.itemId))}
                    　現有數量 {formatNumber(available)}
                  </span>
                )}
                {account?.isCogsAccount && (
                  <span className="hint-text">
                    加權平均單位成本（銷貨成本） {formatNumber(inventoryAvgCost(inventoryState, line.itemId))}
                  </span>
                )}
                {account?.isSalesRevenueAccount && (
                  <input
                    type="number"
                    className="num-input"
                    placeholder="售價"
                    value={line.price}
                    onChange={(e) => updateLine(idx, { price: e.target.value })}
                  />
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
                  <>
                    <input
                      className={
                        line.bankAccount.trim() && !accounts.some((a) => a.code === line.bankAccount.trim())
                          ? 'input-warning'
                          : ''
                      }
                      placeholder="請輸入科目代號，例如：1112"
                      value={line.bankAccount}
                      onChange={(e) => updateLine(idx, { bankAccount: e.target.value })}
                    />
                    {line.bankAccount.trim() && !accounts.some((a) => a.code === line.bankAccount.trim()) && (
                      <span className="warning-text">⚠ 查無此科目代號</span>
                    )}
                  </>
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

            {arApIncrease && (
              <div className="line-row inventory-line">
                <input
                  placeholder={isDebitNormal(account) ? '客戶名稱' : '廠商名稱'}
                  value={line.party}
                  onChange={(e) => updateLine(idx, { party: e.target.value })}
                />
              </div>
            )}
            {arApSettle && (
              <div className="line-row inventory-line">
                <select value={line.arApId} onChange={(e) => updateLine(idx, { arApId: e.target.value })}>
                  <option value="">選擇要{isDebitNormal(account) ? '收款' : '付款'}沖銷的對象</option>
                  {arApSettleOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.party || '(未命名)'}（餘額 {formatNumber(arApState[c.id]?.remaining || 0)}）
                    </option>
                  ))}
                </select>
                {line.arApId && (
                  <span className="hint-text">未沖銷餘額 {formatNumber(arApSettleRemaining)}</span>
                )}
              </div>
            )}
            {arApSettleExceeded && (
              <p className="error-text">沖銷金額超過此對象未沖銷餘額（餘額 {formatNumber(arApSettleRemaining)}）</p>
            )}

            {advanceIncrease && (
              <div className="line-row inventory-line">
                <input
                  placeholder={isDebitNormal(account) ? '廠商名稱' : '客戶名稱'}
                  value={line.party}
                  onChange={(e) => updateLine(idx, { party: e.target.value })}
                />
              </div>
            )}
            {advanceSettle && (
              <div className="line-row inventory-line">
                <select value={line.advanceId} onChange={(e) => updateLine(idx, { advanceId: e.target.value })}>
                  <option value="">選擇要沖銷的對象</option>
                  {advanceSettleOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.party || '(未命名)'}（餘額 {formatNumber(advanceState[c.id]?.remaining || 0)}）
                    </option>
                  ))}
                </select>
                {line.advanceId && (
                  <span className="hint-text">未沖銷餘額 {formatNumber(advanceSettleRemaining)}</span>
                )}
              </div>
            )}
            {advanceSettleExceeded && (
              <p className="error-text">沖銷金額超過此對象未沖銷餘額（餘額 {formatNumber(advanceSettleRemaining)}）</p>
            )}

            {amortizedIncrease && (
              <div className="line-row inventory-line">
                <input
                  style={{ flex: 1, minWidth: 120 }}
                  placeholder="項目名稱"
                  value={line.amortName}
                  onChange={(e) => updateLine(idx, { amortName: e.target.value })}
                />
                <input
                  style={{ flex: 1, minWidth: 120 }}
                  placeholder={amortizedIsRevenueSide ? '客戶名稱' : '對象（選填）'}
                  value={line.party}
                  onChange={(e) => updateLine(idx, { party: e.target.value })}
                />
                <input
                  style={{ flex: 1, minWidth: 120 }}
                  type="date"
                  title="生效日期"
                  value={line.amortStartDate}
                  onChange={(e) => updateLine(idx, { amortStartDate: e.target.value })}
                />
                <input
                  type="number"
                  className="num-input"
                  placeholder="攤銷期間（月）"
                  value={line.amortMonths}
                  onChange={(e) => updateLine(idx, { amortMonths: e.target.value })}
                />
                {amortizedIsRevenueSide && (
                  <input
                    type="number"
                    className="num-input"
                    placeholder="稅額"
                    value={line.amortTaxAmount}
                    onChange={(e) => updateLine(idx, { amortTaxAmount: e.target.value })}
                  />
                )}
              </div>
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
  const {
    accounts,
    entries,
    inventoryItems,
    noteCards,
    addNoteCard,
    updateNoteCard,
    deleteNoteCard,
    arApCards,
    addArApCard,
    updateArApCard,
    deleteArApCard,
    advanceCards,
    addAdvanceCard,
    updateAdvanceCard,
    deleteAdvanceCard,
    amortizationCards,
    addAmortizationCard,
    updateAmortizationCard,
    deleteAmortizationCard,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useApp();
  const selectableAccounts = sortAccountsByCode(accounts.filter((a) => !a.isSummary));
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [debits, setDebits] = useState([emptyLine()]);
  const [credits, setCredits] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  // 編輯既有分錄時，先把該筆分錄從重播計算中排除（等同「先還原」原本的異動），
  // 讓存貨/票據/應收應付/預付預收的餘額與可沖銷選項回到「這筆分錄尚未存在」的狀態；
  // 送出時再用新內容整筆覆蓋回去（等同「再套用」），全程不需要手動計算差額
  const entriesForState = editingId ? entries.filter((e) => e.id !== editingId) : entries;
  const inventoryState = computeInventoryState(accounts, inventoryItems, entriesForState);
  const noteState = computeNoteState(accounts, noteCards, entriesForState);
  const arApState = computeArApState(accounts, arApCards, entriesForState);
  const advanceState = computeAdvanceState(accounts, advanceCards, entriesForState);

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
    setEditingId(null);
  }

  // 把已儲存的分錄行還原成表單可編輯的格式：對於「新增明細卡」那一側的分錄行，
  // 額外把當初建立的卡片內容（對象/票據號碼/項目名稱等）帶回表單，讓使用者可以直接修改
  function lineFromStored(l, side) {
    const account = accounts.find((a) => a.id === l.accountId);
    const line = { ...emptyLine(), accountId: l.accountId, amount: l.amount, note: l.note || '' };
    if (!account) return line;
    if (account.isInventory || account.isCogsAccount) {
      line.itemId = l.itemId || '';
      line.qty = l.qty ?? '';
      line.unitCost = l.unitCost ?? '';
    } else if (account.isSalesRevenueAccount) {
      line.itemId = l.itemId || '';
      line.qty = l.qty ?? '';
      line.price = l.price ?? '';
    } else if (account.isNoteAccount) {
      line.noteId = l.noteId || '';
      if (isNoteIncreaseLine(account, side)) {
        const card = noteCards.find((c) => c.id === l.noteId);
        if (card) {
          line.party = card.party || '';
          line.noteNumber = card.noteNumber || '';
          line.issueDate = card.issueDate || '';
          line.dueDate = card.dueDate || '';
          line.bankAccount = card.bankAccount || '';
        }
      }
    } else if (account.isArApAccount) {
      line.arApId = l.arApId || '';
      if (isArApIncreaseLine(account, side)) {
        const card = arApCards.find((c) => c.id === l.arApId);
        if (card) line.party = card.party || '';
      }
    } else if (account.isAdvanceAccount) {
      line.advanceId = l.advanceId || '';
      if (isAdvanceIncreaseLine(account, side)) {
        const card = advanceCards.find((c) => c.id === l.advanceId);
        if (card) line.party = card.party || '';
      }
    } else if (account.isAmortizedAccount) {
      line.amortizationId = l.amortizationId || '';
      if (isAmortizedIncreaseLine(account, side)) {
        const card = amortizationCards.find((c) => c.id === l.amortizationId);
        if (card) {
          line.amortName = card.name || '';
          line.party = card.party || '';
          line.amortStartDate = card.startDate || '';
          line.amortMonths = card.months ?? '';
          line.amortTaxAmount = card.taxAmount ?? '';
        }
      }
    }
    return line;
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setDescription(entry.description);
    setDebits(entry.debits.map((l) => lineFromStored(l, 'debit')));
    setCredits(entry.credits.map((l) => lineFromStored(l, 'credit')));
    setError('');
  }

  function cancelEdit() {
    resetForm();
  }

  // 蒐集某一側分錄行中，屬於「新增明細卡」（與科目正常餘額方向同側）的卡片參照，
  // 用來比對編輯前後哪些卡片已經不再被使用（需要刪除，避免殘留錯誤資料）
  function collectCreatedCardRefs(lines, side) {
    const refs = [];
    (lines || []).forEach((l) => {
      const account = accounts.find((a) => a.id === l.accountId);
      if (!account) return;
      if (account.isNoteAccount && isNoteIncreaseLine(account, side) && l.noteId) {
        refs.push({ type: 'note', id: l.noteId });
      }
      if (account.isArApAccount && isArApIncreaseLine(account, side) && l.arApId) {
        refs.push({ type: 'arap', id: l.arApId });
      }
      if (account.isAdvanceAccount && isAdvanceIncreaseLine(account, side) && l.advanceId) {
        refs.push({ type: 'advance', id: l.advanceId });
      }
      if (account.isAmortizedAccount && isAmortizedIncreaseLine(account, side) && l.amortizationId) {
        refs.push({ type: 'amort', id: l.amortizationId });
      }
    });
    return refs;
  }

  function deleteCardRef(ref) {
    if (ref.type === 'note') deleteNoteCard(ref.id);
    else if (ref.type === 'arap') deleteArApCard(ref.id);
    else if (ref.type === 'advance') deleteAdvanceCard(ref.id);
    else if (ref.type === 'amort') deleteAmortizationCard(ref.id);
  }

  // 該筆分錄行是否「已選科目但缺少必填欄位」，回傳具體錯誤訊息；未選科目（空白列）回傳 null 視為可略過
  function lineIssue(line, side) {
    const account = accounts.find((a) => a.id === line.accountId);
    if (!account) return null;
    const label = `${account.code} ${account.name}`;
    if (!(Number(line.amount) > 0)) return `「${label}」尚未輸入金額`;
    if (isItemAccount(account)) {
      if (!line.itemId) return `「${label}」尚未選擇品項`;
      if (!(Number(line.qty) > 0)) return `「${label}」尚未輸入數量`;
    }
    if (account.isNoteAccount) {
      if (isNoteIncreaseLine(account, side)) {
        if (!line.party.trim()) return `「${label}」尚未輸入${isDebitNormal(account) ? '客戶' : '廠商'}名稱`;
      } else if (!line.noteId) {
        return `「${label}」尚未選擇要沖銷的票據`;
      }
    }
    if (account.isArApAccount) {
      if (isArApIncreaseLine(account, side)) {
        if (!line.party.trim()) return `「${label}」尚未輸入${isDebitNormal(account) ? '客戶' : '廠商'}名稱`;
      } else if (!line.arApId) {
        return `「${label}」尚未選擇要${isDebitNormal(account) ? '收款' : '付款'}沖銷的對象`;
      }
    }
    if (account.isAdvanceAccount) {
      if (isAdvanceIncreaseLine(account, side)) {
        if (!line.party.trim()) return `「${label}」尚未輸入對象名稱`;
      } else if (!line.advanceId) {
        return `「${label}」尚未選擇要沖銷的對象`;
      }
    }
    if (account.isAmortizedAccount && isAmortizedIncreaseLine(account, side)) {
      if (!line.amortName.trim()) return `「${label}」尚未輸入項目名稱`;
    }
    return null;
  }

  function isValidLine(line, side) {
    return !!accounts.find((a) => a.id === line.accountId) && !lineIssue(line, side);
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!description.trim()) {
      setError('請輸入摘要說明');
      return;
    }

    // 逐筆檢查已選科目但漏填必要欄位的分錄行，避免無聲無息地被略過而不提示原因
    for (const { l, side } of [
      ...debits.map((l) => ({ l, side: 'debit' })),
      ...credits.map((l) => ({ l, side: 'credit' })),
    ]) {
      const issue = lineIssue(l, side);
      if (issue) {
        setError(issue);
        return;
      }
    }

    const validDebits = debits.filter((l) => isValidLine(l, 'debit'));
    const validCredits = credits.filter((l) => isValidLine(l, 'credit'));

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

    // 【修改七】檢查應收/應付帳款沖銷金額是否超過該對象未沖銷餘額
    const settleAmountByArAp = {};
    [
      ...validDebits.map((l) => ({ l, side: 'debit' })),
      ...validCredits.map((l) => ({ l, side: 'credit' })),
    ].forEach(({ l, side }) => {
      const account = accounts.find((a) => a.id === l.accountId);
      if (account?.isArApAccount && !isArApIncreaseLine(account, side)) {
        settleAmountByArAp[l.arApId] = (settleAmountByArAp[l.arApId] || 0) + Number(l.amount);
      }
    });
    for (const arApId of Object.keys(settleAmountByArAp)) {
      const remaining = arApState[arApId]?.remaining || 0;
      if (settleAmountByArAp[arApId] - remaining > 0.005) {
        const card = arApCards.find((c) => c.id === arApId);
        setError(`對象「${card?.party || arApId}」沖銷金額超過未沖銷餘額（餘額 ${formatNumber(remaining)}）`);
        return;
      }
    }

    // 檢查預付/預收貨款沖銷金額是否超過該對象未沖銷餘額
    const settleAmountByAdvance = {};
    [
      ...validDebits.map((l) => ({ l, side: 'debit' })),
      ...validCredits.map((l) => ({ l, side: 'credit' })),
    ].forEach(({ l, side }) => {
      const account = accounts.find((a) => a.id === l.accountId);
      if (account?.isAdvanceAccount && !isAdvanceIncreaseLine(account, side)) {
        settleAmountByAdvance[l.advanceId] = (settleAmountByAdvance[l.advanceId] || 0) + Number(l.amount);
      }
    });
    for (const advanceId of Object.keys(settleAmountByAdvance)) {
      const remaining = advanceState[advanceId]?.remaining || 0;
      if (settleAmountByAdvance[advanceId] - remaining > 0.005) {
        const card = advanceCards.find((c) => c.id === advanceId);
        setError(`對象「${card?.party || advanceId}」沖銷金額超過未沖銷餘額（餘額 ${formatNumber(remaining)}）`);
        return;
      }
    }

    // 【介面修正三】支票帳戶欄位只接受既有科目代號，儲存前擋下無效輸入
    for (const l of validCredits.concat(validDebits)) {
      const account = accounts.find((a) => a.id === l.accountId);
      if (account?.isNoteAccount && l.bankAccount?.trim() && !accounts.some((a) => a.code === l.bankAccount.trim())) {
        setError(`支票帳戶「${l.bankAccount}」不是有效的科目代號，請輸入正確的科目代號（例如：1112）`);
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
      const base = { accountId: l.accountId, amount: Number(l.amount), note: hasDetailCard(account) ? '' : l.note.trim() };
      if (account?.isInventory || account?.isCogsAccount) {
        return { ...base, itemId: l.itemId, qty: Number(l.qty), unitCost: Number(l.unitCost) || 0 };
      }
      if (account?.isSalesRevenueAccount) {
        return { ...base, itemId: l.itemId, qty: Number(l.qty), price: Number(l.price) || 0 };
      }
      if (account?.isNoteAccount) {
        if (isNoteIncreaseLine(account, side)) {
          const cardFields = {
            party: l.party.trim(),
            amount: Number(l.amount),
            noteNumber: l.noteNumber.trim(),
            issueDate: l.issueDate,
            dueDate: l.dueDate,
            bankAccount: l.bankAccount.trim(),
          };
          const reuseId = l.noteId && noteCards.some((c) => c.id === l.noteId) ? l.noteId : null;
          if (reuseId) {
            updateNoteCard(reuseId, cardFields);
            return { ...base, noteId: reuseId };
          }
          const newId = addNoteCard(account.id, cardFields);
          return { ...base, noteId: newId };
        }
        return { ...base, noteId: l.noteId };
      }
      if (account?.isArApAccount) {
        if (isArApIncreaseLine(account, side)) {
          const cardFields = { party: l.party.trim(), amount: Number(l.amount) };
          const reuseId = l.arApId && arApCards.some((c) => c.id === l.arApId) ? l.arApId : null;
          if (reuseId) {
            updateArApCard(reuseId, cardFields);
            return { ...base, arApId: reuseId };
          }
          const newId = addArApCard(account.id, cardFields);
          return { ...base, arApId: newId };
        }
        return { ...base, arApId: l.arApId };
      }
      if (account?.isAdvanceAccount) {
        if (isAdvanceIncreaseLine(account, side)) {
          const cardFields = { party: l.party.trim(), amount: Number(l.amount) };
          const reuseId = l.advanceId && advanceCards.some((c) => c.id === l.advanceId) ? l.advanceId : null;
          if (reuseId) {
            updateAdvanceCard(reuseId, cardFields);
            return { ...base, advanceId: reuseId };
          }
          const newId = addAdvanceCard(account.id, cardFields);
          return { ...base, advanceId: newId };
        }
        return { ...base, advanceId: l.advanceId };
      }
      if (account?.isAmortizedAccount && isAmortizedIncreaseLine(account, side)) {
        const cardFields = {
          name: l.amortName.trim(),
          party: l.party.trim(),
          untaxedAmount: Number(l.amount),
          taxAmount: Number(l.amortTaxAmount) || 0,
          startDate: l.amortStartDate,
          months: Number(l.amortMonths) || 0,
        };
        const reuseId = l.amortizationId && amortizationCards.some((c) => c.id === l.amortizationId) ? l.amortizationId : null;
        if (reuseId) {
          updateAmortizationCard(reuseId, cardFields);
          return { ...base, amortizationId: reuseId };
        }
        const newId = addAmortizationCard(account.id, cardFields);
        return { ...base, amortizationId: newId };
      }
      return base;
    }

    const newDebits = validDebits.map((l) => toLine(l, 'debit'));
    const newCredits = validCredits.map((l) => toLine(l, 'credit'));

    if (editingId) {
      const original = entries.find((e) => e.id === editingId);
      const oldRefs = collectCreatedCardRefs(original?.debits, 'debit').concat(
        collectCreatedCardRefs(original?.credits, 'credit')
      );
      const newRefs = collectCreatedCardRefs(newDebits, 'debit').concat(collectCreatedCardRefs(newCredits, 'credit'));
      oldRefs
        .filter((old) => !newRefs.some((nr) => nr.type === old.type && nr.id === old.id))
        .forEach(deleteCardRef);
      updateEntry(editingId, { date, description: description.trim(), debits: newDebits, credits: newCredits });
    } else {
      addEntry({ date, description: description.trim(), debits: newDebits, credits: newCredits });
    }
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

  function arApLabel(id) {
    const card = arApCards.find((c) => c.id === id);
    return card ? card.party || '(未命名)' : '(已刪除對象)';
  }

  function advanceLabel(id) {
    const card = advanceCards.find((c) => c.id === id);
    return card ? card.party || '(未命名)' : '(已刪除對象)';
  }

  function amortLabel(id) {
    const card = amortizationCards.find((c) => c.id === id);
    return card ? card.name || '(未命名)' : '(已刪除項目)';
  }

  function renderLine(l, i) {
    return (
      <div key={i}>
        {accountLabel(l.accountId)}
        {l.itemId ? ` ［${itemLabel(l.itemId)} x ${formatNumber(l.qty)}］` : ''}
        {l.noteId ? ` ［${noteLabel(l.noteId)}］` : ''}
        {l.arApId ? ` ［${arApLabel(l.arApId)}］` : ''}
        {l.advanceId ? ` ［${advanceLabel(l.advanceId)}］` : ''}
        {l.amortizationId ? ` ［${amortLabel(l.amortizationId)}］` : ''}
        {l.note ? ` ［${l.note}］` : ''}{' '}
        <span className="num-cell">{formatNumber(l.amount)}</span>
      </div>
    );
  }

  return (
    <div>
      <h2>分錄輸入</h2>
      {editingId && <p className="hint-text">正在編輯既有分錄，儲存後會直接覆蓋原本這一筆，不會新增一筆或改變在列表中的位置。</p>}
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
          當借貸方選到存貨科目時：借方＝進貨（輸入品項、數量、單位成本），貸方＝銷貨（輸入品項與數量，成本依目前加權平均單位成本自動計算，並扣減庫存）。
          當貸方選到銷貨收入科目時：輸入品項、售價、數量，金額自動＝售價×數量加總。
          當借方選到銷貨成本科目時：輸入品項與數量，成本依目前加權平均單位成本自動計算（僅計算金額，不重複扣減庫存，庫存異動仍以貸方存貨那一列為準）。
          進行銷貨時建議同時登錄四列：借方應收帳款/現金、借方銷貨成本、貸方銷貨收入、貸方存貨。
          當借貸方選到應收/應付票據、應收/應付帳款、或預付/預收貨款科目時：與科目正常餘額方向同側＝新增票據、客戶/廠商欠款或預付/預收款項（填入對象等欄位），
          異側＝沖銷既有票據、欠款或預付/預收款項（選擇特定對象，可部分沖銷）。
          當借貸方選到預付費用/預收收入科目（啟用攤銷明細卡）時：與科目正常餘額方向同側＝新增一張攤銷明細卡（填入項目名稱、對象、生效日期、攤銷期間），
          金額即為卡片的未稅金額；攤銷/認列金額依生效日期自動試算，不透過分錄沖銷，如需調整已攤銷金額請至「開帳作業」分頁的攤銷明細卡修改。
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
            arApCards={arApCards}
            arApState={arApState}
            advanceCards={advanceCards}
            advanceState={advanceState}
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
            arApCards={arApCards}
            arApState={arApState}
            advanceCards={advanceCards}
            advanceState={advanceState}
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
          {editingId ? '更新分錄' : '儲存分錄'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            取消編輯
          </button>
        )}
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
                <div className="action-buttons">
                  <button type="button" onClick={() => startEdit(entry)}>編輯</button>
                  <button type="button" onClick={() => deleteEntry(entry.id)}>刪除</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
