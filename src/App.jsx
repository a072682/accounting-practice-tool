import { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import AccountsTab from './components/AccountsTab';
import OpeningBalanceTab from './components/OpeningBalanceTab';
import JournalEntryTab from './components/JournalEntryTab';
import LedgerTab from './components/LedgerTab';
import DetailTab from './components/DetailTab';
import TrialBalanceTab from './components/TrialBalanceTab';
import IncomeStatementTab from './components/IncomeStatementTab';
import BalanceSheetTab from './components/BalanceSheetTab';
import ImportExport from './components/ImportExport';
import './App.css';

const TABS = [
  { key: 'accounts', label: '科目設定', Component: AccountsTab },
  { key: 'opening', label: '開帳', Component: OpeningBalanceTab },
  { key: 'entries', label: '分錄登錄', Component: JournalEntryTab },
  { key: 'ledger', label: '分類帳', Component: LedgerTab },
  { key: 'detail', label: '明細表', Component: DetailTab },
  { key: 'trial', label: '試算表', Component: TrialBalanceTab },
  { key: 'income', label: '損益表', Component: IncomeStatementTab },
  { key: 'balance', label: '資產負債表', Component: BalanceSheetTab },
];

const THEME_STORAGE_KEY = 'accounting-tool-theme';

// 預設依上次選擇；若從未選過，改依系統的亮/暗色偏好判斷
function getInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function AppContent() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [theme, setTheme] = useState(getInitialTheme);
  const ActiveComponent = TABS.find((t) => t.key === activeTab).Component;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>複式記帳練習工具</h1>
        <div className="theme-toggle">
          <button type="button" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀ 日間模式' : '🌙 夜晚模式'}
          </button>
          <ImportExport />
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={tab.key === activeTab ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <ActiveComponent />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
