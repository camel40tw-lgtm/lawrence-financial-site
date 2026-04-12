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

---

## 詳細記錄

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
| **中** | 更多文章頁面 | 可繼續新增「稅務規劃」、「財產信託 Q&A」等主題文章 |
| **中** | GA / Meta Pixel 正式埋碼 | 準備追蹤時，在各 HTML `<head>` 埋入正式版代碼（已移除佔位符） |
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

*最後更新：2026-04-12 | 紀錄版本 v1.0*
