# 台灣遺產稅法規與試算公式規則（供一頁式試算網頁 AI Agent 使用）

> 版本定位：本文件以 **目前已查得之官方最新公開資訊** 為準，重點整理台灣遺產稅試算所需之法規規則、欄位定義、計算順序、公式與實作注意事項。法規主軸依《遺產及贈與稅法》第13條，金額標準依財政部 115 年度（西元 2026 年）公告。 [cite:15][cite:14]

## 1. 法源與最新適用基準

- 遺產稅之基本稅額計算，係以被繼承人死亡時依規定計算之遺產總額，減除法定扣除額及免稅額後，按級距稅率課徵。 [cite:15]
- 目前查得官方最新金額標準中，**115 年 1 月 1 日以後發生之繼承案件**，遺產稅免稅額為 **1,333 萬元**。 [cite:14]
- 同一公告所列各項扣除額，亦適用於 **115 年度發生之繼承案件**。 [cite:14]
- 申報實務上，若要做網頁試算，應以「**死亡日／繼承事實發生日**」作為版本選擇的核心判斷欄位。 [cite:14][cite:2]

## 2. 試算核心流程

建議前端或後端依下列順序計算：

1. 先彙總全部應計入遺產之財產，得到「遺產總額」。
2. 再扣除依法「不計入遺產總額」之項目。
3. 再扣除法定各項「扣除額」。
4. 最後再扣除「免稅額」。
5. 若結果小於 0，課稅遺產淨額以 0 計。
6. 依課稅遺產淨額套用第13條級距稅率。 [cite:15][cite:14][cite:2]

可實作為：

\[
課稅遺產淨額 = \max\left(0,\ 遺產總額 - 不計入遺產總額金額 - 各項扣除額合計 - 免稅額\right)
\]

其後：

\[
應納遺產稅額 = f(課稅遺產淨額)
\]

其中函數 \(f\) 依第13條稅率級距決定。 [cite:15]

## 3. 115年度金額規則

### 3.1 免稅額

- 一般案件免稅額：**13,330,000 元**。 [cite:14]

### 3.2 扣除額

- 配偶扣除額：**5,530,000 元**。 [cite:14]
- 直系血親卑親屬扣除額：**每人 560,000 元**。 [cite:14]
- 直系血親卑親屬如屬未成年，並得按其年齡距屆滿成年之年數，**每年加扣 560,000 元**。 [cite:14]
- 父母扣除額：**每人 1,380,000 元**。 [cite:14]
- 重度以上身心障礙特別扣除額：**每人 6,930,000 元**。 [cite:14]
- 受被繼承人扶養之兄弟姊妹、祖父母扣除額：**每人 560,000 元**。 [cite:14]
- 扶養之兄弟姊妹如屬未成年，並得按其年齡距屆滿成年之年數，**每年加扣 560,000 元**。 [cite:14]
- 喪葬費扣除額：**1,380,000 元**。 [cite:14]

### 3.3 不計入遺產總額項目

- 被繼承人日常生活必需之器具及用具：**100 萬元以下部分不計入**。此金額可由官方 2026 年相關整理與財政部公告調整說明交叉驗證。 [cite:3][cite:8]
- 被繼承人職業上之工具：**56 萬元以下部分不計入**。 [cite:3][cite:8]

> 實作建議：上述二項應採「上限扣除」概念，亦即輸入實際金額後，系統只取不超過法定上限之金額排除在遺產總額外。 [cite:3][cite:8]

## 4. 稅率與速算邏輯

依《遺產及贈與稅法》第13條，課稅遺產淨額適用下列級距： [cite:15]

| 課稅遺產淨額 | 稅率／公式 |
|---|---|
| 50,000,000 元以下 | 10% [cite:15] |
| 超過 50,000,000 元至 100,000,000 元 | 5,000,000 + 超過 50,000,000 部分 × 15% [cite:15] |
| 超過 100,000,000 元 | 12,500,000 + 超過 100,000,000 部分 × 20% [cite:15] |

可實作為：

```text
if net <= 50_000_000:
    tax = net * 0.10
elif net <= 100_000_000:
    tax = 5_000_000 + (net - 50_000_000) * 0.15
else:
    tax = 12_500_000 + (net - 100_000_000) * 0.20
```

## 5. 一頁式網頁的欄位規格

建議 AI agent 製作試算頁時，最少需要下列輸入欄位：

| 欄位 | 型別 | 說明 |
|---|---|---|
| deathDate | date | 被繼承人死亡日，用來決定適用版本。 [cite:14][cite:2] |
| grossEstate | number | 遺產總額。 [cite:15] |
| dailyNecessitiesValue | number | 日常生活器具及用具總值，系統自動以法定上限列為不計入。 [cite:3][cite:8] |
| workToolsValue | number | 職業上工具總值，系統自動以法定上限列為不計入。 [cite:3][cite:8] |
| spouseCount | integer | 是否有配偶，通常 0 或 1。 [cite:14] |
| linealDescCount | integer | 直系血親卑親屬人數。 [cite:14] |
| linealMinorExtraYears | integer | 全部未成年卑親屬之「距成年年數」合計。 [cite:14] |
| parentCount | integer | 父母人數。 [cite:14] |
| disabledCount | integer | 符合重度以上身心障礙特別扣除之人數。 [cite:14] |
| dependentSiblingGrandparentCount | integer | 受扶養兄弟姊妹及祖父母人數。 [cite:14] |
| dependentSiblingMinorExtraYears | integer | 未成年受扶養兄弟姊妹距成年年數合計。 [cite:14] |
| funeralDeductionEnabled | boolean | 是否適用喪葬費扣除。一般可預設 true。 [cite:14] |

