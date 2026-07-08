import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, sortAccountsByCode, sumByTypes, typeSignedBalance } from '../utils/accounting';

export default function IncomeStatementTab() {
  const { accounts, openingBalances, entries } = useApp();
  const balances = computeEndingBalances(accounts, openingBalances, entries);

  // 顯示金額：依科目所屬分類換算正負號，讓銷貨退回/折讓、進貨退出/折讓等抵銷科目顯示為負值（減項）
  const displayAmount = (acc) => typeSignedBalance(acc, balances[acc.id] || 0);

  const revenues = sortAccountsByCode(accounts.filter((a) => a.type === '收益' && !a.isSummary));
  const expenses = sortAccountsByCode(accounts.filter((a) => a.type === '費損' && !a.isSummary));

  const revenueTotal = sumByTypes(accounts, balances, ['收益']);
  const expenseTotal = sumByTypes(accounts, balances, ['費損']);
  const netIncome = revenueTotal - expenseTotal;

  return (
    <div>
      <h2>損益表</h2>
      <h3>收益</h3>
      <table className="data-table">
        <tbody>
          {revenues.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td className="num-cell">{formatNumber(displayAmount(acc))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>收益合計</th>
            <th className="num-cell">{formatNumber(revenueTotal)}</th>
          </tr>
        </tfoot>
      </table>

      <h3>費損</h3>
      <table className="data-table">
        <tbody>
          {expenses.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td className="num-cell">{formatNumber(displayAmount(acc))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>費損合計</th>
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
