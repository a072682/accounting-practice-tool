import { useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function ImportExport() {
  const { accounts, openingBalances, inventoryItems, fixedAssetCards, noteCards, entries, importData } = useApp();
  const fileInputRef = useRef(null);

  function handleExport() {
    const data = { accounts, openingBalances, inventoryItems, fixedAssetCards, noteCards, entries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `記帳練習-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        importData(data);
      } catch {
        alert('檔案格式錯誤，無法匯入');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="import-export">
      <button onClick={handleExport}>匯出 JSON</button>
      <button onClick={handleImportClick}>匯入 JSON</button>
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
