import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import AccountsTab from './components/AccountsTab';
import OpeningBalanceTab from './components/OpeningBalanceTab';
import JournalEntryTab from './components/JournalEntryTab';
import LedgerTab from './components/LedgerTab';
import InventoryDetailTab from './components/InventoryDetailTab';
import NoteDetailTab from './components/NoteDetailTab';
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
  { key: 'inventory', label: '存貨明細表', Component: InventoryDetailTab },
  { key: 'notes', label: '票據明細表', Component: NoteDetailTab },
  { key: 'trial', label: '試算表', Component: TrialBalanceTab },
  { key: 'income', label: '損益表', Component: IncomeStatementTab },
  { key: 'balance', label: '資產負債表', Component: BalanceSheetTab },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const ActiveComponent = TABS.find((t) => t.key === activeTab).Component;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>複式記帳練習工具</h1>
        <ImportExport />
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
