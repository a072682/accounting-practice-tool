import { useApp } from '../../context/AppContext';
import { computeArApState, computeEndingBalances, formatNumber, isDebitNormal, sortAccountsByCode } from '../../utils/accounting';

// side: 'receivable'（應收帳款，正常餘額為借方）或 'payable'（應付帳款，正常餘額為貸方）
// 每個帳款科目依客戶/廠商拆分明細，所有明細加總＝該「應收/應付帳款」明細科目的餘額；
// 若有配對的備抵損失/呆帳科目（allowanceAccountCode），另外獨立列示該科目餘額並算出淨額參考
export default function ArApDetailPanel({ side }) {
  const { accounts, arApCards, entries, openingBalances } = useApp();
  const wantDebitNormal = side === 'receivable';
  const arApAccounts = sortAccountsByCode(
    accounts.filter((a) => a.isArApAccount && !a.isSummary && isDebitNormal(a) === wantDebitNormal)
  );
  const state = computeArApState(accounts, arApCards, entries);
  const endingBalances = computeEndingBalances(accounts, openingBalances, entries);
  const title = side === 'receivable' ? '應收帳款明細' : '應付帳款明細';
  const emptyHint = side === 'receivable' ? '目前尚未設定應收帳款科目。' : '目前尚未設定應付帳款科目。';

  return (
    <div>
      <h2>{title}</h2>
      {arApAccounts.length === 0 && <p className="hint-text">{emptyHint}</p>}

      {arApAccounts.map((acc) => {
        const cards = arApCards.filter((c) => c.accountId === acc.id);
        const outstanding = cards.filter((c) => (state[c.id]?.remaining || 0) > 0.005);
        const total = outstanding.reduce((s, c) => s + (state[c.id]?.remaining || 0), 0);
        const allowanceAccount = acc.allowanceAccountCode
          ? accounts.find((a) => a.code === acc.allowanceAccountCode)
          : null;
        const allowanceBalance = allowanceAccount ? endingBalances[allowanceAccount.id] || 0 : 0;

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
                  <th>客戶/廠商明細合計</th>
                  <th className="num-cell">{formatNumber(total)}</th>
                </tr>
                {allowanceAccount && (
                  <>
                    <tr>
                      <td>
                        減：{allowanceAccount.code} {allowanceAccount.name}
                      </td>
                      <td className="num-cell">{formatNumber(allowanceBalance)}</td>
                    </tr>
                    <tr>
                      <th>淨額</th>
                      <th className="num-cell">{formatNumber(total - allowanceBalance)}</th>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}
