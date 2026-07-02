import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, sortAccountsByCode, sumByTypes } from '../utils/accounting';

export default function BalanceSheetTab() {
  const { accounts, openingBalances, entries } = useApp();
  const balances = computeEndingBalances(accounts, openingBalances, entries);

  const assets = sortAccountsByCode(accounts.filter((a) => a.type === '資產' && !a.isSummary));
  const liabilities = sortAccountsByCode(accounts.filter((a) => a.type === '負債' && !a.isSummary));
  const equities = sortAccountsByCode(accounts.filter((a) => a.type === '權益' && !a.isSummary));

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
      <h2>資產負債表</h2>
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
              <tr>
                <td colSpan={2}>本期淨利（併入權益）</td>
                <td className="num-cell">{formatNumber(netIncome)}</td>
              </tr>
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
