import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ACCOUNT_TYPES } from '../data/defaultAccounts';
import { sortAccountsByCode } from '../utils/accounting';

const emptyForm = { code: '', name: '', type: '資產' };

export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useApp();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const sorted = sortAccountsByCode(accounts);

  function resetForm() {
    setForm(emptyForm);
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
    if (editingId) {
      updateAccount(editingId, { code: form.code.trim(), name: form.name.trim(), type: form.type });
    } else {
      addAccount({ code: form.code.trim(), name: form.name.trim(), type: form.type });
    }
    resetForm();
  }

  function handleEdit(acc) {
    setEditingId(acc.id);
    setForm({ code: acc.code, name: acc.name, type: acc.type });
    setError('');
  }

  function handleDelete(id) {
    if (window.confirm('確定要刪除此科目嗎？相關的期初餘額也會一併清除。')) {
      deleteAccount(id);
      if (editingId === id) resetForm();
    }
  }

  return (
    <div>
      <h2>科目設定</h2>
      <form className="account-form" onSubmit={handleSubmit}>
        <input
          placeholder="代號 (如 1101)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <input
          placeholder="名稱 (如 現金)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit">{editingId ? '更新科目' : '新增科目'}</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            取消
          </button>
        )}
      </form>
      {error && <p className="error-text">{error}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th>類型</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td>{acc.type}</td>
              <td>
                <button onClick={() => handleEdit(acc)}>編輯</button>
                <button onClick={() => handleDelete(acc.id)}>刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
