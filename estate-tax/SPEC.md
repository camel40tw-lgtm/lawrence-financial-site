# 台灣遺產稅免費試算頁開發規格

版本：v1.0  
規則基準：115 年度遺產稅免稅額、扣除額與現行《遺產及贈與稅法》第 13 條稅率  
頁面定位：網站「免費試算」項下的一頁式稅務概算工具，僅供教育與初步規劃參考，不構成法律、稅務、會計或申報意見。

## 1. 頁面目標

建立一個可放在 `/estate-tax/` 的一頁式台灣遺產稅試算頁。頁面風格沿用既有「投資不動產規劃平台」與「房地合一 2.0 稅額試算」：專業工具頁、即時計算摘要、分段輸入、公式展開、結果表格、風險提示與免責聲明。

第一版只處理遺產稅核心公式：

```text
課稅遺產淨額 = max(0, 遺產總額 - 不計入遺產總額合計 - 扣除額合計 - 免稅額)
應納遺產稅額 = 依第 13 條三段級距計算
```

複雜案件需提示進階覆核，例如債務扣除、配偶剩餘財產差額分配、農地、保險給付、跨境財產、信託、訴訟或遺產範圍爭議。

## 2. 使用者流程

1. 使用者進入頁面，看到工具用途、資料不會上傳與規則版本。
2. 使用者輸入死亡日與遺產總額。
3. 使用者輸入不計入遺產總額項目，系統自動套用法定上限。
4. 使用者輸入家庭成員與扣除額條件。
5. 使用者即時看到課稅遺產淨額、適用級距、預估稅額與公式展開。
6. 使用者可複製或列印試算摘要。

## 3. 欄位規格

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 說明 |
|---|---|---|---|---|
| 死亡日／繼承事實發生日 | `deathDate` | date | 2026-08-09 | 用於判斷規則版本；目前支援 115 年度版本 |
| 遺產總額 | `grossEstate` | number | 30000000 | 全部應計入遺產之財產合計 |
| 日常生活器具及用具總值 | `dailyNecessitiesValue` | number | 800000 | 不計入上限 100 萬元 |
| 職業上工具總值 | `workToolsValue` | number | 0 | 不計入上限 56 萬元 |
| 配偶人數 | `spouseCount` | select | 1 | 通常為 0 或 1 |
| 直系血親卑親屬人數 | `linealDescCount` | number | 2 | 每人扣除 56 萬元 |
| 未成年卑親屬距成年年數合計 | `linealMinorExtraYears` | number | 0 | 每年加扣 56 萬元 |
| 父母人數 | `parentCount` | select | 0 | 每人扣除 138 萬元 |
| 重度以上身心障礙特別扣除人數 | `disabledCount` | number | 0 | 每人扣除 693 萬元 |
| 受扶養兄弟姊妹及祖父母人數 | `dependentSiblingGrandparentCount` | number | 0 | 每人扣除 56 萬元 |
| 未成年受扶養兄弟姊妹距成年年數合計 | `dependentSiblingMinorExtraYears` | number | 0 | 每年加扣 56 萬元 |
| 適用喪葬費扣除 | `funeralDeductionEnabled` | checkbox | true | 扣除 138 萬元 |
| 涉及進階情境 | `advancedFlags` | checkbox group | empty | 勾選時標示需進階覆核 |

## 4. 115 年度常數

```js
const EXEMPTION = 13_330_000;
const DEDUCTION_SPOUSE = 5_530_000;
const DEDUCTION_LINEAL = 560_000;
const DEDUCTION_PARENT = 1_380_000;
const DEDUCTION_DISABLED = 6_930_000;
const DEDUCTION_DEPENDENT_SG = 560_000;
const DEDUCTION_FUNERAL = 1_380_000;
const EXCLUDED_DAILY_NECESSITIES_CAP = 1_000_000;
const EXCLUDED_WORK_TOOLS_CAP = 560_000;
```

## 5. 稅率公式

```js
if (netEstate <= 50_000_000) tax = netEstate * 0.10;
else if (netEstate <= 100_000_000) tax = 5_000_000 + (netEstate - 50_000_000) * 0.15;
else tax = 12_500_000 + (netEstate - 100_000_000) * 0.20;
```

## 6. 結果輸出

- 遺產總額。
- 不計入遺產總額分項與合計。
- 各類扣除額分項與合計。
- 免稅額。
- 課稅遺產淨額。
- 適用級距。
- 預估應納遺產稅額。
- 進階覆核提示與免責聲明。

## 7. 免責與更新提示

頁面需明示：本版依 115 年度公告金額與現行《遺產及贈與稅法》第 13 條整理。若未來財政部公告新年度金額，應更新版本常數表。個案仍可能因債務、配偶剩餘財產差額分配、農地、保險、跨境財產、信託、繼承人資格或其他爭點而不同。
