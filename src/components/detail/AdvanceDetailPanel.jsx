import { useApp } from '../../context/AppContext';
import { formatNumber, isDebitNormal, sortAccountsByCode } from '../../utils/accounting';

// side: 'receivable'（預付貨款，正常餘額為借方）或 'payable'（預收貨款，正常餘額為貸方）
// 邏輯比照應收/應付帳款明細：依對象拆分明細，所有明細加總＝該科目的開帳金額；
// 不需要攤銷／沖銷狀態追蹤（等貨到齊後一次沖銷），故直接列出各卡片金額
export default function AdvanceDetailPanel({ side }) {
  const { accounts, advanceCards } = useApp();
  const wantDebitNormal = side === 'receivable';
  const advanceAccounts = sortAccountsByCode(
    accounts.filter((a) => a.isAdvanceAccount && !a.isSummary && isDebitNormal(a) === wantDebitNormal)
  );
  const title = side === 'receivable' ? '預付貨款明細' : '預收貨款明細';
  const emptyHint = side === 'receivable' ? '目前尚未設定預付貨款科目。' : '目前尚未設定預收貨款科目。';

  return (
    <div>
      <h2>{title}</h2>
      {advanceAccounts.length === 0 && <p className="hint-text">{emptyHint}</p>}

      {advanceAccounts.map((acc) => {
        const cards = advanceCards.filter((c) => c.accountId === acc.id);
        const total = cards.reduce((s, c) => s + Number(c.amount || 0), 0);

        return (
          <div key={acc.id} className="inventory-editor">
            <h4>
              {acc.code} {acc.name}
            </h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>對象</th>
                  <th>金額</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id}>
                    <td>{c.party || '(未命名)'}</td>
                    <td className="num-cell">{formatNumber(c.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>對象明細合計</th>
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
