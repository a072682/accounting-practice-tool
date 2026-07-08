// ============================================================
// 【修改六】共用科目樹狀列渲染元件：科目設定頁、開帳輸入頁皆共用同一套摺疊/展開邏輯
// 樹狀節點有兩種：
//   { kind: 'group', key, label, children }   —— 顯示分類群組（非真實科目，見 utils/accounting.js buildDisplayTree）
//   { kind: 'account', account, children }    —— 真實科目（彙總或明細），children 可能是子彙總或明細
// 摺疊狀態統一以 collapsedKeys 追蹤：顯示分類節點用 `group:<key>`、真實科目節點用其代號
// ============================================================
export default function AccountTreeRows({
  tree,
  collapsedKeys,
  onToggle,
  renderAccountCells,
  renderGroupCells,
  colSpan,
  onAddChild,
  addRootLabel = '+ 新增頂層科目',
  activeAddContainer = null,
  renderInlineForm = null,
}) {
  const rows = [];

  // containerKey 用來識別「這一個新增子科目的位置」（真實彙總科目代號／顯示分類群組 key／樹的最底部）
  // parentAccountCode 則是新科目實際要寫入的上層科目代號：顯示分類群組底下一律為 null（不是真實上層科目）
  function renderAddRow(parentAccountCode, containerKey, depth) {
    if (activeAddContainer === containerKey && renderInlineForm) {
      rows.push(
        <tr key={`${containerKey}-form`} className="add-child-row">
          <td colSpan={colSpan} style={{ paddingLeft: `${depth * 20}px` }}>
            {renderInlineForm(parentAccountCode)}
          </td>
        </tr>
      );
      return;
    }
    rows.push(
      <tr key={`${containerKey}-add`} className="add-child-row">
        <td colSpan={colSpan} style={{ paddingLeft: `${depth * 20}px` }}>
          <button type="button" onClick={() => onAddChild(parentAccountCode, containerKey)}>
            {parentAccountCode ? '+ 新增子科目' : addRootLabel}
          </button>
        </td>
      </tr>
    );
  }

  function renderNode(node, depth) {
    const isGroup = node.kind === 'group';
    const containerKey = isGroup ? `group:${node.key}` : node.account.code;
    const isExpandable = isGroup || node.account.isSummary;
    const isExpanded = !collapsedKeys.has(containerKey);
    const hasChildren = node.children.length > 0;

    rows.push(
      <tr key={isGroup ? `group-${node.key}` : node.account.id} className={isExpandable ? 'summary-row' : ''}>
        <td className="tree-code-cell col-code" data-label="代號" style={{ paddingLeft: `${depth * 20}px` }}>
          {isExpandable && (
            <button
              type="button"
              className="tree-toggle"
              onClick={() => onToggle(containerKey)}
              aria-label={isExpanded ? '收合' : '展開'}
              title={isExpanded ? '收合' : '展開'}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
          {isGroup ? '' : node.account.code}
        </td>
        {isGroup
          ? renderGroupCells(node, { depth, isExpanded })
          : renderAccountCells(node.account, { depth, hasChildren, isExpanded })}
      </tr>
    );

    if (isExpandable && isExpanded) {
      node.children.forEach((child) => renderNode(child, depth + 1));
      if (onAddChild) {
        const parentAccountCode = isGroup ? null : node.account.code;
        renderAddRow(parentAccountCode, containerKey, depth + 1);
      }
    }
  }

  tree.forEach((node) => renderNode(node, 0));

  if (onAddChild) {
    renderAddRow(null, '__root__', 0);
  }

  return rows;
}
// ============================================================
// 【修改六結束】
// ============================================================
