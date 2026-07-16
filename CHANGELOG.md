# 📋 Lawrence Financial Site — 開發更新日誌

> **維護說明**：每次開發後，在本文件新增一條記錄，格式參考下方既有紀錄。  
> **Git Tag 慣例**：重大里程碑使用 `v<major>.<minor>` 標記。

---

## 版本歷史總覽

| 版本 / Commit | 日期 | 主要內容 |
|---|---|---|
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
