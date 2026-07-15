# Lawrence Financial Site — 統一美術規格（Design Spec）

> **定位**：本文件是全站（官網頁面＋站內工具＋外部工具）視覺的**單一真相來源**。
> 任何新頁面、新工具、新文章版型，先讀這份規格再動手。
> Token 落地檔：`assets/design-tokens.css`；活的樣式展示頁：`styleguide.html`。

---

## 0. 現況盤點（為什麼要統一）

2026-07-16 盤點，目前實際存在**三套互不相容的視覺系統**：

| 面向 | 官網（styles.css） | 退休試算器（calc-style.css） | 遺囑撰寫站（外部） |
|---|---|---|---|
| 主色調 | 深藍 Navy ＋ 琥珀 Amber | 和紙米色 ＋ 柿橙 Kaki | 淺灰藍 ＋ 藍 #2563eb |
| 標題字 | Playfair Display + Noto Serif TC | Shippori Mincho（日文明朝體） | Noto Sans TC |
| 內文字 | Noto Sans TC | Noto Serif TC（襯線） | Noto Sans TC |
| 圓角 | 16 / 24 / 32px | 4 / 8 / 12 / 18px | 8 / 10px 左右 |
| 陰影 | 大而柔（12–30px 位移） | 小而緊（1–4px 位移） | 單一大陰影 |
| 深色模式 | ✅ 完整支援 | ❌ 無 | ❌ 無 |

**統一基準**：以**官網系統**為準（品牌識別已建立：深藍＋琥珀、Playfair/Noto Serif 標題）。
試算器與遺囑站屬「工具介面」，允許簡化（見 §7），但色彩與字體必須歸隊。

---

## 1. 品牌色彩（Color Tokens）

所有顏色**一律使用 CSS 變數**，禁止在頁面中寫死 hex（裝飾性漸層除外）。

### 1.1 品牌主色

| Token | 值 | 用途 |
|---|---|---|
| `--navy-950` | `#0b1d33` | 最深底色、深色模式文字反白背景 |
| `--navy-900` | `#102947` | **品牌主色**：標題、主按鈕漸層起點 |
| `--navy-800` | `#173a63` | hover 深化 |
| `--navy-700` | `#244f83` | 主按鈕漸層終點、小標 eyebrow |
| `--navy-600` | `#35689f` | 圖表次色、輔助 |
| `--amber-500` | `#F59E0B` | **品牌強調色**：CTA hover 光暈、重點標示 |
| `--amber-600` | `#D97706` | 導覽「免費試算」連結、強調文字 |
| `--amber-100` | `#FEF3C7` | 強調底色（淺） |

### 1.2 中性色與語意色

| Token | 值 | 用途 |
|---|---|---|
| `--slate-900` | `#1a2433` | 主文字 |
| `--slate-700` | `#4a586e` | 次要文字 |
| `--slate-500` | `#748196` | 弱化文字、meta |
| `--line` / `--line-strong` | `#dbe4ee` / `#c9d6e3` | 分隔線、卡片邊框 |
| `--bg` / `--bg-soft` | `#f4f7fb` / `#edf3f9` | 頁面底、區塊底 |
| `--success` | `#0d8b67` | 成功、通過 |
| `--danger` | `#dc2626` | 錯誤、警告（新增 token，統一遺囑站的 red） |
| `--warning` | `#b45309` | 提醒（統一遺囑站的 amber 文字色） |

### 1.3 深色模式

- 深色模式由 `<html data-theme="dark">` 驅動，初始化腳本＋`localStorage('theme')`（沿用官網現有機制，見 §8 頁面樣板）。
- 深色值一律定義在 `[data-theme="dark"]` 區塊內覆寫同名 token，**不得**在元件層寫死深色 hex。
- 核心深色值：底 `#0A192F`、卡片 `rgba(12,29,51,.88)`、主文字 `#F1F5F9`、線 `rgba(148,163,184,.18)`。

### 1.4 使用比例（60-30-10）

- **60%** 中性底（`--bg` 系）＋ **30%** Navy 結構色 ＋ **10%** Amber 強調。
- Amber 只用於：CTA、hover 反饋、關鍵數字、導覽入口。**不得**大面積鋪底。

---

## 2. 字體（Typography）

### 2.1 字族

