// 用於取代長串括號註解文字：只顯示一個小圖示，滑鼠移過（或觸控長按）才顯示完整說明，
// 避免「名稱」欄位被說明文字撐得過寬，擠壓到其他欄位（見科目列表欄寬調整需求）
export default function HintIcon({ text }) {
  if (!text) return null;
  return (
    <span className="hint-icon" title={text} aria-label={text}>
      ⓘ
    </span>
  );
}
