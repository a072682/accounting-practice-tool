import { createContext, useContext, useMemo, useState } from 'react';
import { createAccountsFromTemplates, defaultAccounts, standardAccountTemplates } from '../data/defaultAccounts';
import {
  computeAdvanceOpeningTotals,
  computeAmortizationOpeningTotals,
  computeArApOpeningTotals,
  computeFixedAssetOpeningTotals,
  computeInventoryOpeningTotals,
  computeNoteOpeningTotals,
  isDebitNormal,
} from '../utils/accounting';

const AppContext = createContext(null);

let invIdCounter = 0;
function nextInventoryItemId() {
  invIdCounter += 1;
  return `inv${Date.now()}_${invIdCounter}`;
}

let assetIdCounter = 0;
function nextFixedAssetCardId() {
  assetIdCounter += 1;
  return `fa${Date.now()}_${assetIdCounter}`;
}

let noteIdCounter = 0;
function nextNoteCardId() {
  noteIdCounter += 1;
  return `note${Date.now()}_${noteIdCounter}`;
}

let arApIdCounter = 0;
function nextArApCardId() {
  arApIdCounter += 1;
  return `arap${Date.now()}_${arApIdCounter}`;
}

let advanceIdCounter = 0;
function nextAdvanceCardId() {
  advanceIdCounter += 1;
  return `adv${Date.now()}_${advanceIdCounter}`;
}

let amortizationIdCounter = 0;
function nextAmortizationCardId() {
  amortizationIdCounter += 1;
  return `amort${Date.now()}_${amortizationIdCounter}`;
}

