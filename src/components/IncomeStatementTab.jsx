import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeEndingBalances, formatNumber, sortAccountsByCode, typeSignedBalance } from '../utils/accounting';

// 依「科目代號前綴」取出該區塊的明細科目（已排序、可選擇隱藏零餘額），並算出區塊小計
function buildSection(accounts, balances, prefixes, hideZero) {
  const displayAmount = (acc) => typeSignedBalance(acc, balances[acc.id] || 0);
  const all = sortAccountsByCode(
    accounts.filter((a) => !a.isSummary && prefixes.some((p) => a.code.startsWith(p)))
  );
  const total = all.reduce((sum, acc) => sum + displayAmount(acc), 0);
  const list = all.filter((acc) => !hideZero || Math.abs(displayAmount(acc)) > 0.005);
  return { list, total, displayAmount };
}

function SectionTable({ title, list, displayAmount, totalLabel, total }) {
  return (
    <div>
      <h3>{title}</h3>
      <table className="data-table">
        <tbody>
          {list.map((acc) => (
            <tr key={acc.id}>
              <td>{acc.code}</td>
              <td>{acc.name}</td>
              <td className="num-cell">{formatNumber(displayAmount(acc))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>{totalLabel}</th>
            <th className="num-cell">{formatNumber(total)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SubtotalRow({ label, amount, emphasize }) {
  return (
    <div className={emphasize ? 'income-subtotal-box income-final' : 'income-subtotal-box'}>
      <span>{label}</span>
      <span className={amount >= 0 ? 'ok-text num-cell' : 'error-text num-cell'}>{formatNumber(amount)}</span>
    </div>
  );
}

// 損益表七層結構：營業收入 → 營業成本 →【毛利】→ 營業費用 →【營業利益】→ 營業外收支 →【稅前淨利】
function IncomeStatementView({ accounts, balances, hideZero }) {
  const revenue = buildSection(accounts, balances, ['41'], hideZero);
  const cost = buildSection(accounts, balances, ['51'], hideZero);
  const expense = buildSection(accounts, balances, ['52'], hideZero);
  const nonOpRevenue = buildSection(accounts, balances, ['42'], hideZero);
  const nonOpExpense = buildSection(accounts, balances, ['53'], hideZero);

  const grossProfit = revenue.total - cost.total;
  const operatingIncome = grossProfit - expense.total;
  const nonOperatingNet = nonOpRevenue.total - nonOpExpense.total;
  const netIncomeBeforeTax = operatingIncome + nonOperatingNet;

  return (
    <div className="income-statement">
      <SectionTable
        title="營業收入"
        list={revenue.list}
        displayAmount={revenue.displayAmount}
        totalLabel="銷貨收入淨額"
        total={revenue.total}
      />

      <SectionTable
        title="營業成本"
        list={cost.list}
        displayAmount={cost.displayAmount}
        totalLabel="營業成本合計"
        total={cost.total}
      />

      <SubtotalRow label="毛利" amount={grossProfit} emphasize />

      <SectionTable
        title="營業費用"
        list={expense.list}
        displayAmount={expense.displayAmount}
        totalLabel="營業費用合計"
        total={expense.total}
      />

      <SubtotalRow label="營業利益" amount={operatingIncome} emphasize />

      <SectionTable
        title="營業外收入"
        list={nonOpRevenue.list}
        displayAmount={nonOpRevenue.displayAmount}
        totalLabel="營業外收入合計"
        total={nonOpRevenue.total}
      />

      <SectionTable
        title="營業外支出"
        list={nonOpExpense.list}
        displayAmount={nonOpExpense.displayAmount}
        totalLabel="營業外支出合計"
        total={nonOpExpense.total}
      />

      <SubtotalRow label="營業外收支" amount={nonOperatingNet} />

      <SubtotalRow label="稅前淨利（本期淨利）" amount={netIncomeBeforeTax} emphasize />
    </div>
  );
}

export default function IncomeStatementTab() {
  const { accounts, openingBalances, entries } = useApp();
  const [hideZero, setHideZero] = useState(true);
  const balances = computeEndingBalances(accounts, openingBalances, entries);

  return (
    <div>
      <h2>損益表</h2>
      <label className="checkbox-label">
        <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
        隱藏零餘額科目
      </label>
      <IncomeStatementView accounts={accounts} balances={balances} hideZero={hideZero} />
    </div>
  );
}
