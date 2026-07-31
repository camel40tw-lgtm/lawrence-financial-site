(function () {
  const STORAGE_KEY = "cfp_retire_plan_v4";
  const APP_ROOT_ID = "clientIntakeApp";

  const HELP_TEXTS = {
    "案件名稱": "這份填寫資料的案件名字，方便顧問和客戶日後比對版本。",
    "客戶名稱 / 家庭識別": "這份資料屬於哪一個家庭或客戶，方便辨認。",
    "版本名稱": "這次填寫的版本標記，方便之後和其他版本比較。",
    "基準版本": "這次拿來對照的舊版本或原始版本。",
    "顧問名稱": "負責這份案件的顧問名稱。",
    "報告日期": "這次填寫或產出報告的日期。",
    "家庭模式": "選單人或夫妻，會影響後面的時間軸與收入支出計算。",
    "姓名": "這個人或這筆資料所屬的名稱。",
    "目前年齡": "目前幾歲，系統會用來排退休與現金流時間軸。",
    "預計退休年齡": "預計幾歲開始不靠工作收入生活。",
    "預期壽命": "這次規劃先算到幾歲，通常會比退休年齡更晚。",
    "健康狀態": "這個人的健康概況，會影響長照與壽命假設。",
    "顧問觀點 / 本次假設說明": "把這次規劃先採用的判斷和假設記下來。",
    "現金與活存": "可以馬上動用的現金、活存和準備金。",
    "投資帳戶": "放股票、ETF、基金等投資資產的地方。",
    "退休帳戶 / 保單帳戶": "放退休金、保單現金價值等長期資產。",
    "房產估值": "房子目前大約值多少錢。",
    "房產名稱": "這間房子的名稱，方便辨認自住、出租或其他用途。",
    "所有權人": "這筆資產屬於本人、配偶，還是共同持有。",
    "房產類型": "這間房子是自住、出租，還是其他用途。",
    "房價年增值率 %": "房子每年大約增值多少。",
    "房產模式": "決定房產是只算家庭淨值、指定出售，還是不納入退休池。",
    "出售年齡": "如果房子要出售，預計幾歲賣出。",
    "出售成本率 %": "賣房時要扣掉多少交易成本。",
    "資產名稱": "這筆資產的名字，方便辨認是哪一筆。",
    "帳戶類型": "這筆資產是現金、投資、退休帳戶，還是保單帳戶。",
    "資產類型": "這筆資產主要屬於成長型、收益型，或平衡型。",
    "目前餘額": "這筆資產目前有多少錢或市值。",
    "退休前處理": "退休前這筆資產的收益要再投入，還是先轉現金。",
    "退休後處理": "退休後這筆資產要怎麼支應生活。",
    "年化報酬率 / 收益率": "這筆資產每年大約能帶來多少報酬或收益。",
    "提領順序": "退休後多筆帳戶都能用時，數字越小越先提領。",
    "最低保留金額": "這筆資產至少要留下多少，不要全領光。",
    "負債名稱": "這筆債務的名字，方便辨認是哪一筆負債。",
    "負債類型": "這筆債務屬於房貸、信貸、車貸、保單借款或其他。",
    "每月還款": "每個月要還多少錢。",
    "年利率 %": "這筆債務一年大約要付多少利息。",
    "連動房產": "這筆負債是否連動到某一間房子。",
    "清償年齡": "這筆負債預計幾歲清償完畢。",
    "負債模式": "是正常攤還，還是預計提前清償。",
    "提前清償年齡": "若採提前清償，預計幾歲一次還清。",
    "提前清償金額": "若採提前清償，預計要一次還多少。",
    "收入名稱": "這筆收入的名稱，方便辨認是薪資、獎金、租金或其他收入。",
    "收入類型": "這筆收入屬於哪一種，系統會依類型做不同處理。",
    "發生年齡（填該所有人的年齡）": "這筆收入從這個人幾歲開始出現。",
    "型態": "這筆收入是每月重複，還是一次性發生。",
    "金額": "這筆收入的金額。",
    "持續年數": "這筆收入會持續幾年。",
    "年成長率 %": "這筆收入每年大約成長多少。",
    "隨通膨調整": "如果勾選，系統會把通膨當作調整假設。",
    "必要生活支出 / 月": "每個月固定一定要花掉的生活費。",
    "彈性生活支出 / 月": "每個月可彈性調整的休閒、旅遊、享受型支出。",
    "醫療支出 / 月": "每個月預估的醫療花費。",
    "照護支出 / 月": "每個月預估的照護花費。",
    "保費 / 月": "每個月要繳的保費金額。",
    "扶養 / 家庭支援": "如果有扶養或家庭支援支出，可以先在備註補充。",
    "稅金": "如果有明確的稅金支出，也可以先在備註補充。"
  };

  const OWNER_OPTIONS = [
    { value: "joint", label: "共同" },
    { value: "self", label: "本人" },
    { value: "spouse", label: "配偶" }
  ];

  const INCOME_OWNER_OPTIONS = [
    { value: "household", label: "家庭" },
    { value: "self", label: "本人" },
    { value: "spouse", label: "配偶" }
  ];

  const ACCOUNT_TYPE_OPTIONS = [
    { value: "cash", label: "現金帳戶" },
    { value: "taxable", label: "投資帳戶" },
    { value: "retirement", label: "退休帳戶" },
    { value: "insurance", label: "保單帳戶" }
  ];

  const ASSET_TYPE_OPTIONS = [
    { value: "growth", label: "成長型" },
    { value: "income", label: "收益型" },
    { value: "balanced", label: "平衡型" }
  ];

  const RETIREMENT_POLICY_OPTIONS = [
    { value: "reinvest", label: "再投入" },
    { value: "distribution_to_cash", label: "收益轉現金" }
  ];

  const POST_RETIREMENT_OPTIONS = [
    { value: "distribution_first_then_sell", label: "先領收益，不夠再賣" },
    { value: "sell_only", label: "只賣單位" },
    { value: "distribution_to_cash", label: "收益直接轉現金" },
    { value: "reinvest", label: "繼續再投入" }
  ];

  const DEBT_TYPE_OPTIONS = [
    { value: "mortgage", label: "房貸" },
    { value: "personal_loan", label: "信貸" },
    { value: "car_loan", label: "車貸" },
    { value: "policy_loan", label: "保單借款" },
    { value: "other", label: "其他" }
  ];

  const INCOME_PRESET_OPTIONS = [
    { value: "salary", label: "薪資收入" },
    { value: "bonus", label: "獎金收入" },
    { value: "part_time", label: "兼職收入" },
    { value: "business", label: "事業收入" },
    { value: "rent", label: "租金收入" },
    { value: "interest", label: "利息收入" },
    { value: "dividend", label: "股利收入" },
    { value: "distribution", label: "配息收入" },
    { value: "labor_insurance", label: "勞保給付" },
    { value: "labor_pension", label: "勞退提領" },
    { value: "annuity", label: "商業年金" },
    { value: "survivor_pension", label: "遺屬年金" },
    { value: "custom", label: "自訂收入" }
  ];

  const INCOME_TYPE_OPTIONS = [
    { value: "monthly", label: "每月收入" },
    { value: "annual", label: "每年收入" },
    { value: "lump", label: "一次性收入" }
  ];

  const PROPERTY_TYPE_OPTIONS = [
    { value: "residence", label: "自住房" },
    { value: "rental", label: "出租房" },
    { value: "other", label: "其他" }
  ];

  const PROPERTY_FUNDING_OPTIONS = [
    { value: "excluded", label: "只列家庭淨值" },
    { value: "net_equity", label: "退休起點動用淨值" },
    { value: "sale_event", label: "指定年齡出售" }
  ];

  const app = {
    init,
    saveDraft,
    submitToAdvisor,
    openAdvisorPage,
    openClientReport,
    loadSampleData,
    clearDraft,
    addAssetRow,
    addLiabilityRow,
    addIncomeRow
  };

  window.ClientIntakeApp = app;
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    decorateHelpLabels(document);
    applyIntakeGuideMode(document);
    hydrateFromStorage(true);
    updateHouseholdModeUI();
    wireLiveUpdates();
    updateStatusLine();
    ensureDynamicDefaults();
  }

  function wireLiveUpdates() {
    const root = document.getElementById(APP_ROOT_ID) || document.body;
    root.addEventListener("change", (event) => {
      if (event.target?.id === "householdMode") {
        updateHouseholdModeUI();
      }
      if (event.target?.matches?.(".account-driver-select")) {
        refreshAccountRow(event.target.closest(".row-card"));
      }
      if (event.target?.matches?.(".liability-type-select,.liability-treatment-select")) {
        refreshLiabilityRow(event.target.closest(".row-card"));
      }
      if (event.target?.matches?.(".income-preset-select,.income-owner-select")) {
        refreshIncomeRow(event.target.closest(".row-card"));
      }
      updateStatusLine();
    });
    root.addEventListener("input", () => {
      updateStatusLine();
    });
  }

  function decorateHelpLabels(root = document) {
    root.querySelectorAll("label[data-help-key]").forEach((label) => {
      if (label.dataset.helpEnhanced === "1") return;
      const key = label.dataset.helpKey || label.textContent.trim();
      const helpText = HELP_TEXTS[key] || `${key} 的白話說明。`;
      const labelText = label.textContent.trim();

      label.textContent = "";
      const textNode = document.createElement("span");
      textNode.className = "field-label-text";
      textNode.textContent = labelText;

      const trigger = document.createElement("span");
      trigger.className = "help-trigger";
      trigger.tabIndex = 0;
      trigger.setAttribute("role", "button");
      trigger.setAttribute("aria-label", `${labelText} 說明`);
      trigger.textContent = "i";

      const bubble = document.createElement("span");
      bubble.className = "help-bubble";
      bubble.textContent = helpText;
      trigger.appendChild(bubble);

      label.append(textNode, trigger);
      label.dataset.helpEnhanced = "1";
    });
  }

  function getLocalDateString() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return entities[char] || char;
    });
  }

  function escapeAttr(value = "") {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function formatCurrency(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0
    }).format(number);
  }

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function setNotice(message, tone = "info") {
    const notice = document.getElementById("intakeNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.dataset.tone = tone;
  }

  function renderSelect(options, value, className = "") {
    return `<select class="${className}">${options.map((option) => `<option value="${escapeAttr(option.value)}" ${String(value) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`;
  }

  function renderField(label, helpKey, controlHtml, options = {}) {
    const classes = ["field"];
    if (options.full) classes.push("field-full");
    if (options.className) classes.push(options.className);
    return `
      <div class="${classes.join(" ")}">
        <label data-help-key="${escapeAttr(helpKey || label)}">${escapeHtml(label)}</label>
        ${controlHtml}
        ${options.note ? `<div class="section-note">${escapeHtml(options.note)}</div>` : ""}
      </div>
    `;
  }

  function renderPageSkeleton() {
    const root = document.getElementById(APP_ROOT_ID);
    if (!root) return;

    root.innerHTML = `
      <div class="top-bar no-print">
        <button type="button" class="ghost-btn small-btn" data-action="save">暫存草稿</button>
        <button type="button" class="ghost-btn small-btn" data-action="submit">送交顧問版</button>
        <button type="button" class="ghost-btn small-btn" data-action="sample">載入範例資料</button>
        <button type="button" class="danger-btn small-btn" data-action="clear">清除草稿</button>
      </div>

      <section class="intake-hero card">
        <div class="intake-kicker">客戶填寫頁</div>
        <h1 class="main-title"><span>財務安全需求分析</span> 前置資料蒐集</h1>
        <p class="sub-title">先填家庭基本資料、資產負債表與收入支出表。填完後送交顧問版，系統會先產出正式報表，再切到客戶版閱讀。</p>
        <div id="intakeNotice" class="intake-notice">尚未載入資料，請先從上方開始填寫；每個欄位右側都會有小 i 說明。</div>
        <div id="intakeStatus" class="intake-status">目前已填資料：0 筆資產、0 筆負債、0 筆收入。</div>
      </section>

      <section class="intake-section card" id="intakeGuideBlock">
        <div class="section-head">
          <div>
            <h2 class="section-title">先填這三件事</h2>
            <div class="section-subtitle">先把最重要的資料補齊，其他細節之後再慢慢補也可以。</div>
          </div>
          <span class="section-tag">客戶導覽</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          <div class="summary-card">
            <strong style="display:block;margin-bottom:6px;">1. 家庭基本資料</strong>
            先填本人與配偶的年齡、退休時間與基本聯絡資訊，讓系統知道時間軸怎麼排。
          </div>
          <div class="summary-card">
            <strong style="display:block;margin-bottom:6px;">2. 資產負債表</strong>
            再填資產名稱、所有權人、帳戶類型、餘額與房產負債，先把家底整理清楚。
          </div>
          <div class="summary-card">
            <strong style="display:block;margin-bottom:6px;">3. 收入支出表</strong>
            最後補上薪資、被動收入、生活費與保費，報表就能開始計算。
          </div>
        </div>
      </section>

      <section class="intake-section card">
        <div class="section-head">
          <div>
            <h2 class="section-title">1. 家庭基本資料</h2>
            <div class="section-subtitle">先把案件與家庭角色確認好，後面的資產、收入和退休年齡才會接得準。</div>
          </div>
          <span class="section-tag">必填</span>
        </div>

        <div class="sub-card">
          <div class="section-toolbar">
            <h3>案件資訊</h3>
            <div class="section-note">這些欄位會變成顧問版報表的標頭。</div>
          </div>
          <div class="field-grid">
            ${renderField("案件名稱", "案件名稱", '<input id="caseName" type="text" placeholder="例如：王家退休規劃 2026Q2">')}
            ${renderField("客戶名稱 / 家庭識別", "客戶名稱 / 家庭識別", '<input id="clientName" type="text" placeholder="例如：王先生 / 王太太">')}
            ${renderField("版本名稱", "版本名稱", '<input id="versionName" type="text" placeholder="例如：Intake v1">')}
            ${renderField("基準版本", "基準版本", '<input id="baselineVersion" type="text" placeholder="例如：Baseline-2026-04-20">')}
            ${renderField("顧問名稱", "顧問名稱", '<input id="advisorName" type="text" placeholder="例如：Lawrence">')}
            ${renderField("報告日期", "報告日期", '<input id="reportDate" type="date">')}
          </div>
        </div>

        <div class="sub-card">
          <div class="section-toolbar">
            <h3>家庭成員</h3>
            <div class="section-note">如果是夫妻模式，配偶也請一併填上。</div>
          </div>
          <div class="field-grid">
            ${renderField("家庭模式", "家庭模式", `
              <select id="householdMode">
                <option value="single">單人家庭</option>
                <option value="couple">夫妻家庭</option>
              </select>
            `, { full: true })}
          </div>
          <div class="field-grid" style="margin-top:14px;">
            <div class="sub-card">
              <div class="section-toolbar" style="margin-top:0;">
                <h3>本人</h3>
                <div class="section-note">這個人會當作時間軸主體。</div>
              </div>
              <div class="field-grid">
                ${renderField("姓名", "姓名", '<input id="selfName" type="text" placeholder="例如：王先生">')}
                ${renderField("健康狀態", "健康狀態", `
                  <select id="selfHealthStatus">
                    <option value="good">良好</option>
                    <option value="normal" selected>一般</option>
                    <option value="watch">留意</option>
                  </select>
                `)}
                ${renderField("目前年齡", "目前年齡", '<input id="currentAge" type="number" min="1" step="1" value="40">')}
                ${renderField("預計退休年齡", "預計退休年齡", '<input id="retireAge" type="number" min="1" step="1" value="65">')}
                ${renderField("預期壽命", "預期壽命", '<input id="lifeExpectancy" type="number" min="1" step="1" value="90">')}
              </div>
            </div>

            <div class="sub-card" id="spouseCard">
              <div class="section-toolbar" style="margin-top:0;">
                <h3>配偶</h3>
                <div class="section-note">夫妻模式時才需要填寫。</div>
              </div>
              <div class="field-grid">
                ${renderField("姓名", "姓名", '<input id="spouseName" type="text" placeholder="例如：王太太">')}
                ${renderField("健康狀態", "健康狀態", `
                  <select id="spouseHealthStatus">
                    <option value="good">良好</option>
                    <option value="normal" selected>一般</option>
                    <option value="watch">留意</option>
                  </select>
                `)}
                ${renderField("目前年齡", "目前年齡", '<input id="spouseCurrentAge" type="number" min="1" step="1" value="38">')}
                ${renderField("預計退休年齡", "預計退休年齡", '<input id="spouseRetireAge" type="number" min="1" step="1" value="63">')}
                ${renderField("預期壽命", "預期壽命", '<input id="spouseLifeExpectancy" type="number" min="1" step="1" value="92">')}
              </div>
            </div>
          </div>

          <div class="field-grid" style="margin-top:14px;">
            ${renderField("顧問觀點 / 本次假設說明", "顧問觀點 / 本次假設說明", '<textarea id="advisorNote" placeholder="例如：首次會談先以家庭主要收入與主要資產為主，細項之後再補。"></textarea>', { full: true })}
          </div>
        </div>
      </section>

      <section class="intake-section card">
        <div class="section-head">
          <div>
            <h2 class="section-title">2. 資產負債表</h2>
            <div class="section-subtitle">先填總額，再補明細。若今天時間有限，先把上方四個總額填好也可以。</div>
          </div>
          <span class="section-tag">核心</span>
        </div>

        <div class="sub-card">
          <div class="section-toolbar">
            <h3>快速總額</h3>
            <div class="section-note">這一區是顧問第一次看案最常先抓的數字。</div>
          </div>
          <div class="summary-grid">
            ${renderSummaryCard("現金與活存", "現金與活存", '<input id="cashAssets" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("投資帳戶", "投資帳戶", '<input id="investmentAssets" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("退休帳戶 / 保單帳戶", "退休帳戶 / 保單帳戶", '<input id="retirementAssets" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("房產估值", "房產估值", '<input id="propertyAssets" type="number" min="0" step="1" value="0">')}
          </div>
        </div>

        <div class="sub-card" style="margin-top:14px;">
          <div class="section-toolbar">
            <h3>房產資訊</h3>
            <div class="section-note">房產估值請先填在上方快速總額；這裡再補房產性質與退休處理方式。</div>
          </div>
          <div class="field-grid">
            ${renderField("房產名稱", "房產名稱", '<input id="propertyName" type="text" placeholder="例如：新北自住房">')}
            ${renderField("所有權人", "所有權人", `
              <select id="propertyOwner">
                <option value="joint">共同</option>
                <option value="self">本人</option>
                <option value="spouse">配偶</option>
              </select>
            `)}
            ${renderField("房產類型", "房產類型", `
              <select id="propertyType">
                <option value="residence">自住房</option>
                <option value="rental">出租房</option>
                <option value="other">其他</option>
              </select>
            `)}
            ${renderField("房價年增值率 %", "房價年增值率 %", '<input id="propertyGrowthRate" type="number" step="0.1" value="0">')}
            ${renderField("房產模式", "房產模式", `
              <select id="propertyFundingMode">
                <option value="excluded">只列家庭淨值</option>
                <option value="net_equity">退休起點動用淨值</option>
                <option value="sale_event">指定年齡出售</option>
              </select>
            `)}
            ${renderField("出售年齡", "出售年齡", '<input id="propertySaleAge" type="number" min="1" step="1" value="70">')}
            ${renderField("出售成本率 %", "出售成本率 %", '<input id="propertySaleCostRate" type="number" min="0" step="0.1" value="5">')}
          </div>
        </div>

        <div class="sub-card" style="margin-top:14px;">
          <div class="section-toolbar">
            <h3>資產明細</h3>
            <div class="section-note">若只填總額，這一區可以先留空；若要細分，按「新增資產」即可。</div>
          </div>
          <div class="section-toolbar" style="margin-top:0;">
            <div class="section-note">每筆資產都會對應到顧問版的資產明細。</div>
            <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.addAssetRow()">新增資產</button>
          </div>
          <div id="assetRows" class="row-list"></div>
        </div>

        <div class="sub-card" style="margin-top:14px;">
          <div class="section-toolbar">
            <h3>負債明細</h3>
            <div class="section-note">房貸、信貸、車貸等都可以拆成單筆列出。</div>
          </div>
          <div class="section-toolbar" style="margin-top:0;">
            <div class="section-note">若有房貸，請記得連動到房產資訊。</div>
            <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.addLiabilityRow()">新增負債</button>
          </div>
          <div id="liabilityRows" class="row-list"></div>
        </div>
      </section>

      <section class="intake-section card">
        <div class="section-head">
          <div>
            <h2 class="section-title">3. 收入支出表</h2>
            <div class="section-subtitle">收入先抓大類，支出先抓必要生活費與固定支出，之後顧問再幫你做更細的現金流分析。</div>
          </div>
          <span class="section-tag">現金流</span>
        </div>

        <div class="sub-card">
          <div class="section-toolbar">
            <h3>收入明細</h3>
            <div class="section-note">薪資、獎金、租金、利息、股利、年金都可以分筆列出。</div>
          </div>
          <div class="section-toolbar" style="margin-top:0;">
            <div class="section-note">收入欄位也會自動幫你加上小 i 說明。</div>
            <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.addIncomeRow()">新增收入</button>
          </div>
          <div id="incomeRows" class="row-list"></div>
        </div>

        <div class="sub-card" style="margin-top:14px;">
          <div class="section-toolbar">
            <h3>支出摘要</h3>
            <div class="section-note">這裡先抓固定每月支出。若有扶養或特殊支出，可先寫在顧問備註。</div>
          </div>
          <div class="summary-grid">
            ${renderSummaryCard("必要生活支出 / 月", "必要生活支出 / 月", '<input id="essentialExpense" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("彈性生活支出 / 月", "彈性生活支出 / 月", '<input id="discretionaryExpense" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("醫療支出 / 月", "醫療支出 / 月", '<input id="monthlyMedicalExpense" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("照護支出 / 月", "照護支出 / 月", '<input id="monthlyCareExpense" type="number" min="0" step="1" value="0">')}
            ${renderSummaryCard("保費 / 月", "保費 / 月", '<input id="monthlyPremiumExpense" type="number" min="0" step="1" value="0">')}
          </div>
        </div>
      </section>

      <section class="intake-section card">
        <div class="section-head">
          <div>
            <h2 class="section-title">4. 完成後下一步</h2>
            <div class="section-subtitle">先送交顧問版產出正式報表；系統會用同一份資料再切到客戶版閱讀。</div>
          </div>
          <span class="section-tag">下一步</span>
        </div>
        <div class="intake-actions">
          <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.saveDraft()">暫存草稿</button>
          <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.submitToAdvisor()">送交顧問版</button>
          <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.loadSampleData()">載入示範資料</button>
        </div>
        <div class="intake-footer">
          <div class="intake-footnote">送交後，顧問版會先產出正式報表，再由同一份結果提供客戶版閱讀。</div>
          <div class="intake-footnote">客戶頁可以列印與輸出 PDF，內容都來自顧問版快照，不會另外重算。</div>
        </div>
      </section>
    `;
    decorateHelpLabels(root);
    applyIntakeGuideMode(root);
  }

  function applyIntakeGuideMode(root) {
    if (!root) return;

    document.title = "客戶填寫頁｜退休規劃顧問版試算器V2";

    const topBar = root.querySelector(".top-bar.no-print");
    if (topBar) {
      topBar.innerHTML = `
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.saveDraft()">暫存草稿</button>
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.submitToAdvisor()">送交顧問版</button>
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.loadSampleData()">載入示範資料</button>
        <button type="button" class="danger-btn small-btn" onclick="window.ClientIntakeApp.clearDraft()">清除草稿</button>
      `;
    }

    const kicker = root.querySelector(".intake-hero .intake-kicker");
    if (kicker) kicker.textContent = "客戶填寫頁";

    const title = root.querySelector(".intake-hero .main-title");
    if (title) title.innerHTML = "<span>先填核心資料</span>，再送交顧問版";

    const subtitle = root.querySelector(".intake-hero .sub-title");
    if (subtitle) {
      subtitle.textContent = "先完成家庭基本資料、資產負債表與收入支出表，系統會用同一份資料交給顧問版產出報表。";
    }

    const notice = root.querySelector("#intakeNotice");
    if (notice) {
      notice.textContent = "這一頁只做資料填寫與暫存；完成後按送交顧問版，報表與分析會交給系統與顧問版處理。";
    }

    const status = root.querySelector("#intakeStatus");
    if (status) {
      status.textContent = "先從家庭基本資料開始，填完再補資產負債與收入支出。";
    }

    const hero = root.querySelector(".intake-hero");
    if (hero && !root.querySelector("#intakeGuideBlock")) {
      hero.insertAdjacentHTML(
        "beforeend",
        `
          <section class="intake-section card" id="intakeGuideBlock">
            <div class="section-head">
              <div>
                <h2 class="section-title">先填這三件事</h2>
                <div class="section-subtitle">先把最重要的資料補齊，其他細節之後再慢慢補也可以。</div>
              </div>
              <span class="section-tag">客戶導覽</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
              <div class="summary-card">
                <strong style="display:block;margin-bottom:6px;">1. 家庭基本資料</strong>
                先填本人與配偶的年齡、退休時間與基本聯絡資訊，讓系統知道時間軸怎麼排。
              </div>
              <div class="summary-card">
                <strong style="display:block;margin-bottom:6px;">2. 資產負債表</strong>
                再填資產名稱、所有權人、帳戶類型、餘額與房產負債，先把家底整理清楚。
              </div>
              <div class="summary-card">
                <strong style="display:block;margin-bottom:6px;">3. 收入支出表</strong>
                最後補上薪資、被動收入、生活費與保費，報表就能開始計算。
              </div>
            </div>
          </section>
        `
      );
    }

    const actionPanel = root.querySelector(".intake-actions");
    if (actionPanel) {
      actionPanel.innerHTML = `
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.saveDraft()">暫存草稿</button>
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.submitToAdvisor()">送交顧問版</button>
        <button type="button" class="ghost-btn small-btn" onclick="window.ClientIntakeApp.loadSampleData()">載入示範資料</button>
      `;
    }

    const footnotes = root.querySelectorAll(".intake-footer .intake-footnote");
    if (footnotes[0]) {
      footnotes[0].textContent = "送交後，顧問版會先產出正式報表，再由同一份結果提供客戶版閱讀。";
    }
    if (footnotes[1]) {
      footnotes[1].textContent = "客戶頁可以列印與輸出 PDF，內容都來自顧問版快照，不會另外重算。";
    }
  }

  function renderSummaryCard(label, helpKey, controlHtml) {
    return `
      <div class="summary-card">
        <div class="field">
          <label data-help-key="${escapeAttr(helpKey || label)}">${escapeHtml(label)}</label>
          ${controlHtml}
        </div>
      </div>
    `;
  }

  function ensureDynamicDefaults() {
    const assetRows = document.getElementById("assetRows");
    const liabilityRows = document.getElementById("liabilityRows");
    const incomeRows = document.getElementById("incomeRows");
    if (assetRows && !assetRows.children.length) addAssetRow();
    if (liabilityRows && !liabilityRows.children.length) addLiabilityRow();
    if (incomeRows && !incomeRows.children.length) addIncomeRow();
    updateStatusLine();
  }

  function updateHouseholdModeUI() {
    const householdMode = document.getElementById("householdMode");
    const spouseCard = document.getElementById("spouseCard");
    const isCouple = householdMode?.value === "couple";
    if (spouseCard) spouseCard.classList.toggle("hidden", !isCouple);
    document.getElementById("spouseName")?.toggleAttribute("disabled", !isCouple);
    document.getElementById("spouseCurrentAge")?.toggleAttribute("disabled", !isCouple);
    document.getElementById("spouseRetireAge")?.toggleAttribute("disabled", !isCouple);
    document.getElementById("spouseLifeExpectancy")?.toggleAttribute("disabled", !isCouple);
    document.getElementById("spouseHealthStatus")?.toggleAttribute("disabled", !isCouple);
  }

  function updateStatusLine() {
    const assetCount = document.querySelectorAll("#assetRows .row-card").length;
    const liabilityCount = document.querySelectorAll("#liabilityRows .row-card").length;
    const incomeCount = document.querySelectorAll("#incomeRows .row-card").length;
    const status = document.getElementById("intakeStatus");
    if (status) {
      status.textContent = `目前已填資料：${assetCount} 筆資產、${liabilityCount} 筆負債、${incomeCount} 筆收入。`;
    }
  }

  function makeRowId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function renderAccountRow(data = {}, index = 0) {
    const assetStyle = normalizeAssetStyle(data.assetStyle || data.asset_style || data.uiPrimaryDriver);
    const selectedOwner = data.owner || "joint";
    const selectedType = data.accountType || data.account_type || "taxable";
    const selectedPre = data.preRetirementPolicy || data.pre_retirement_policy || "reinvest";
    const selectedPost = data.postRetirementPolicy || data.post_retirement_policy || "sell_only";
    const rateValue = Number.isFinite(Number(data.rate)) ? Number(data.rate) : Number.isFinite(Number(data.totalReturnRate)) ? Number(data.totalReturnRate) : 0;

    return `
      <div class="row-card account-row" data-row-id="${escapeAttr(data.id || makeRowId("account"))}">
        <div class="row-card-header">
          <div class="row-card-title">資產 ${index + 1}</div>
          <button type="button" class="danger-btn small-btn" data-remove-row>移除</button>
        </div>
        <div class="row-card-grid">
          ${renderField("資產名稱", "資產名稱", `<input type="text" class="account-name" value="${escapeAttr(data.name || data.account_name || "")}" placeholder="例如：0050、現金帳戶">`)}
          ${renderField("所有權人", "所有權人", renderSelect(OWNER_OPTIONS, selectedOwner, "account-owner"))}
          ${renderField("帳戶類型", "帳戶類型", renderSelect(ACCOUNT_TYPE_OPTIONS, selectedType, "account-type"))}
          ${renderField("資產類型", "資產類型", renderSelect(ASSET_TYPE_OPTIONS, assetStyle, "account-driver-select"))}
          ${renderField("目前餘額", "目前餘額", `<input type="number" class="account-balance" min="0" step="1" value="${Number.isFinite(Number(data.openingBalance ?? data.opening_balance)) ? Number(data.openingBalance ?? data.opening_balance) : 0}">`)}
          ${renderField("退休前處理", "退休前處理", renderSelect(RETIREMENT_POLICY_OPTIONS, selectedPre, "account-pre-policy"))}
          ${renderField("退休後處理", "退休後處理", renderSelect(POST_RETIREMENT_OPTIONS, selectedPost, "account-post-policy"))}
          ${renderField("年化報酬率 / 收益率", "年化報酬率 / 收益率", `<input type="number" class="account-rate" min="-50" step="0.1" value="${rateValue}">`)}
          ${renderField("提領順序", "提領順序", `<input type="number" class="account-priority" min="1" step="1" value="${Number.isFinite(Number(data.withdrawalPriority ?? data.withdrawal_priority)) ? Number(data.withdrawalPriority ?? data.withdrawal_priority) : index + 1}">`)}
          ${renderField("最低保留金額", "最低保留金額", `<input type="number" class="account-reserve" min="0" step="1" value="${Number.isFinite(Number(data.minimumReserve ?? data.minimum_reserve)) ? Number(data.minimumReserve ?? data.minimum_reserve) : 0}">`)}
        </div>
      </div>
    `;
  }

  function renderLiabilityRow(data = {}, index = 0) {
    const selectedOwner = data.owner || "joint";
    const selectedType = data.debtType || data.debt_type || "mortgage";
    const selectedTreatment = data.treatmentMode || data.treatment_mode || "amortized";
    const selectedLinkedProperty = data.linkedPropertyId || data.linked_property_id || "";
    return `
      <div class="row-card liability-row" data-row-id="${escapeAttr(data.id || makeRowId("liability"))}">
        <div class="row-card-header">
          <div class="row-card-title">負債 ${index + 1}</div>
          <button type="button" class="danger-btn small-btn" data-remove-row>移除</button>
        </div>
        <div class="row-card-grid">
          ${renderField("負債名稱", "負債名稱", `<input type="text" class="liability-name" value="${escapeAttr(data.name || data.liability_name || "")}" placeholder="例如：房貸">`)}
          ${renderField("所有權人", "所有權人", renderSelect(OWNER_OPTIONS, selectedOwner, "liability-owner"))}
          ${renderField("負債類型", "負債類型", renderSelect(DEBT_TYPE_OPTIONS, selectedType, "liability-type-select"))}
          ${renderField("目前餘額", "目前餘額", `<input type="number" class="liability-balance" min="0" step="1" value="${Number.isFinite(Number(data.balance ?? data.current_balance)) ? Number(data.balance ?? data.current_balance) : 0}">`)}
          ${renderField("每月還款", "每月還款", `<input type="number" class="liability-payment" min="0" step="1" value="${Number.isFinite(Number(data.monthlyPayment ?? data.monthly_payment)) ? Number(data.monthlyPayment ?? data.monthly_payment) : 0}">`)}
          ${renderField("年利率 %", "年利率 %", `<input type="number" class="liability-interest" min="0" step="0.1" value="${Number.isFinite(Number(data.interestRate ?? data.annual_interest_rate)) ? Number(data.interestRate ?? data.annual_interest_rate) : 0}">`)}
          ${renderField("連動房產", "連動房產", `
            <select class="liability-linked-property">
              <option value="">未連結</option>
              <option value="property-1" ${selectedLinkedProperty === "property-1" ? "selected" : ""}>主要房產</option>
            </select>
          `)}
          ${renderField("清償年齡", "清償年齡", `<input type="number" class="liability-payoff-age" min="1" step="1" value="${Number.isFinite(Number(data.payoffAge ?? data.payoff_age)) ? Number(data.payoffAge ?? data.payoff_age) : 70}">`)}
          ${renderField("負債模式", "負債模式", renderSelect([
            { value: "amortized", label: "正常攤還" },
            { value: "prepay", label: "提前清償" }
          ], selectedTreatment, "liability-treatment-select"))}
          ${renderField("提前清償年齡", "提前清償年齡", `<input type="number" class="liability-prepay-age" min="0" step="1" value="${Number.isFinite(Number(data.prepayAge ?? data.prepay_age)) ? Number(data.prepayAge ?? data.prepay_age) : 0}">`)}
          ${renderField("提前清償金額", "提前清償金額", `<input type="number" class="liability-prepay-amount" min="0" step="1" value="${Number.isFinite(Number(data.prepayAmount ?? data.prepay_amount)) ? Number(data.prepayAmount ?? data.prepay_amount) : 0}">`)}
        </div>
      </div>
    `;
  }

  function renderIncomeRow(data = {}, index = 0) {
    const owner = data.owner || "household";
    const preset = data.preset || "salary";
    const type = data.type || "monthly";
    return `
      <div class="row-card income-row" data-row-id="${escapeAttr(data.id || makeRowId("income"))}">
        <div class="row-card-header">
          <div class="row-card-title">收入 ${index + 1}</div>
          <button type="button" class="danger-btn small-btn" data-remove-row>移除</button>
        </div>
        <div class="row-card-grid">
          ${renderField("收入名稱", "收入名稱", `<input type="text" class="income-name" value="${escapeAttr(data.name || "")}" placeholder="例如：薪資、租金、配息">`)}
          ${renderField("所有權人", "所有權人", renderSelect(INCOME_OWNER_OPTIONS, owner, "income-owner-select"))}
          ${renderField("收入類型", "收入類型", renderSelect(INCOME_PRESET_OPTIONS, preset, "income-preset-select"))}
          ${renderField("型態", "型態", renderSelect(INCOME_TYPE_OPTIONS, type, "income-type-select"))}
          ${renderField("金額", "金額", `<input type="number" class="income-amount" min="0" step="1" value="${Number.isFinite(Number(data.amount)) ? Number(data.amount) : 0}">`)}
          ${renderField("發生年齡（填該所有人的年齡）", "發生年齡（填該所有人的年齡）", `<input type="number" class="income-age" min="1" step="1" value="${Number.isFinite(Number(data.age)) ? Number(data.age) : 65}">`)}
          ${renderField("持續年數", "持續年數", `<input type="number" class="income-years" min="1" step="1" value="${Number.isFinite(Number(data.years)) ? Number(data.years) : 20}">`)}
          ${renderField("年成長率 %", "年成長率 %", `<input type="number" class="income-growth" step="0.1" value="${Number.isFinite(Number(data.growthRate ?? data.growth_rate)) ? Number(data.growthRate ?? data.growth_rate) : 0}">`)}
          ${renderField("隨通膨調整", "隨通膨調整", `<label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--sumi-mid);"><input type="checkbox" class="income-inflation" ${data.inflation === false ? "" : "checked"}>勾選後隨通膨調整</label>`, { full: true })}
        </div>
      </div>
    `;
  }

  function renderRowList(containerId, rows, renderer, fallbackCount = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const safeRows = Array.isArray(rows) && rows.length ? rows : Array.from({ length: fallbackCount }, () => ({}));
    container.innerHTML = safeRows.map((row, index) => renderer(row, index)).join("");
    decorateHelpLabels(container);
    container.querySelectorAll("[data-remove-row]").forEach((button) => {
      button.addEventListener("click", () => {
        button.closest(".row-card")?.remove();
        if (!container.children.length) {
          const blank = renderer({}, 0);
          container.insertAdjacentHTML("beforeend", blank);
          decorateHelpLabels(container);
        }
        updateStatusLine();
      });
    });
  }

  function normalizeAssetStyle(value) {
    if (value === "income") return "income";
    if (value === "mixed") return "balanced";
    return value === "growth" ? "growth" : "balanced";
  }

  function refreshAccountRow(row) {
    if (!row) return;
    const driver = row.querySelector(".account-driver-select")?.value || "balanced";
    const rateField = row.querySelector(".account-rate");
    const label = row.querySelector(".account-rate")?.closest(".field")?.querySelector("label");
    if (label) {
      label.dataset.helpKey = driver === "growth" ? "年化報酬率 / 收益率" : "年化報酬率 / 收益率";
    }
    if (rateField) {
      rateField.placeholder = driver === "growth" ? "例如 5.5" : "例如 3.0";
    }
  }

  function refreshLiabilityRow(row) {
    if (!row) return;
    const debtType = row.querySelector(".liability-type-select")?.value || "other";
    const linked = row.querySelector(".liability-linked-property");
    if (linked) {
      linked.disabled = debtType !== "mortgage";
    }
  }

  function refreshIncomeRow(row) {
    if (!row) return;
    const preset = row.querySelector(".income-preset-select")?.value || "salary";
    const nameInput = row.querySelector(".income-name");
    if (nameInput && !nameInput.value.trim()) {
      const presetLabel = INCOME_PRESET_OPTIONS.find((item) => item.value === preset)?.label || "收入";
      const owner = row.querySelector(".income-owner-select")?.value || "household";
      const ownerLabel = owner === "self" ? "本人" : owner === "spouse" ? "配偶" : "家庭";
      nameInput.placeholder = `${ownerLabel} ${presetLabel}`;
    }
  }

  function ensureDynamicDefaults() {
    if (!document.getElementById("assetRows")?.children.length) addAssetRow();
    if (!document.getElementById("liabilityRows")?.children.length) addLiabilityRow();
    if (!document.getElementById("incomeRows")?.children.length) addIncomeRow();
    updateStatusLine();
  }

  function addAssetRow(data = {}) {
    const container = document.getElementById("assetRows");
    if (!container) return;
    const index = container.children.length;
    container.insertAdjacentHTML("beforeend", renderAccountRow(data, index));
    const row = container.lastElementChild;
    decorateHelpLabels(row);
    refreshAccountRow(row);
    updateStatusLine();
  }

  function addLiabilityRow(data = {}) {
    const container = document.getElementById("liabilityRows");
    if (!container) return;
    const index = container.children.length;
    container.insertAdjacentHTML("beforeend", renderLiabilityRow(data, index));
    const row = container.lastElementChild;
    decorateHelpLabels(row);
    refreshLiabilityRow(row);
    updateStatusLine();
  }

  function addIncomeRow(data = {}) {
    const container = document.getElementById("incomeRows");
    if (!container) return;
    const index = container.children.length;
    container.insertAdjacentHTML("beforeend", renderIncomeRow(data, index));
    const row = container.lastElementChild;
    decorateHelpLabels(row);
    refreshIncomeRow(row);
    updateStatusLine();
  }

  function clearRowContainers() {
    document.getElementById("assetRows").innerHTML = "";
    document.getElementById("liabilityRows").innerHTML = "";
    document.getElementById("incomeRows").innerHTML = "";
  }

  function hydrateDraft(data = {}) {
    document.getElementById("caseName").value = data.caseName || "";
    document.getElementById("clientName").value = data.clientName || "";
    document.getElementById("versionName").value = data.versionName || "";
    document.getElementById("baselineVersion").value = data.baselineVersion || "";
    document.getElementById("advisorName").value = data.advisorName || "";
    document.getElementById("reportDate").value = data.reportDate || getLocalDateString();
    document.getElementById("householdMode").value = data.householdMode === "couple" ? "couple" : "single";
    document.getElementById("selfName").value = data.selfName || "";
    document.getElementById("currentAge").value = Number.isFinite(Number(data.currentAge)) ? Number(data.currentAge) : 40;
    document.getElementById("retireAge").value = Number.isFinite(Number(data.retireAge)) ? Number(data.retireAge) : 65;
    document.getElementById("lifeExpectancy").value = Number.isFinite(Number(data.lifeExpectancy)) ? Number(data.lifeExpectancy) : 90;
    document.getElementById("selfHealthStatus").value = data.selfHealthStatus || "normal";
    document.getElementById("spouseName").value = data.spouseName || "";
    document.getElementById("spouseCurrentAge").value = Number.isFinite(Number(data.spouseCurrentAge)) ? Number(data.spouseCurrentAge) : 38;
    document.getElementById("spouseRetireAge").value = Number.isFinite(Number(data.spouseRetireAge)) ? Number(data.spouseRetireAge) : 63;
    document.getElementById("spouseLifeExpectancy").value = Number.isFinite(Number(data.spouseLifeExpectancy)) ? Number(data.spouseLifeExpectancy) : 92;
    document.getElementById("spouseHealthStatus").value = data.spouseHealthStatus || "normal";
    document.getElementById("advisorNote").value = data.advisorNote || "";

    document.getElementById("cashAssets").value = Number.isFinite(Number(data.cashAssets)) ? Number(data.cashAssets) : 0;
    document.getElementById("investmentAssets").value = Number.isFinite(Number(data.investmentAssets)) ? Number(data.investmentAssets) : 0;
    document.getElementById("retirementAssets").value = Number.isFinite(Number(data.retirementAssets)) ? Number(data.retirementAssets) : 0;
    document.getElementById("propertyAssets").value = Number.isFinite(Number(data.propertyAssets)) ? Number(data.propertyAssets) : 0;

    document.getElementById("propertyName").value = data.propertyName || "";
    document.getElementById("propertyOwner").value = data.propertyOwner || "joint";
    document.getElementById("propertyType").value = data.propertyType || "residence";
    document.getElementById("propertyGrowthRate").value = Number.isFinite(Number(data.propertyGrowthRate)) ? Number(data.propertyGrowthRate) : 0;
    document.getElementById("propertyFundingMode").value = data.propertyFundingMode || (data.includePropertyInFunding ? "net_equity" : "excluded");
    document.getElementById("propertySaleAge").value = Number.isFinite(Number(data.propertySaleAge)) ? Number(data.propertySaleAge) : 70;
    document.getElementById("propertySaleCostRate").value = Number.isFinite(Number(data.propertySaleCostRate)) ? Number(data.propertySaleCostRate) : 5;

    document.getElementById("essentialExpense").value = Number.isFinite(Number(data.essentialExpense)) ? Number(data.essentialExpense) : 0;
    document.getElementById("discretionaryExpense").value = Number.isFinite(Number(data.discretionaryExpense)) ? Number(data.discretionaryExpense) : 0;
    document.getElementById("monthlyMedicalExpense").value = Number.isFinite(Number(data.monthlyMedicalExpense)) ? Number(data.monthlyMedicalExpense) : 0;
    document.getElementById("monthlyCareExpense").value = Number.isFinite(Number(data.monthlyCareExpense)) ? Number(data.monthlyCareExpense) : 0;
    document.getElementById("monthlyPremiumExpense").value = Number.isFinite(Number(data.monthlyPremiumExpense)) ? Number(data.monthlyPremiumExpense) : 0;

    clearRowContainers();
    renderRowList("assetRows", data.accounts || [], renderAccountRow, 1);
    renderRowList("liabilityRows", data.liabilities || [], renderLiabilityRow, 1);
    renderRowList("incomeRows", data.incomes || [], renderIncomeRow, 1);

    updateHouseholdModeUI();
    updateStatusLine();
    decorateHelpLabels(document);
  }

  function buildDraftState() {
    return {
      caseName: document.getElementById("caseName").value.trim(),
      clientName: document.getElementById("clientName").value.trim(),
      versionName: document.getElementById("versionName").value.trim(),
      baselineVersion: document.getElementById("baselineVersion").value.trim(),
      advisorName: document.getElementById("advisorName").value.trim(),
      reportDate: document.getElementById("reportDate").value || getLocalDateString(),
      householdMode: document.getElementById("householdMode").value === "couple" ? "couple" : "single",
      selfName: document.getElementById("selfName").value.trim(),
      currentAge: Math.trunc(toFiniteNumber(document.getElementById("currentAge").value, 40)),
      retireAge: Math.trunc(toFiniteNumber(document.getElementById("retireAge").value, 65)),
      lifeExpectancy: Math.trunc(toFiniteNumber(document.getElementById("lifeExpectancy").value, 90)),
      selfHealthStatus: document.getElementById("selfHealthStatus").value,
      spouseName: document.getElementById("spouseName").value.trim(),
      spouseCurrentAge: Math.trunc(toFiniteNumber(document.getElementById("spouseCurrentAge").value, 38)),
      spouseRetireAge: Math.trunc(toFiniteNumber(document.getElementById("spouseRetireAge").value, 63)),
      spouseLifeExpectancy: Math.trunc(toFiniteNumber(document.getElementById("spouseLifeExpectancy").value, 92)),
      spouseHealthStatus: document.getElementById("spouseHealthStatus").value,
      advisorNote: document.getElementById("advisorNote").value.trim(),
      cashAssets: toFiniteNumber(document.getElementById("cashAssets").value, 0),
      investmentAssets: toFiniteNumber(document.getElementById("investmentAssets").value, 0),
      retirementAssets: toFiniteNumber(document.getElementById("retirementAssets").value, 0),
      propertyAssets: toFiniteNumber(document.getElementById("propertyAssets").value, 0),
      propertyName: document.getElementById("propertyName").value.trim(),
      propertyOwner: document.getElementById("propertyOwner").value,
      propertyType: document.getElementById("propertyType").value,
      propertyGrowthRate: toFiniteNumber(document.getElementById("propertyGrowthRate").value, 0),
      propertyFundingMode: document.getElementById("propertyFundingMode").value,
      propertySaleAge: Math.trunc(toFiniteNumber(document.getElementById("propertySaleAge").value, 70)),
      propertySaleCostRate: toFiniteNumber(document.getElementById("propertySaleCostRate").value, 5),
      includePropertyInFunding: document.getElementById("propertyFundingMode").value === "net_equity",
      accounts: readAssetRows(),
      liabilities: readLiabilityRows(),
      incomes: readIncomeRows(),
      essentialExpense: toFiniteNumber(document.getElementById("essentialExpense").value, 0),
      discretionaryExpense: toFiniteNumber(document.getElementById("discretionaryExpense").value, 0),
      monthlyMedicalExpense: toFiniteNumber(document.getElementById("monthlyMedicalExpense").value, 0),
      monthlyCareExpense: toFiniteNumber(document.getElementById("monthlyCareExpense").value, 0),
      monthlyPremiumExpense: toFiniteNumber(document.getElementById("monthlyPremiumExpense").value, 0),
      monthlyContribution: 0,
      monthlyContributionOverride: 0,
      useManualContributionOverride: false,
      ltcProfile: {
        enabled: true,
        startAge: 80,
        durationYears: 8,
        extraCostFactor: 1.2
      }
    };
  }

  function readAssetRows() {
    return Array.from(document.querySelectorAll("#assetRows .account-row"))
      .map((row, index) => {
        const name = row.querySelector(".account-name")?.value.trim() || "";
        const balance = toFiniteNumber(row.querySelector(".account-balance")?.value, 0);
        const driver = row.querySelector(".account-driver-select")?.value || "balanced";
        const rate = toFiniteNumber(row.querySelector(".account-rate")?.value, 0);
        if (!name && !balance && rate === 0) return null;

        const assetStyle = normalizeAssetStyle(driver);
        const normalized = {
          id: row.dataset.rowId || makeRowId("account"),
          name,
          owner: row.querySelector(".account-owner")?.value || "joint",
          accountType: row.querySelector(".account-type")?.value || "taxable",
          assetStyle,
          openingBalance: balance,
          uiPrimaryDriver: driver === "balanced" ? "mixed" : driver,
          preRetirementPolicy: row.querySelector(".account-pre-policy")?.value || "reinvest",
          postRetirementPolicy: row.querySelector(".account-post-policy")?.value || "sell_only",
          totalReturnRate: 0,
          cashYieldRate: 0,
          priceGrowthRate: 0,
          withdrawalPriority: Math.max(1, Math.trunc(toFiniteNumber(row.querySelector(".account-priority")?.value, index + 1))),
          minimumReserve: toFiniteNumber(row.querySelector(".account-reserve")?.value, 0)
        };

        if (assetStyle === "growth") {
          normalized.totalReturnRate = rate;
        } else if (assetStyle === "income") {
          normalized.cashYieldRate = rate;
        } else {
          normalized.cashYieldRate = rate / 2;
          normalized.priceGrowthRate = rate / 2;
        }

        return normalized;
      })
      .filter(Boolean);
  }

  function readLiabilityRows() {
    return Array.from(document.querySelectorAll("#liabilityRows .liability-row"))
      .map((row, index) => {
        const name = row.querySelector(".liability-name")?.value.trim() || "";
        const balance = toFiniteNumber(row.querySelector(".liability-balance")?.value, 0);
        const monthlyPayment = toFiniteNumber(row.querySelector(".liability-payment")?.value, 0);
        if (!name && !balance && !monthlyPayment) return null;

        return {
          id: row.dataset.rowId || makeRowId("liability"),
          name,
          owner: row.querySelector(".liability-owner")?.value || "joint",
          debtType: row.querySelector(".liability-type-select")?.value || "other",
          balance,
          monthlyPayment,
          interestRate: toFiniteNumber(row.querySelector(".liability-interest")?.value, 0),
          linkedPropertyId: row.querySelector(".liability-linked-property")?.value || "",
          payoffAge: Math.trunc(toFiniteNumber(row.querySelector(".liability-payoff-age")?.value, 70)),
          treatmentMode: row.querySelector(".liability-treatment-select")?.value || "amortized",
          prepayAge: Math.trunc(toFiniteNumber(row.querySelector(".liability-prepay-age")?.value, 0)),
          prepayAmount: toFiniteNumber(row.querySelector(".liability-prepay-amount")?.value, 0),
          includeInRetirementCashflow: true
        };
      })
      .filter(Boolean);
  }

  function readIncomeRows() {
    return Array.from(document.querySelectorAll("#incomeRows .income-row"))
      .map((row, index) => {
        const name = row.querySelector(".income-name")?.value.trim() || "";
        const amount = toFiniteNumber(row.querySelector(".income-amount")?.value, 0);
        if (!name && !amount) return null;

        return {
          id: row.dataset.rowId || makeRowId("income"),
          name,
          owner: row.querySelector(".income-owner-select")?.value || "household",
          preset: row.querySelector(".income-preset-select")?.value || "salary",
          type: row.querySelector(".income-type-select")?.value || "monthly",
          amount,
          age: Math.trunc(toFiniteNumber(row.querySelector(".income-age")?.value, 65)),
          years: Math.max(1, Math.trunc(toFiniteNumber(row.querySelector(".income-years")?.value, 1))),
          growthRate: toFiniteNumber(row.querySelector(".income-growth")?.value, 0),
          inflation: row.querySelector(".income-inflation")?.checked !== false
        };
      })
      .filter(Boolean);
  }

  function saveDraft(options = {}) {
    const { silent = false } = options;
    const payload = buildDraftState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (!silent) {
      setNotice("草稿已儲存。若已填完，可直接按「送交顧問版」。", "ok");
    }
    updateStatusLine();
    return payload;
  }

  function submitToAdvisor() {
    saveDraft({ silent: true });
    setNotice("已送交顧問版，正在開啟顧問工作台。", "ok");
    window.location.href = "advisor.html?source=intake";
  }

  function openAdvisorPage() {
    saveDraft({ silent: true });
    window.location.href = "advisor.html?source=intake";
  }

  function openClientReport() {
    saveDraft({ silent: true });
    window.location.href = "client.html";
  }

  function buildSampleDraft() {
    return {
      caseName: "夫妻雙薪房產範例",
      clientName: "範例客戶",
      versionName: "Intake Sample",
      baselineVersion: "Baseline",
      advisorName: "系統自動生成",
      reportDate: getLocalDateString(),
      householdMode: "couple",
      selfName: "王先生",
      currentAge: 45,
      retireAge: 63,
      lifeExpectancy: 90,
      selfHealthStatus: "normal",
      spouseName: "王太太",
      spouseCurrentAge: 43,
      spouseRetireAge: 61,
      spouseLifeExpectancy: 92,
      spouseHealthStatus: "normal",
      advisorNote: "一鍵範例資料，供測試用。",
      cashAssets: 500000,
      investmentAssets: 2600000,
      retirementAssets: 1500000,
      propertyAssets: 10000000,
      propertyName: "新北自住房",
      propertyOwner: "joint",
      propertyType: "residence",
      propertyGrowthRate: 3,
      propertyFundingMode: "net_equity",
      propertySaleAge: 70,
      propertySaleCostRate: 5,
      accounts: [
        {
          id: "cash-1",
          name: "家庭備用金",
          owner: "joint",
          accountType: "cash",
          assetStyle: "balanced",
          openingBalance: 500000,
          uiPrimaryDriver: "mixed",
          preRetirementPolicy: "distribution_to_cash",
          postRetirementPolicy: "distribution_to_cash",
          totalReturnRate: 0,
          cashYieldRate: 0,
          priceGrowthRate: 0,
          withdrawalPriority: 1,
          minimumReserve: 200000
        },
        {
          id: "growth-1",
          name: "全球成長 ETF",
          owner: "self",
          accountType: "taxable",
          assetStyle: "growth",
          openingBalance: 1800000,
          uiPrimaryDriver: "growth",
          preRetirementPolicy: "reinvest",
          postRetirementPolicy: "sell_only",
          totalReturnRate: 7,
          cashYieldRate: 0,
          priceGrowthRate: 0,
          withdrawalPriority: 2,
          minimumReserve: 0
        },
        {
          id: "income-1",
          name: "高股息帳戶",
          owner: "spouse",
          accountType: "taxable",
          assetStyle: "income",
          openingBalance: 900000,
          uiPrimaryDriver: "income",
          preRetirementPolicy: "distribution_to_cash",
          postRetirementPolicy: "distribution_first_then_sell",
          totalReturnRate: 0,
          cashYieldRate: 4.5,
          priceGrowthRate: 0,
          withdrawalPriority: 3,
          minimumReserve: 0
        },
        {
          id: "retire-1",
          name: "退休帳戶",
          owner: "joint",
          accountType: "retirement",
          assetStyle: "balanced",
          openingBalance: 1500000,
          uiPrimaryDriver: "mixed",
          preRetirementPolicy: "reinvest",
          postRetirementPolicy: "distribution_first_then_sell",
          totalReturnRate: 0,
          cashYieldRate: 1.6,
          priceGrowthRate: 1.6,
          withdrawalPriority: 4,
          minimumReserve: 0
        }
      ],
      liabilities: [
        {
          id: "mortgage-1",
          name: "房貸",
          owner: "joint",
          debtType: "mortgage",
          balance: 4000000,
          monthlyPayment: 30000,
          interestRate: 2.15,
          linkedPropertyId: "property-1",
          payoffAge: 70,
          treatmentMode: "amortized",
          prepayAge: 0,
          prepayAmount: 0,
          includeInRetirementCashflow: true
        }
      ],
      incomes: [
        {
          id: "income-salary-1",
          name: "王先生薪資",
          owner: "self",
          preset: "salary",
          type: "monthly",
          amount: 120000,
          age: 45,
          years: 18,
          growthRate: 3,
          inflation: true
        },
        {
          id: "income-salary-2",
          name: "王太太薪資",
          owner: "spouse",
          preset: "salary",
          type: "monthly",
          amount: 100000,
          age: 43,
          years: 18,
          growthRate: 3,
          inflation: true
        },
        {
          id: "income-dividend-1",
          name: "配息收入",
          owner: "household",
          preset: "dividend",
          type: "monthly",
          amount: 30000,
          age: 45,
          years: 25,
          growthRate: 2,
          inflation: false
        }
      ],
      essentialExpense: 55000,
      discretionaryExpense: 20000,
      monthlyMedicalExpense: 8000,
      monthlyCareExpense: 3000,
      monthlyPremiumExpense: 12000,
      monthlyContribution: 0,
      monthlyContributionOverride: 0,
      useManualContributionOverride: false
    };
  }

  function loadSampleData() {
    hydrateDraft(buildSampleDraft());
    saveDraft({ silent: true });
    setNotice("已載入範例資料。你可以先檢查內容，再送交顧問版。", "ok");
    updateStatusLine();
  }

  function clearDraft() {
    if (!window.confirm("要清除這份客戶填寫草稿嗎？")) return;
    localStorage.removeItem(STORAGE_KEY);
    hydrateDraft({
      reportDate: getLocalDateString(),
      householdMode: "single"
    });
    setNotice("已清除草稿，現在是空白可填狀態。", "warn");
  }

  function hydrateFromStorage(showDefaultNotice = false) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      renderPageSkeleton();
      hydrateDraft({
        reportDate: getLocalDateString(),
        householdMode: "single"
      });
      if (showDefaultNotice) {
        setNotice("尚未載入資料，請先從上方開始填寫；每個欄位右側都會有小 i 說明。", "info");
      }
      return false;
    }

    try {
      renderPageSkeleton();
      hydrateDraft(JSON.parse(saved));
      setNotice("已載入先前草稿，可直接繼續編輯或送交顧問版。", "ok");
      return true;
    } catch (error) {
      console.error("載入客戶填寫草稿失敗", error);
      renderPageSkeleton();
      hydrateDraft({
        reportDate: getLocalDateString(),
        householdMode: "single"
      });
      setNotice("讀取舊草稿失敗，已回到空白表單。", "error");
      return false;
    }
  }

  function updateStatusLine() {
    const status = document.getElementById("intakeStatus");
    if (!status) return;
    const assets = document.querySelectorAll("#assetRows .row-card").length;
    const liabilities = document.querySelectorAll("#liabilityRows .row-card").length;
    const incomes = document.querySelectorAll("#incomeRows .row-card").length;
    const propertyFilled = document.getElementById("propertyName")?.value.trim() ? "已填房產" : "未填房產";
    status.textContent = `目前已填資料：${assets} 筆資產、${liabilities} 筆負債、${incomes} 筆收入；${propertyFilled}。`;
  }

  function normalizeAssetStyle(value) {
    if (value === "income") return "income";
    if (value === "growth") return "growth";
    return "balanced";
  }
})();