| 角色 | 字族 | Token |
|---|---|---|
| 標題（H1/H2/大標） | `"Playfair Display", "Noto Serif TC", serif` | `--font-display` |
| 內文/介面 | `"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif` | `--font-body` |
| 數字/表格（工具用） | `"DM Mono", ui-monospace, monospace` | `--font-mono` |

- Google Fonts 載入一律放 `<head>`（preconnect ＋ 單一 css2 請求），**禁止在 CSS 內 `@import`**（calc-style.css 目前違規，列入待辦）。
- 淘汰 Shippori Mincho：工具頁標題改用 `--font-display`。

### 2.2 字級階梯（clamp 響應式）

| 層級 | 規格 | 用途 |
|---|---|---|
| Display | `clamp(2.15rem, 4.4vw, 3.8rem)` / display / weight 500 | 首頁 hero |
| H1/H2 | `clamp(1.82rem, 3vw, 2.8rem)` / display / weight 600 / line-height 1.16 | 區塊標題 |
| H3 | `1.15rem–1.45rem` / body 或 display / weight 700 | 卡片標題 |
| Eyebrow | `.78rem` / weight 900 / `letter-spacing:.11em` / 色 `--navy-700` | 區塊小標（大寫英文） |
| 內文 | `1rem` / line-height **1.8** | 段落 |
| Meta | `.83rem–.9rem` / 色 `--slate-500` | 日期、分類、註解 |

- 內文行高固定 **1.8**（中文閱讀基準）；工具密集表單可降至 1.6，不得低於 1.5。

---

## 3. 間距與版心（Spacing & Layout)

| Token | 值 | 用途 |
|---|---|---|
| `--max` | `1180px` | 版心寬（`.container` = `min(var(--max), 100% - 40px)`） |
| `--header-h` | `84px` | 固定 header 高 |
| 區塊間距 | `.section{padding:84px 0}` | 頁面大區塊 |
| 卡片網格 gap | `20px` | 所有卡片網格統一 |
| 卡片內距 | `40px`（內容卡）/ `28px`（工具表單卡） | |

- 間距只用 **4 的倍數**（4/8/12/16/20/24/28/40/84）。
- 網格欄數：內容卡 3 欄 → `960px` 以下 2 欄 → `640px` 以下 1 欄（tools.html 已示範）。

---

## 4. 圓角與陰影（Radius & Elevation）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | `16px` | 輸入框、小元件 |
| `--radius-md` | `24px` | 卡片 |
| `--radius-lg` | `32px` | 大面板、hero 卡 |
| `--radius-pill` | `999px` | 按鈕、導覽膠囊 |
| `--shadow-sm` | `0 12px 28px rgba(16,41,71,.08)` | 靜止卡片 |
| `--shadow-md` | `0 22px 48px rgba(16,41,71,.12)` | hover、彈層 |
| `--shadow-lg` | `0 30px 72px rgba(16,41,71,.16)` | hero、關鍵面板 |

- 陰影風格＝「大位移、低不透明度、柔和」。禁止 1–3px 的硬陰影（calc-style 現狀，列入待辦）。
- 工具介面的密集表單元素（input）可用 `--radius-sm` 以下（8px），但卡片層仍走 `--radius-md`。

---

## 5. 核心元件規格（Components）

### 5.1 按鈕

| 類型 | 規格 |
|---|---|
| `.btn` 基底 | inline-flex、`min-height:54px`、`padding:0 22px`、`border-radius:999px`、weight 800、`transition:.24s ease`、hover 上浮 `-2px` |
| `.btn-primary` | 白字、`linear-gradient(135deg, var(--navy-900), var(--navy-700))`、hover 出現 amber 邊框光暈 |
| `.btn-secondary` | navy 字、白 84% 底、`--line-strong` 邊框 |
| `.btn-outline` | 透明底、`--line-strong` 邊框 |
| 工具內小按鈕 | 高度可降到 40px，其餘規則不變 |

### 5.2 卡片

- 基底：`linear-gradient(180deg, var(--bg-card-grad-start), var(--bg-card-grad-end))` ＋ `1px --line` 邊框 ＋ `--radius-md` ＋ `--shadow-sm`。
- hover：上浮＋`--shadow-md`＋頂部 amber 細線（`::before`，官網既有樣式）。
- 工具卡（tools.html `.tool-card`）：繼承 `.article-card`，附 52px 圓角圖示磚（`rgba(148,163,184,.14)` 底）。

