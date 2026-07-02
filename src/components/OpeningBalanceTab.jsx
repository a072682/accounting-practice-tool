import { useApp } from '../context/AppContext';
import { formatNumber, sortAccountsByCode, sumByTypes } from '../utils/accounting';

export default function OpeningBalanceTab() {
  const { accounts, openingBalances, setOpeningBalance } = useApp();
  const sorted = sortAccountsByCode(accounts);

  const assetTotal = sumByTypes(accounts, openingBalances, ['資產']);
  const liabilityTotal = sumByTypes(accounts, openingBalances, ['負債']);
  const equityTotal = sumByTypes(accounts, openingBalances, ['權益']);
  const diff = assetTotal - (liabilityTotal + equityTotal);
  const balanced = Math.abs(diff) < 0.005;

  return (
    <div>
      <h2>開帳作業（期初餘額輸入）</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th>類型</th>
            <th>期初餘額</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((acc) => (
            <tr key={acc.id} className={acc.isSummary ? 'summary-row' : ''}>
              <td>{acc.code}</td>
              <td>{acc.name}{acc.isSummary ? '（彙總）' : ''}</td>
              <td>{acc.type}</td>
              <td className="num-cell">
                {acc.isSummary ? (
                  '—'
                ) : (
                  <input
                    type="number"
                    className="num-input"
                    value={openingBalances[acc.id] ?? ''}
                    onChange={(e) => setOpeningBalance(acc.id, e.target.value === '' ? '' : Number(e.target.value))}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary-box">
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
