# 投資不動產規劃平台工作紀錄

日期：2026-08-09  
專案：`D:\AI\lawrence_financial_site`  
頁面：`property-invest/`  
正式網址：https://lawrence-financial-site.pages.dev/property-invest/

## 本次完成

1. 將原本線性流程升級為「五個評估模組 + 即時總覽」。
   - 資金門檻
   - 貸款壓力
   - 營運現金流
   - 出場假設
   - 投資判讀

2. 新增目前工作區色彩提示。
   - 切換 5 個模組時，上方模組卡、即時總覽、目前表單卡會同步變色。

3. 修正購屋能力邏輯。
   - 原本月付能力主要用收入比例推估，未實質扣除固定支出與其他貸款月付。
   - 已改為取較保守者：
     - 月收入 x 房貸支出上限率 - 其他貸款月付
     - 月收入 - 每月固定支出 - 其他貸款月付

4. 新增 NPV / 折現率。
   - 在出場假設加入折現率欄位。
   - 結果頁、三情境比較、PDF 摘要、CSV 匯出皆納入 NPV。

5. CSV 匯出改為跟隨目前選取情境。
   - 保守 / 基準 / 樂觀會輸出對應情境。
   - CSV 僅輸出持有期間，不再輸出完整 30 年房貸表。

6. PDF 報告年度表改為僅呈現持有期間。

7. 法規提示改為條件式。
   - 新增借款人身分、既有房貸戶數、名下是否有房屋、是否換屋自住、高價住宅等欄位。
   - 依條件顯示央行選擇性信用管制提示。

8. 免費試算頁確認已包含「投資不動產規劃平台」入口。
   - 入口頁：https://lawrence-financial-site.pages.dev/tools

## 測試紀錄

### 單元與語法測試

- `node --check property-invest/property_invest_ui.js`：通過
- `node --check property-invest/property_calc_engine.js`：通過
- `node property-invest/test/property_calc_engine.test.js`：通過
  - 19 個通過
  - 0 個失敗

### 獨立數學驗算

已用獨立公式驗算：

- PMT
- 貸款餘額
- NOI
- DSCR
- 出售淨回收
- IRR
- NPV
- 壓力測試結果結構

### UI 靜態完整性檢查

已確認：

- 所有 `getElementById` 都有對應 DOM 或合法動態 DOM。
- 所有輸入欄位都有 UI 綁定。
- 所有 `data-goto` 都指向存在的步驟。
- CSV 使用目前情境。
- CSV / PDF 僅輸出持有期間。
- 法規提示覆蓋公司法人、高價住宅、第 2 戶、第 3 戶以上、換屋 18 個月協處。

### Playwright 瀏覽器 E2E 測試

測試腳本：

- `output/playwright/property-invest-e2e.js`

測試結果：

- `E2E PASSED`

覆蓋項目：

- 頁面載入無 runtime error
- 5 個步驟切換正常
- 工作區色彩 `data-current-step` 正常切換
- 表單輸入會更新購屋能力、NPV、法規提示
- 儲存草稿 / 載入草稿 / 重新試算正常
- CSV 下載跟隨目前情境，且只輸出持有期間
- PDF 可產生並下載
- 列印按鈕有呼叫 `window.print`
- 深色模式切換正常，圖表仍可見

Playwright 安裝位置：

- 套件：`%TEMP%\pinv-playwright`
- Chromium：`C:\Users\ASUS\AppData\Local\ms-playwright`

測試產物：

- `output/playwright/投資不動產試算_樂觀情境.csv`
- `output/playwright/投資不動產試算報告.pdf`
- `output/playwright/property-invest-final.png`

## 部署紀錄

部署工具：

- Wrangler `4.120.0`

Cloudflare 帳號：

- `camel40tw@gmail.com`

部署指令：

```bash
npx wrangler pages deploy "%TEMP%\lawrence_financial_site_deploy_20260809_004434" --project-name lawrence-financial-site --branch main
```

部署結果：

- 成功
- 預覽網址：https://c2de391b.lawrence-financial-site.pages.dev

正式驗證：

- https://lawrence-financial-site.pages.dev/property-invest/：`200`
- https://lawrence-financial-site.pages.dev/tools：`200`
- 已確認正式頁面含新版 `NPV` 與 `即時總覽`
- 已確認免費試算頁含 `投資不動產規劃平台` 與連結 `property-invest/index.html`

## 備份紀錄

備份檔：

- `D:\AI\lawrence_financial_site_backups\lawrence_financial_site_static_20260809_004434.zip`

備份內容：

- 根目錄 HTML
- `assets`
- `images`
- `calculator-v2`
- `policy-irr`
- `property-invest`
- `robots.txt`
- `sitemap.xml`
- `_headers`

排除：

- `.git`
- `.wrangler`
- `node_modules`
- `output`

## 注意事項

1. 專案根目錄曾因第一次 Playwright 安裝中斷，留下不完整的 `node_modules/playwright` 與 `node_modules/playwright-core`。刪除時遇到檔案鎖 / OneDrive 卡住逾時，未再強刪。

2. Wrangler 部署時提示工作目錄有未提交變更，部署仍成功。

3. 法規提示僅為一般性提示，不代表最終核貸結果；實際仍須以中央銀行最新規定、承貸金融機構審核與正式貸款契約為準。
