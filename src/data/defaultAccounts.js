// 標準科目表模板（不含 id，id 於載入/建立時動態產生）
// type: 資產 / 負債 / 權益 / 收益 / 費損
// parent: 上層科目代號（彙總科目留空 null）
// isSummary: true 表示彙總科目，僅用於報表分類加總，不可作為分錄借貸對象
// normalBalance: 借方 / 貸方，該科目的「正常餘額方向」。多數科目可依 type 推定，
//   但備抵損失、累計折舊、銷貨退回/折讓、進貨退出/折讓等「抵銷科目」的正常餘額方向
//   與其所屬 type 相反，需個別指定。

export const ACCOUNT_TYPES = ['資產', '負債', '權益', '收益', '費損'];
export const NORMAL_BALANCE_SIDES = ['借方', '貸方'];
export const DEPRECIATION_METHODS = ['直線法', '倍數餘額遞減法'];

// 借方為正常餘額方（借增貸減）的類型（僅作為推定預設值使用，實際判斷一律以科目的 normalBalance 為準）
export const DEBIT_NORMAL_TYPES = ['資產', '費損'];

export function defaultNormalBalance(type) {
  return DEBIT_NORMAL_TYPES.includes(type) ? '借方' : '貸方';
}

// isFixedAsset: true 表示此為「成本」科目，可建立資產卡（見【不動產廠房設備資產卡】功能）
// depreciationAccountCode: 配對的累計折舊（抵銷）科目代號；留空表示不提折舊（如土地）
// isNoteAccount: true 表示此為票據科目（應收票據／應付票據），可建立票據明細卡
// isArApAccount: true 表示此為應收/應付帳款科目，可依客戶/廠商建立明細卡
// allowanceAccountCode: 配對的備抵損失／呆帳（抵銷）科目代號；留空表示無配對的備抵科目
// isAdvanceAccount: true 表示此為預付貨款／預收貨款科目，可依對象建立明細卡（僅對象＋金額，等貨到齊後一次沖銷，不分期攤銷）
// isAmortizedAccount: true 表示此為預付費用／預收收入科目，可建立攤銷明細卡（依生效日期＋攤銷期間分期認列）
function t(
  code,
  name,
  type,
  parent = null,
  isSummary = false,
  isInventory = false,
  normalBalanceOverride = null,
  isFixedAsset = false,
  depreciationAccountCode = null,
  isNoteAccount = false,
  isArApAccount = false,
  allowanceAccountCode = null,
  isAdvanceAccount = false,
  isAmortizedAccount = false
) {
  return {
    code,
    name,
    type,
    parent,
    isSummary,
    isInventory,
    normalBalance: normalBalanceOverride || defaultNormalBalance(type),
    isFixedAsset,
    depreciationAccountCode,
    isNoteAccount,
    isArApAccount,
    allowanceAccountCode,
    isAdvanceAccount,
    isAmortizedAccount,
  };
}

