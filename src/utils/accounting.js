// 千分位格式化，保留原始正負號
export function formatNumber(value) {
  const n = Number(value) || 0;
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ============================================================
// 【修改一】借貸分欄開帳：正常餘額方向一律以科目自身的 normalBalance 為準
// （不再單純依科目 type 推定，因備抵損失、累計折舊等抵銷科目的正常
//   餘額方向與其 type 相反）
// ============================================================
export function isDebitNormal(account) {
  return account?.normalBalance === '借方';
}

// 取出某科目的開帳借方/貸方金額（未設定時視為 0/0）
export function getOpeningEntry(openingBalances, accountId) {
  const ob = openingBalances[accountId];
  return { debit: Number(ob?.debit || 0), credit: Number(ob?.credit || 0) };
}

// 開帳借方金額加總、貸方金額加總（最底層的借貸相等驗算，非資產=負債+權益）
export function sumOpeningDebitCredit(accounts, openingBalances) {
  return accounts.reduce(
    (acc, a) => {
      if (a.isSummary) return acc;
      const { debit, credit } = getOpeningEntry(openingBalances, a.id);
      acc.debitTotal += debit;
      acc.creditTotal += credit;
      return acc;
    },
    { debitTotal: 0, creditTotal: 0 }
  );
}

// 依科目正常餘額方向，將開帳借方/貸方金額換算為單一淨額（分類帳期初餘額用）
export function openingNetBalance(account, openingBalances) {
  const { debit, credit } = getOpeningEntry(openingBalances, account.id);
  return isDebitNormal(account) ? debit - credit : credit - debit;
}
// ============================================================
// 【修改一結束】
// ============================================================

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
// 正常餘額為借方的科目：借方增加、貸方減少；正常餘額為貸方的科目：貸方增加、借方減少
export function computeEndingBalances(accounts, openingBalances, entries) {
  const { debitTotals, creditTotals } = sumEntriesByAccount(entries);
  const balances = {};
  accounts.forEach((acc) => {
    const opening = getOpeningEntry(openingBalances, acc.id);
    const debit = opening.debit + (debitTotals[acc.id] || 0);
    const credit = opening.credit + (creditTotals[acc.id] || 0);
    balances[acc.id] = isDebitNormal(acc) ? debit - credit : credit - debit;
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

// 科目的「中分類」：其上層（彙總）科目的名稱
export function accountMidCategory(accounts, account) {
  if (!account.parent) return '—';
  const parent = accounts.find((a) => a.code === account.parent);
  return parent ? parent.name : '—';
}

// ============================================================
// 【修改二】存貨明細（品項／單價／數量）
// ============================================================
export function isInventoryAccount(accounts, accountId) {
  return !!accounts.find((a) => a.id === accountId)?.isInventory;
}

// 單一品項的期初金額（單位成本 × 期初數量）
export function inventoryOpeningValue(item) {
  return Number(item.openingQty || 0) * Number(item.openingUnitCost || 0);
}

// 依科目彙總所有品項的期初金額，作為該存貨科目的期初餘額
export function computeInventoryOpeningTotals(inventoryItems) {
  const totals = {};
  inventoryItems.forEach((item) => {
    totals[item.accountId] = (totals[item.accountId] || 0) + inventoryOpeningValue(item);
  });
  return totals;
}

// 依「期初品項 + 分錄中的進貨/銷貨異動」重播，算出每個品項目前的數量與金額
// 分錄借方（進貨）：qty、amount 直接累加
// 分錄貸方（銷貨）：qty、amount 直接扣除（amount 為分錄登錄當下依加權平均法算好的成本）
export function computeInventoryState(inventoryItems, entries) {
  const state = {};
  inventoryItems.forEach((item) => {
    state[item.id] = { qty: Number(item.openingQty || 0), value: inventoryOpeningValue(item) };
  });
  entries.forEach((entry) => {
    entry.debits.forEach((d) => {
      if (d.itemId && state[d.itemId]) {
        state[d.itemId].qty += Number(d.qty || 0);
        state[d.itemId].value += Number(d.amount || 0);
      }
    });
    entry.credits.forEach((c) => {
      if (c.itemId && state[c.itemId]) {
        state[c.itemId].qty -= Number(c.qty || 0);
        state[c.itemId].value -= Number(c.amount || 0);
      }
    });
  });
  return state;
}

// 品項目前的加權平均單位成本
export function inventoryAvgCost(state, itemId) {
  const s = state[itemId];
  if (!s || !s.qty) return 0;
  return s.value / s.qty;
}
// ============================================================
// 【修改二結束】
// ============================================================

// ============================================================
// 【修改三】不動產廠房設備資產卡（資產名稱／取得日期／成本／殘值／耐用年限／折舊方法／累計折舊）
// ============================================================

// 該科目是否為「累計折舊」配對科目（其他成本科目的 depreciationAccountCode 指向它）
export function isDepreciationPairAccount(accounts, account) {
  return accounts.some((a) => a.isFixedAsset && a.depreciationAccountCode === account.code);
}

// 開帳時，存貨／不動產廠房設備／應收應付票據的科目金額皆改由明細（品項／資產卡／票據卡）加總而來，不可手動輸入
export function isDerivedOpeningAccount(accounts, accountId) {
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return false;
  if (acc.isInventory || acc.isFixedAsset || acc.isNoteAccount) return true;
  return isDepreciationPairAccount(accounts, acc);
}

// 依資產卡彙總「成本科目」的開帳借方金額、「配對累計折舊科目」的開帳貸方金額
export function computeFixedAssetOpeningTotals(accounts, fixedAssetCards) {
  const costTotals = {};
  const accumDepTotals = {};
  fixedAssetCards.forEach((card) => {
    costTotals[card.accountId] = (costTotals[card.accountId] || 0) + Number(card.cost || 0);
    const costAccount = accounts.find((a) => a.id === card.accountId);
    const depAccount = costAccount && accounts.find((a) => a.code === costAccount.depreciationAccountCode);
    if (depAccount) {
      accumDepTotals[depAccount.id] = (accumDepTotals[depAccount.id] || 0) + Number(card.openingAccumulatedDepreciation || 0);
    }
  });
  return { costTotals, accumDepTotals };
}

// 依「取得日期、成本、殘值、耐用年限、折舊方法」計算「理論上每年應提折舊金額」
// 僅供年底調整分錄的參考，與開帳時登記的既有累計折舊（題目給定的既定事實）無關，不會互相影響
export function computeAnnualDepreciation(card) {
  const cost = Number(card.cost || 0);
  const life = Number(card.usefulLife || 0);
  if (!life) return 0;
  if (card.depreciationMethod === '倍數餘額遞減法') {
    const rate = 2 / life;
    const bookValue = Math.max(cost - Number(card.openingAccumulatedDepreciation || 0), 0);
    return bookValue * rate;
  }
  const residual = Number(card.residualValue || 0);
  return Math.max((cost - residual) / life, 0);
}
// ============================================================
// 【修改三結束】
// ============================================================

// ============================================================
// 【修改四】應收/應付票據明細卡（對象／金額／票據號碼／開票日／到期日／[支票帳戶]）
// ============================================================

// 依科目彙總「開帳時建立」的票據卡金額，作為該票據科目的期初餘額
// 分錄登錄時新增的票據（fromOpening 為 false）不計入期初餘額，其金額已經由該筆分錄自身反映在借貸金額中
export function computeNoteOpeningTotals(noteCards) {
  const totals = {};
  noteCards.forEach((card) => {
    if (!card.fromOpening) return;
    totals[card.accountId] = (totals[card.accountId] || 0) + Number(card.amount || 0);
  });
  return totals;
}

// 某一筆分錄借/貸方分錄行，對票據科目而言是「新增票據」還是「沖銷既有票據」
// 與科目正常餘額方向同側 → 新增（如應收票據借方增加、應付票據貸方增加）
// 異側 → 沖銷（到期兌現／償還，如應收票據貸方減少、應付票據借方減少）
export function isNoteIncreaseLine(account, side) {
  return (side === 'debit') === isDebitNormal(account);
}

// 依「期初票據卡金額 + 分錄中新增/沖銷票據的異動」重播，算出每張票據卡目前的未沖銷餘額
// 開帳建立的票據卡（fromOpening）以卡片金額作為起始餘額；分錄登錄時新增的票據卡起始餘額為 0，
// 其金額改由建立當下那筆分錄的借/貸金額計入（避免與卡片金額重複計算）
export function computeNoteState(accounts, noteCards, entries) {
  const state = {};
  noteCards.forEach((card) => {
    state[card.id] = { remaining: card.fromOpening ? Number(card.amount || 0) : 0 };
  });
  function applyLine(line, side) {
    if (!line.noteId || !state[line.noteId]) return;
    const account = accounts.find((a) => a.id === line.accountId);
    const delta = isNoteIncreaseLine(account, side) ? Number(line.amount || 0) : -Number(line.amount || 0);
    state[line.noteId].remaining += delta;
  }
  entries.forEach((entry) => {
    entry.debits.forEach((d) => applyLine(d, 'debit'));
    entry.credits.forEach((c) => applyLine(c, 'credit'));
  });
  return state;
}
// ============================================================
// 【修改四結束】
// ============================================================
