# 房地合一 2.0 免費試算頁開發規格

版本：v1.1  
規則基準：房地合一 2.0 個人一般買賣案件 MVP  
頁面定位：免費試算工具頁，僅供教育與初步規劃參考，不構成稅務、法律、會計或申報意見。

---

## 1. 頁面目標

建立一個可嵌入網站「免費試算」項下的一頁式房地合一 2.0 試算頁。頁面風格參考既有「投資不動產規劃平台」：專業工具頁、步驟式輸入、即時計算摘要、結果表格、風險提示與免責聲明。

第一版只處理「個人、境內居住者、一般買賣取得、一般房屋土地交易」的概算。複雜案件必須分流，不得將一般公式結果包裝為可申報稅額。

---

## 2. 使用者流程

1. 使用者進入頁面，看到工具標題、用途說明與資料不會上傳的提示。
2. 使用者完成「案件篩選」。
3. 若屬一般案件，繼續輸入日期、金額、土地漲價總數額與自住優惠條件。
4. 若屬進階案件，頁面仍可保留表單，但結果區必須顯示「需要進階覆核」，不得顯示為可直接採用的稅額結論。
5. 使用者即時看到預估稅額、課稅所得、持有期間、適用稅率與申報提醒。
6. 使用者可列印或複製試算摘要。

---

## 3. 頁面區塊

### 3.1 頁首區

標題：

```text
房地合一 2.0 稅額試算
```

副標：

```text
輸入取得日、出售日、成交價、成本與土地漲價總數額，初步估算個人房地交易所得稅。所有資料只保留在你的瀏覽器中，不會上傳伺服器；試算結果僅供規劃參考，不代表申報或核定稅額。
```

顯示資訊：

- 規則版本：`house-land-tax-v1.1`
- 資料更新日期：開發時填入，例如 `2026-08-09`
- 法源連結：所得稅法、房地合一課徵所得稅申報作業要點、財政部房地合一專區

### 3.2 步驟導覽

使用 5 步驟：

1. 案件篩選
2. 日期與持有期間
3. 成交價、成本與費用
4. 土地漲價總數額
5. 自住優惠與試算結果

每個步驟區塊應包含：

- 步驟標題，例如 `步驟 1／5　案件篩選`
- 一句目的說明
- 左側或上方輸入表單
- 右側或下方即時計算摘要

手機版改為單欄。

---

## 4. 欄位規格

### 4.1 步驟 1：案件篩選

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 必填 | 說明 |
|---|---|---|---|---|---|
| 是否為自然人 | `isIndividual` | radio boolean | true | 是 | MVP 僅支援自然人 |
| 是否為中華民國境內居住者 | `isResident` | radio boolean | true | 是 | 非居住者分流 |
| 標的類型 | `assetType` | select | `house_land` | 是 | `house_land`、`house_only`、`land_only`、`presale`、`building_right`、`specific_equity`、`other` |
| 取得方式 | `acquisitionMethod` | select | `purchase` | 是 | `purchase`、`inheritance`、`gift`、`spouse_gift`、`trust`、`other` |
| 是否涉及特殊情境 | `specialScenarios` | checkbox group | empty | 否 | `urban_renewal`、`dangerous_old_building`、`joint_construction`、`land_readjustment`、`compulsory_sale`、`involuntary`、`repurchase`、`co_ownership_split`、`exchange` |

可繼續一般試算條件：

- `isIndividual === true`
- `isResident === true`
- `assetType` 為 `house_land`、`house_only` 或 `land_only`
- `acquisitionMethod === purchase`
- `specialScenarios.length === 0`

否則狀態為 `advancedReviewRequired`。

### 4.2 步驟 2：日期與持有期間

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 必填 | 說明 |
|---|---|---|---|---|---|
| 取得日 | `acquisitionDate` | date | empty | 是 | 一般案件以所有權移轉登記日為準 |
| 交易日 | `transferDate` | date | empty | 是 | 一般案件以所有權移轉登記日為準 |
| 日期是否為所有權移轉登記日 | `datesAreRegistrationDates` | checkbox | true | 是 | 若否，顯示提醒 |