## 6. 可直接交付 AI Agent 的公式規則

### 6.1 常數（115年度版本）

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

以上金額係依財政部 115 年度公告整理。 [cite:14][cite:3]

### 6.2 排除項目計算

```js
excludedDailyNecessities = Math.min(dailyNecessitiesValue, EXCLUDED_DAILY_NECESSITIES_CAP);
excludedWorkTools = Math.min(workToolsValue, EXCLUDED_WORK_TOOLS_CAP);
excludedTotal = excludedDailyNecessities + excludedWorkTools;
```

其邏輯為「實際值」與「法定上限」取較小者。 [cite:3][cite:8]

### 6.3 扣除額計算

```js
deductionSpouse = spouseCount * DEDUCTION_SPOUSE;
deductionLineal = linealDescCount * DEDUCTION_LINEAL;
deductionLinealMinor = linealMinorExtraYears * DEDUCTION_LINEAL;
deductionParent = parentCount * DEDUCTION_PARENT;
deductionDisabled = disabledCount * DEDUCTION_DISABLED;
deductionDependentSG = dependentSiblingGrandparentCount * DEDUCTION_DEPENDENT_SG;
deductionDependentSGMinor = dependentSiblingMinorExtraYears * DEDUCTION_DEPENDENT_SG;
deductionFuneral = funeralDeductionEnabled ? DEDUCTION_FUNERAL : 0;

deductionsTotal =
  deductionSpouse +
  deductionLineal +
  deductionLinealMinor +
  deductionParent +
  deductionDisabled +
  deductionDependentSG +
  deductionDependentSGMinor +
  deductionFuneral;
```

未成年加扣的法規結構，是以「距屆滿成年之年數」乘上每年加扣金額。 [cite:14]

### 6.4 課稅遺產淨額

```js
netEstate = Math.max(0, grossEstate - excludedTotal - deductionsTotal - EXEMPTION);
```

此計算順序符合遺產總額減除扣除額及免稅額後課稅之法條結構。 [cite:15]

### 6.5 應納遺產稅額

```js
function calcEstateTax(netEstate) {
  if (netEstate <= 50_000_000) {
    return netEstate * 0.10;
  }
  if (netEstate <= 100_000_000) {
    return 5_000_000 + (netEstate - 50_000_000) * 0.15;
  }
  return 12_500_000 + (netEstate - 100_000_000) * 0.20;
}
```

該函式直接對應第13條三段級距公式。 [cite:15]

## 7. 建議輸出欄位

試算頁不宜只顯示最終稅額，至少應輸出以下中間值，以利法規核對與 AI agent 除錯：

- 遺產總額。 [cite:15]
- 不計入遺產總額合計。 [cite:3][cite:8]
- 各類扣除額分項與合計。 [cite:14]
- 免稅額。 [cite:14]
- 課稅遺產淨額。 [cite:15]
- 適用級距。 [cite:15]
- 應納遺產稅額。 [cite:15]

## 8. 實作限制與真確性警語

- 本文件僅整理「遺產稅試算核心規則」，不等同完整申報法律意見；個案仍可能涉及遺產範圍認定、債務扣除、農地或配偶剩餘財產差額分配、保險給付是否計入、跨境財產認定等爭點，這些均可能影響正式申報結果。 [cite:2][cite:15]
- 若網頁要標示「最新」，建議在頁面明示：**本版係依財政部 115 年度公告及現行《遺產及贈與稅法》第13條整理**。 [cite:14][cite:15]
- 若未來財政部再公告新年度金額，AI agent 應優先更新「版本常數表」，而非直接改動主公式。 [cite:14][cite:8]

## 9. 給 AI Agent 的最終實作指令摘要

```text
1. 以 deathDate 判斷法規版本；目前預設支援 115 年度版本。
2. 先輸入 grossEstate。
3. 對 dailyNecessitiesValue 與 workToolsValue 分別做上限截斷後，列為 excludedTotal。
4. 依配偶、卑親屬、父母、身障、受扶養兄弟姊妹/祖父母、喪葬費計算 deductionsTotal。
5. netEstate = max(0, grossEstate - excludedTotal - deductionsTotal - EXEMPTION)
6. 依第13條三段稅率計算 estateTax。
7. 畫面需顯示每一步驟與公式展開結果。
8. 所有金額欄位以新台幣整數輸入與顯示，千分位格式化。
9. 保留「版本常數 JSON」以利未來年度更新。
```

以上規則可直接作為一頁式遺產稅試算網頁的規格基礎。 [cite:14][cite:15]
