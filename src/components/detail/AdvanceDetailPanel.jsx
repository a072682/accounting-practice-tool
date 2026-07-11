import { useApp } from '../../context/AppContext';
import { computeAdvanceState, formatNumber, isDebitNormal, sortAccountsByCode } from '../../utils/accounting';

// side: 'receivable'（預付貨款，正常餘額為借方）或 'payable'（預收貨款，正常餘額為貸方）
// 邏輯比照應收/應付帳款明細：依對象拆分明細，貨到時可於分錄輸入部分/全額沖銷，
// 未沖銷餘額依「期初卡片金額 + 分錄新增/沖銷異動」重播計算
export default function AdvanceDetailPanel({ side }) {
  const { accounts, advanceCards, entries } = useApp();
  const wantDebitNormal = side === 'receivable';
  const advanceAccounts = sortAccountsByCode(
    accounts.filter((a) => a.isAdvanceAccount && !a.isSummary && isDebitNormal(a) === wantDebitNormal)
  );
  const state = computeAdvanceState(accounts, advanceCards, entries);
  const title = side === 'receivable' ? '預付貨款明細' : '預收貨款明細';
  const emptyHint = side === 'receivable' ? '目前尚未設定預付貨款科目。' : '目前尚未設定預收貨款科目。';

  return (
    <div>
      <h2>{title}</h2>
      {advanceAccounts.length === 0 && <p className="hint-text">{emptyHint}</p>}

      {advanceAccounts.map((acc) => {
        const cards = advanceCards.filter((c) => c.accountId === acc.id);
        const outstanding = cards.filter((c) => (state[c.id]?.remaining || 0) > 0.005);
        const total = outstanding.reduce((s, c) => s + (state[c.id]?.remaining || 0), 0);

        return (
          <div key={acc.id} className="inventory-editor">
            <h4>
              {acc.code} {acc.name}
            </h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>對象</th>
                  <th>未沖銷餘額</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((c) => (
                  <tr key={c.id}>
                    <td>{c.party || '(未命名)'}</td>
                    <td className="num-cell">{formatNumber(state[c.id]?.remaining || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>對象明細合計（尚未沖銷）</th>
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
