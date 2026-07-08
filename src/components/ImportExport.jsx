import { useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function ImportExport() {
  const {
    accounts,
    openingBalances,
    inventoryItems,
    fixedAssetCards,
    noteCards,
    arApCards,
    entries,
    openingSnapshot,
    importData,
  } = useApp();
  const fileInputRef = useRef(null);

  function handleExport() {
    const data = {
      accounts,
      openingBalances,
      inventoryItems,
      fixedAssetCards,
      noteCards,
      arApCards,
      openingSnapshot,
      entries,
    };
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
      <span className="import-export-item">
        <button onClick={handleExport} title="下載備份檔，可用於換裝置或保存進度">
          匯出練習紀錄
        </button>
        <span className="hint-text">(下載備份檔，可用於換裝置或保存進度)</span>
      </span>
      <span className="import-export-item">
        <button onClick={handleImportClick} title="讀取先前備份的檔案">
          匯入練習紀錄
        </button>
        <span className="hint-text">(讀取先前備份的檔案)</span>
      </span>
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
