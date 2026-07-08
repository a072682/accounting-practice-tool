import { useApp } from '../../context/AppContext';
import { computeNoteState, formatNumber, isDebitNormal, sortAccountsByCode } from '../../utils/accounting';

// side: 'receivable'（應收票據，正常餘額為借方）或 'payable'（應付票據，正常餘額為貸方）
export default function NoteDetailPanel({ side }) {
  const { accounts, noteCards, entries } = useApp();
  const wantDebitNormal = side === 'receivable';
  const noteAccounts = sortAccountsByCode(
    accounts.filter((a) => a.isNoteAccount && !a.isSummary && isDebitNormal(a) === wantDebitNormal)
  );
  const state = computeNoteState(accounts, noteCards, entries);
  const title = side === 'receivable' ? '應收票據明細' : '應付票據明細';
  const emptyHint = side === 'receivable' ? '目前尚未設定應收票據科目。' : '目前尚未設定應付票據科目。';

  return (
    <div>
      <h2>{title}</h2>
      {noteAccounts.length === 0 && <p className="hint-text">{emptyHint}</p>}

      {noteAccounts.map((acc) => {
        const cards = noteCards.filter((c) => c.accountId === acc.id);
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
                  <th>票據號碼</th>
                  <th>開票日</th>
                  <th>到期日</th>
                  <th>原始金額</th>
                  <th>未沖銷餘額</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((c) => (
                  <tr key={c.id}>
                    <td>{c.party || '(未命名)'}</td>
                    <td>{c.noteNumber || '—'}</td>
                    <td>{c.issueDate || '—'}</td>
                    <td>{c.dueDate || '—'}</td>
                    <td className="num-cell">{formatNumber(c.amount)}</td>
                    <td className="num-cell">{formatNumber(state[c.id]?.remaining || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={5}>合計（尚未沖銷）</th>
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
