import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, sortAccountsByCode, sumByTypes } from '../utils/accounting';

// 資產負債表的實際內容：接收「哪一份科目清單＋開帳金額＋分錄」算出的餘額後渲染，
// 期初／期末兩種視圖共用同一套呈現邏輯，差別只在傳入的資料來源
function BalanceSheetView({ accounts, balances, hideZero }) {
  const nonZero = (acc) => !hideZero || Math.abs(balances[acc.id] || 0) > 0.005;

  const assets = sortAccountsByCode(accounts.filter((a) => a.type === '資產' && !a.isSummary)).filter(nonZero);
  const liabilities = sortAccountsByCode(accounts.filter((a) => a.type === '負債' && !a.isSummary)).filter(nonZero);
  const equities = sortAccountsByCode(accounts.filter((a) => a.type === '權益' && !a.isSummary)).filter(nonZero);

  const assetTotal = sumByTypes(accounts, balances, ['資產']);
  const liabilityTotal = sumByTypes(accounts, balances, ['負債']);
  const equityBase = sumByTypes(accounts, balances, ['權益']);

  const revenueTotal = sumByTypes(accounts, balances, ['收益']);
  const expenseTotal = sumByTypes(accounts, balances, ['費損']);
  const netIncome = revenueTotal - expenseTotal;

  const equityTotal = equityBase + netIncome;
  const diff = assetTotal - (liabilityTotal + equityTotal);
  const balanced = Math.abs(diff) < 0.005;

  return (
    <div>
      <div className="bs-columns">
        <div>
          <h3>資產</h3>
          <table className="data-table">
            <tbody>
              {assets.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.code}</td>
                  <td>{acc.name}</td>
                  <td className="num-cell">{formatNumber(balances[acc.id] || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>資產總計</th>
                <th className="num-cell">{formatNumber(assetTotal)}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div>
          <h3>負債</h3>
          <table className="data-table">
            <tbody>
              {liabilities.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.code}</td>
                  <td>{acc.name}</td>
                  <td className="num-cell">{formatNumber(balances[acc.id] || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>負債總計</th>
                <th className="num-cell">{formatNumber(liabilityTotal)}</th>
              </tr>
            </tfoot>
          </table>

          <h3>權益</h3>
          <table className="data-table">
            <tbody>
              {equities.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.code}</td>
                  <td>{acc.name}</td>
                  <td className="num-cell">{formatNumber(balances[acc.id] || 0)}</td>
                </tr>
              ))}
              {(!hideZero || Math.abs(netIncome) > 0.005) && (
                <tr>
                  <td colSpan={2}>本期淨利（併入權益）</td>
                  <td className="num-cell">{formatNumber(netIncome)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>權益總計</th>
                <th className="num-cell">{formatNumber(equityTotal)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="summary-box">
        {balanced ? (
          <p className="ok-text">資產 = 負債 + 權益，平衡 ✓</p>
        ) : (
          <p className="error-text">
            不平衡！差額為 <span className="num-cell">{formatNumber(diff)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// 期初資產負債表：只讀「完成開帳當下」凍結的獨立快照（openingSnapshot），
// 不使用即時的 accounts／openingBalances，因此後續修改開帳金額或新增分錄都不會影響這份報表
function OpeningBalanceSheetPanel({ hideZero }) {
  const { openingSnapshot } = useApp();

  if (!openingSnapshot) {
    return (
      <p className="hint-text">
        尚未完成開帳，沒有期初快照可顯示。請至「開帳」頁面確認開帳金額輸入完畢後，點擊「完成開帳（建立期初快照）」。
      </p>
    );
  }

  const balances = computeEndingBalances(openingSnapshot.accounts, openingSnapshot.openingBalances, []);

  return (
    <div>
      <p className="hint-text">
        此為 {new Date(openingSnapshot.finalizedAt).toLocaleString('zh-TW')} 完成開帳當下凍結的快照，
        之後修改開帳金額或新增分錄都不會改變這份報表。
      </p>
      <BalanceSheetView accounts={openingSnapshot.accounts} balances={balances} hideZero={hideZero} />
    </div>
  );
}

// 期末（目前）資產負債表：即時運算＝期初科目餘額 + 所有已登錄分錄對各科目的異動加總，
// 會隨著使用者新增/修改/刪除分錄即時更新
function EndingBalanceSheetPanel({ hideZero }) {
  const { accounts, openingBalances, entries } = useApp();
  const balances = computeEndingBalances(accounts, openingBalances, entries);
  return <BalanceSheetView accounts={accounts} balances={balances} hideZero={hideZero} />;
}

const PERIODS = [
  { key: 'opening', label: '期初資產負債表', Component: OpeningBalanceSheetPanel },
  { key: 'ending', label: '期末（目前）資產負債表', Component: EndingBalanceSheetPanel },
];

export default function BalanceSheetTab() {
  const [activeKey, setActiveKey] = useState(PERIODS[1].key);
  const [hideZero, setHideZero] = useState(true);
  const active = PERIODS.find((p) => p.key === activeKey) || PERIODS[0];
  const ActiveComponent = active.Component;

  return (
    <div>
      <h2>資產負債表</h2>
      <label className="checkbox-label">
        <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
        隱藏零餘額科目
      </label>

      <div className="detail-tab-layout">
        <aside className="detail-sidebar">
          <ul className="detail-sidebar-list">
            {PERIODS.map((period) => (
              <li key={period.key}>
                <button
                  type="button"
                  className={period.key === active.key ? 'detail-sidebar-item active' : 'detail-sidebar-item'}
                  onClick={() => setActiveKey(period.key)}
                >
                  {period.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="detail-content">
          <h3>{active.label}</h3>
          <ActiveComponent hideZero={hideZero} />
        </section>
      </div>
    </div>
  );
}
