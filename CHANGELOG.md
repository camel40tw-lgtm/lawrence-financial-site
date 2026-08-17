# 📋 Lawrence Financial Site — 開發更新日誌

> **維護說明**：每次開發後，在本文件新增一條記錄，格式參考下方既有紀錄。  
> **Git Tag 慣例**：重大里程碑使用 `v<major>.<minor>` 標記。

---

## 版本歷史總覽

| 版本 / Commit | 日期 | 主要內容 |
|---|---|---|
| — | 2026-08-17 | 全站 AEO/GEO 優化：11 個頁面（首頁/about/services/文章總覽/6篇文章/5個試算工具）加 FAQPage schema＋可見 FAQ 區塊，新增 llms.txt |
| — | 2026-08-17 | policy-irr 新增多保單投資組合功能（新增／切換／改名／刪除保單，跨幣別加總） |
| — | 2026-08-17 | property-invest 新增可負擔房貸負債考量、NPV、依身分動態法規提示 |
| — | 2026-08-17 | 網域遷移至 lawrence.money：全站乾淨路徑改寫＋Cloudflare Bulk Redirects（www、舊 pages.dev 網域皆 301 轉址） |
| — | 2026-08-09 | 新增台灣遺產稅試算工具（estate-tax/），整合進 tools.html（本次遲至 2026-08-17 才補記） |
| — | 2026-08-02 | 新增投資不動產規劃平台（property-invest/，五步驟精靈：購屋能力／房貸／出租／出售／IRR，三情境＋六壓力測試），整合進 tools.html |
| — | 2026-08-01 | 新增保單現金流與年化報酬率試算工具（policy-irr/，IRR／XIRR 引擎，保證／非保證雙軌），整合進 tools.html |
| — | 2026-07-31 | 部署退休規劃顧問版試算器V2（calculator-v2/，多頁面 App，新增 Bengen/Guyton-Klinger/三桶金提領策略），整合進 tools.html |
| — | 2026-07-31 | 新增 MBTI 職場性格測驗工具（mbti-quiz.html），套用統一美術規格並整合進 tools.html |
| `v10` Tag | 2026-04-11 | 網站 v10 基準線：完成 SEO、暗模式、退休試算器整合 |
| `6bcc8a6` | 2026-04-12 | 樣式重構：行內 CSS 遷移、移除追蹤代碼佔位符 |
| `7afb3ab` | 2026-04-12 | 新增 5 篇文章頁面、修正全站內鏈 |
| `382edd2` | 2026-07-12 | 修正 calculator.html SEO 標籤、新增 Turnstile 防護、資產載入強化 |
| — | 2026-07-16 | 新增 tools.html 免費試算工具總覽頁（卡片式、可擴充），整合遺囑撰寫站 |
| — | 2026-07-16 | 統一美術規格：DESIGN.md ＋ design-tokens.css ＋ styleguide.html |
| — | 2026-07-16 | 美術規格落地：試算器改 navy/amber token、圖表改語意色；遺囑站同步歸隊 |
| — | 2026-07-16 | thanks.css 併入 token（DESIGN.md §9 全數完成） |
| — | 2026-07-16 | 全站優化：CSP 安全標頭、字型修剪、responsive srcset、_headers 重寫、sitemap 更新；遺囑站搬遷至 D:\AI＋git 化 |

---

## 詳細記錄

---

### [新增] 全站 AEO／GEO 優化 — 2026-08-17

**類型**：Feature / SEO

**來源**：換完網域後使用者要求接續做 AEO（Answer Engine Optimization）與 GEO（Generative Engine Optimization）。開工前先盤點現況：全站有 Article／WebPage／ProfessionalService schema，但**沒有任何 FAQPage／HowTo schema**；`calculator-v2`／`house-land-tax`／`estate-tax` 三個工具頁完全沒有結構化資料；沒有 `llms.txt`。經確認後分兩批施工。

**執行內容**：
- 新增 `.faq-list`／`.faq-item` 手風琴元件（`assets/styles.css`），用原生 `<details>/<summary>`，不用 JS，套用既有 design tokens 與既有卡片／深色模式覆寫模式。
- 第一批（首頁、about、services、文章總覽、6 篇 article-*）：每頁 3 題 FAQ，同時寫成頁面可見文字＋`FAQPage` JSON-LD，兩者逐字一致。內容全部改寫自頁面既有文字，沒有新增站內原本沒有的承諾（例如不寫「免費諮詢」，因為 `contact.html` 只承諾 24 小時內回覆）。
- 第二批（calculator-v2、policy-irr、property-invest、house-land-tax、estate-tax）：同樣每頁 3 題 FAQ。`calculator-v2` 用自己獨立的「kaki／和紙」設計系統（不載入共用 `assets/styles.css`），FAQ 樣式改在該頁既有的行內 `<style>` 區塊用自己的 token 另外寫一份；其餘 4 頁沿用共用元件。`calculator-v2`／`house-land-tax`／`estate-tax` 原本零結構化資料，順便補上基礎 `WebPage` schema。
- 新增網站根目錄 `llms.txt`（純 Markdown，llmstxt.org 慣例），彙整服務、5 個試算工具、7 篇文章與聯絡方式，供 AI 助理直接讀取摘要。

