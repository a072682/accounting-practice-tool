import InventoryDetailPanel from '../components/detail/InventoryDetailPanel';
import NoteDetailPanel from '../components/detail/NoteDetailPanel';
import ArApDetailPanel from '../components/detail/ArApDetailPanel';
import AdvanceDetailPanel from '../components/detail/AdvanceDetailPanel';
import AmortizationDetailPanel from '../components/detail/AmortizationDetailPanel';

// 明細表登錄表：日後新增其他明細表類型（如固定資產卡片明細）時，
// 只需在此陣列新增一筆項目（key／label／Component／props），
// 「明細表」分頁的左側選單與右側內容會自動顯示，不需修改頂層分頁結構。
export const detailTypes = [
  { key: 'inventory', label: '存貨明細', Component: InventoryDetailPanel },
  { key: 'notes-receivable', label: '應收票據明細', Component: NoteDetailPanel, props: { side: 'receivable' } },
  { key: 'notes-payable', label: '應付票據明細', Component: NoteDetailPanel, props: { side: 'payable' } },
  { key: 'ar-detail', label: '應收帳款明細', Component: ArApDetailPanel, props: { side: 'receivable' } },
  { key: 'ap-detail', label: '應付帳款明細', Component: ArApDetailPanel, props: { side: 'payable' } },
  { key: 'prepaid-purchase-detail', label: '預付貨款明細', Component: AdvanceDetailPanel, props: { side: 'receivable' } },
  { key: 'advance-receipt-detail', label: '預收貨款明細', Component: AdvanceDetailPanel, props: { side: 'payable' } },
  {
    key: 'prepaid-expense-detail',
    label: '預付費用明細',
    Component: AmortizationDetailPanel,
    props: { side: 'receivable' },
  },
  {
    key: 'unearned-revenue-detail',
    label: '預收收入明細',
    Component: AmortizationDetailPanel,
    props: { side: 'payable' },
  },
];
