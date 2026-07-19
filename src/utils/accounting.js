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

// 該科目所屬 type 的「一般」正常餘額方向：資產／費損通常為借方，負債／權益／收益通常為貸方
const DEBIT_NORMAL_TYPES = ['資產', '費損'];

// 將科目餘額換算為「相對於其所屬分類」的正負號：
// 若科目本身的正常餘額方向與所屬分類的一般方向相同 → 原值（正常加項）
// 若相反（即備抵損失、累計折舊、銷貨退回/折讓、進貨退出/折讓等抵銷科目）→ 反號（作為減項）
// 讓抵銷科目在資產/負債/權益/收益/費損總計中正確地被扣除，而不是被誤當成一般加項
export function typeSignedBalance(account, balance) {
  const typeIsDebitNormal = DEBIT_NORMAL_TYPES.includes(account.type);
  const isContra = isDebitNormal(account) !== typeIsDebitNormal;
  return isContra ? -balance : balance;
}

export function sumByTypes(accounts, balances, types) {
  return accounts
    .filter((acc) => types.includes(acc.type))
    .reduce((sum, acc) => sum + typeSignedBalance(acc, balances[acc.id] || 0), 0);
}

export function entryDebitTotal(entry) {
  return entry.debits.reduce((s, d) => s + Number(d.amount || 0), 0);
}

export function entryCreditTotal(entry) {
  return entry.credits.reduce((s, c) => s + Number(c.amount || 0), 0);
}

// 當「上層科目代號」留空時，依代號前綴自動找出現有科目中最長匹配的作為上層科目
export function inferParentCode(accounts, code, excludeId) {
  let best = null;
  accounts.forEach((a) => {
    if (a.id === excludeId || a.code === code) return;
    if (code.startsWith(a.code) && (!best || a.code.length > best.length)) {
      best = a.code;
    }
  });
  return best;
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
// 【修改五】科目樹狀結構：支援彙總科目無限層級疊加（彙總底下可再接子彙總或明細）
// ============================================================

// 依 parent 代號建立科目樹（陣列形式的多層節點：{ account, children: [...] }）
// 找不到對應上層代號的科目視為頂層節點，避免因資料不一致（parent 指向不存在的代號）而遺漏
export function buildAccountTree(accounts) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const childrenByParentCode = new Map();
  const roots = [];
  accounts.forEach((a) => {
    if (a.parent && byCode.has(a.parent)) {
      if (!childrenByParentCode.has(a.parent)) childrenByParentCode.set(a.parent, []);
      childrenByParentCode.get(a.parent).push(a);
    } else {
      roots.push(a);
    }
  });
  function build(acc) {
    const children = sortAccountsByCode(childrenByParentCode.get(acc.code) || []);
    return { account: acc, children: children.map(build) };
  }
  return sortAccountsByCode(roots).map(build);
}

// ============================================================
// 【修改五結束】
// ============================================================