**驗證**：寫 Python 腳本對全部 16 頁的 JSON-LD 逐一 `json.loads` 驗證語法，並比對「頁面可見 FAQ 文字」與「schema 內文字」是否逐字相同（Google FAQPage 規範要求兩者一致，不一致會被拿掉 rich result 資格）——16 頁全部通過。本機起 `python -m http.server` 以瀏覽器實測淺色／深色模式排版與手風琴展開，包含 `calculator-v2` 獨立配色系統。分兩個 commit 推上正式環境後，用 curl 逐頁確認 `FAQPage` schema 與 `llms.txt` 都正確部署。

**明確跳過／待辦**：目前每頁固定 3 題，沒有做 `HowTo` schema（工具頁的步驟式操作流程未來可考慮補上）；FAQ 內容目前是一次性人工改寫，站內文字若之後更新，需要記得同步更新對應的 FAQ 文字與 schema，避免兩者不一致。

### [新增] policy-irr 多保單投資組合功能 — 2026-08-17

**類型**：Feature

**執行內容**：`policy_irr_ui.js` 新增多保單工作區——新增、切換、重新命名、刪除保單（皆用瀏覽器原生 `prompt()`/`confirm()`，與既有存檔/清除功能同一套寫法），每張保單各自設定幣別與對 TWD 匯率；新增「組合總覽」，依保單年度加總所有保單現金流，同幣別直接原幣加總，不同幣別則換算為 TWD 後合計，計算整體保證／含非保證利益 IRR，並可選擇是否納入 PDF 報告。

**驗證**：底層 `irr_engine.js` 換匯邏輯單元測試 8/8 通過。UI 操作流程用瀏覽器自動化實測：新增／切換／改名／刪除保單、僅剩一張保單時的刪除保護機制、跨幣別組合加總數學（手動核對 TWD 5,000 ＋ USD 10,000 × 匯率 31.5 = 320,000 TWD，與畫面顯示一致）。過程中發現自動化工具因原生 `prompt()`/`confirm()` 彈窗卡住兩次，改用注入 JS 覆寫彈窗方式重測，非程式本身的 bug。

**明確跳過／待辦**：多保單 UI 操作流程沒有自動化測試（只有手動驗證過一輪），之後如果要重構這塊建議先補測試。

### [新增] property-invest 可負擔房貸負債考量、NPV、動態法規提示 — 2026-08-17

**類型**：Feature

**執行內容**：`property_calc_engine.js` 的可負擔房貸月付計算，從只看「收入負擔率」改成取「收入負擔率扣既有負債」與「收支餘裕扣既有負債」兩者較低值，避免高估可負擔房貸金額（新增測試 TC-A03）。新增出售步驟 NPV／折現率欄位與情境比較表 NPV 欄；新增「即時總覽」面板同步顯示資金缺口／月付／現金流／DSCR／淨回收／IRR；新增「貸款法規條件」欄位（借款人身分、既有房貸戶數、換屋需求、高價住宅），法規提示表格改為依這些輸入動態產生，取代原本固定的靜態表格。

**驗證**：引擎測試 19/19 通過（含新增的 TC-A03）。

### [變更] 網域遷移至 lawrence.money — 2026-08-17

**類型**：Infrastructure

**執行內容**：全站 HTML/CSS/JS 的 canonical／og／twitter／JSON-LD 標籤與內部導覽連結，從舊網域 `lawrence-financial-site.pages.dev` 改成 `lawrence.money`，內部連結同時從 `about.html` 這種寫法改成 `/about` 乾淨路徑（靠 Cloudflare Pages 原生「請求 `.html` 自動轉址到無副檔名網址」的行為達成，沒有搬動實體檔案）。`calculator-v2` 內部頁面互連（`advisor.html`／`client.html`／`client_intake.html`）刻意保留 `.html`，因為 `ui_controller_v3.js` 仍用 `pathname.endsWith('.html')` 判斷顧問版／客戶版模式。

之後在 Cloudflare 帳號層級設定 **Bulk Redirects**：建立一份清單，把 `www.lawrence.money/*` 與舊網域 `lawrence-financial-site.pages.dev/*` 都 301 轉址到 `lawrence.money/*`（勾選 Subpath matching／Preserve path suffix／Preserve query string，讓子路徑與查詢字串也正確轉址），再建立 Bulk Redirect Rule 套用生效。`_redirects` 檔案本身不支援依網域比對，這是 Cloudflare 官方文件建議、也是唯一能把 `.pages.dev` 網域轉走的做法。

同批一併清掉確認無引用的舊檔案（10 支 `scripts/*.py` 舊腳本、2 張已被響應式圖檔取代的舊版 `.webp`），並把 `output/`、`.wrangler/` 加進 `.gitignore`。

**驗證**：curl 逐一測試 `www.lawrence.money`、`lawrence-financial-site.pages.dev`、含路徑的網址（如 `/tools`），確認都 301 正確轉到 `lawrence.money` 且路徑保留；同時確認 `lawrence.money` 自己沒有形成轉址迴圈。

**明確跳過／待辦**：無。



**類型**：Feature

**來源**：使用者提供「投資不動產規劃平台_MVP產品規格書.md」，要求依站台美術規格建置在 tools.html 之下。開工前先提出規格審查與優化建議並取得使用者確認：技術棧採原生 JS（放棄規格書建議的 Next.js/React/後端資料庫）、金額精度採原生 Number＋延遲取整（不引入 Decimal.js）、UI 採五步驟 wizard（沿用 calculator-v2 既有分步表單模式）；並依使用者指示將規格書 2.2 節原本排除的「分段利率」「提前還款」納入本次範圍（抵利型房貸維持排除）。