輸出：

- `holdingYearsLabel`
- `holdingBracket`
- `generalTaxRate`
- `filingDueDate`

若 `acquisitionDate < 2016-01-01`，本 MVP 必須標記為 `advancedReviewRequired = true`。105 年以前取得的房地可能涉及舊制或過渡規定，不得以一般 105 年後取得流程直接產出正式概算。

### 4.3 步驟 3：成交價、成本與費用

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 必填 | 說明 |
|---|---|---|---|---|---|
| 出售成交價額 | `salePrice` | number | empty | 是 | 非負整數，元 |
| 原始取得成本 | `acquisitionCost` | number | empty | 是 | 一般買賣取得成本 |
| 取得附帶成本 | `purchaseRelatedCosts` | number | 0 | 否 | 契稅、印花稅、代書費、規費等 |
| 改良／增置成本 | `improvementCosts` | number | 0 | 否 | 具資本性質且符合規定者 |
| 移轉費用 | `transferExpenses` | number | 0 | 否 | 仲介費、廣告費、清潔費、搬運費等 |
| 是否可提示成本費用憑證 | `canProvideExpenseEvidence` | radio boolean | true | 是 | 有憑證時採實際可認列費用；未提示或未達法定概算條件時，才採 3%／30 萬概算 |

衍生欄位：

- `baseExpenses = purchaseRelatedCosts + improvementCosts + transferExpenses`
- `standardExpense = min(salePrice * 0.03, 300000)`
- `recognizedBaseExpenses = canProvideExpenseEvidence ? baseExpenses : standardExpense`

不得列入一般成本費用的常見項目：

- 持有期間房屋稅。
- 持有期間地價稅。
- 管理費。
- 取得後持有期間的金融機構借款利息。
- 與本次取得、改良或移轉無直接關聯的生活支出或維修支出。

### 4.4 步驟 4：土地漲價總數額

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 必填 | 說明 |
|---|---|---|---|---|---|
| 依土地稅法計算之土地漲價總數額 | `landValueIncrementTotal` | number | 0 | 是 | 用於房地合一所得扣除 |
| 交易當年度公告土地現值 | `currentAssessedLandValue` | number | 0 | 是 | 計算法定減除上限 |
| 前次移轉現值 | `previousTransferValue` | number | 0 | 是 | 計算法定減除上限 |
| 已納土地增值稅 | `landValueIncrementTaxPaid` | number | 0 | 否 | 僅參考，不自動全額扣除 |
| 未減除土地漲價總數額部分對應之土地增值稅 | `excessLandValueIncrementTaxPaid` | number | 0 | 否 | 進階欄位；只能填入超過法定減除上限部分對應之土地增值稅，不得填全部土地增值稅 |

衍生欄位：

- `landDeductionCap = max(currentAssessedLandValue - previousTransferValue, 0)`
- `recognizedLandDeduction = min(landValueIncrementTotal, landDeductionCap)`
- `excessLandValueIncrement = max(landValueIncrementTotal - recognizedLandDeduction, 0)`

注意：

- 不得將 `landValueIncrementTaxPaid` 全額直接列為費用或扣除額。
- `excessLandValueIncrementTaxPaid` 只能在 `excessLandValueIncrement > 0` 時作為進階費用加入，且應由使用者依土地增值稅資料或專業覆核後輸入。
- 若 `landValueIncrementTotal > landDeductionCap`，顯示「土地漲價總數額超過法定減除上限」。

### 4.5 步驟 5：自住優惠