// ============================================================
// 【修改六】顯示分類群組（Level 0 大分類／Level 1 次分類）
// 純粹用於 UI 摺疊顯示：不是真實科目、沒有代號、不參與任何驗算或分錄邏輯。
// 只依「科目代號前幾碼」自動比對分組，新增/調整科目時完全不需要手動指定顯示分類。
// 呈現時共四層：Level 0 顯示分類 → Level 1 顯示分類（可省略）→ Level 2 彙總科目（可省略）→ Level 3 明細科目
// 若要調整分類規則或新增/刪減分類，只需修改這份設定陣列即可，不需更動樹狀建構或渲染邏輯。
// ============================================================
export const defaultDisplayGroupDefs = [
  { level: 0, key: 'assets', label: '1xxx 資產', match: (code) => code.startsWith('1') },
  { level: 0, key: 'liabilities', label: '2xxx 負債', match: (code) => code.startsWith('2') },
  { level: 0, key: 'equity', label: '3xxx 權益', match: (code) => code.startsWith('3') },
  { level: 0, key: 'revenue', label: '4xxx 收益', match: (code) => code.startsWith('4') },
  { level: 0, key: 'expense', label: '5xxx 費損', match: (code) => code.startsWith('5') },

  { level: 1, key: 'current-assets', label: '流動資產', parent: 'assets', match: (code) => code.startsWith('11') },
  { level: 1, key: 'noncurrent-assets', label: '非流動資產', parent: 'assets', match: (code) => code.startsWith('12') },
  { level: 1, key: 'current-liabilities', label: '流動負債', parent: 'liabilities', match: (code) => code.startsWith('21') },
  {
    level: 1,
    key: 'noncurrent-liabilities',
    label: '非流動負債',
    parent: 'liabilities',
    match: (code) => code.startsWith('22'),
  },
  { level: 1, key: 'operating-revenue', label: '營業收入', parent: 'revenue', match: (code) => code.startsWith('41') },
  {
    level: 1,
    key: 'nonoperating-revenue',
    label: '營業外收入',
    parent: 'revenue',
    match: (code) => code.startsWith('42'),
  },
  { level: 1, key: 'operating-cost', label: '營業成本', parent: 'expense', match: (code) => code.startsWith('51') },
  { level: 1, key: 'operating-expense', label: '營業費用', parent: 'expense', match: (code) => code.startsWith('52') },
  {
    level: 1,
    key: 'nonoperating-expense',
    label: '營業外支出',
    parent: 'expense',
    match: (code) => code.startsWith('53'),
  },
];

// 節點的「代表代號」：真實科目節點就是自己的代號；顯示分類節點取其底下所有子節點中最小的代號，
// 用來決定顯示分類群組彼此之間、以及群組與科目之間的顯示順序
function representativeCode(node) {
  if (node.kind === 'account') return node.account.code;
  let min = null;
  node.children.forEach((child) => {
    const code = representativeCode(child);
    if (code && (min === null || code < min)) min = code;
  });
  return min;
}

function sortDisplayChildren(node) {
  node.children.forEach(sortDisplayChildren);
  node.children.sort((a, b) => (representativeCode(a) || '').localeCompare(representativeCode(b) || '', 'zh-Hant'));
}

// 依「顯示分類規則＋真實科目上下層結構」建立四層摺疊樹。
// 顯示分類節點：{ kind: 'group', key, label, children }
// 真實科目節點：{ kind: 'account', account, children }（children 可能是子彙總或明細，來自 buildAccountTree）
// 找不到任何 Level 0 規則匹配的科目（理論上不會發生，除非科目代號不在 1~5 開頭）會被歸入樹的最後，不遺漏任何科目
export function buildDisplayTree(accounts, groupDefs = defaultDisplayGroupDefs) {
  const accountTree = buildAccountTree(accounts);
  const level0Defs = groupDefs.filter((d) => d.level === 0);
  const level1Defs = groupDefs.filter((d) => d.level === 1);

  function wrapAccountNode(node) {
    return { kind: 'account', account: node.account, children: node.children.map(wrapAccountNode) };
  }

  const level0Nodes = level0Defs.map((def) => ({ kind: 'group', key: def.key, label: def.label, children: [] }));
  const unclassified = [];

  accountTree.forEach((rootNode) => {
    const code = rootNode.account.code;
    const l0Def = level0Defs.find((d) => d.match(code));
    if (!l0Def) {
      unclassified.push(wrapAccountNode(rootNode));
      return;
    }
    const l0Node = level0Nodes.find((n) => n.key === l0Def.key);
    const l1Def = level1Defs.find((d) => d.parent === l0Def.key && d.match(code));
    if (l1Def) {
      let l1Node = l0Node.children.find((c) => c.kind === 'group' && c.key === l1Def.key);
      if (!l1Node) {
        l1Node = { kind: 'group', key: l1Def.key, label: l1Def.label, children: [] };
        l0Node.children.push(l1Node);
      }
      l1Node.children.push(wrapAccountNode(rootNode));
    } else {
      l0Node.children.push(wrapAccountNode(rootNode));
    }
  });

  const tree = [...level0Nodes.filter((n) => n.children.length > 0), ...unclassified];
  tree.forEach(sortDisplayChildren);
  return tree;
}