**執行內容**：
- 新增 `property-invest/` 目錄：`property_calc_engine.js`（純函式計算引擎：購屋能力 FR-A、三種房貸攤還法＋二段式利率＋提前還款 FR-L、出租營運 FR-R、增值出售 FR-S、綜合報酬 IRR/ROI/EquityMultiple FR-I、三情境＋六壓力測試）、`property_invest_ui.js`（五步驟 wizard 控制器）、`property_invest_style.css`（沿用 `design-tokens.css`）、`index.html`
- 計算引擎精度策略：全程原生 `Number`、絕不中間取整，房貸攤還表每期用「期初餘額」逐期計算、最後一期本金直接設為期初餘額本身，確保期末餘額精確為 0
- `test/property_calc_engine.test.js`：涵蓋規格書第 13 章全部 15 項測試案例（TC-A01/A02、TC-L01～L05、TC-R01/R02、TC-S01/S02、TC-I01～I03、TC-V01）＋ 3 項擴充範圍迴歸測試（二段利率、提前還款兩種模式），共 18 項，`node property-invest/test/property_calc_engine.test.js` 可直接執行，不需 npm install
- PDF 報告（jsPDF＋html2canvas，沿用 policy-irr 已驗證做法）、CSV 匯出、本機儲存（localStorage）、三情境比較表、法規提示區塊（16.2 節央行規則提示，原樣引用未自行驗證，標註資料更新日期）
- `tools.html` 新增「投資不動產規劃平台」卡片；`sitemap.xml` 新增 `property-invest/`

**驗證**：`node --check` 全部 JS 檔案通過；引擎測試 18/18 通過；本機起 `python -m http.server` 以 Playwright 逐步驟實測五個步驟＋PDF／CSV 匯出／深色模式／手機版。過程中發現並修正兩個真實 bug：① 步驟五分析結果原本會直接白屏（`scenarioResults` 存取路徑多套一層 `.result`，undefined 存取）；② Chart.js 顏色在圖表建立當下就寫死，不會隨 `[data-theme]` 屬性即時重繪，切換深色模式後圖表文字會用舊主題顏色留在畫面上變成看不見——已改用 `MutationObserver` 監聽主題切換即時重繪圖表修正。

**明確跳過／待辦**：抵利型房貸（規格書附錄 B 僅預留資料結構，未串接）；提前還款在寬限期間內會被略過不生效（僅寬限期結束後才套用，未在畫面上明講）；P01「快速試算／專業試算」雙模式未做，直接做成單一完整五步驟流程；深色模式圖表即時重繪的修正尚未回頭套用到 `policy-irr/`（該工具已交付驗收，此次不在範圍內）。

### [新增] 保單現金流與年化報酬率試算工具上線 — 2026-08-01

**類型**：Feature

**來源**：使用者提供「保單現金價值與IRR試算工具_產品規格書.md」，要求依站台美術規格建置在 tools.html 之下。開工前先提出規格審查與優化建議並取得使用者確認：技術棧採原生 JS（放棄規格書建議的 React/Next.js/TypeScript/Tailwind）、範疇聚焦 MVP＋精選第二階段功能（雙軌 IRR、XIRR、三情境、圖表），不做分享連結（與站台既有隱私聲明衝突）、PDF 精緻報告與 Excel 上傳等列為後續優化方向，經使用者後續指示追加實作。

**執行內容**：
- 新增 `policy-irr/` 目錄：`irr_engine.js`（IRR／XIRR 純函式引擎：粗掃描定位變號區間→二分法收斂→Newton-Raphson 拋光，範圍 -99.99%～1000%，容許誤差 1e-8）、`policy_irr_ui.js`、`policy_irr_style.css`、`index.html`
- 核心功能：年度現金流輸入表、保證／含非保證利益雙軌 IRR、解約金是否已包含當年度領回三種模式、三情境比較、非保證利益實現比例滑桿、各年度解約比較表、三張 Chart.js 圖表、名目／複利回本年度、CSV 匯出、本機儲存
- `test/irr_engine.test.js`：涵蓋規格書第 14 章驗收案例（單筆投入、無解、多重 IRR、XIRR）＋跳年現金流迴歸測試
- 後續追加：批次填入改正式表單彈窗（原為 `prompt()`）、CSV 檔案上傳、PDF 報告（jsPDF＋html2canvas，中文以 html2canvas 截圖繞過 jsPDF 不支援中文字型的限制，JPEG 壓縮將檔案從 28.8MB 降到 446KB）、效能優化（逐年序列整份渲染只算一次，IRR 呼叫次數從約 240 次降到 60 次）
- `tools.html` 新增「保單現金流與年化報酬率試算工具」卡片；`sitemap.xml` 新增 `policy-irr/`

**驗證**：`node --check` 全部 JS 檔案通過；引擎測試全數通過；本機起 `python -m http.server` 以 Playwright 實測。過程中發現並修正兩個真實 bug：① 保單年度跳年（例如只填第 0、10 年）時，IRR 計算誤把「第 2 筆現金流」當成「第 2 年」折現，導致 IRR 嚴重失真（曾算出 21.9% 而非正確的 2%）——已改用實際 `policyYear` 折現；② 深色模式下多處文字使用 `--navy-900` 直接當文字色，但 `design-tokens.css` 的深色模式區塊未覆寫此變數，導致深色底上文字幾乎看不見——已改用區域變數 `--pirr-ink`/`--pirr-accent` 依主題切換。