export const standardAccountTemplates = [
  // ===== 1xxx 資產：流動資產 =====
  t('1110', '現金及約當現金', '資產', null, true),
  t('1111', '現金', '資產', '1110'),
  t('1112', '銀行存款', '資產', '1110'),
  t('1120', '各項金融資產－流動', '資產', null, true),
  t('1121', '各項金融資產－流動', '資產', '1120'),
  t('1130', '應收票據', '資產', null, true),
  t('1131', '應收票據', '資產', '1130', false, false, null, false, null, true),
  t('1132', '備抵損失－應收票據', '資產', '1130', false, false, '貸方'),
  t('1140', '應收帳款', '資產', null, true),
  t('1141', '應收帳款', '資產', '1140', false, false, null, false, null, false, true, '1142'),
  t('1142', '備抵損失－應收帳款', '資產', '1140', false, false, '貸方'),
  t('1150', '其他應收款', '資產', null, true),
  t('1151', '應收收益', '資產', '1150'),
  t('1152', '應收退稅款', '資產', '1150'),
  t('1153', '其他應收款', '資產', '1150'),
  t('1160', '存貨', '資產', null, true),
  t('1161', '存貨', '資產', '1160', false, true),
  t('1170', '生物資產－流動', '資產', null, true),
  t('1171', '各項生物資產－流動', '資產', '1170'),
  t('1180', '預付款項', '資產', null, true),
  t('1181', '預付貨款', '資產', '1180', false, false, null, false, null, false, false, null, true, false),
  t('1182', '預付費用', '資產', '1180', false, false, null, false, null, false, false, null, false, true),
  t('1183', '用品盤存', '資產', '1180'),
  t('1184', '進項稅額', '資產', '1180'),
  t('1185', '留抵稅額', '資產', '1180'),
  t('1190', '其他流動資產', '資產', null, true),
  t('1191', '暫付款', '資產', '1190'),
  t('1192', '代付款', '資產', '1190'),

  // ===== 1xxx 資產：非流動資產 =====
  t('1210', '各項金融資產－非流動', '資產', null, true),
  t('1211', '各項金融資產－非流動', '資產', '1210'),
  t('1220', '不動產、廠房及設備', '資產', null, true),
  t('1221', '土地成本', '資產', '1220', false, false, null, true, null),
  t('1222', '房屋及建築成本', '資產', '1220', false, false, null, true, '1223'),
  t('1223', '累計折舊－房屋及建築', '資產', '1220', false, false, '貸方'),
  t('1224', '機器設備成本', '資產', '1220', false, false, null, true, '1225'),
  t('1225', '累計折舊－機器設備', '資產', '1220', false, false, '貸方'),
  t('1226', '運輸設備成本', '資產', '1220', false, false, null, true, '1227'),
  t('1227', '累計折舊－運輸設備', '資產', '1220', false, false, '貸方'),
  t('1228', '辦公設備成本', '資產', '1220', false, false, null, true, '1229'),
  t('1229', '累計折舊－辦公設備', '資產', '1220', false, false, '貸方'),
  t('1230', '無形資產', '資產', null, true),
  t('1231', '商標權', '資產', '1230'),
  t('1232', '專利權', '資產', '1230'),
  t('1233', '累計攤銷－專利權', '資產', '1230', false, false, '貸方'),
  t('1234', '著作權', '資產', '1230'),
  t('1235', '累計攤銷－著作權', '資產', '1230', false, false, '貸方'),
  t('1236', '電腦軟體', '資產', '1230'),
  t('1237', '累計攤銷－電腦軟體', '資產', '1230', false, false, '貸方'),
  t('1238', '商譽', '資產', '1230'),
  t('1240', '生物資產－非流動', '資產', null, true),
  t('1241', '各項生物資產－非流動', '資產', '1240'),
  t('1250', '其他非流動資產', '資產', null, true),
  t('1251', '存出保證金', '資產', '1250'),
  t('1252', '長期應收票據', '資產', '1250'),
  t('1253', '基金', '資產', '1250'),

  // ===== 2xxx 負債：流動負債 =====
  t('2110', '短期借款', '負債', null, true),
  t('2111', '銀行透支', '負債', '2110'),
  t('2112', '銀行借款', '負債', '2110'),
  t('2120', '合約負債－流動', '負債', null, true),
  t('2121', '預收貨款', '負債', '2120', false, false, null, false, null, false, false, null, true, false),
  t('2122', '預收收入', '負債', '2120', false, false, null, false, null, false, false, null, false, true),
  t('2130', '應付票據', '負債', null, true),
  t('2131', '應付票據', '負債', '2130', false, false, null, false, null, true),
  t('2140', '應付帳款', '負債', null, true),
  t('2141', '應付帳款', '負債', '2140', false, false, null, false, null, false, true, null),
  t('2150', '其他應付款', '負債', null, true),
  t('2151', '應付費用', '負債', '2150'),
  t('2152', '應付土地房屋款', '負債', '2150'),
  t('2153', '應付設備款', '負債', '2150'),
  t('2154', '銷項稅額', '負債', '2150'),
  t('2155', '應付營業稅', '負債', '2150'),
  t('2156', '其他應付款', '負債', '2150'),
  t('2160', '本期所得稅負債', '負債', null, true),
  t('2161', '本期所得稅負債', '負債', '2160'),
  t('2170', '負債準備－流動', '負債', null, true),
  t('2171', '負債準備－流動', '負債', '2170'),
  t('2180', '其他流動負債', '負債', null, true),
  t('2181', '暫收款', '負債', '2180'),
  t('2182', '代收款', '負債', '2180'),

  // ===== 2xxx 負債：非流動負債 =====
  t('2210', '應付公司債', '負債', null, true),
  t('2211', '應付公司債', '負債', '2210'),
  t('2220', '長期借款', '負債', null, true),
  t('2221', '銀行長期借款', '負債', '2220'),
  t('2230', '負債準備－非流動', '負債', null, true),
  t('2231', '負債準備－非流動', '負債', '2230'),
  t('2240', '其他非流動負債', '負債', null, true),
  t('2241', '長期應付票據', '負債', '2240'),
  t('2242', '存入保證金', '負債', '2240'),

  // ===== 3xxx 權益 =====
  t('3110', '業主資本', '權益', null, true),
  t('3111', '業主資本', '權益', '3110'),
  t('3120', '業主往來', '權益', null, true),
  t('3121', '業主往來', '權益', '3120'),
  t('3130', '本期損益', '權益', null, true),
  t('3131', '本期損益', '權益', '3130'),
  t('3140', '股本', '權益', null, true),
  t('3141', '普通股股本', '權益', '3140'),
  t('3150', '保留盈餘', '權益', null, true),
  t('3151', '法定盈餘公積', '權益', '3150'),
  t('3152', '保留盈餘（未分配）', '權益', '3150'),

  // ===== 4xxx 收益 =====
  t('4101', '銷貨收入', '收益'),
  t('4102', '銷貨退回', '收益', null, false, false, '借方'),
  t('4103', '銷貨折讓', '收益', null, false, false, '借方'),
  t('4104', '勞務收入', '收益'),
  t('4201', '其他收入', '收益'),
  t('4202', '利息收入', '收益'),
  t('4203', '佣金收入', '收益'),
  t('4204', '租金收入', '收益'),
  t('4205', '股利收入', '收益'),
  t('4206', '處分不動產、廠房及設備利益', '收益'),
  t('4207', '處分投資利益', '收益'),

  // ===== 5xxx 費損 =====
  t('5101', '銷貨成本', '費損'),
  t('5102', '銷貨折扣', '費損'),
  t('5103', '進貨', '費損'),
  t('5104', '進貨費用', '費損'),
  t('5105', '進貨退出', '費損', null, false, false, '貸方'),
  t('5106', '進貨折讓', '費損', null, false, false, '貸方'),
  t('5107', '進貨折扣', '費損', null, false, false, '貸方'),
  t('5108', '勞務成本', '費損'),
  t('5201', '薪資支出', '費損'),
  t('5202', '租金支出', '費損'),
  t('5203', '文具用品', '費損'),
  t('5204', '旅費', '費損'),
  t('5205', '運費', '費損'),
  t('5206', '郵電費', '費損'),
  t('5207', '修繕費', '費損'),
  t('5208', '廣告費', '費損'),
  t('5209', '水電瓦斯費', '費損'),
  t('5210', '保險費', '費損'),
  t('5211', '交際費', '費損'),
  t('5212', '捐贈', '費損'),
  t('5213', '稅捐', '費損'),
  t('5214', '折舊', '費損'),
  t('5215', '各項攤提', '費損'),
  t('5216', '伙食費', '費損'),
  t('5217', '職工福利', '費損'),
  t('5218', '佣金支出', '費損'),
  t('5219', '訓練費', '費損'),
  t('5220', '研究發展費用', '費損'),
  t('5221', '其他費用', '費損'),
  t('5222', '預期信用減損損失', '費損'),
  t('5223', '預期信用減損利益', '費損', null, false, false, '貸方'),
  t('5301', '其他損失', '費損'),
  t('5302', '利息費用', '費損'),
  t('5303', '處分不動產、廠房及設備損失', '費損'),
  t('5304', '處分投資損失', '費損'),
];

// isSalesRevenueAccount / isCogsAccount：分錄登錄頁用來判斷是否觸發「銷貨品項明細輸入模式」
// （品項／售價或成本／數量），不透過 t() 的一長串位置參數指定，改於此依代號設定，避免既有呼叫都要補一堆 false/null
const SALES_REVENUE_CODES = ['4101'];
const COGS_CODES = ['5101'];
standardAccountTemplates.forEach((tpl) => {
  tpl.isSalesRevenueAccount = SALES_REVENUE_CODES.includes(tpl.code);
  tpl.isCogsAccount = COGS_CODES.includes(tpl.code);
});

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `a${Date.now()}_${idCounter}`;
}

// 依模板產生帶有唯一 id 的科目物件陣列
export function createAccountsFromTemplates(templates) {
  return templates.map((tpl) => ({ ...tpl, id: nextId() }));
}

// 預設科目表（App 啟動時的初始資料）＝完整標準科目表
export const defaultAccounts = createAccountsFromTemplates(standardAccountTemplates);