// 遞迴計算顯示樹每個節點的開帳借/貸「參考加總」：
// 明細科目＝自身輸入值；彙總科目／顯示分類群組＝其下所有明細科目金額的加總（逐層往上疊加，不限深度）。
// 顯示分類群組的加總純供 UI 參考顯示，不是正式科目餘額，不影響任何驗算邏輯。
// 回傳的 map 以真實科目用 account.id 為 key、顯示分類群組用其 key 為 key。
export function computeDisplayTreeOpeningTotals(tree, openingBalances) {
  const result = {};
  function walk(node) {
    if (node.kind === 'account' && !node.account.isSummary) {
      const entry = getOpeningEntry(openingBalances, node.account.id);
      result[node.account.id] = entry;
      return entry;
    }
    const totals = node.children.reduce(
      (acc, child) => {
        const t = walk(child);
        acc.debit += t.debit;
        acc.credit += t.credit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
    result[node.kind === 'account' ? node.account.id : node.key] = totals;
    return totals;
  }
  tree.forEach(walk);
  return result;
}
// 遞迴計算顯示樹每個節點的「金額」小計：明細科目＝amountByAccountId 中的自身金額；
// 彙總科目／顯示分類群組＝其下所有明細科目金額的加總（逐層往上疊加，不限深度）。
// 用於資產負債表等報表，讓彙總科目（如流動負債）也能顯示小計，供 UI 展開/收合呈現。
// 回傳的 map 以真實科目用 account.id 為 key、顯示分類群組用其 key 為 key。
export function computeDisplayTreeAmountTotals(tree, amountByAccountId) {
  const result = {};
  function walk(node) {
    if (node.kind === 'account' && !node.account.isSummary) {
      const amount = amountByAccountId[node.account.id] || 0;
      result[node.account.id] = amount;
      return amount;
    }
    const total = node.children.reduce((sum, child) => sum + walk(child), 0);
    result[node.kind === 'account' ? node.account.id : node.key] = total;
    return total;
  }
  tree.forEach(walk);
  return result;
}
// ============================================================
// 【修改六結束】
// ============================================================

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
// 分錄借方（進貨，存貨科目）：qty、amount 直接累加
// 分錄貸方（銷貨，存貨科目）：qty、amount 直接扣除（amount 為分錄登錄當下依加權平均法算好的成本）
// 只有科目本身是「存貨科目」(isInventory) 的分錄行才會異動庫存；銷貨成本科目的分錄行雖然也帶 itemId
// （用於自動代入加權平均成本），但那只是引用成本，不代表庫存異動，庫存異動一律以存貨科目那一行為準，
// 否則同一筆銷貨會被銷貨成本行與存貨行重複扣減兩次。
export function computeInventoryState(accounts, inventoryItems, entries) {
  const state = {};
  inventoryItems.forEach((item) => {
    state[item.id] = { qty: Number(item.openingQty || 0), value: inventoryOpeningValue(item) };
  });
  entries.forEach((entry) => {
    entry.debits.forEach((d) => {
      const account = accounts.find((a) => a.id === d.accountId);
      if (account?.isInventory && d.itemId && state[d.itemId]) {
        state[d.itemId].qty += Number(d.qty || 0);
        state[d.itemId].value += Number(d.amount || 0);
      }
    });
    entry.credits.forEach((c) => {
      const account = accounts.find((a) => a.id === c.accountId);
      if (account?.isInventory && c.itemId && state[c.itemId]) {
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

// 開帳時，存貨／不動產廠房設備／應收應付票據／應收應付帳款的科目金額皆改由明細
// （品項／資產卡／票據卡／客戶廠商卡）加總而來，不可手動輸入
export function isDerivedOpeningAccount(accounts, accountId) {
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return false;
  if (
    acc.isInventory ||
    acc.isFixedAsset ||
    acc.isNoteAccount ||
    acc.isArApAccount ||
    acc.isAdvanceAccount ||
    acc.isAmortizedAccount
  )
    return true;
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

// ============================================================
// 【修改七】應收/應付帳款客戶廠商明細卡（對象／金額），邏輯比照【修改四】票據明細卡，
// 但不需要票據號碼／開票日／到期日等欄位，只需要對象名稱與金額
// ============================================================

// 依科目彙總「開帳時建立」的客戶/廠商卡金額，作為該應收/應付帳款科目的期初餘額
// 分錄登錄時新增的卡（fromOpening 為 false）不計入期初餘額，其金額已經由該筆分錄自身反映在借貸金額中
export function computeArApOpeningTotals(arApCards) {
  const totals = {};
  arApCards.forEach((card) => {
    if (!card.fromOpening) return;
    totals[card.accountId] = (totals[card.accountId] || 0) + Number(card.amount || 0);
  });
  return totals;
}

// 某一筆分錄借/貸方分錄行，對應收/應付帳款科目而言是「新增客戶/廠商欠款」還是「收款/付款沖銷既有欠款」
// 與科目正常餘額方向同側 → 新增（如應收帳款借方增加、應付帳款貸方增加）
// 異側 → 沖銷（收現／付款，如應收帳款貸方減少、應付帳款借方減少）
export function isArApIncreaseLine(account, side) {
  return (side === 'debit') === isDebitNormal(account);
}

// 依「期初客戶/廠商卡金額 + 分錄中新增/沖銷的異動」重播，算出每張卡目前的未沖銷餘額
export function computeArApState(accounts, arApCards, entries) {
  const state = {};
  arApCards.forEach((card) => {
    state[card.id] = { remaining: card.fromOpening ? Number(card.amount || 0) : 0 };
  });
  function applyLine(line, side) {
    if (!line.arApId || !state[line.arApId]) return;
    const account = accounts.find((a) => a.id === line.accountId);
    const delta = isArApIncreaseLine(account, side) ? Number(line.amount || 0) : -Number(line.amount || 0);
    state[line.arApId].remaining += delta;
  }
  entries.forEach((entry) => {
    entry.debits.forEach((d) => applyLine(d, 'debit'));
    entry.credits.forEach((c) => applyLine(c, 'credit'));
  });
  return state;
}

// 該科目是否為某應收/應付帳款科目配對的備抵損失／呆帳（抵銷）科目
export function isArApAllowancePairAccount(accounts, account) {
  return accounts.some((a) => a.isArApAccount && a.allowanceAccountCode === account.code);
}
// ============================================================
// 【修改七結束】
// ============================================================

// ============================================================
// 【新增】預付貨款／預收貨款明細卡（對象／金額）
// 邏輯比照【修改七】應收/應付帳款明細卡，但這是等貨物到齊後一次沖銷，不是按時間分期認列，
// 故不需要攤銷欄位，也不追蹤沖銷狀態，單純以卡片金額加總作為該科目的開帳金額
// ============================================================
// 依科目彙總「開帳時建立」的對象卡金額，作為該預付/預收貨款科目的期初餘額
// 分錄登錄時新增的卡（fromOpening 為 false）不計入期初餘額，其金額已經由該筆分錄自身反映在借貸金額中
export function computeAdvanceOpeningTotals(advanceCards) {
  const totals = {};
  advanceCards.forEach((card) => {
    if (!card.fromOpening) return;
    totals[card.accountId] = (totals[card.accountId] || 0) + Number(card.amount || 0);
  });
  return totals;
}

// 某一筆分錄借/貸方分錄行，對預付/預收貨款科目而言是「新增預付/預收」還是「貨到沖銷既有預付/預收」
// 與科目正常餘額方向同側 → 新增；異側 → 沖銷（貨到，可部分沖銷）
export function isAdvanceIncreaseLine(account, side) {
  return (side === 'debit') === isDebitNormal(account);
}

// 依「期初對象卡金額 + 分錄中新增/沖銷的異動」重播，算出每張卡目前的未沖銷餘額
export function computeAdvanceState(accounts, advanceCards, entries) {
  const state = {};
  advanceCards.forEach((card) => {
    state[card.id] = { remaining: card.fromOpening ? Number(card.amount || 0) : 0 };
  });
  function applyLine(line, side) {
    if (!line.advanceId || !state[line.advanceId]) return;
    const account = accounts.find((a) => a.id === line.accountId);
    const delta = isAdvanceIncreaseLine(account, side) ? Number(line.amount || 0) : -Number(line.amount || 0);
    state[line.advanceId].remaining += delta;
  }
  entries.forEach((entry) => {
    entry.debits.forEach((d) => applyLine(d, 'debit'));
    entry.credits.forEach((c) => applyLine(c, 'credit'));
  });
  return state;
}
// ============================================================
// 【新增結束】
// ============================================================

// ============================================================
// 【新增】預付費用／預收收入攤銷明細卡
// 欄位：項目名稱／對象／未稅金額／稅額（預收收入適用）／生效日期／攤銷期間（月）
// 依「未稅金額 ÷ 攤銷期間」算出每月攤銷（認列）金額；已攤銷金額可手動輸入，留空則依生效日期與今日
// 之間經過的月數自動試算；剩餘（未攤銷／未認列）餘額＝未稅金額－已攤銷金額，即為該科目的開帳金額
// ============================================================
export function amortizationMonthlyAmount(card) {
  const months = Number(card.months || 0);
  if (!months) return 0;
  return Number(card.untaxedAmount || 0) / months;
}

// 依生效日期與攤銷期間，計算「至今日」已經過的攤銷月數（無條件捨去，限制於 0～攤銷期間之間）
export function amortizationElapsedMonths(card, asOfDate = new Date()) {
  const months = Number(card.months || 0);
  if (!months || !card.startDate) return 0;
  const start = new Date(card.startDate);
  if (Number.isNaN(start.getTime())) return 0;
  let elapsed = (asOfDate.getFullYear() - start.getFullYear()) * 12 + (asOfDate.getMonth() - start.getMonth());
  if (asOfDate.getDate() < start.getDate()) elapsed -= 1;
  return Math.min(Math.max(elapsed, 0), months);
}

// 依日期試算的已攤銷（已認列）金額
export function amortizationComputedAmount(card) {
  return amortizationMonthlyAmount(card) * amortizationElapsedMonths(card);
}

// 已攤銷（已認列）金額：使用者手動輸入者優先，留空則依日期自動試算
export function amortizationAmortizedAmount(card) {
  if (card.amortizedOverride !== null && card.amortizedOverride !== '' && card.amortizedOverride !== undefined) {
    return Number(card.amortizedOverride);
  }
  return amortizationComputedAmount(card);
}

// 剩餘（未攤銷／未認列）餘額
export function amortizationRemaining(card) {
  const base = Number(card.untaxedAmount || 0);
  return Math.max(base - amortizationAmortizedAmount(card), 0);
}

// 某一筆分錄借/貸方分錄行，對預付費用/預收收入科目而言是否為「新增攤銷明細卡」
// 與科目正常餘額方向同側 → 新增一張攤銷卡；異側則無對應機制（攤銷/認列金額依日期自動試算，不透過分錄沖銷）
export function isAmortizedIncreaseLine(account, side) {
  return (side === 'debit') === isDebitNormal(account);
}

// 依科目彙總「開帳時建立」的攤銷卡剩餘餘額，作為該預付費用／預收收入科目的期初餘額
// 分錄登錄時新增的卡（fromOpening 為 false）不計入期初餘額，其金額已經由該筆分錄自身反映在借貸金額中
export function computeAmortizationOpeningTotals(amortizationCards) {
  const totals = {};
  amortizationCards.forEach((card) => {
    if (!card.fromOpening) return;
    totals[card.accountId] = (totals[card.accountId] || 0) + amortizationRemaining(card);
  });
  return totals;
}
// ============================================================
// 【新增結束】
// ============================================================