### 5.3 表單

- input/textarea/select：`--radius-sm` 以下、`1px --line` 邊框、focus 時 `--navy-700` 邊框＋`0 0 0 3px rgba(53,104,159,.15)` 光圈。
- label：weight 800、色 `--navy-900`（深色模式 `--text-main`）。
- 錯誤狀態：`--danger` 邊框＋說明文字；成功用 `--success`。

### 5.4 導覽與頁尾（全站固定，不得變體）

- Header：fixed、`backdrop-filter:blur(14px)`、捲動後加陰影；導覽連結膠囊 hover 填 navy 漸層；「📝免費試算」用 `--amber-600`＋`.calc-link`。
- Footer：三欄（品牌／網站導覽／聯絡方式）＋版權列。新頁面直接複製，不重寫。
- 浮動按鈕（FAB）：LINE 綠 `#06C755` 沿用官方色＋預約深藍，全站一致。

### 5.5 動效

- 標準 easing：`transition:.24s ease`（hover 類）；主題切換 `.4s ease`。
- 進場動畫用 `.reveal`（官網 main.js 既有 IntersectionObserver）。
- 禁止：跑馬燈、無限循環動畫、超過 0.5s 的 UI 轉場。

---

## 6. 語氣與圖像（Voice & Imagery）

- Emoji 圖示：允許用於工具卡圖示磚與導覽入口（📝📊📜🛠️），但一張卡最多 1 個，正文不用 emoji。
- 照片：真實人物照（顧問形象照）優先；一律 `border-radius:--radius-md` 以上裁切。
- 免責聲明區塊：`--bg-soft` 底＋`--line` 邊框＋`--slate-700` 文字，全站同一款式。

---

## 7. 工具頁規範（站內工具與外部工具）

**站內工具**（如 `calculator.html`）：
1. 必須引用 `assets/design-tokens.css`（或 `styles.css`），元件色一律走 token。
2. 保留官網 header/footer；工具本體可以用自己的版型，但色彩、字體、圓角、陰影遵守本規格。
3. 必須支援 `data-theme="dark"`。

**外部工具**（如遺囑撰寫站，獨立 repo/獨立部署）：
1. 複製 `design-tokens.css` 進該專案（單向同步：官網為源頭）。
2. 至少對齊：主色（navy/amber）、字體（Noto Sans TC 內文＋serif 標題）、按鈕與卡片規格。
3. 頁面上加一行「駱潤生 Lawrence 免費工具」識別（連回官網），維持品牌連續性。

---

## 8. 新頁面樣板（Checklist）

- [ ] `<head>`：theme 初始化腳本（防閃白）＋ `styles.css?v=` 版本號 ＋ Google Fonts（Noto Serif TC + Playfair Display）
- [ ] canonical / og / twitter meta 指向自己頁面（勿複製別頁忘改）
- [ ] 官網 header ＋ footer 原樣複製（導覽 active 狀態改對）
- [ ] 內容區：`.section > .container > .section-title(small+h1/h2+p)` 結構
- [ ] 深色模式檢查（切 theme toggle 看一遍）
- [ ] RWD 檢查：960px、640px 斷點
- [ ] `sitemap.xml` 加 URL；`main.js?v=` 版本號一致

---

## 9. 落地待辦（優先順序）

| # | 項目 | 影響 | 狀態 |
|---|---|---|---|
| 1 | 建立 `assets/design-tokens.css` 並在 styleguide.html 展示 | 建立單一真相來源 | ✅ 2026-07-16 完成 |
| 2 | `calc-style.css` 歸隊：本地變數（--washi/--kaki 等）改對映 design token、Shippori→display 字族、移除 CSS 內 `@import`、圖表色改語意色（calc-ui.js） | 試算器視覺統一 | ✅ 2026-07-16 完成 |
| 3 | 遺囑撰寫站套用 token（:root 改 navy 系、標題改 Noto Serif TC、側欄加品牌識別列連回 tools.html） | 外部工具統一 | ✅ 2026-07-16 完成 |
| 4 | `thanks.css` 檢查併入 token | 小 | ⬜ 待做 |

> 規格有異動時：先改本文件與 `design-tokens.css`，再改各頁面；並在 CHANGELOG 記錄。