| 欄位標籤 | 欄位 ID | 型別 | 預設 | 必填 | 說明 |
|---|---|---|---|---|---|
| 是否檢核自住優惠 | `checkSelfUseBenefit` | checkbox | false | 否 | 未勾選則使用一般稅率 |
| 已辦竣戶籍登記 | `selfUseRegistered` | radio boolean | false | 條件必填 | 本人、配偶或未成年子女 |
| 持有並居住連續滿 6 年 | `selfUseSixYears` | radio boolean | false | 條件必填 | 使用者聲明 |
| 交易前 6 年內無出租 | `selfUseNoRental` | radio boolean | false | 條件必填 | 使用者聲明 |
| 交易前 6 年內無營業或執業使用 | `selfUseNoBusiness` | radio boolean | false | 條件必填 | 使用者聲明 |
| 交易前 6 年內未曾適用本優惠 | `selfUseNotUsedBefore` | radio boolean | false | 條件必填 | 使用者聲明 |

自住優惠成立條件：

```js
selfUseEligible =
  checkSelfUseBenefit &&
  selfUseRegistered &&
  selfUseSixYears &&
  selfUseNoRental &&
  selfUseNoBusiness &&
  selfUseNotUsedBefore
```

---

## 5. 計算公式

### 5.1 持有期間與稅率

持有期間不可用天數直接除以 365 判斷。應用「日期元件」與週年日邏輯，不直接用 JavaScript `Date` 物件相減，也不使用含時區的 ISO datetime。

```js
function parseDateOnly(value) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function anniversary(date, years) {
  const targetYear = date.year + years
  if (date.month === 2 && date.day === 29 && !isLeapYear(targetYear)) {
    return { year: targetYear, month: 2, day: 28 }
  }
  return { year: targetYear, month: date.month, day: date.day }
}

function compareDate(a, b) {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

if (compareDate(transferDate, anniversary(acquisitionDate, 2)) <= 0) rate = 0.45
else if (compareDate(transferDate, anniversary(acquisitionDate, 5)) <= 0) rate = 0.35
else if (compareDate(transferDate, anniversary(acquisitionDate, 10)) <= 0) rate = 0.20
else rate = 0.15
```

2 月 29 日取得且目標年度非閏年時，週年日以 2 月 28 日作為保守實作基準；頁面應顯示持有期間判斷仍以稽徵機關認定為準。

顯示文案：

- `2 年以內，適用 45%`
- `超過 2 年、未逾 5 年，適用 35%`
- `超過 5 年、未逾 10 年，適用 20%`
- `超過 10 年，適用 15%`

### 5.2 費用

```js
baseExpenses =
  purchaseRelatedCosts + improvementCosts + transferExpenses

standardExpense = Math.min(salePrice * 0.03, 300000)

recognizedBaseExpenses =
  canProvideExpenseEvidence
    ? baseExpenses
    : standardExpense
```

### 5.3 土地漲價總數額扣除

```js
landDeductionCap =
  Math.max(currentAssessedLandValue - previousTransferValue, 0)

recognizedLandDeduction =
  Math.min(landValueIncrementTotal, landDeductionCap)

excessLandValueIncrement =
  Math.max(landValueIncrementTotal - recognizedLandDeduction, 0)
```

### 5.4 課稅所得

```js
recognizedExpenses =
  recognizedBaseExpenses + excessLandValueIncrementTaxPaid

realEstateTransactionIncome =
  salePrice - acquisitionCost - recognizedExpenses

taxableIncomeBeforeFloor =
  realEstateTransactionIncome - recognizedLandDeduction

taxableIncome =
  Math.max(taxableIncomeBeforeFloor, 0)
```

### 5.5 一般稅額

```js
generalEstimatedTax = taxableIncome * generalTaxRate
```

### 5.6 自住優惠稅額

```js
if (selfUseEligible) {
  selfUseEstimatedTax = Math.max(taxableIncome - 4000000, 0) * 0.10
} else {
  selfUseEstimatedTax = null
}
```

### 5.7 最終顯示稅額

```js
estimatedTax =
  selfUseEligible
    ? selfUseEstimatedTax
    : generalEstimatedTax
```

若 `advancedReviewRequired === true`：

- 可顯示概算結果，但主標籤必須為「概念性估算」。
- 結果區必須顯示進階覆核警示。
- 不得顯示「可申報」、「精準」、「核定」等字樣。

### 5.8 申報提醒日

