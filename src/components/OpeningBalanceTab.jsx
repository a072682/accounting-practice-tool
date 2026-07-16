import { useApp } from '../context/AppContext';
import { ACCOUNT_TYPES, DEPRECIATION_METHODS, NORMAL_BALANCE_SIDES, defaultNormalBalance } from '../data/defaultAccounts';
import {
  amortizationAmortizedAmount,
  amortizationMonthlyAmount,
  amortizationRemaining,
  buildDisplayTree,
  computeAnnualDepreciation,
  computeDisplayTreeOpeningTotals,
  formatNumber,
  inferParentCode,
  inventoryOpeningValue,
  isArApAllowancePairAccount,
  isDebitNormal,
  isDepreciationPairAccount,
  isDerivedOpeningAccount,
  openingNetBalance,
  sortAccountsByCode,
  sumByTypes,
  sumOpeningDebitCredit,
} from '../utils/accounting';
import { useState } from 'react';
import AccountTreeRows from './AccountTreeRows';
import HintIcon from './HintIcon';

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
      <div className="amortization-card-tables">
      <div className="table-scroll">
        <table className="data-table amortization-table">
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
                </>
              )}
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
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>合計</th>
              <th className="num-cell">{formatNumber(totalCost)}（＝開帳借方金額）</th>
              {!isLand && <th colSpan={3}></th>}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data-table amortization-table">
          <thead>
            <tr>
              {!isLand && (
                <>
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
                {!isLand && (
                  <>
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
          {!isLand && (
            <tfoot>
              <tr>
                <th className="num-cell">{formatNumber(totalAccumDep)}（＝配對科目開帳貸方金額）</th>
                <th></th>
                <th></th>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </div>
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
  const { accounts, noteCards, addNoteCard, updateNoteCard, deleteNoteCard } = useApp();
  const cards = noteCards.filter((c) => c.accountId === account.id);
  const isPayable = !isDebitNormal(account);
  const total = cards.reduce((s, c) => s + Number(c.amount || 0), 0);
  // 【介面修正三】支票帳戶欄位只接受既有科目代號，不是自由文字
  const isValidBankAccountCode = (code) => !code.trim() || accounts.some((a) => a.code === code.trim());

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 票據明細卡
      </h4>
      <div className="amortization-card-tables">
      <div className="table-scroll">
        <table className="data-table note-card-table amortization-table">
          <thead>
            <tr>
              <th>對象</th>
              <th className="col-amount-wide">金額</th>
              <th>票據號碼</th>
              <th>開票日</th>
              <th>到期日</th>
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
                <td className="col-amount-wide">
                  <input
                    type="number"
                    className="num-input"
                    value={card.amount ?? ''}
                    onChange={(e) =>
                      updateNoteCard(card.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })
                    }
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
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>合計（＝該科目開帳{isPayable ? '貸方' : '借方'}金額）</th>
              <th className="num-cell">{formatNumber(total)}</th>
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data-table note-card-table amortization-table">
          <thead>
            <tr>
              {isPayable && <th className="col-bank-account">支票帳戶</th>}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                {isPayable && (
                  <td className="col-bank-account">
                    <input
                      className={isValidBankAccountCode(card.bankAccount) ? 'bank-account-input' : 'bank-account-input input-warning'}
                      value={card.bankAccount}
                      placeholder="請輸入科目代號，例如：1112"
                      onChange={(e) => updateNoteCard(card.id, { bankAccount: e.target.value })}
                    />
                    {!isValidBankAccountCode(card.bankAccount) && (
                      <div className="warning-text">⚠ 查無此科目代號</div>
                    )}
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
        </table>
      </div>
      </div>
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
// 【修改七】應收/應付帳款客戶廠商明細卡期初明細編輯
// 邏輯比照【修改四】票據明細卡，但只需要對象名稱與金額
// ============================================================
function ArApOpeningEditor({ account }) {
  const { arApCards, addArApCard, updateArApCard, deleteArApCard } = useApp();
  const cards = arApCards.filter((c) => c.accountId === account.id);
  const isPayable = !isDebitNormal(account);
  const total = cards.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 客戶/廠商明細卡
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>對象</th>
            <th>金額</th>
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
                  onChange={(e) => updateArApCard(card.id, { party: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="num-input"
                  value={card.amount ?? ''}
                  onChange={(e) => updateArApCard(card.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </td>
              <td>
                <button type="button" onClick={() => deleteArApCard(card.id)}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>合計（＝該科目開帳{isPayable ? '貸方' : '借方'}金額）</th>
            <th className="num-cell">{formatNumber(total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
      <button type="button" onClick={() => addArApCard(account.id, { fromOpening: true })}>
        + 新增{isPayable ? '廠商' : '客戶'}
      </button>
    </div>
  );
}
// ============================================================
// 【修改七結束】
// ============================================================

// ============================================================
// 【新增】預付貨款／預收貨款明細卡期初明細編輯
// 邏輯比照【修改七】應收/應付帳款明細卡，但不需要攤銷（等貨到齊後一次沖銷），只需要對象與金額
// ============================================================
function AdvanceOpeningEditor({ account }) {
  const { advanceCards, addAdvanceCard, updateAdvanceCard, deleteAdvanceCard } = useApp();
  const cards = advanceCards.filter((c) => c.accountId === account.id);
  const isPayable = !isDebitNormal(account);
  const total = cards.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 對象明細卡
      </h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>對象</th>
            <th>金額</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <input
                  value={card.party}
                  placeholder={isPayable ? '客戶名稱' : '廠商名稱'}
                  onChange={(e) => updateAdvanceCard(card.id, { party: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="num-input"
                  value={card.amount ?? ''}
                  onChange={(e) =>
                    updateAdvanceCard(card.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <button type="button" onClick={() => deleteAdvanceCard(card.id)}>
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>合計（＝該科目開帳{isPayable ? '貸方' : '借方'}金額）</th>
            <th className="num-cell">{formatNumber(total)}</th>
            <th></th>
          </tr>
        </tfoot>
      </table>
      <button type="button" onClick={() => addAdvanceCard(account.id, { fromOpening: true })}>
        + 新增{isPayable ? '客戶' : '廠商'}
      </button>
    </div>
  );
}
// ============================================================
// 【新增結束】
// ============================================================

// ============================================================
// 【新增】預付費用／預收收入攤銷明細卡期初明細編輯
// 每月攤銷（認列）金額＝未稅金額÷攤銷期間；已攤銷金額可手動輸入覆蓋，留空則依生效日期自動試算；
// 剩餘（未攤銷／未認列）餘額＝該科目的開帳金額。預收收入（貸方科目）另外顯示稅額欄位供拆分含稅/未稅金額
// ============================================================
function AmortizationOpeningEditor({ account }) {
  const { amortizationCards, addAmortizationCard, updateAmortizationCard, deleteAmortizationCard } = useApp();
  const cards = amortizationCards.filter((c) => c.accountId === account.id);
  const isRevenueSide = !isDebitNormal(account);
  const total = cards.reduce((s, c) => s + amortizationRemaining(c), 0);

  function numField(card, field) {
    return (
      <input
        type="number"
        className="num-input"
        value={card[field] ?? ''}
        onChange={(e) =>
          updateAmortizationCard(card.id, { [field]: e.target.value === '' ? '' : Number(e.target.value) })
        }
      />
    );
  }

  return (
    <div className="inventory-editor">
      <h4>
        {account.code} {account.name} － 攤銷明細卡
      </h4>
      <div className="amortization-card-tables">
      <div className="table-scroll">
        <table className="data-table note-card-table amortization-table">
          <thead>
            <tr>
              <th>項目名稱</th>
              <th>對象{isRevenueSide ? '' : '（選填）'}</th>
              <th>{isRevenueSide ? '未稅金額' : '總金額'}</th>
              {isRevenueSide && <th>稅額</th>}
              <th>生效日期</th>
              <th>攤銷期間（月）</th>
              <th>{isRevenueSide ? '每月應認列金額' : '每月攤銷金額'}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>
                  <input
                    value={card.name}
                    placeholder="項目名稱"
                    onChange={(e) => updateAmortizationCard(card.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={card.party}
                    placeholder={isRevenueSide ? '客戶名稱' : '對象（選填）'}
                    onChange={(e) => updateAmortizationCard(card.id, { party: e.target.value })}
                  />
                </td>
                <td>{numField(card, 'untaxedAmount')}</td>
                {isRevenueSide && <td>{numField(card, 'taxAmount')}</td>}
                <td>
                  <input
                    type="date"
                    value={card.startDate}
                    onChange={(e) => updateAmortizationCard(card.id, { startDate: e.target.value })}
                  />
                </td>
                <td>{numField(card, 'months')}</td>
                <td className="num-cell">{formatNumber(amortizationMonthlyAmount(card))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data-table note-card-table amortization-table">
          <thead>
            <tr>
              <th>{isRevenueSide ? '已認列金額' : '已攤銷金額'}</th>
              <th>{isRevenueSide ? '剩餘（未認列）餘額' : '剩餘餘額'}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>
                  <input
                    type="number"
                    className="num-input"
                    placeholder={`依日期試算：${formatNumber(amortizationAmortizedAmount(card))}`}
                    value={card.amortizedOverride ?? ''}
                    onChange={(e) =>
                      updateAmortizationCard(card.id, {
                        amortizedOverride: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="num-cell">{formatNumber(amortizationRemaining(card))}</td>
                <td>
                  <button type="button" onClick={() => deleteAmortizationCard(card.id)}>
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>合計（＝該科目開帳{isRevenueSide ? '貸方' : '借方'}金額）</th>
              <th className="num-cell">{formatNumber(total)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
      <p className="hint-text">已攤銷／已認列金額留空時，會依生效日期與今日之間經過的月數自動試算；如需以特定基準日覆蓋，請直接輸入金額。</p>
      <button type="button" onClick={() => addAmortizationCard(account.id, { fromOpening: true })}>
        + 新增項目
      </button>
    </div>
  );
}
// ============================================================
// 【新增結束】
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
    <td className="num-cell col-amount" data-label={side === 'debit' ? '開帳借方金額' : '開帳貸方金額'}>
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

// 開帳頁面用的快速新增科目列（僅提供基本欄位，進階設定仍請至「科目設定」頁調整）
function QuickAddAccountRow({ parentCode, onDone }) {
  const { accounts, addAccount } = useApp();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('資產');
  const [isSummary, setIsSummary] = useState(false);
  const [normalBalance, setNormalBalance] = useState(defaultNormalBalance('資產'));
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('代號與名稱皆為必填');
      return;
    }
    if (accounts.some((a) => a.code === code.trim())) {
      setError('此代號已存在');
      return;
    }
    // parentCode 為 null 時（在顯示分類群組底下新增），仍嘗試依代號前綴自動找出實際的上層彙總科目，
    // 找不到才視為新的頂層科目，與「科目設定」頁的新增邏輯一致
    const parent = parentCode || inferParentCode(accounts, code.trim(), null);
    addAccount({
      code: code.trim(),
      name: name.trim(),
      type,
      parent,
      isSummary,
      isInventory: false,
      isFixedAsset: false,
      depreciationAccountCode: null,
      isNoteAccount: false,
      normalBalance,
    });
    onDone();
  }

  return (
    <div>
      <form className="quick-add-form" onSubmit={handleSubmit}>
        <input placeholder="代號" value={code} onChange={(e) => setCode(e.target.value)} />
        <input placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setNormalBalance(defaultNormalBalance(e.target.value));
          }}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={normalBalance} onChange={(e) => setNormalBalance(e.target.value)}>
          {NORMAL_BALANCE_SIDES.map((s) => (
            <option key={s} value={s}>
              正常餘額：{s}
            </option>
          ))}
        </select>
        <label className="checkbox-label">
          <input type="checkbox" checked={isSummary} onChange={(e) => setIsSummary(e.target.checked)} />
          彙總科目
        </label>
        <button type="submit">新增</button>
        <button type="button" onClick={onDone}>
          取消
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default function OpeningBalanceTab() {
  const { accounts, openingBalances, setOpeningBalance, entries, openingSnapshot, finalizeOpening } = useApp();
  const sorted = sortAccountsByCode(accounts);
  const inventoryAccounts = sorted.filter((a) => a.isInventory && !a.isSummary);
  const fixedAssetAccounts = sorted.filter((a) => a.isFixedAsset && !a.isSummary);
  const noteAccounts = sorted.filter((a) => a.isNoteAccount && !a.isSummary);
  const arApAccounts = sorted.filter((a) => a.isArApAccount && !a.isSummary);
  const advanceAccounts = sorted.filter((a) => a.isAdvanceAccount && !a.isSummary);
  const amortizationAccounts = sorted.filter((a) => a.isAmortizedAccount && !a.isSummary);
  // 【修改六】顯示分類群組（大分類/次分類）＋真實科目的四層摺疊樹；彙總科目與顯示分類群組的開帳借貸金額
  // 皆＝其下所有明細科目加總（即時運算），不可手動輸入；顯示分類群組的加總純供 UI 參考，不影響任何驗算邏輯
  const displayTree = buildDisplayTree(accounts);
  const displayTreeTotals = computeDisplayTreeOpeningTotals(displayTree, openingBalances);
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());
  const [addingContainer, setAddingContainer] = useState(null); // containerKey 字串，null 表示未在新增

  function toggleCollapse(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAddChild(parentCode, containerKey) {
    setAddingContainer(containerKey);
  }

  // 【修改八】完成開帳：把當下的科目與開帳金額凍結成一份獨立快照，供「資產負債表」的期初視圖固定讀取
  function handleFinalizeOpening() {
    let message = '確定要以目前的科目與開帳金額，建立期初資產負債表快照嗎？建立後這份快照會被凍結，之後修改開帳金額或新增分錄都不會影響它。';
    if (openingSnapshot) {
      message = '已經有一份期初快照，重新完成開帳將會覆蓋舊的快照，確定要繼續嗎？';
      if (entries.length > 0) {
        message += '（目前已有分錄登錄，一般不建議在開帳完成後再重建快照）';
      }
    }
    if (window.confirm(message)) {
      finalizeOpening();
    }
  }

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

      {/* 【修改八】完成開帳＝建立/覆蓋期初資產負債表快照，凍結後不受後續開帳金額或分錄變動影響 */}
      <div className="account-toolbar">
        <button type="button" onClick={handleFinalizeOpening}>
          {openingSnapshot ? '重新完成開帳（覆蓋期初快照）' : '完成開帳（建立期初快照）'}
        </button>
        {openingSnapshot ? (
          <span className="ok-text">
            已建立期初快照（{new Date(openingSnapshot.finalizedAt).toLocaleString('zh-TW')}），「資產負債表」的期初視圖已凍結，不受之後變動影響。
          </span>
        ) : (
          <span className="hint-text">
            尚未完成開帳。請確認開帳金額輸入完畢後點擊此按鈕，「資產負債表」才會有期初視圖可供查看。
          </span>
        )}
      </div>
      <table className="data-table responsive-tree-table">
        <thead>
          <tr>
            <th className="col-code">科目代號</th>
            <th className="col-name">科目名稱</th>
            <th className="col-direction">借貸</th>
            <th className="col-amount">開帳借方金額</th>
            <th className="col-amount">開帳貸方金額</th>
          </tr>
        </thead>
        <tbody>
          <AccountTreeRows
            tree={displayTree}
            collapsedKeys={collapsedKeys}
            onToggle={toggleCollapse}
            onAddChild={handleAddChild}
            activeAddContainer={addingContainer}
            renderInlineForm={(parentCode) => (
              <QuickAddAccountRow parentCode={parentCode} onDone={() => setAddingContainer(null)} />
            )}
            colSpan={5}
            addRootLabel="+ 新增頂層科目"
            renderGroupCells={(node) => (
              <>
                <td className="col-name" data-label="科目名稱">
                  {node.label}
                  <HintIcon text="顯示分類，僅供參考加總" />
                </td>
                <td className="col-direction" data-label="借貸">
                  —
                </td>
                <td className="num-cell col-amount num-cell-readonly" data-label="開帳借方金額">
                  {formatNumber(displayTreeTotals[node.key]?.debit || 0)}
                </td>
                <td className="num-cell col-amount num-cell-readonly" data-label="開帳貸方金額">
                  {formatNumber(displayTreeTotals[node.key]?.credit || 0)}
                </td>
              </>
            )}
            renderAccountCells={(acc) => {
              const hintText = [
                acc.isSummary && '彙總，金額為子科目自動加總',
                acc.isInventory && '存貨，見下方品項明細',
                acc.isFixedAsset && '見下方資產卡',
                isDepreciationPairAccount(accounts, acc) && '依資產卡累計折舊加總，見下方資產卡',
                acc.isNoteAccount && '見下方票據明細卡',
                acc.isArApAccount && '見下方客戶/廠商明細卡',
                isArApAllowancePairAccount(accounts, acc) && '備抵損失/呆帳科目，請直接輸入既有金額',
                acc.isAdvanceAccount && '見下方對象明細卡',
                acc.isAmortizedAccount && '見下方攤銷明細卡',
              ]
                .filter(Boolean)
                .join('；');
              return (
                <>
                  <td className="col-name" data-label="科目名稱">
                    {acc.name}
                    <HintIcon text={hintText} />
                  </td>
                  <td className="col-direction" data-label="借貸">
                    {acc.normalBalance}
                  </td>
                  {acc.isSummary ? (
                    <>
                      <td className="num-cell col-amount num-cell-readonly" data-label="開帳借方金額">
                        {formatNumber(displayTreeTotals[acc.id]?.debit || 0)}
                      </td>
                      <td className="num-cell col-amount num-cell-readonly" data-label="開帳貸方金額">
                        {formatNumber(displayTreeTotals[acc.id]?.credit || 0)}
                      </td>
                    </>
                  ) : isDerivedOpeningAccount(accounts, acc.id) ? (
                    <>
                      <td className="num-cell col-amount num-cell-readonly" data-label="開帳借方金額">
                        {formatNumber(openingBalances[acc.id]?.debit || 0)}
                      </td>
                      <td className="num-cell col-amount num-cell-readonly" data-label="開帳貸方金額">
                        {formatNumber(openingBalances[acc.id]?.credit || 0)}
                      </td>
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
                </>
              );
            }}
          />
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>合計</th>
            <th className="num-cell col-amount">{formatNumber(openingDebitTotal)}</th>
            <th className="num-cell col-amount">{formatNumber(openingCreditTotal)}</th>
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

      {arApAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>應收/應付帳款客戶廠商明細卡</h3>
          {arApAccounts.map((acc) => (
            <ArApOpeningEditor key={acc.id} account={acc} />
          ))}
        </div>
      )}

      {advanceAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>預付貨款/預收貨款對象明細卡</h3>
          {advanceAccounts.map((acc) => (
            <AdvanceOpeningEditor key={acc.id} account={acc} />
          ))}
        </div>
      )}

      {amortizationAccounts.length > 0 && (
        <div className="inventory-editors">
          <h3>預付費用/預收收入攤銷明細卡</h3>
          {amortizationAccounts.map((acc) => (
            <AmortizationOpeningEditor key={acc.id} account={acc} />
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