export function AppProvider({ children }) {
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [manualOpeningBalances, setManualOpeningBalances] = useState({});
  const [inventoryItems, setInventoryItems] = useState([]);
  const [fixedAssetCards, setFixedAssetCards] = useState([]);
  const [noteCards, setNoteCards] = useState([]);
  const [arApCards, setArApCards] = useState([]);
  const [advanceCards, setAdvanceCards] = useState([]);
  const [amortizationCards, setAmortizationCards] = useState([]);
  const [entries, setEntries] = useState([]);
  // 【修改八】期初資產負債表快照：一旦「完成開帳」就凍結，之後不論科目/開帳金額/分錄如何變動都不受影響
  const [openingSnapshot, setOpeningSnapshot] = useState(null);

  // openingBalances 結構：{ [accountId]: { debit: number, credit: number } }
  // 存貨科目的開帳借方金額改由品項明細加總而來（見【修改二】），
  // 不動產廠房設備的成本科目開帳借方金額、配對累計折舊科目開帳貸方金額改由資產卡加總而來（見【修改三】），
  // 應收/應付票據科目的開帳金額改由票據卡加總而來（見【修改四】），
  // 應收/應付帳款科目的開帳金額改由客戶/廠商卡加總而來（見【修改七】）
  // 皆會覆蓋掉手動輸入的值
  const openingBalances = useMemo(() => {
    const inventoryTotals = computeInventoryOpeningTotals(inventoryItems);
    const { costTotals, accumDepTotals } = computeFixedAssetOpeningTotals(accounts, fixedAssetCards);
    const noteTotals = computeNoteOpeningTotals(noteCards);
    const arApTotals = computeArApOpeningTotals(arApCards);
    const advanceTotals = computeAdvanceOpeningTotals(advanceCards);
    const amortizationTotals = computeAmortizationOpeningTotals(amortizationCards);
    const merged = { ...manualOpeningBalances };
    accounts.forEach((a) => {
      if (a.isInventory) merged[a.id] = { debit: inventoryTotals[a.id] || 0, credit: 0 };
      if (a.isFixedAsset) merged[a.id] = { debit: costTotals[a.id] || 0, credit: 0 };
      if (a.isNoteAccount) {
        const total = noteTotals[a.id] || 0;
        merged[a.id] = isDebitNormal(a) ? { debit: total, credit: 0 } : { debit: 0, credit: total };
      }
      if (a.isArApAccount) {
        const total = arApTotals[a.id] || 0;
        merged[a.id] = isDebitNormal(a) ? { debit: total, credit: 0 } : { debit: 0, credit: total };
      }
      if (a.isAdvanceAccount) {
        const total = advanceTotals[a.id] || 0;
        merged[a.id] = isDebitNormal(a) ? { debit: total, credit: 0 } : { debit: 0, credit: total };
      }
      if (a.isAmortizedAccount) {
        const total = amortizationTotals[a.id] || 0;
        merged[a.id] = isDebitNormal(a) ? { debit: total, credit: 0 } : { debit: 0, credit: total };
      }
    });
    accounts.forEach((a) => {
      if (accumDepTotals[a.id] !== undefined) {
        merged[a.id] = { debit: 0, credit: accumDepTotals[a.id] };
      }
    });
    return merged;
  }, [
    manualOpeningBalances,
    inventoryItems,
    fixedAssetCards,
    noteCards,
    arApCards,
    advanceCards,
    amortizationCards,
    accounts,
  ]);

  function addAccount(account) {
    setAccounts((prev) => [...prev, { ...account, id: `a${Date.now()}` }]);
  }

  function updateAccount(id, patch) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function deleteAccount(id) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setManualOpeningBalances((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInventoryItems((prev) => prev.filter((it) => it.accountId !== id));
    setFixedAssetCards((prev) => prev.filter((c) => c.accountId !== id));
    setNoteCards((prev) => prev.filter((c) => c.accountId !== id));
    setArApCards((prev) => prev.filter((c) => c.accountId !== id));
    setAdvanceCards((prev) => prev.filter((c) => c.accountId !== id));
    setAmortizationCards((prev) => prev.filter((c) => c.accountId !== id));
  }

  // 【修改一】開帳借貸分欄：side 為 'debit' 或 'credit'，分別寫入該科目開帳金額的借方/貸方欄位
  // 存貨科目、不動產廠房設備科目（及其配對的累計折舊科目）、應收/應付票據科目、應收/應付帳款科目的期初餘額
  // 皆為明細加總，不可手動設定
  function setOpeningBalance(accountId, side, amount) {
    const account = accounts.find((a) => a.id === accountId);
    if (
      account?.isSummary ||
      account?.isInventory ||
      account?.isFixedAsset ||
      account?.isNoteAccount ||
      account?.isArApAccount ||
      account?.isAdvanceAccount ||
      account?.isAmortizedAccount
    )
      return;
    if (accounts.some((a) => a.isFixedAsset && a.depreciationAccountCode === account?.code)) return;
    setManualOpeningBalances((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || { debit: 0, credit: 0 }), [side]: amount },
    }));
  }

  function addInventoryItem(accountId, item = {}) {
    const newItem = {
      id: nextInventoryItemId(),
      accountId,
      name: '',
      unit: '',
      openingQty: 0,
      openingUnitCost: 0,
      ...item,
    };
    setInventoryItems((prev) => [...prev, newItem]);
    return newItem.id;
  }

  function updateInventoryItem(id, patch) {
    setInventoryItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function deleteInventoryItem(id) {
    setInventoryItems((prev) => prev.filter((it) => it.id !== id));
  }

  // 【修改三】不動產廠房設備資產卡
  function addFixedAssetCard(accountId, card = {}) {
    const newCard = {
      id: nextFixedAssetCardId(),
      accountId,
      name: '',
      acquisitionDate: '',
      cost: 0,
      residualValue: 0,
      usefulLife: 0,
      depreciationMethod: '直線法',
      openingAccumulatedDepreciation: 0,
      ...card,
    };
    setFixedAssetCards((prev) => [...prev, newCard]);
    return newCard.id;
  }

  function updateFixedAssetCard(id, patch) {
    setFixedAssetCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteFixedAssetCard(id) {
    setFixedAssetCards((prev) => prev.filter((c) => c.id !== id));
  }

  // 【修改四】應收/應付票據明細卡
  // fromOpening: true 表示此卡是在開帳頁面建立（無對應分錄，卡片金額本身即為起始未沖銷餘額）
  // false（分錄登錄時新增票據）表示此卡的金額已由建立當下那筆分錄計入，起始未沖銷餘額為 0，避免重複計算
  function addNoteCard(accountId, card = {}) {
    const newCard = {
      id: nextNoteCardId(),
      accountId,
      party: '',
      amount: 0,
      noteNumber: '',
      issueDate: '',
      dueDate: '',
      bankAccount: '',
      fromOpening: false,
      ...card,
    };
    setNoteCards((prev) => [...prev, newCard]);
    return newCard.id;
  }

  function updateNoteCard(id, patch) {
    setNoteCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteNoteCard(id) {
    setNoteCards((prev) => prev.filter((c) => c.id !== id));
  }

  // 【修改七】應收/應付帳款客戶廠商明細卡
  // fromOpening: true 表示此卡是在開帳頁面建立（無對應分錄，卡片金額本身即為起始未沖銷餘額）
  // false（分錄登錄時新增）表示此卡的金額已由建立當下那筆分錄計入，起始未沖銷餘額為 0，避免重複計算
  function addArApCard(accountId, card = {}) {
    const newCard = {
      id: nextArApCardId(),
      accountId,
      party: '',
      amount: 0,
      fromOpening: false,
      ...card,
    };
    setArApCards((prev) => [...prev, newCard]);
    return newCard.id;
  }

  function updateArApCard(id, patch) {
    setArApCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteArApCard(id) {
    setArApCards((prev) => prev.filter((c) => c.id !== id));
  }

  // 【新增】預付貨款／預收貨款明細卡（對象／金額，無攤銷，等貨到齊後一次沖銷）
  function addAdvanceCard(accountId, card = {}) {
    const newCard = {
      id: nextAdvanceCardId(),
      accountId,
      party: '',
      amount: 0,
      ...card,
    };
    setAdvanceCards((prev) => [...prev, newCard]);
    return newCard.id;
  }

  function updateAdvanceCard(id, patch) {
    setAdvanceCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteAdvanceCard(id) {
    setAdvanceCards((prev) => prev.filter((c) => c.id !== id));
  }

  // 【新增】預付費用／預收收入攤銷明細卡（項目名稱／對象／未稅金額／稅額／生效日期／攤銷期間）
  function addAmortizationCard(accountId, card = {}) {
    const newCard = {
      id: nextAmortizationCardId(),
      accountId,
      name: '',
      party: '',
      untaxedAmount: 0,
      taxAmount: 0,
      startDate: '',
      months: 0,
      amortizedOverride: null,
      ...card,
    };
    setAmortizationCards((prev) => [...prev, newCard]);
    return newCard.id;
  }

  function updateAmortizationCard(id, patch) {
    setAmortizationCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteAmortizationCard(id) {
    setAmortizationCards((prev) => prev.filter((c) => c.id !== id));
  }

  function addEntry(entry) {
    setEntries((prev) => [...prev, { ...entry, id: `e${Date.now()}` }]);
  }

  function deleteEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // 【修改八】建立/覆蓋期初資產負債表快照：把「當下」的科目與開帳金額深拷貝凍結起來，
  // 之後不論科目設定、開帳金額、或分錄如何變動，這份快照都不會跟著改變，
  // 「期初資產負債表」永遠只讀這份快照，不會每次重新從即時資料算
  function finalizeOpening() {
    setOpeningSnapshot({
      finalizedAt: new Date().toISOString(),
      accounts: JSON.parse(JSON.stringify(accounts)),
      openingBalances: JSON.parse(JSON.stringify(openingBalances)),
    });
  }

  function importData(data) {
    if (data.accounts) setAccounts(data.accounts);
    if (data.openingBalances) setManualOpeningBalances(data.openingBalances);
    if (data.inventoryItems) setInventoryItems(data.inventoryItems);
    if (data.fixedAssetCards) setFixedAssetCards(data.fixedAssetCards);
    if (data.noteCards) setNoteCards(data.noteCards);
    if (data.arApCards) setArApCards(data.arApCards);
    if (data.advanceCards) setAdvanceCards(data.advanceCards);
    if (data.amortizationCards) setAmortizationCards(data.amortizationCards);
    if ('openingSnapshot' in data) setOpeningSnapshot(data.openingSnapshot);
    if (data.entries) setEntries(data.entries);
  }

  // 將標準科目表合併進現有科目：代號已存在者略過，不覆蓋使用者的自訂/修改
  // 回傳實際新增的科目數量
  function loadStandardAccounts() {
    let addedCount = 0;
    setAccounts((prev) => {
      const existingCodes = new Set(prev.map((a) => a.code));
      const missingTemplates = standardAccountTemplates.filter((tpl) => !existingCodes.has(tpl.code));
      addedCount = missingTemplates.length;
      if (missingTemplates.length === 0) return prev;
      return [...prev, ...createAccountsFromTemplates(missingTemplates)];
    });
    return addedCount;
  }

  const value = {
    accounts,
    openingBalances,
    inventoryItems,
    fixedAssetCards,
    noteCards,
    arApCards,
    advanceCards,
    amortizationCards,
    entries,
    openingSnapshot,
    addAccount,
    updateAccount,
    deleteAccount,
    setOpeningBalance,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addFixedAssetCard,
    updateFixedAssetCard,
    deleteFixedAssetCard,
    addNoteCard,
    updateNoteCard,
    deleteNoteCard,
    addArApCard,
    updateArApCard,
    deleteArApCard,
    addAdvanceCard,
    updateAdvanceCard,
    deleteAdvanceCard,
    addAmortizationCard,
    updateAmortizationCard,
    deleteAmortizationCard,
    addEntry,
    deleteEntry,
    finalizeOpening,
    importData,
    loadStandardAccounts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