一般案件：

```js
filingStartDate = nextDay(transferDate)
filingDueDate = addDays(filingStartDate, 29)
```

顯示：

```text
一般房屋土地交易原則上應於所有權移轉登記日次日起 30 日內申報。實際期限、假日順延及個案起算日仍以主管機關規定為準。
```

---

## 6. 分流條件

### 6.1 直接分流為進階覆核

任一條件成立，即 `advancedReviewRequired = true`：

- `isIndividual === false`
- `isResident === false`
- `assetType` 為 `presale`、`building_right`、`specific_equity`、`other`
- `acquisitionMethod` 為 `inheritance`、`gift`、`spouse_gift`、`trust`、`other`
- `specialScenarios.length > 0`
- `datesAreRegistrationDates === false`
- `acquisitionDate < 2016-01-01`

### 6.2 分流提示文案

標題：

```text
此案件需要進階規則覆核
```

內容：

```text
你選擇的情境可能涉及預售屋、繼承贈與、信託、都更危老、非自願因素、重購退稅或其他特殊規則。本頁的一般買賣公式只能作概念性估算，不建議直接作為申報依據。
```

---

## 7. 驗證與錯誤提示

### 7.1 日期錯誤

條件：`acquisitionDate` 空白  
提示：

```text
請輸入取得日。
```

條件：`transferDate` 空白  
提示：

```text
請輸入交易日。
```

條件：`transferDate < acquisitionDate`  
提示：

```text
交易日不可早於取得日。
```

條件：`acquisitionDate < 2014-01-02`  
提示：

```text
此取得日可能涉及舊制或過渡規定，需進一步確認適用制度。
```

條件：`acquisitionDate < 2016-01-01`  
提示：

```text
105 年以前取得的房地可能涉及舊制或過渡適用條件，本工具將標示為需進階覆核，不以一般 105 年後取得流程作正式概算。
```

### 7.2 金額錯誤

條件：必要金額空白  
提示：

```text
請輸入必要金額，若沒有該項金額請填 0。
```

條件：任一金額小於 0  
提示：

```text
金額不可小於 0。
```

條件：`salePrice === 0`  
提示：

```text
成交價額需大於 0 才能試算。
```

條件：`acquisitionCost === 0`  
提示：

```text
原始取得成本為 0 時，結果可能嚴重失真；若無法舉證成本，需進階判斷。
```

### 7.3 費用錯誤

條件：`canProvideExpenseEvidence === false` 且使用者也輸入實際費用  
提示：

```text
你目前聲明無法提示成本費用憑證，本工具將採成交價額 3%、最高 30 萬元的概算費用，已輸入的實際費用不會加總計入。
```

條件：`canProvideExpenseEvidence === true` 且 `baseExpenses < standardExpense`  
提示：

```text
你目前聲明可提示成本費用憑證，本工具將採實際可認列費用。若費用證明未提示或未達規定情形，是否可採成交價額 3%、最高 30 萬元概算，仍以申報規定與個案查核為準。
```

### 7.4 土地欄位錯誤

條件：`currentAssessedLandValue < previousTransferValue`  
提示：

```text
交易當年度公告土地現值低於前次移轉現值，法定減除上限將以 0 計算，請確認輸入資料。
```

條件：`landValueIncrementTaxPaid > 0`  
提示：

```text
已納土地增值稅僅作參考，不會自動全額列為房地合一稅的扣除額或費用。
```

條件：`excessLandValueIncrementTaxPaid > landValueIncrementTaxPaid`  
提示：

```text
超限土地漲價總數額對應之土地增值稅不可大於已納土地增值稅，請確認輸入。
```

條件：`excessLandValueIncrement === 0` 且 `excessLandValueIncrementTaxPaid > 0`  
提示：

```text
本案土地漲價總數額未超過法定減除上限，不應填入超限部分對應之土地增值稅。
```

條件：`landValueIncrementTotal > landDeductionCap`  
提示：

```text
土地漲價總數額超過法定減除上限，本工具將以較低的法定上限作為實際扣除額。
```