**明確跳過／待辦**：分享連結（與「資料只留在瀏覽器」隱私承諾衝突，且站台無後端）；月／季繳頻率完整支援；深色模式圖表即時重繪修正（見上方投資不動產規劃平台條目，尚未回頭套用）。

### [新增] 退休規劃顧問版試算器V2 部署上線 — 2026-07-31

**類型**：Feature / Deployment

**來源**：`D:\AI\ABC版搶修\2_gemini_ABC補全版`（獨立 git repo，分支 `codex/retirement-v4`）。這是一套比現有 `calculator.html` 更完整的多頁面退休規劃 App：客戶填寫（`client_intake.html`）→ 顧問版精算（`advisor.html`，五步驟精算精靈，逐帳戶配息/成長/賣單位規則）→ 客戶版報表（`client.html`），並剛完成三種提領策略的完整精算邏輯（固定提領率＝Bengen 4% 法則、Guardrail＝Guyton-Klinger 護欄策略、三桶金＝Bucket Portfolios）。

**執行內容**：
- 新增 `calculator-v2/` 目錄，複製最小部署檔案集（13 個檔案：4 個 HTML 入口＋8 個共用 JS＋1 個共用 CSS＋favicon；不含 `tests/`、`VERSION_HISTORY.md`、稽核腳本、PDF 等開發用檔案）。
- 品牌重命名為「退休規劃顧問版試算器V2」：4 個頁面的 `<title>`／H1／報表標題（含 `ui_controller_v3.js` 內動態設定 `document.title`／`pageMainTitle`／`reportPageTitle`／`printPageTitle` 的字串）、`client_intake.js` 內 `document.title` 皆同步加上 V2 標識。
- 4 個頁面頂部加一列「駱潤生 Lawrence 免費工具 · 回官網工具頁 →」連回 `tools.html`（比照 DESIGN.md §7 外部工具最低整合規格）；`index.html` 補上完整 SEO meta（description/canonical/OG，`robots: index,follow`），`client_intake.html`／`advisor.html`／`client.html` 標記 `robots: noindex,follow`（功能性子頁面，避免薄內容被索引）。
- **美術規格說明**：V2 App 本身沿用自己既有的和紙／柿橘色（kaki/washi）視覺系統，**未**改套官網 navy/amber 規格——與使用者確認過，多頁面 App 完整重製視覺是另一項較大工程，本次先以「保留原設計＋加回官網連結」的最低整合規格上線，待後續視需要另開工作階段處理。
- `tools.html` 新增「退休規劃顧問版試算器V2」卡片（🧮 圖示，標記「站內工具・V2」），置於既有 V1 試算器卡片下方；`sitemap.xml` 新增 `calculator-v2/index.html`；`_headers` 新增 `/calculator-v2/*` 快取規則（`max-age=0, must-revalidate`，比照頁面規則，非靜態資產長快取）。CSP 已預先允許 `cdn.jsdelivr.net`（V2 用 Chart.js CDN），無需調整。
- **備份**：部署當下的完整檔案快照另存於部署目錄之外的 `D:\AI\_uploads-backup\lawrence_financial_site\calculator-v2-deploy-2026-07-31\`；來源專案本身在 `D:\AI\ABC版搶修\2_gemini_ABC補全版` 另有自己的 git 版本控制，不受本次官網部署影響。

**驗證**：`node --check` 全部複製並改動過的 `.js` 檔案通過；本機起 `python -m http.server` 以 Playwright 實測 — `tools.html` 新卡片顯示正常、點入 `calculator-v2/index.html` 標題與品牌正確、「直接進顧問版」載入範例資料後報表標題顯示「退休規劃顧問報告 V2」、頂部回官網連結可正確導回 `tools.html`；過程中發現並修正一個重複裝飾線的視覺瑕疵（新增的副標題誤用 `.sub-title` class 導致 `::after` 裝飾線重複出現）。

**明確跳過／待辦**：V2 App 尚未套用官網 navy/amber 統一美術規格（見上）；`calculator-v2/*` 各頁面目前只有 `index.html` 有完整 SEO meta，其餘 3 頁刻意 `noindex`。

### [新增] MBTI 職場性格測驗工具上線 — 2026-07-31

**類型**：Feature / Design System

**來源**：使用者提供 `gemini-code-1785467401604.html.zip`（AI 產出的 20 題 MBTI 職場性格測驗，含結果分析與職涯建議），要求整合進 tools.html 並統一美術規格。

**執行內容**：
- 新增 `mbti-quiz.html`：套用官網標準頁面樣板（head meta/OG/canonical/JSON-LD、header/footer、FAB、深色模式初始化腳本），並將原始工具的內嵌樣式全面改寫為 DESIGN.md 規格 — 色彩改用 `design-tokens.css` 變數（navy/amber，不再寫死 hex）、標題改 `--font-display`（Playfair Display/Noto Serif TC）、圓角改 `--radius-sm/md/lg`、陰影改 `--shadow-sm`、按鈕改用全站 `.btn/.btn-primary/.btn-outline` 元件、深色模式下的 navy 裝飾文字（MBTI 標題、職業標籤）比照 `.eyebrow` 慣例另加 `[data-theme="dark"]` 覆寫
- 題目與計分邏輯（20 題、EI/SN/TF/JP 四維度、16 型人格說明）維持原始內容不變，僅將 class 命名加上 `quiz-` 前綴避免與全站樣式衝突
- 在文末結果頁加入導回 `contact.html#booking` 的諮詢引導文字，呼應網站定位
- `tools.html`：在工具卡網格新增「MBTI 職場性格測驗」卡片（🧭 圖示、職涯探索分類），置於既有兩張卡片與「更多工具開發中」佔位卡之間
- `sitemap.xml`：新增 `mbti-quiz.html`（priority 0.7），並將 `tools.html` 的 `lastmod` 更新為 2026-07-31

**備份**：原始 `gemini-code-1785467401604.html.zip` 與解壓縮後的原始 html，另存於部署目錄之外的 `D:\AI\_uploads-backup\lawrence_financial_site\`（不隨站台部署，避免未整理的原始檔案被公開存取）；程式碼版本歷史則由本次 git commit 留存。

**驗證**：本機起 `python -m http.server` 以 Playwright 實測 — 淺色／深色模式截圖比對均符合 DESIGN.md 規格；自動化跑完 20 題（全選 a）驗證計分邏輯正確產出 ESTJ 並正確渲染優勢／盲點／職業標籤；`tools.html` 卡片網格版面（3 欄）正常換行。

---

### [優化] 全站體檢落地：安全標頭、字型、圖片、快取、遺囑站搬遷 — 2026-07-16

**類型**：Security / Performance / Infra

**執行內容（官網）**：
- `_headers` 重寫：新增 Content-Security-Policy（白名單：cdn.jsdelivr.net、challenges.cloudflare.com、fonts.googleapis/gstatic、siteverify worker、script.google.com）；HTML 快取規則改用 `/` ＋ `/:page`（Pages 會把 .html 轉為無副檔名網址，舊的逐頁 .html 規則實際上從未命中）
- Google Fonts 修剪：17 個頁面從 10 個字型變體減到 6 個（移除未使用的 400 與斜體）
- Responsive srcset：sharp 產生 480/800/1200w WebP 變體（首頁 hero 480w 僅 10KB，原 111KB），9 個頁面的 `<picture>` 與 index preload 改多尺寸＋sizes
- `sitemap.xml` 14 個 lastmod 全部更新為 2026-07-16

**執行內容（遺囑站）**：
- 專案自 OneDrive 桌面搬遷至 `D:\AI\will-writing-station`（避開 node_modules 同步風暴），git init（master，commit 8226e62）；69 張無關照片（10.3MB）移至桌面「遺囑生成器照片」；舊資料夾留搬遷說明檔待刪
- `index.html` 補齊 SEO/OG/canonical meta；新增 `public/_headers` 安全標頭＋assets immutable 快取；package.json 依賴分類修正＋新增 `npm run deploy` 腳本；已重新部署 production

**明確跳過／需人工（含原因）**：
- CSS/JS minify：手改型靜態 repo，minify 損維護性；Cloudflare 已 gzip，增益約 10-20KB — 不做
- Cloudflare Web Analytics 開通：需 Dashboard 一鍵操作（Analytics → Web Analytics → Add site），API token 無此權限
- API Token 權限收斂：需在 Dashboard 重發 token（現有 token 含 email/containers 等未用權限）

**驗證**：本機 srcset 選圖正確（800w/2x）；部署後線上驗證 CSP（fonts/chart.js/Turnstile widget）、安全標頭、快取標頭

### [收尾] thanks.css 併入 design token — 2026-07-16

**類型**：Design System

**執行內容**：
- `thanks.css` 寫死色碼換 token：成功圖示底 `#e0f2e9`→`rgba(13,139,103,.12)`、外框鈕 `#fff`→`var(--bg-card)`、深色標題/內文改 `var(--text-main)`/`var(--text-soft)`、深色成功色統一 `#34d399`；深色外框鈕覆寫因 `--bg-card` 自動翻轉而移除
- `thanks.html` 補快取版本號 `?v=20260716a`
- DESIGN.md §9 落地待辦至此全數完成

**驗證**：本機 Playwright 淺／深色截圖通過

### [改版] 美術規格落地：退休試算器＋遺囑撰寫站歸隊 — 2026-07-16

**類型**：Design System / Refactor

**問題根源 / 背景**：
- 依 DESIGN.md §9 待辦 #2、#3 執行：試算器仍是和紙色系＋Shippori Mincho，遺囑站是獨立藍色系。

**執行內容**：
- `calc-style.css`：移除 CSS 內 `@import` 字體；`:root` 本地變數（--washi/--sumi/--kaki/--matcha 等 22 個）全數改對映 design token，因此淺／深色自動由 token 驅動；散落的和紙寫死色（表格斑馬紋、診斷卡、print 樣式、badge 邊框等 40+ 處）換成 token 或 navy/amber 系；圓角/陰影對齊規格（卡片 24、陰影大位移低不透明）；修正深色模式引用了不存在的 --emerald-400/--amber-400/--rose-400
- `calc-ui.js`：圖表色改語意色——樂觀/P90 綠 `#0d8b67`、基準/P50 藍 `#35689f`、保守/P10 紅 `#dc2626`、選取強調改 amber `#F59E0B`
- `calculator.html`：calc-style.css 與 calc-ui.js 快取版本號 bump 至 `?v=20260716a`
- 遺囑撰寫站（外部 repo）：`:root` 色票改 navy 系（--navy #102947、--blue→#244f83、語意色同官網）、h1/h2 改 Noto Serif TC、favicon 改品牌色、側欄新增「駱潤生 Lawrence 免費工具」識別列連回 tools.html；已重建並部署 production

**驗證**：
- 本機 Playwright：試算器表單、產出報告、圖表（綠柱＋amber 選取）、深色模式截圖全數通過；遺囑站新視覺與品牌列確認

### [規範] 統一美術規格：DESIGN.md ＋ design-tokens.css ＋ styleguide.html — 2026-07-16

**類型**：Design System / Docs

**問題根源 / 背景**：
- 盤點發現三套互不相容的視覺系統：官網（navy＋amber、Playfair/Noto Serif）、退休試算器（和紙米色＋柿橙、Shippori Mincho、CSS 內 @import 字體）、遺囑撰寫站（藍色 SaaS 風）。圓角、陰影、深色模式支援也各自為政。

**執行內容**：
- 新增 `DESIGN.md`：以官網為基準的完整美術規格（色彩 60-30-10、字體階梯、間距 4 倍數、圓角/陰影、按鈕/卡片/表單元件規格、工具頁規範、新頁面 checklist、落地待辦優先序）
- 新增 `assets/design-tokens.css`：token 單一真相來源（含深色模式覆寫、新增 --font-* / --radius-pill / --danger / --warning / --ease-* token），供站內工具引用、外部工具複製
- 新增 `styleguide.html`：活的樣式指南頁（noindex、不進 sitemap/導覽），展示色票、字體階梯、按鈕、卡片、表單、圓角陰影與使用守則

**驗證**：
- 本機 Playwright 全頁截圖：淺色／深色模式逐區檢查通過

**後續待辦**：
- calc-style.css 歸隊（和紙→navy/amber、移除 @import、補深色模式）— 工程量大，建議獨立改版
- 遺囑撰寫站套用 token ＋ 品牌識別列

### [功能] 新增免費試算工具總覽頁 tools.html，整合遺囑撰寫站 — 2026-07-16

**類型**：Feature

**問題根源 / 背景**：
- 導覽列「📝免費試算」原本直接連到 `calculator.html`（退休試算器本體），但工具會陸續增加（本次新增外部工具「遺囑撰寫站」），需要一個可擴充的工具入口頁。

**執行內容**：
- 新增 `tools.html`：沿用 `article-grid`/`article-card` 卡片樣式加 `.tool-card` 微調（圖示、CTA、「更多工具開發中」虛線佔位卡），三欄 RWD（960px 兩欄、640px 單欄），支援深色模式；檔內有註解說明如何複製卡片新增工具
- 現有兩張工具卡：退休規劃顧問版試算器（站內 `calculator.html`）、遺囑撰寫站（外部 https://will-writing-station.pages.dev ，`target="_blank" rel="noopener"`）
- 全站 15 個頁面導覽列「📝免費試算」改指向 `tools.html`；`tools.html` footer 網站導覽加入「免費試算工具」
- `sitemap.xml` 新增 tools.html（priority 0.8）

**驗證**：
- 本機 serve + Playwright 實測：淺色／深色模式截圖正常、index 與 calculator 導覽指向 tools.html、兩張卡片連結正確、無殘留舊導覽連結

### [Bugfix/Feature] 修正 calculator.html SEO 標籤、新增 Turnstile 防護、資產載入強化 (Commit: `382edd2`) — 2026-07-12

**類型**：Bugfix / Feature / Security / Performance
**Commit**：`382edd2`

**問題根源 / 背景**：
- 全站掃描發現 `calculator.html` 的整個 `<head>`（meta description、og/twitter 標籤、JSON-LD 的 url/description）是從 `services.html` 複製過來的，只有 `<title>` 改對，導致試算器頁面的 SEO 索引與社群分享預覽都錯誤指向服務頁面。
- `contact.html` 預約表單直接明碼 POST 到公開的 Google Apps Script，僅靠一個蜜罐欄位防護，無驗證碼機制，長期有被灌垃圾表單的風險。
- `calculator.html` 的 `chart.js` 從 CDN 載入未鎖版本、無 SRI，且三支 script（chart.js、calc-core.js、calc-ui.js）皆同步阻塞載入。
- 全站 `assets/main.js` 沒有快取版本號，`_headers` 對 `/assets/*` 設定 24 小時快取＋7 天 stale-while-revalidate，若修改 main.js 行為（如本次加驗證邏輯），舊訪客可能吃到舊版本。

**執行內容**：
- 修正 `calculator.html` 的 canonical、og:*、twitter:*、JSON-LD 全部改為指向自己（試算器頁面），文案改寫成試算器專屬描述
- 新增 Cloudflare Turnstile 防護：建立 managed widget（sitekey `0x4AAAAAAD0MokIVGy1j2OPt`）＋ 部署 siteverify Worker（`turnstile-siteverify-lawrence.camel40tw.workers.dev`），`contact.html`/`assets/main.js` 在原有送出邏輯前加驗證閘門，端到端驗證（health check、dummy token、widget 網域）全通過
- `calculator.html`：`chart.js` 鎖定版本 `4.5.1` 並加上 SRI hash；三支 calculator script 全部加 `defer`
- 全站 15 個頁面的 `assets/main.js` 補上 `?v=20260712a` 快取版本號

**驗證**：
- Turnstile widget/Worker 三項驗證（`/health`、dummy siteverify、widget domains）皆通過
- `git diff --stat` 確認只有預期的 16 個檔案異動，已 commit 並 push 到 `origin/main`

**後續待辦（見下方「待辦」表）**：Web Analytics 尚未開通、Token 權限待收斂、CSS/JS 尚未 minify、hero 圖片尚無 responsive srcset。

---

### [功能] 新增文章：家族辦公室不是有錢人的專利 — 2026-07-12

**類型**：Feature / Content
**Commit**：（尚未提交）

**問題根源 / 背景**：
- 內容產線（idea-capture → deep-researcher → article-writer → content-refiner）產出新主題「普惠家族辦公室」，需上站發布。

**執行內容**：
- 新增 `article-inclusive-family-office.html`，標配 OG/Twitter meta、Article JSON-LD、CTA Band、浮動 FAB
- `articles.html`：新增「家族傳承」分類卡片，置頂於文章網格
- `sitemap.xml`：新增 1 個 URL

**驗證**：尚待人工檢視內容與版面後，再 commit 並推送觸發 Cloudflare Pages 部署。

---

### [v10 基準線] 2026-04-11

**目標**：建立網站的生產就緒基準版本，確保 SEO、UI 與技術架構達到頂級水準。

**執行內容**：
- 完成 `index.html`、`about.html`、`services.html`、`articles.html`、`contact.html`、`404.html`、`calculator.html`、`thanks.html`、`article-retirement-cashflow.html` 共 9 頁
- 部署 `ProfessionalService`、`Blog`、`Article`、`Person` JSON-LD 結構化資料
- 全站深色模式 (`data-theme="dark"`) 與 CSS 變數架構
- 退休試算器整合：Monte Carlo 模擬、4% Rule、LTC 壓力測試、PDF 匯出
- 圖片全面 WebP 化（`<picture>` 標籤 + `fetchpriority="high"` 首屏圖）
- Git 狀態：`working tree clean`，打上 `v10` Tag

**技術棧**：
- 靜態 HTML / Vanilla CSS / Vanilla JS
- 字體：`Noto Serif TC`、`Playfair Display`、`Shippori Mincho`
- 主色：Navy `#0A192F` × Amber `#D97706`
- 部署：Cloudflare Pages

---

### [維護] 清理開發腳本 2026-04-12

**類型**：環境整理  
**Commit**：包含於 `6bcc8a6`

**執行內容**：
- 建立 `scripts/` 目錄
- 將根目錄 11 個開發用 Python 腳本移入（`fix_calc_amber.py`、`build_calc.py`、`apply_aesthetic_upgrades.py` 等）
- 根目錄恢復純淨：僅保留核心 HTML、CSS、JS 與設定檔

---

### [重構] 樣式表清理 (Commit: `6bcc8a6`) — 2026-04-12

**類型**：Refactor（不影響 UI 外觀）

**問題根源**：
- 全站 HTML 含大量重複行內 `style=""` 屬性
- `calculator.html` 內有獨立 `<style>` 區塊
- 每個 HTML 檔案均含已註釋的 GA + Meta Pixel 佔位符，增加頁面體積與閱讀雜訊

**執行內容**：

| 動作 | 檔案 | 說明 |
|---|---|---|
| 新增 | `assets/thanks.css` | 感謝頁面專屬樣式（含深色模式與 RWD） |
| 修改 | `assets/styles.css` | 新增 9 個通用 utility class |
| 修改 | `assets/calc-style.css` | 遷移試算器 `<style>` 區塊，新增 10+ class |
| 修改 | 全站 8 個 HTML | 移除行內樣式、移除追蹤佔位符 |

**新增 CSS Classes（styles.css）**：

```
.header-controls     → style="display:flex;align-items:center;gap:10px"
.calc-link           → 免費試算連結行內樣式
.btn-outline-white   → 深色 CTA 內的白色外框按鈕
.page-hero-title     → 各內頁 hero h1 的 font-size
.article-hero-title  → 文章頁縮小版 hero title
.contact-line-btn    → 聯絡頁 LINE 按鈕緊湊尺寸
.panel-centered      → 404 頁面 max-width/margin/text-align
.eyebrow-center      → 404 頁面 eyebrow 置中
.hero-actions-center → 404 頁面按鈕組置中
```

**新增 CSS Classes（calc-style.css）**：

```
.calc-main              → <main> 的 padding 偏移
.ltc-summary-label      → LTC 摺疊面板標籤樣式
.section-title-inline   → 無邊距、無底框的段落標題
.btn-send-line          → LINE 傳送按鈕（漸層綠）
.unified-action-bar     → 操作列 flex 佈局與邊框
.calc-btn-outline / .calc-btn-primary → 試算器按鈕
```

**驗證**：視覺無任何位移，Git Diff 共 -254 行 / +302 行

---

### [功能] 文章內鏈優化 (Commit: `7afb3ab`) — 2026-04-12

**類型**：Feature / SEO Enhancement

**問題根源**：
- `articles.html` 的 5 篇文章卡片全部連向通用頁面（contact、services、about）
- `index.html` 的 2 篇卡片連向文章列表頁（無法直達內容）
- 缺乏獨立知識文章頁面，SEO 主題權威感不足

**新增文章頁面**：

| 檔案 | 文章主題 |
|---|---|
| `article-aging-asset-risk.html` | 高齡家庭最常忽略的資產風險 |
| `article-inheritance-planning.html` | 傳承規劃不是等到最後一刻 |
| `article-insurance-role.html` | 保險在整體財務規劃裡的真正角色 |
| `article-asset-protection.html` | 家庭財產保護架構 |
| `article-advisor-value.html` | 真正的財務顧問的價值 |

**每篇文章標配**：
- Open Graph + Twitter Card meta tags
- `Article` JSON-LD 結構化資料（`datePublished`、`dateModified`）
- `<picture>` 標籤 + WebP 圖片
- 文末 CTA Band（預約諮詢 + LINE 連結）
- 深色模式、浮動 FAB 按鈕

**連結更新**：
- `articles.html`：5 篇卡片 → 各自文章頁面（`閱讀全文 →`）
- `index.html`：2 篇卡片 → 各自文章頁面（`閱讀文章 →`）
- `sitemap.xml`：新增 6 個 URL（5 篇文章 + `calculator.html`）

---

### [確認] WebP 補完審查 — 2026-04-12

**類型**：審查（無需行動）

**結論**：全站 WebP 已完整覆蓋，無需追加任何轉換工作。

| 圖片 | JPG | WebP | 節省 | `<picture>` |
|---|---|---|---|---|
| `lawrence-home-hero-standing` | 389 KB | 113 KB | 71% | ✅ |
| `lawrence-profile-standing` | 377 KB | 108 KB | 71% | ✅ |
| `lawrence-about-seated-portrait` | 241 KB | 120 KB | 50% | ✅ |
| `apple-touch-icon.png` | 3 KB | — | N/A (用途特殊) | — |
| `site-social-share.png` | 52 KB | — | N/A (OG 圖) | — |
| `favicon.svg` | 0.6 KB | — | N/A (SVG 已最小) | — |

---

### [Bugfix] 修正 CTA 按鈕文字對比度與清理根目錄腳本 — 2026-04-12

**類型**：Bugfix / 維護  

**問題根源 / 背景**：
- 在深藍底色區域（如 `cta-band`）內的「加入 LINE」按鈕 (`.btn-outline-white`) 因 CSS 優先權問題文字呈現深色，對比度不足。
- 先前雖將開發腳本移至 `scripts/`，但根目錄仍殘留舊有 `.py` 檔案，導致 Git 環境出現雜亂未追蹤檔案。

**執行內容**：
- **環境清理**：一鍵刪除根目錄殘留的 11 個 Python 腳本。
- **樣式修正**：修改 `assets/styles.css`，加強 `.btn-outline-white` 系列的選擇器權重並補齊 Hover 樣式，確保任何狀態皆強制白字，解決藍底黑字問題。
- **快取強制刷新**：將全站 HTML 中的 CSS 引入參數推升至 `?v=20260412b`，避免訪客看見快取的舊樣式。

**驗證**：CSS 樣式已徹底修復，且 `git status` 工作目錄已恢復純淨。

---

## 待辦 / 未來擴展方向

| 優先級 | 項目 | 說明 |
|---|---|---|
| **高** | 開通 Cloudflare Web Analytics | API Token 權限不足無法自動開通，需人工到 Pages 專案後台「Analytics」分頁點擊啟用 |
| **高** | 名單磁鐵 (Lead Magnet) 系統 | 於試算報告「匯出 PDF」功能加入閘口（Email 表單或 Google 授權登入），獲取潛在用戶名單供後續自動化行銷 |
| **中** | 收斂 Cloudflare API Token 權限 | 2026-07-12 設定 Turnstile 時用的是一組權限過廣的通用 Token，建議另建一組僅 `Turnstile:Edit` + `Workers Scripts:Edit` 的窄權限 Token 並撤銷舊的 |
| **中** | 更多文章頁面 | 可繼續新增「稅務規劃」、「財產信託 Q&A」等主題文章 |
| **中** | GA / Meta Pixel 正式埋碼 | 準備追蹤時，在各 HTML `<head>` 埋入正式版代碼（已移除佔位符） |
| **低** | CSS/JS 壓縮 | `assets/styles.css`（1177 行）、`assets/calc-ui.js`（1970 行）等皆為未壓縮原始檔，目前無建置流程，可評估加入簡單 minify 步驟 |
| **低** | Hero 圖片 responsive srcset | 目前僅有 WebP/JPG 格式切換，無依裝置寬度縮小的多尺寸版本，行動裝置仍下載原尺寸圖 |
| **低** | 計算機 PDF 輸出優化 | 美化 print 版 CSS，讓報告匯出更精緻 |
| **低** | 文章交叉內鏈 | 在各篇文章末尾加入「延伸閱讀」推薦相關文章 |
| **低** | 意見回饋機制 | 文章底部加入簡易回饋功能 |

---

## 如何新增記錄

複製以下模板到本文件適當位置：

```markdown
### [類型] 簡短標題 (Commit: `xxxxxxx`) — YYYY-MM-DD

**類型**：Feature / Refactor / Bugfix / 維護 / 審查  
**Commit**：`git commit hash`

**問題根源 / 背景**：
- 簡述為何需要此次修改

**執行內容**：
- 修改項目 1
- 修改項目 2

**驗證**：簡述如何確認修改正確
```

---

*最後更新：2026-07-12 | 紀錄版本 v1.1*
