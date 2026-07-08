import { useApp } from '../../context/AppContext';
import { computeInventoryState, formatNumber, inventoryAvgCost, sortAccountsByCode } from '../../utils/accounting';

export default function InventoryDetailPanel() {
  const { accounts, inventoryItems, entries } = useApp();
  const inventoryAccounts = sortAccountsByCode(accounts.filter((a) => a.isInventory && !a.isSummary));
  const state = computeInventoryState(inventoryItems, entries);

  return (
    <div>
      <h2>存貨明細</h2>
      {inventoryAccounts.length === 0 && <p className="hint-text">目前尚未設定存貨科目。</p>}

      {inventoryAccounts.map((acc) => {
        const items = inventoryItems.filter((it) => it.accountId === acc.id);
        const total = items.reduce((s, it) => s + (state[it.id]?.value || 0), 0);
        return (
          <div key={acc.id} className="inventory-editor">
            <h4>
              {acc.code} {acc.name}
            </h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>品項名稱</th>
                  <th>單位</th>
                  <th>目前數量</th>
                  <th>加權平均單位成本</th>
                  <th>目前金額</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const s = state[it.id] || { qty: 0, value: 0 };
                  return (
                    <tr key={it.id}>
                      <td>{it.name || '(未命名品項)'}</td>
                      <td>{it.unit}</td>
                      <td className="num-cell">{formatNumber(s.qty)}</td>
                      <td className="num-cell">{formatNumber(inventoryAvgCost(state, it.id))}</td>
                      <td className="num-cell">{formatNumber(s.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={4}>合計</th>
                  <th className="num-cell">{formatNumber(total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}