---

## 8. 結果文案

### 8.1 一般結果標題

```text
預估房地合一稅
```

### 8.2 進階案件結果標題

```text
概念性估算，需進階覆核
```

### 8.3 結果摘要卡

| 卡片 | 欄位 |
|---|---|
| 預估稅額 | `estimatedTax` |
| 房地合一課稅所得 | `taxableIncome` |
| 適用稅率 | `generalTaxRate` 或自住優惠 |
| 持有期間 | `holdingYearsLabel` |
| 實際採用土地扣除額 | `recognizedLandDeduction` |
| 申報提醒日 | `filingDueDate` |

### 8.4 結果明細表

| 顯示項目 | 對應欄位 |
|---|---|
| 出售成交價額 | `salePrice` |
| 原始取得成本 | `acquisitionCost` |
| 可採認費用 | `recognizedExpenses` |
| 房地交易所得 | `realEstateTransactionIncome` |
| 土地漲價總數額 | `landValueIncrementTotal` |
| 法定減除上限 | `landDeductionCap` |
| 實際採用扣除額 | `recognizedLandDeduction` |
| 未減除土地漲價總數額 | `excessLandValueIncrement` |
| 超限部分對應之土地增值稅 | `excessLandValueIncrementTaxPaid` |
| 房地合一課稅所得 | `taxableIncome` |
| 一般稅率試算稅額 | `generalEstimatedTax` |
| 自住優惠試算稅額 | `selfUseEstimatedTax` |
| 本頁顯示預估稅額 | `estimatedTax` |

### 8.5 投資與稅務判讀

若 `taxableIncome === 0`：

```text
依目前輸入資料，本次房地合一課稅所得為 0，預估稅額為 0。若有交易損失，是否可於未來 3 年內扣抵其他房地交易所得，仍需依申報規定與個案資料判斷。
```

若 `selfUseEligible === true` 且 `taxableIncome <= 4000000`：

```text
依你的自住聲明，本案可能符合自住房地優惠，課稅所得 400 萬元以內部分預估免稅。實際仍以戶籍、居住、出租、營業及過去優惠使用紀錄查核為準。
```

若 `selfUseEligible === true` 且 `taxableIncome > 4000000`：

```text
依你的自住聲明，本案可能符合自住房地優惠，超過 400 萬元部分按 10% 試算。
```

若 `advancedReviewRequired === true`：

```text
本案包含進階情境，一般試算結果只能作為概念性參考。實際申報前應由稽徵機關、會計師、稅務代理人或其他專業人士確認。
```

---

## 9. 固定警示文案

### 9.1 土地漲價總數額警示

```text
土地漲價總數額不同於土地增值稅。房地合一稅計算時，應先判斷得減除的土地漲價總數額，且可能受到法定減除上限限制；已納土地增值稅不會自動全額扣除。只有未自房地交易所得減除的土地漲價總數額部分所對應之土地增值稅，才可能作為進階費用列入。
```

### 9.2 費用警示

```text
實際成本與費用須有可採認憑證。本工具無法判斷憑證是否有效。未提示費用證明或符合規定情形時，才可能採成交價額 3%、最高 30 萬元的概算費用；概算費用與實際憑證費用不能重複加總。
```

### 9.3 自住優惠警示

```text
自住優惠涉及戶籍、持有居住、出租、營業或執業使用，以及過去 6 年是否曾適用優惠等事實。本工具僅依使用者聲明進行估算。
```

### 9.4 非產品承諾

```text
本工具不使用「精準稅額」、「保證節稅」、「可直接申報」或「核定稅額」等文字。所有結果均為預估，實際稅額以稽徵機關認定為準。
```

---

## 10. UI 與互動規格

### 10.1 版面

- 桌機：兩欄式，左側表單、右側即時計算摘要。
- 手機：單欄式，摘要區置於每個步驟下方。
- 結果區放在步驟 5 下方，使用較醒目的數字卡片與明細表。
- 不使用大型行銷 hero 圖。
- 整體保持工具頁密度，避免過多裝飾。

