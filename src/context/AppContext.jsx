import { createContext, useContext, useState } from 'react';
import { defaultAccounts } from '../data/defaultAccounts';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [openingBalances, setOpeningBalances] = useState({});
  const [entries, setEntries] = useState([]);

  function addAccount(account) {
    setAccounts((prev) => [...prev, { ...account, id: `a${Date.now()}` }]);
  }

  function updateAccount(id, patch) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function deleteAccount(id) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setOpeningBalances((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setOpeningBalance(accountId, amount) {
    setOpeningBalances((prev) => ({ ...prev, [accountId]: amount }));
  }

  function addEntry(entry) {
    setEntries((prev) => [...prev, { ...entry, id: `e${Date.now()}` }]);
  }

  function deleteEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function importData(data) {
    if (data.accounts) setAccounts(data.accounts);
    if (data.openingBalances) setOpeningBalances(data.openingBalances);
    if (data.entries) setEntries(data.entries);
  }

  const value = {
    accounts,
    openingBalances,
    entries,
    addAccount,
    updateAccount,
    deleteAccount,
    setOpeningBalance,
    addEntry,
    deleteEntry,
    importData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
