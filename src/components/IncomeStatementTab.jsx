import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, sortAccountsByCode } from '../utils/accounting';

export default function IncomeStatementTab() {
  const { accounts, openingBalances, entries } = useApp();
  const balances = computeEndingBalances(accounts, openingBalances, entries);

  const revenues = sortAccountsByCode(accounts.filter((a) => a.type === '收入'));
  const expenses = sortAccountsByCode(accounts.filter((a) => a.type === '費用'));

  const revenueTotal = revenues.reduce((s, a) => s + (balances[a.id] || 0), 0);
  const expenseTotal = expenses.reduce((s, a) => s + (balances[a.id] || 0), 0);
  const netIncome = revenueTotal - expenseTotal;

  return (
    <div>
      <h2>損益表</h2>
      <h3>收入</h3>
      <table className="data-table">
        <tbody>
          {revenues.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td className="num-cell">{formatNumber(balances[acc.id] || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>收入合計</th>
            <th className="num-cell">{formatNumber(revenueTotal)}</th>
          </tr>
        </tfoot>
      </table>

      <h3>費用</h3>
      <table className="data-table">
        <tbody>
          {expenses.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td className="num-cell">{formatNumber(balances[acc.id] || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>費用合計</th>
            <th className="num-cell">{formatNumber(expenseTotal)}</th>
          </tr>
        </tfoot>
      </table>

      <div className="summary-box">
        <p>
          本期淨利（損）：
          <span className={netIncome >= 0 ? 'ok-text num-cell' : 'error-text num-cell'}>
            {formatNumber(netIncome)}
          </span>
        </p>
      </div>
    </div>
  );
}
