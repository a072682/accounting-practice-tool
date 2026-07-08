import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ACCOUNT_TYPES, NORMAL_BALANCE_SIDES, defaultNormalBalance } from '../data/defaultAccounts';
import { buildDisplayTree, inferParentCode, isArApAllowancePairAccount } from '../utils/accounting';
import AccountTreeRows from './AccountTreeRows';

const emptyForm = {
  code: '',
  name: '',
  type: '資產',
  parent: '',
  isSummary: false,
  isInventory: false,
  isFixedAsset: false,
  depreciationAccountCode: '',
  isNoteAccount: false,
  isArApAccount: false,
  allowanceAccountCode: '',
  normalBalance: defaultNormalBalance('資產'),
};

export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount, loadStandardAccounts } = useApp();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  // 【修改六】記錄已收合的節點 key（顯示分類群組為 `group:<key>`、真實彙總科目為代號）；預設全部展開，只需追蹤例外
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());

  function toggleCollapse(key) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  }

  // 點擊某節點下的「+ 新增子科目」：預先帶入上層科目代號，parentCode 為 null 表示新增頂層科目
  // （顯示分類群組底下一律是 null，因為顯示分類不是真實上層科目，新科目仍靠代號前綴自動歸類顯示）
  function handleAddChild(parentCode) {
    setForm({ ...emptyForm, parent: parentCode || '' });
    setEditingId(null);
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('代號與名稱皆為必填');
      return;
    }
    const duplicate = accounts.find(
      (a) => a.code === form.code.trim() && a.id !== editingId
    );
    if (duplicate) {
      setError('此代號已存在');
      return;
    }
    const code = form.code.trim();
    const parent = form.parent.trim() || inferParentCode(accounts, code, editingId);
    const payload = {
      code,
      name: form.name.trim(),
      type: form.type,
      parent,
      isSummary: form.isSummary,
      isInventory: form.isSummary ? false : form.isInventory,
      isFixedAsset: form.isSummary ? false : form.isFixedAsset,
      depreciationAccountCode: form.isFixedAsset ? form.depreciationAccountCode.trim() || null : null,
      isNoteAccount: form.isSummary ? false : form.isNoteAccount,
      isArApAccount: form.isSummary ? false : form.isArApAccount,
      allowanceAccountCode: form.isArApAccount ? form.allowanceAccountCode.trim() || null : null,
      normalBalance: form.normalBalance,
    };
    if (editingId) {
      updateAccount(editingId, payload);
    } else {
      addAccount(payload);
    }
    resetForm();
  }

  function handleEdit(acc) {
    setEditingId(acc.id);
    setForm({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      parent: acc.parent || '',
      isSummary: !!acc.isSummary,
      isInventory: !!acc.isInventory,
      isFixedAsset: !!acc.isFixedAsset,
      depreciationAccountCode: acc.depreciationAccountCode || '',
      isNoteAccount: !!acc.isNoteAccount,
      isArApAccount: !!acc.isArApAccount,
      allowanceAccountCode: acc.allowanceAccountCode || '',
      normalBalance: acc.normalBalance || defaultNormalBalance(acc.type),
    });
    setError('');
  }

  function handleDelete(id) {
    if (window.confirm('確定要刪除此科目嗎？相關的期初餘額（及存貨品項明細、資產卡、票據明細卡）也會一併清除。')) {
      deleteAccount(id);
      if (editingId === id) resetForm();
    }
  }

  function handleLoadStandard() {
    if (!window.confirm('將載入標準科目表，已存在的科目代號會保留不變，只會新增缺少的科目，確定要繼續嗎？')) {
      return;
    }
    const added = loadStandardAccounts();
    alert(added > 0 ? `已新增 ${added} 個標準科目。` : '目前的科目已包含完整標準科目表，沒有新增任何項目。');
  }

  return (
    <div className="accounts-page">
      <h2>科目設定</h2>
      <div className="account-toolbar">
        <button type="button" onClick={handleLoadStandard}>
          載入標準科目表
        </button>
      </div>
      <p className="hint-text">彙總科目只用於報表分類加總，無法作為分錄的借貸對象；只有明細科目才能記分錄。</p>

      <table className="data-table responsive-tree-table">
        <thead>
          <tr>
            <th className="col-code">代號</th>
            <th className="col-name">名稱</th>
            <th className="col-type">類型</th>
            <th className="col-direction">正常餘額</th>
            <th className="col-nature">科目性質</th>
            <th className="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <AccountTreeRows
            tree={buildDisplayTree(accounts)}
            collapsedKeys={collapsedKeys}
            onToggle={toggleCollapse}
            onAddChild={handleAddChild}
            colSpan={6}
            renderGroupCells={(node) => (
              <>
                <td className="col-name" data-label="名稱">
                  {node.label}
                </td>
                <td className="col-type" data-label="類型">
                  —
                </td>
                <td className="col-direction" data-label="正常餘額">
                  —
                </td>
                <td className="col-nature" data-label="科目性質">
                  顯示分類
                </td>
                <td className="col-action" data-label="操作"></td>
              </>
            )}
            renderAccountCells={(acc) => (
              <>
                <td className="col-name" data-label="名稱">
                  {acc.name}
                </td>
                <td className="col-type" data-label="類型">
                  {acc.type}
                </td>
                <td className="col-direction" data-label="正常餘額">
                  {acc.normalBalance || defaultNormalBalance(acc.type)}
                </td>
                <td className="col-nature" data-label="科目性質">
                  {acc.isSummary ? '彙總' : '明細'}
                  {acc.isInventory ? '／存貨' : ''}
                  {acc.isFixedAsset ? `／固定資產${acc.depreciationAccountCode ? `（折舊科目：${acc.depreciationAccountCode}）` : '（不提折舊）'}` : ''}
                  {acc.isNoteAccount ? '／票據' : ''}
                  {acc.isArApAccount ? `／應收應付帳款${acc.allowanceAccountCode ? `（備抵科目：${acc.allowanceAccountCode}）` : ''}` : ''}
                  {isArApAllowancePairAccount(accounts, acc) ? '／備抵損失呆帳科目' : ''}
                </td>
                <td className="col-action" data-label="操作">
                  <div className="action-buttons">
                    <button onClick={() => handleEdit(acc)}>編輯</button>
                    <button onClick={() => handleDelete(acc.id)}>刪除</button>
                  </div>
                </td>
              </>
            )}
          />
        </tbody>
      </table>

      {/* 新增/編輯科目表單固定在畫面底部，捲動科目列表時仍可隨時操作，不需捲回頂部 */}
      <div className="sticky-form-bar">
        <div className="sticky-form-bar-inner">
          <form className="account-form" onSubmit={handleSubmit}>
            <input
              placeholder="代號 (如 1111)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <input
              placeholder="名稱 (如 現金)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value, normalBalance: defaultNormalBalance(e.target.value) })
              }
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={form.normalBalance} onChange={(e) => setForm({ ...form, normalBalance: e.target.value })}>
              {NORMAL_BALANCE_SIDES.map((side) => (
                <option key={side} value={side}>
                  正常餘額：{side}
                </option>
              ))}
            </select>
            <input
              placeholder="上層科目代號 (留空則依代號前綴自動判斷)"
              value={form.parent}
              onChange={(e) => setForm({ ...form, parent: e.target.value })}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isSummary}
                onChange={(e) => setForm({ ...form, isSummary: e.target.checked })}
              />
              彙總科目
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isInventory}
                disabled={form.isSummary}
                onChange={(e) => setForm({ ...form, isInventory: e.target.checked })}
              />
              存貨科目（啟用品項明細）
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isFixedAsset}
                disabled={form.isSummary}
                onChange={(e) => setForm({ ...form, isFixedAsset: e.target.checked })}
              />
              不動產廠房設備成本科目（啟用資產卡）
            </label>
            {form.isFixedAsset && (
              <input
                placeholder="配對累計折舊科目代號 (留空表示不提折舊，如土地)"
                value={form.depreciationAccountCode}
                onChange={(e) => setForm({ ...form, depreciationAccountCode: e.target.value })}
              />
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isNoteAccount}
                disabled={form.isSummary}
                onChange={(e) => setForm({ ...form, isNoteAccount: e.target.checked })}
              />
              票據科目（啟用票據明細卡）
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isArApAccount}
                disabled={form.isSummary}
                onChange={(e) => setForm({ ...form, isArApAccount: e.target.checked })}
              />
              應收/應付帳款科目（啟用客戶/廠商明細卡）
            </label>
            {form.isArApAccount && (
              <input
                placeholder="配對備抵損失/呆帳科目代號 (選填，如應收帳款可填備抵損失科目)"
                value={form.allowanceAccountCode}
                onChange={(e) => setForm({ ...form, allowanceAccountCode: e.target.value })}
              />
            )}
            <button type="submit">{editingId ? '更新科目' : '新增科目'}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                取消
              </button>
            )}
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </div>
  );
}