### 10.2 表單元件

- 金額欄位顯示千分位格式。
- 金額單位固定為新台幣元。
- 日期使用瀏覽器原生 date input。
- 是／否問題使用 radio。
- 多重特殊情境使用 checkbox。
- 費用憑證狀態使用 radio，文案為「可提示憑證」與「無法提示／採概算」。
- 結果數字四捨五入至整數元。

### 10.3 即時摘要

每次輸入變更後重新計算：

- 案件狀態
- 持有期間
- 適用稅率
- 費用憑證狀態與採認費用
- 土地扣除上限
- 超限土地漲價總數額與對應土地增值稅
- 課稅所得
- 預估稅額

若資料不足，以 `—` 顯示。

### 10.4 操作按鈕

- `重新試算`：清空表單並回到預設值。
- `複製試算摘要`：複製主要輸入、結果、規則版本與免責聲明。
- `列印結果`：呼叫 `window.print()`。

---

## 11. 資料與隱私

第一版不需要後端資料庫。

規則：

- 不收姓名。
- 不收身分證字號。
- 不收完整門牌。
- 不要求契約掃描檔。
- 不要求銀行帳號。
- 所有資料僅存在瀏覽器記憶體。
- 若日後加入儲存功能，需另行設計隱私聲明與資料刪除機制。

---

## 12. 法源區

頁尾顯示：

- 所得稅法第 4 條之 4、第 4 條之 5、第 14 條之 4、第 14 條之 5、第 14 條之 6、第 14 條之 8
- 房地合一課徵所得稅申報作業要點
- 財政部房地合一專區
- 土地稅法第 30 至 32 條

文案：

```text
資料更新日期：2026-08-09。本頁依公開法規與一般規則整理，僅供初步試算參考。法規、函釋、公告及個案事實可能影響實際結果。
```

---

## 13. 最終免責聲明

```text
本工具依使用者輸入資料及網站載明之規則進行初步估算，僅供教育與試算參考，不構成稅務、法律、會計或申報意見。房地合一稅的適用範圍、交易日、取得日、持有期間、成本、費用、土地漲價總數額、自住優惠及特殊稅率，可能因個案事實、憑證、公告、函釋與稽徵機關認定而不同。重大交易或實際申報前，應向稽徵機關、會計師、稅務代理人或其他專業人士確認。
```

---

## 14. 開發禁則

1. 不得把土地增值稅全額直接視為土地漲價總數額或一般費用。
2. 不得忽略土地漲價總數額的法定減除上限。
3. 不得把實際憑證費用與 3%／30 萬元概算費用重複加總。
4. 不得以一般登記日期規則處理預售屋、繼承贈與、信託、房屋使用權或特定股權。
5. 不得把房地合一所得併入一般綜合所得累進稅率。
6. 不得將自住 400 萬元免稅／超額 10% 與土地增值稅自用住宅優惠混淆。
7. 未經進階驗證，不得對非自願因素、合建、都更危老或重購使用 20% 或退稅結果。
8. 不得要求使用者提供姓名、身分證字號、完整門牌、契約掃描檔或銀行帳號作為一般試算必要資料。
9. 不得用「精準稅額」、「保證」、「可直接申報」等文字描述結果。

---

## 15. HTML/JS 實作建議檔案

若做成獨立頁：

```text
property-tax.html
assets/property-tax.css
assets/property-tax.js
```

若嵌入既有網站：

```text
/free-tools/house-land-tax/
  index.html
  house-land-tax.css
  house-land-tax.js
```

JavaScript 建議模組：

- `parseMoneyInput()`
- `formatMoney()`
- `calculateHoldingPeriod()`
- `getResidentTaxRate()`
- `calculateRecognizedExpenses()`
- `calculateLandDeduction()`
- `calculateExcessLandValueIncrementTaxExpense()`
- `calculateTaxableIncome()`
- `calculateSelfUseTax()`
- `validateInputs()`
- `renderSummary()`
- `renderWarnings()`
