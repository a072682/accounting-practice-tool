import { useApp } from '../../context/AppContext';
import {
  amortizationAmortizedAmount,
  amortizationMonthlyAmount,
  amortizationRemaining,
  formatNumber,
  isDebitNormal,
  sortAccountsByCode,
} from '../../utils/accounting';

// side: 'receivable'（預付費用，正常餘額為借方）或 'payable'（預收收入，正常餘額為貸方）
// 每個科目依項目拆分明細，各卡片的剩餘（未攤銷／未認列）餘額加總＝該科目的開帳金額
export default function AmortizationDetailPanel({ side }) {
  const { accounts, amortizationCards } = useApp();
  const wantDebitNormal = side === 'receivable';
  const amortizationAccounts = sortAccountsByCode(
    accounts.filter((a) => a.isAmortizedAccount && !a.isSummary && isDebitNormal(a) === wantDebitNormal)
  );
  const title = side === 'receivable' ? '預付費用明細' : '預收收入明細';
  const emptyHint = side === 'receivable' ? '目前尚未設定預付費用科目。' : '目前尚未設定預收收入科目。';

  return (
    <div>
      <h2>{title}</h2>
      {amortizationAccounts.length === 0 && <p className="hint-text">{emptyHint}</p>}

      {amortizationAccounts.map((acc) => {
        const cards = amortizationCards.filter((c) => c.accountId === acc.id);
        const total = cards.reduce((s, c) => s + amortizationRemaining(c), 0);
        const isRevenueSide = side === 'payable';

        return (
          <div key={acc.id} className="inventory-editor">
            <h4>
              {acc.code} {acc.name}
            </h4>
            <div className="table-scroll">
              <table className="data-table note-card-table">
                <thead>
                  <tr>
                    <th>項目名稱</th>
                    <th>對象</th>
                    <th>{isRevenueSide ? '未稅金額' : '總金額'}</th>
                    {isRevenueSide && <th>稅額</th>}
                    <th>生效日期</th>
                    <th>攤銷期間（月）</th>
                    <th>{isRevenueSide ? '每月應認列金額' : '每月攤銷金額'}</th>
                    <th>{isRevenueSide ? '已認列金額' : '已攤銷金額'}</th>
                    <th>{isRevenueSide ? '剩餘（未認列）餘額' : '剩餘餘額'}</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name || '(未命名)'}</td>
                      <td>{c.party || '—'}</td>
                      <td className="num-cell">{formatNumber(c.untaxedAmount || 0)}</td>
                      {isRevenueSide && <td className="num-cell">{formatNumber(c.taxAmount || 0)}</td>}
                      <td>{c.startDate || '—'}</td>
                      <td className="num-cell">{c.months || 0}</td>
                      <td className="num-cell">{formatNumber(amortizationMonthlyAmount(c))}</td>
                      <td className="num-cell">{formatNumber(amortizationAmortizedAmount(c))}</td>
                      <td className="num-cell">{formatNumber(amortizationRemaining(c))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={isRevenueSide ? 8 : 7}>項目明細合計（剩餘餘額）</th>
                    <th className="num-cell">{formatNumber(total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
