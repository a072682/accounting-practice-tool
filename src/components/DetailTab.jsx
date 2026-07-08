import { useState } from 'react';
import { detailTypes } from '../data/detailTypes';

// 明細表分頁：左側為可擴充的明細表清單（見 data/detailTypes.js），右側顯示選中項目的內容
export default function DetailTab() {
  const [activeKey, setActiveKey] = useState(detailTypes[0]?.key);
  const active = detailTypes.find((t) => t.key === activeKey) || detailTypes[0];
  const ActiveComponent = active?.Component;

  return (
    <div className="detail-tab-layout">
      <aside className="detail-sidebar">
        <ul className="detail-sidebar-list">
          {detailTypes.map((type) => (
            <li key={type.key}>
              <button
                type="button"
                className={type.key === active?.key ? 'detail-sidebar-item active' : 'detail-sidebar-item'}
                onClick={() => setActiveKey(type.key)}
              >
                {type.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="detail-content">
        {ActiveComponent ? (
          <ActiveComponent {...(active.props || {})} />
        ) : (
          <p className="hint-text">尚未設定任何明細表。</p>
        )}
      </section>
    </div>
  );
}
