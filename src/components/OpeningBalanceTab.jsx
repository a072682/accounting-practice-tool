import { useApp } from '../context/AppContext';
import { DEPRECIATION_METHODS } from '../data/defaultAccounts';
import {
  accountMidCategory,
  computeAnnualDepreciation,
  formatNumber,
  inventoryOpeningValue,
  isDebitNormal,
  isDepreciationPairAccount,
  isDerivedOpeningAccount,
  openingNetBalance,
  sortAccountsByCode,
  sumByTypes,
  sumOpeningDebitCredit,
} from '../utils/accounting';

// ============================================================
// 【修改二】存貨品項期初明細編輯（品項／單價／數量），與【修改一】的借貸分欄開帳彼此獨立
// ============================================================
function InventoryOpeningEditor({ account }) {
  const { inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useApp();
  const items = inventoryItems.filter((it) => it.accountId === account.id);
  const total = items.reduce((s, it) => s + inventoryOpeningValue(it), 0);

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 期初品項明細
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>品項名稱</th>
            <th>單位成本</th>
            <th>數量</th>
            <th>單位</th>
            <th>總金額</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                <input
                  value={it.name}
                  placeholder="品項名稱"
                  onChange={(e) => updateInventoryItem(it.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="num-input"
                  value={it.openingUnitCost ?? ''}
                  onChange={(e) =>
                    updateInventoryItem(it.id, { openingUnitCost: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="num-input"
                  value={it.openingQty ?? ''}
                  onChange={(e) =>
                    updateInventoryItem(it.id, { openingQty: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  value={it.unit}
                  placeholder="組/個/件"
                  onChange={(e) => updateInventoryItem(it.id, { unit: e.target.value })}
                />
              </td>
              <td className="num-cell">{formatNumber(inventoryOpeningValue(it))}</td>
              <td>
                <button type="button" onClick={() => deleteInventoryItem(it.id)}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>合計（＝該科目開帳借方金額）</th>
            <th className="num-cell">{formatNumber(total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
      <button type="button" onClick={() => addInventoryItem(account.id)}>
        + 新增品項
      </button>
    </div>
  );
}
// ============================================================
// 【修改二結束】
// ============================================================

// ============================================================
// 【修改三】不動產廠房設備資產卡期初明細編輯
// 成本 → 該科目開帳借方金額；累計折舊為題目給定的既有金額，直接輸入 → 配對科目開帳貸方金額
// 理論年折舊僅供之後年底調整分錄參考，與既有累計折舊互不影響
// 土地不提折舊，只需成本欄位
// ============================================================
function FixedAssetOpeningEditor({ account }) {
  const { fixedAssetCards, addFixedAssetCard, updateFixedAssetCard, deleteFixedAssetCard } = useApp();
  const cards = fixedAssetCards.filter((c) => c.accountId === account.id);
  const isLand = !account.depreciationAccountCode;
  const totalCost = cards.reduce((s, c) => s + Number(c.cost || 0), 0);
  const totalAccumDep = cards.reduce((s, c) => s + Number(c.openingAccumulatedDepreciation || 0), 0);

  function numField(card, field, placeholder) {
    return (
      <input
        type="number"
        className="num-input"
        placeholder={placeholder}
        value={card[field] ?? ''}
        onChange={(e) => updateFixedAssetCard(card.id, { [field]: e.target.value === '' ? '' : Number(e.target.value) })}
      />
    );
  }

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 資產卡{isLand ? '（土地不提折舊）' : ''}
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>資產名稱</th>
            <th>取得日期</th>
            <th>成本</th>
            {!isLand && (
              <>
                <th>殘值</th>
                <th>耐用年限</th>
                <th>折舊方法</th>
                <th>累計折舊（既有金額）</th>
                <th>理論年折舊（參考）</th>
              </>
            )}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <input
                  value={card.name}
                  placeholder="資產名稱"
                  onChange={(e) => updateFixedAssetCard(card.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={card.acquisitionDate}
                  onChange={(e) => updateFixedAssetCard(card.id, { acquisitionDate: e.target.value })}
                />
              </td>
              <td>{numField(card, 'cost')}</td>
              {!isLand && (
                <>
                  <td>{numField(card, 'residualValue')}</td>
                  <td>{numField(card, 'usefulLife')}</td>
                  <td>
                    <select
                      value={card.depreciationMethod}
                      onChange={(e) => updateFixedAssetCard(card.id, { depreciationMethod: e.target.value })}
                    >
                      {DEPRECIATION_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{numField(card, 'openingAccumulatedDepreciation')}</td>
                  <td className="num-cell">{formatNumber(computeAnnualDepreciation(card))}</td>
                </>
              )}
              <td>
                <button type="button" onClick={() => deleteFixedAssetCard(card.id)}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>合計</th>
            <th className="num-cell">{formatNumber(totalCost)}（＝開帳借方金額）</th>
            {!isLand && (
              <>
                <th colSpan={3}></th>
                <th className="num-cell">{formatNumber(totalAccumDep)}（＝配對科目開帳貸方金額）</th>
                <th></th>
              </>
            )}
            <th></th>
          </tr>
        </tfoot>
      </table>
      <button type="button" onClick={() => addFixedAssetCard(account.id)}>
        + 新增資產卡
      </button>
    </div>
  );
}
// ============================================================
// 【修改三結束】
// ============================================================

// ============================================================
// 【修改四】應收/應付票據明細卡期初明細編輯
// 金額 → 依科目正常餘額方向計入該科目開帳借方或貸方金額（應收票據為借方、應付票據為貸方）
// 支票帳戶僅用於應付票據（正常餘額為貸方），代表公司自己開立票據所使用的銀行支存帳戶
// ============================================================
function NoteOpeningEditor({ account }) {
  const { noteCards, addNoteCard, updateNoteCard, deleteNoteCard } = useApp();
  const cards = noteCards.filter((c) => c.accountId === account.id);
  const isPayable = !isDebitNormal(account);
  const total = cards.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 票據明細卡
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>對象</th>
            <th>金額</th>
            <th>票據號碼</th>
            <th>開票日</th>
            <th>到期日</th>
            {isPayable && <th>支票帳戶</th>}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <input
                  value={card.party}
                  placeholder={isPayable ? '廠商名稱' : '客戶名稱'}
                  onChange={(e) => updateNoteCard(card.id, { party: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="num-input"
                  value={card.amount ?? ''}
                  onChange={(e) => updateNoteCard(card.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  value={card.noteNumber}
                  placeholder="票據號碼"
                  onChange={(e) => updateNoteCard(card.id, { noteNumber: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={card.issueDate}
                  onChange={(e) => updateNoteCard(card.id, { issueDate: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={card.dueDate}
                  onChange={(e) => updateNoteCard(card.id, { dueDate: e.target.value })}
                />
              </td>
              {isPayable && (
                <td>
                  <input
                    value={card.bankAccount}
                    placeholder="如 1112 銀行存款"
                    onChange={(e) => updateNoteCard(card.id, { bankAccount: e.target.value })}
                  />
                </td>
              )}
              <td>
                <button type="button" onClick={() => deleteNoteCard(card.id)}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={isPayable ? 5 : 4}>合計（＝該科目開帳{isPayable ? '貸方' : '借方'}金額）</th>
            <th className="num-cell">{formatNumber(total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
      <button type="button" onClick={() => addNoteCard(account.id, { fromOpening: true })}>
        + 新增票據
      </button>
    </div>
  );
}
// ============================================================
// 【修改四結束】
// ============================================================

// ============================================================
// 【修改一】借貸分欄開帳金額輸入格
// mismatch：金額填在與科目正常餘額方向不符的欄位時給予警告，但仍允許填入
// （例如透支的銀行帳戶，現金類科目卻出現貸方餘額）
// ============================================================
function OpeningAmountCell({ acc, side, openingBalances, setOpeningBalance }) {
  const normalSide = isDebitNormal(acc) ? 'debit' : 'credit';
  const value = openingBalances[acc.id]?.[side] ?? '';
  const mismatch = side !== normalSide && Number(value) > 0;
  return (
    <td className="num-cell">
      <input
        type="number"
        className={mismatch ? 'num-input input-warning' : 'num-input'}
        value={value}
        onChange={(e) => setOpeningBalance(acc.id, side, e.target.value === '' ? '' : Number(e.target.value))}
      />
      {mismatch && <div className="warning-text">⚠ 與正常餘額方向（{acc.normalBalance}）不符</div>}
    </td>
  );
}
// ============================================================
// 【修改一結束（元件定義部分）】
// ============================================================

export default function OpeningBalanceTab() {
  const { accounts, openingBalances, setOpeningBalance } = useApp();
  const sorted = sortAccountsByCode(accounts);
  const inventoryAccounts = sorted.filter((a) => a.isInventory && !a.isSummary);
  const fixedAssetAccounts = sorted.filter((a) => a.isFixedAsset && !a.isSummary);
  const noteAccounts = sorted.filter((a) => a.isNoteAccount && !a.isSummary);

  // 【修改一】兩種平衡驗算：
  // 1. 借貸相等驗算（試算表底層邏輯）：所有科目開帳借方金額加總 = 所有科目開帳貸方金額加總
  const { debitTotal: openingDebitTotal, creditTotal: openingCreditTotal } = sumOpeningDebitCredit(
    accounts,
    openingBalances
  );
  const drCrDiff = openingDebitTotal - openingCreditTotal;
  const drCrBalanced = Math.abs(drCrDiff) < 0.005;

  // 2. 資產 = 負債 + 權益驗算（換算為各科目淨額後才能分類加總）
  const netBalances = {};
  accounts.forEach((acc) => {
    netBalances[acc.id] = openingNetBalance(acc, openingBalances);
  });
  const assetTotal = sumByTypes(accounts, netBalances, ['資產']);
  const liabilityTotal = sumByTypes(accounts, netBalances, ['負債']);
  const equityTotal = sumByTypes(accounts, netBalances, ['權益']);
  const diff = assetTotal - (liabilityTotal + equityTotal);
  const balanced = Math.abs(diff) < 0.005;

  return (
    <div>
      <h2>開帳作業（期初餘額輸入）</h2>
      <p className="hint-text">
        請在「符合科目正常餘額方向」的欄位輸入金額，另一欄留 0。若填在不符方向的欄位，系統會提示警告但仍允許輸入（例如透支的銀行帳戶）。
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>科目代號</th>
            <th>科目名稱</th>
            <th>中分類</th>
            <th>借貸</th>
            <th>開帳借方金額</th>
            <th>開帳貸方金額</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((acc) => (
            <tr key={acc.id} className={acc.isSummary ? 'summary-row' : ''}>
              <td>{acc.code}</td>
              <td>
                {acc.name}
                {acc.isSummary ? '（彙總）' : ''}
                {acc.isInventory ? '（存貨，見下方品項明細）' : ''}
                {acc.isFixedAsset ? '（見下方資產卡）' : ''}
                {isDepreciationPairAccount(accounts, acc) ? '（依資產卡累計折舊加總，見下方資產卡）' : ''}
                {acc.isNoteAccount ? '（見下方票據明細卡）' : ''}
              </td>
              <td>{accountMidCategory(accounts, acc)}</td>
              <td>{acc.normalBalance}</td>
              {acc.isSummary ? (
                <>
                  <td className="num-cell">—</td>
                  <td className="num-cell">—</td>
                </>
              ) : isDerivedOpeningAccount(accounts, acc.id) ? (
                <>
                  <td className="num-cell">{formatNumber(openingBalances[acc.id]?.debit || 0)}</td>
                  <td className="num-cell">{formatNumber(openingBalances[acc.id]?.credit || 0)}</td>
                </>
              ) : (
                <>
                  <OpeningAmountCell
                    acc={acc}
                    side="debit"
                    openingBalances={openingBalances}
                    setOpeningBalance={setOpeningBalance}
                  />
                  <OpeningAmountCell
                    acc={acc}
                    side="credit"
                    openingBalances={openingBalances}
                    setOpeningBalance={setOpeningBalance}
                  />
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>合計</th>
            <th className="num-cell">{formatNumber(openingDebitTotal)}</th>
            <th className="num-cell">{formatNumber(openingCreditTotal)}</th>
          </tr>
        </tfoot>
      </table>

      {inventoryAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>存貨品項明細</h3>
          {inventoryAccounts.map((acc) => (
            <InventoryOpeningEditor key={acc.id} account={acc} />
          ))}
        </div>
      )}

      {fixedAssetAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>不動產廠房設備資產卡</h3>
          {fixedAssetAccounts.map((acc) => (
            <FixedAssetOpeningEditor key={acc.id} account={acc} />
          ))}
        </div>
      )}

      {noteAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>應收/應付票據明細卡</h3>
          {noteAccounts.map((acc) => (
            <NoteOpeningEditor key={acc.id} account={acc} />
          ))}
        </div>
      )}

      <div className="summary-box">
        <p>
          開帳借方合計：<span className="num-cell">{formatNumber(openingDebitTotal)}</span>　開帳貸方合計：
          <span className="num-cell">{formatNumber(openingCreditTotal)}</span>
        </p>
        {drCrBalanced ? (
          <p className="ok-text">借貸相等，已平衡 ✓</p>
        ) : (
          <p className="error-text">
            借貸不相等！差額為 <span className="num-cell">{formatNumber(drCrDiff)}</span>
          </p>
        )}

        <p>
          資產類總額：<span className="num-cell">{formatNumber(assetTotal)}</span>
        </p>
        <p>
          負債類總額：<span className="num-cell">{formatNumber(liabilityTotal)}</span>
        </p>
        <p>
          權益類總額：<span className="num-cell">{formatNumber(equityTotal)}</span>
        </p>
        {balanced ? (
          <p className="ok-text">資產 = 負債 + 權益，已平衡 ✓</p>
        ) : (
          <p className="error-text">
            不平衡！差額為 <span className="num-cell">{formatNumber(diff)}</span>
            （資產 - (負債+權益)）
          </p>
        )}
      </div>
    </div>
  );
}
// ============================================================
// 【修改一結束】
// ============================================================
