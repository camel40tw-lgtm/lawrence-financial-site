let currentStep = 1;
const totalSteps = 5;
const STORAGE_KEY = "cfp_retire_plan_v4";
const SNAPSHOT_KEY = "cfp_retire_plan_v4_snapshots";
const REPORT_CACHE_KEY = "cfp_retire_plan_v4_report_cache";
const REPORT_CACHE_ENGINE_STAMP = "2026-04-19-advisor-client-cache-v1";
const chartInstances = {};
let currentSnapshotRefreshHandle = null;

const REPORT_VIEW_MODE_KEY = "cfp_retire_plan_v4_view_mode";
const REPORT_VIEW_MODES = Object.freeze({
  advisor: "advisor",
  client: "client"
});
const REPORT_BLOCK_IDS = Object.freeze([
  "reportSummary",
  "reportOptionsBlock",
  "snapshotBlock",
  "cashflowSummaryBlock",
  "result",
  "scenarioComparisonBlock",
  "strategyBlock",
  "accountBlock",
  "propertyBlock",
  "liabilityBlock",
  "rule4Block",
  "medicalBlock",
  "inputSummaryBlock",
  "advisorAdviceBlock",
  "logicStepsWrap",
  "monteCarloSummaryBlock",
  "cashflowBlock",
  "preChartBlock",
  "postChartBlock",
  "scenarioChartBlock",
  "monteCarloChartBlock",
  "shareBox"
]);
const CLIENT_REPORT_VISIBLE_BLOCK_IDS = Object.freeze([
  "reportSummary",
  "result",
  "scenarioComparisonBlock",
  "strategyBlock",
  "monteCarloSummaryBlock",
  "scenarioChartBlock",
  "monteCarloChartBlock"
]);
let currentViewMode = REPORT_VIEW_MODES.advisor;

let lastRenderedRawData = null;
let lastRenderedData = null;
let lastRenderedProjection = null;
let lastRenderedMonteCarlo = null;
let lastRenderedScenarioComparisons = [];

const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", () => {
  initializeReportViewMode();
  initializeDefaults();
  attachLiveSnapshotListeners();
  updateWizardUI();
  const hasUrlData = checkUrlData();
  const shouldAutoLoadAdvisorDraft = !isClientReportMode() && new URLSearchParams(window.location.search).get("source") === "intake";
  decorateFieldHelpLabels(document);
  ensureFieldHelpObserver();
  if (isClientReportMode()) {
    bootstrapClientPage(hasUrlData);
  } else {
    if (shouldAutoLoadAdvisorDraft) {
      if (loadData()) {
        calculateRetirement();
        return;
      }
      refreshCurrentSnapshot();
      return;
    }
    refreshCurrentSnapshot();
  }
});

function initializeDefaults() {
  const reportDateInput = document.getElementById("reportDate");
  if (reportDateInput && !reportDateInput.value) {
    reportDateInput.value = getLocalDateString();
  }

  syncTask9UiText();
  handleHouseholdModeChange();
  handleWithdrawalStrategyChange();

  if (!document.getElementById("accountContainer")?.children.length) {
    buildDefaultAccountRowsFromBuckets({
      cashAssets: document.getElementById("cashAssets")?.value,
      investmentAssets: document.getElementById("investmentAssets")?.value,
      retirementAssets: document.getElementById("retirementAssets")?.value,
      returnRate: document.getElementById("returnRate")?.value,
      postReturnRate: document.getElementById("postReturnRate")?.value
    }).forEach((account) => addAccount(account));
  }

  if (!document.getElementById("liabilityContainer").children.length) {
    addLiability();
  }

  updateAnnualReviewStatusBadge();
  generateSummary();
  refreshStep3DerivedPanels();
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
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatSignedCurrency(value) {
  const amount = toFiniteNumber(value, 0);
  return `${amount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(amount))}`;
}

function formatPercent(value, digits = 1) {
  return `${toFiniteNumber(value, 0).toFixed(digits)}%`;
}

function roundForInput(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(toFiniteNumber(value, 0) * factor) / factor;
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? "";
}

function setChecked(id, checked) {
  const element = document.getElementById(id);
  if (element) element.checked = Boolean(checked);
}

function setSelectValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function syncTask9UiText() {
  const contributionLabel = document.querySelector('label[for="monthlyContribution"]');
  if (contributionLabel) contributionLabel.textContent = "手動校正投入（月）";
}

function normalizeScenarioCMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (["return_rate", "return", "報酬率優化", "報酬率", "收益優化"].includes(mode)) {
    return "return_rate";
  }
  if (["retire_delay", "delay", "retire_later", "延後退休", "延後退休優化"].includes(mode)) {
    return "retire_delay";
  }
  if (["contribution", "contrib", "提撥", "提高提撥", "提高提撥優化"].includes(mode)) {
    return "contribution";
  }
  return "mixed";
}

function getScenarioCModeLabel(mode = "mixed") {
  const normalized = normalizeScenarioCMode(mode);
  if (normalized === "return_rate") return "報酬率優化";
  if (normalized === "retire_delay") return "延後退休優化";
  if (normalized === "contribution") return "提高提撥優化";
  return "綜合優化";
}

function getScenarioCSettings(source = getRawFormState()) {
  return {
    mode: normalizeScenarioCMode(source?.scenarioCMode),
    returnBoostPct: Math.max(0, toFiniteNumber(source?.scenarioCReturnBoostPct, 1)),
    retireDelayYears: Math.max(0, Math.trunc(toFiniteNumber(source?.scenarioCRetireDelayYears, 2))),
    contributionBoostPct: Math.max(0, toFiniteNumber(source?.scenarioCContributionBoostPct, 15))
  };
}

function buildScenarioCSettingsSummary(source = getRawFormState()) {
  const settings = getScenarioCSettings(source);
  const modeLabel = getScenarioCModeLabel(settings.mode);
  const parts = [];

  if (settings.mode === "return_rate" || settings.mode === "mixed") {
    parts.push(`報酬率提高 ${settings.returnBoostPct.toFixed(1)} 個百分點`);
  }
  if (settings.mode === "retire_delay" || settings.mode === "mixed") {
    parts.push(`退休延後 ${settings.retireDelayYears} 年`);
  }
  if (settings.mode === "contribution" || settings.mode === "mixed") {
    parts.push(`每月提撥提高 ${settings.contributionBoostPct.toFixed(0)}%`);
  }

  return parts.length
    ? `C 目前為「${modeLabel}」：${parts.join("、")}。`
    : "C 目前沒有啟用任何優化槓桿。";
}

function getReferenceWithdrawalRate(data = {}) {
  const strategy = data.strategy || {};
  const referenceRate = toFiniteNumber(strategy.referenceWithdrawalRate, NaN);
  if (Number.isFinite(referenceRate) && referenceRate > 0) return referenceRate;
  const fixedRate = toFiniteNumber(strategy.fixedWithdrawalRate, NaN);
  if (Number.isFinite(fixedRate) && fixedRate > 0) return fixedRate;
  return 4;
}

function getAnnualReviewEnabled(data = {}) {
  const strategy = data.strategy || {};
  if (typeof strategy.annualReviewEnabled === "boolean") return strategy.annualReviewEnabled;
  if (typeof data.annualReviewEnabled === "boolean") return data.annualReviewEnabled;
  return true;
}

function updateAnnualReviewStatusBadge(sourceData = null) {
  const badge = document.getElementById("annualReviewStatusBadge");
  if (!badge) return;
  const enabled = sourceData ? getAnnualReviewEnabled(sourceData) : document.getElementById("annualReviewEnabled")?.checked !== false;
  badge.textContent = enabled ? "年度重估：預設啟用" : "年度重估：目前停用";
}

function formatScenarioCInlineText(text) {
  const value = String(text || "").trim();
  if (!value) return "可調式優化";
  return value
    .replace(/^C\s*目前為「/, "")
    .replace(/^C\s*目前沒有啟用/, "沒有啟用")
    .replace(/」：/, "：")
    .replace(/[。．]+$/, "");
}

function buildScenarioComparisonSummaryText(scenarioComparisons) {
  const clientMode = isClientReportMode();
  const cScenario = (scenarioComparisons || []).find((scenario) => scenario.id === "C") || scenarioComparisons?.[2] || null;
  const cText = cScenario?.description || buildScenarioCSettingsSummary(lastRenderedRawData || getRawFormState());
  const cInlineText = formatScenarioCInlineText(cText);

  return clientMode
    ? `A 是目前基準，B 是保守壓力情境，C 是${cInlineText}。這一區重點是讓客戶看懂三種情境的差別。`
    : `A 是完全照目前輸入跑出來的基準版；B 是保守壓力情境，會把報酬調低、通膨調高，看在較不利假設下會掉多少；C 是${cInlineText}。`;
}

function buildScenarioChartExplainText(scenarioComparisons) {
  const clientMode = isClientReportMode();
  const cScenario = (scenarioComparisons || []).find((scenario) => scenario.id === "C") || scenarioComparisons?.[2] || null;
  const cText = cScenario?.description || buildScenarioCSettingsSummary(lastRenderedRawData || getRawFormState());
  const cInlineText = formatScenarioCInlineText(cText);

  return clientMode
    ? `A 是目前基準，B 是保守壓力情境，C 是${cInlineText}。這張圖的重點是看差距，而不是看誰被畫得比較漂亮。`
    : `C 目前採用${cInlineText}。這張圖的重點是看差距，而不是看誰被畫得比較漂亮。`;
}

function normalizeReportViewMode(value) {
  return value === REPORT_VIEW_MODES.client ? REPORT_VIEW_MODES.client : REPORT_VIEW_MODES.advisor;
}

function safeGetReportViewModeStorage() {
  try {
    return window.localStorage?.getItem(REPORT_VIEW_MODE_KEY) || "";
  } catch (error) {
    return "";
  }
}

function safeSetReportViewModeStorage(value) {
  try {
    window.localStorage?.setItem(REPORT_VIEW_MODE_KEY, value);
  } catch (error) {
    return false;
  }
  return true;
}

function getInitialReportViewMode() {
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get("view") || params.get("mode") || params.get("reportMode");
  if (urlMode) {
    return normalizeReportViewMode(urlMode);
  }
  const pathname = (window.location.pathname || "").toLowerCase();
  if (pathname.endsWith("/client.html") || pathname.endsWith("\\client.html") || pathname.endsWith("client.html")) {
    return REPORT_VIEW_MODES.client;
  }
  if (pathname.endsWith("/advisor.html") || pathname.endsWith("\\advisor.html") || pathname.endsWith("advisor.html")) {
    return REPORT_VIEW_MODES.advisor;
  }
  return normalizeReportViewMode(safeGetReportViewModeStorage());
}

function getReportViewMode() {
  return currentViewMode;
}

function isClientReportMode() {
  return currentViewMode === REPORT_VIEW_MODES.client;
}

function getReportViewModeLabel(mode = currentViewMode) {
  return normalizeReportViewMode(mode) === REPORT_VIEW_MODES.client ? "客戶版" : "顧問版";
}

function setReportViewMode(mode, options = {}) {
  const normalizedMode = normalizeReportViewMode(mode);
  const persist = options.persist !== false;

  currentViewMode = normalizedMode;

  document.title = normalizedMode === REPORT_VIEW_MODES.client
    ? "退休規劃顧問版試算器V2｜客戶版"
    : "退休規劃顧問版試算器V2｜顧問版";

  syncReportModeLabels(normalizedMode);

  if (document.body) {
    document.body.dataset.reportViewMode = normalizedMode;
  }

  if (persist) {
    safeSetReportViewModeStorage(normalizedMode);
  }

  return normalizedMode;
}

function syncReportModeLabels(mode = currentViewMode) {
  const normalizedMode = normalizeReportViewMode(mode);
  const isClient = normalizedMode === REPORT_VIEW_MODES.client;

  const pageMainTitle = document.getElementById("pageMainTitle");
  if (pageMainTitle) {
    pageMainTitle.innerHTML = isClient
      ? "<span>退休規劃</span> 客戶版報表 V2"
      : "<span>退休規劃</span> 顧問版系統 V2";
  }

  const reportPageTitle = document.getElementById("reportPageTitle");
  if (reportPageTitle) {
    reportPageTitle.textContent = isClient ? "退休規劃客戶報表 V2" : "退休規劃顧問報告 V2";
  }

  const printPageTitle = document.getElementById("printPageTitle");
  if (printPageTitle) {
    printPageTitle.textContent = isClient ? "退休規劃客戶報表 V2" : "退休規劃顧問報告 V2";
  }
}

function initializeReportViewMode() {
  setReportViewMode(getInitialReportViewMode(), { persist: false });
}

function applyReportViewModeVisibility(mode = currentViewMode) {
  const normalizedMode = normalizeReportViewMode(mode);
  if (document.body) {
    document.body.dataset.reportViewMode = normalizedMode;
  }

  const homeSection = document.getElementById("homeSection");
  const reportSection = document.getElementById("reportSection");

  if (homeSection) {
    homeSection.classList.toggle("hidden", normalizedMode === REPORT_VIEW_MODES.client);
  }
  if (reportSection && normalizedMode === REPORT_VIEW_MODES.client) {
    reportSection.classList.remove("hidden");
  }

  if (normalizedMode !== REPORT_VIEW_MODES.client) {
    return;
  }

  const visibleIds = new Set(CLIENT_REPORT_VISIBLE_BLOCK_IDS);
  REPORT_BLOCK_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = visibleIds.has(id) ? "" : "none";
    }
  });
}

function renderReportByMode(data, projection, evaluation, scenarioComparisons, mcResults) {
  if (isClientReportMode()) {
    renderClientReport(data, projection, evaluation, scenarioComparisons, mcResults);
    return;
  }

  renderAdvisorReport(data, projection, evaluation, scenarioComparisons, mcResults);
}

function renderClientEmptyState() {
  const reportSection = document.getElementById("reportSection");
  const homeSection = document.getElementById("homeSection");

  if (homeSection) {
    homeSection.classList.add("hidden");
  }
  if (reportSection) {
    reportSection.classList.remove("hidden");
  }

  const visibleIds = new Set(CLIENT_REPORT_VISIBLE_BLOCK_IDS);
  REPORT_BLOCK_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = visibleIds.has(id) ? "" : "none";
    }
  });

  document.getElementById("printMeta").innerHTML = `
    <strong>客戶版報表尚未載入案件</strong><br>
    請先到 <a href="advisor.html">顧問版</a> 完成規劃並儲存資料，或使用含有 <code>data=</code> 參數的分享連結重新開啟這個頁面。
  `;

  document.getElementById("reportSummary").innerHTML = `
    <strong>目前沒有可顯示的客戶報表</strong><br>
    這個頁面是給客戶看的摘要版；請先回到顧問版建立案件、輸入資料並執行試算，讓系統先產出報表快照，再回到這個頁面查看。
  `;

  document.getElementById("result").innerHTML = `
    <div class="result-title">客戶結論</div>
    目前還沒有已載入的案件結果。請先在顧問版產出報表快照，再開啟客戶版。
  `;
}

function applyClientReportDefaults() {
  setChecked("showInputSummary", false);
  setChecked("showAdvisorAdvice", false);
  setChecked("showMonteCarloSummary", true);
  setChecked("showLogicSteps", false);
  setChecked("showPreChart", false);
  setChecked("showPostChart", false);
  setChecked("showScenarioChart", true);
  setChecked("showMonteCarloChart", true);
}

function bootstrapClientPage(hasUrlData = false) {
  applyReportViewModeVisibility(REPORT_VIEW_MODES.client);

  const savedDataRaw = !hasUrlData ? localStorage.getItem(STORAGE_KEY) : "";
  if (!hasUrlData && savedDataRaw) {
    try {
      hydrateForm(JSON.parse(savedDataRaw));
    } catch (error) {
      console.error("客戶版自動載入失敗", error);
      showPageNotice("客戶版自動載入失敗，請改用顧問版重新儲存後再開啟。", "error");
      renderClientEmptyState();
      return;
    }
  }

  const reportCache = getAdvisorReportCacheForRawData(getFormData());
  if (reportCache && renderClientReportFromCache(reportCache)) {
    return;
  }

  renderClientEmptyState();
  if (hasUrlData || savedDataRaw) {
    showPageNotice("目前找不到對應的顧問版報表快照，請先回顧問版產出結果後再開啟客戶版。", "warn");
  }
}

const FIELD_HELP_TEXTS = Object.freeze({
  "案件名稱": "這是這個規劃案件的名字，方便日後找版本或比對方案。",
  "客戶名稱 / 家庭識別": "這是這個家庭或客戶的識別名稱，方便你在多個案件中辨認。",
  "版本名稱": "這是這次輸入的版本標記，方便和其他版本做比較。",
  "基準版本": "這是這次拿來對照的舊版本或原始版本。",
  "報告日期": "這份報告是在哪一天產生的，系統會以這一天作為快照時間。",
  "顧問名稱": "負責這份規劃的人或顧問名稱。",
  "顧問觀點 / 本次假設說明": "把這次規劃先採用的判斷與假設寫在這裡，方便日後回頭看。",
  "家庭模式": "選擇單人或夫妻規劃，會影響之後的時間軸與收入支出計算。",
  "目前年齡": "這個人的現在年齡，系統會拿來排年度現金流。",
  "預計退休年齡": "預計幾歲開始不靠工作收入生活。",
  "預期壽命": "這次規劃預計要算到幾歲，通常會比退休年齡更晚。",
  "健康狀態": "這個人的健康風險概況，會影響長照與壽命假設。",
  "姓名": "這是這筆資料所屬的名字，方便辨認。",
  "所有人": "這筆資料屬於本人、配偶，還是共同持有。",
  "所有權人": "這筆資產屬於本人、配偶，還是共同持有。",
  "帳戶名稱": "這筆帳戶的名稱，方便你辨認是哪一筆資產。",
  "資產名稱": "這筆資產的名稱，方便你辨認是哪一筆資產。",
  "帳戶類型": "這筆帳戶屬於現金、投資、退休帳戶，還是保單帳戶。",
  "主要靠什麼": "這筆帳戶主要看成長、現金收益，或兩者都有。",
  "資產類型": "請選這筆資產主要屬於成長型、收益型，或平衡型。",
  "目前餘額": "這筆帳戶現在有多少錢或市值。",
  "退休前處理": "退休前這筆帳戶的收益要再投入，還是先轉成現金。",
  "退休後處理": "退休後這筆帳戶要先領收益、直接賣單位，還是繼續再投入。",
  "總報酬率 %": "這是資產一整年的總報酬假設，包含價值成長與可能的分配。",
  "現金收益率 %": "這筆資產每年能拿到多少現金分配。",
  "價格成長率 %": "這筆資產本身每年大約成長多少。",
  "年化波動度 %": "這筆資產每年報酬上下擺動的幅度，用來做壓測。",
  "提領順序": "退休後多筆帳戶都能用時，數字越小就越先被提領。",
  "最低保留金額": "這筆帳戶退休時至少要留下多少，不會全領光。",
  "房產名稱": "這間房子的名稱，方便你分辨自住、出租或其他房產。",
  "房產類型": "這間房子是自住、出租，還是其他用途。",
  "房產估值": "這間房子目前大約值多少錢。",
  "房產模式": "決定這間房子是只看淨值、指定出售，還是不納入退休池。",
  "房價年增值率 %": "這間房子每年大約增值多少。",
  "將房產列入退休資金池": "勾選後，這筆房產淨值會當成退休可動用資金。",
  "出售年齡": "如果這間房子要出售，預計幾歲賣出。",
  "出售成本率 %": "賣房時要扣掉多少交易成本。",
  "可納入退休的房產淨值": "真正能算進退休可動用資金的房產淨值。",
  "退休可提領資產": "退休後真的可以拿來生活提領的資產。",
  "家庭淨值": "把資產減掉負債後的整體家底。",
  "現金與活存": "可立即動用的現金與活期存款。",
  "投資帳戶": "放股票、ETF、基金等投資資產的地方。",
  "退休帳戶 / 保單帳戶": "放退休金、保單現金價值等比較偏長期的資產。",
  "年收入合計": "目前所有收入加總後的年金額。",
  "年支出合計": "目前所有支出加總後的年金額。",
  "年儲蓄 / 可投資現金流": "收入扣掉支出後，理論上可以拿來投資的金額。",
  "年稅額": "這一年預估要繳的稅。",
  "年保費": "這一年所有保險保費加總的金額。",
  "年債務服務": "這一年所有債務還款加總的金額。",
  "自然年度淨餘": "在不做手動校正前，系統自然算出來的年度剩餘金額。",
  "年度可投資金額": "這一年實際可拿去投資或累積的金額。",
  "投入口徑": "這筆可投資金額是用自然淨餘推導，還是手動校正值。",
  "override 差額": "手動校正投入和系統自然推導值之間的差距。",
  "每月持續投入": "每月額外預計投入到投資帳戶的金額。",
  "改用手動校正投入覆蓋系統推導值": "勾選後，系統推導的可投資金額會被這個手動值取代。",
  "每月保費 / 月": "每個月要繳的保費金額。",
  "每月還款": "每個月要還的債務金額。",
  "必要生活支出 / 月": "每個月固定一定要花掉的生活費。",
  "彈性生活支出 / 月": "每個月可彈性調整的休閒、旅遊、享受型支出。",
  "醫療支出 / 月": "每個月預估的醫療花費。",
  "照護支出 / 月": "每個月預估的照護花費。",
  "收入名稱": "這筆收入的名稱，方便你辨認是薪資、獎金、租金或其他收入。",
  "收入類型": "這筆收入屬於哪一類，系統會依類型用不同算法。",
  "發生年齡（填該所有人的年齡）": "這筆收入從這個人幾歲開始出現。",
  "型態": "這筆收入或支出是每月重複，還是一次性發生。",
  "金額": "這筆收入、支出或事件的金額。",
  "持續年數": "這筆收入或支出要持續幾年。",
  "隨通膨調整": "勾選後，這筆金額會跟著通膨一起成長。",
  "年成長率 %": "這筆收入每年預估成長多少。",
  "事件名稱": "這個目標事件的名稱，方便辨認是換屋、旅遊還是傳承。",
  "類別": "這個目標事件屬於房產、照護、家庭支援、旅遊、傳承或自訂。",
  "負債類型": "這筆負債屬於房貸、信貸、車貸、保單借款或其他。",
  "負債模式": "這筆負債是正常攤還，還是到某個年齡一次清償。",
  "連動房產": "這筆負債對應到哪一間房子。",
  "餘額": "這筆負債目前還剩多少要還。",
  "年利率 %": "這筆負債每年的利率。",
  "清償年齡（以本人年齡）": "這筆負債預計在本人幾歲時還清。",
  "提前清償年齡": "如果要提前還清，系統會在幾歲一次清掉。",
  "提前清償金額": "提前還清時要一次拿出多少錢。",
  "提領策略預設": "退休後預設要用哪一種提領方法。",
  "參考提領率 %": "這是可調的參考線，預設 4%，不是硬性答案。",
  "固定提領率 %": "退休後每年固定從資產中提領的比例，每年仍會回頭重估一次。",
  "最低支出比例 %": "Guardrail 的收縮底線。市場轉弱時，彈性支出至少收斂到這個比例。",
  "最高支出比例 %": "Guardrail 的放寬上限。市場轉強時，彈性支出最多放寬到這個比例。",
  "是否啟用 LTC 溢價假設": "勾選後會把長照期的額外支出放進模型。",
  "LTC 起始年齡": "長照假設從幾歲開始。",
  "LTC 持續年數": "長照假設要持續幾年。",
  "LTC 溢價倍數": "進入長照期後，支出要放大的倍數。",
  "啟用 Monte Carlo": "勾選後會開始跑隨機情境壓測。",
  "啟用彈性支出調整": "勾選後，旅遊、醫療、照護等彈性支出會在壓測中跟著浮動。",
  "模擬次數": "Monte Carlo 要跑幾次路徑。",
  "加入通膨波動": "勾選後，通膨率也會在壓測中隨機變動。",
  "通膨波動度 %": "通膨率每年上下波動的幅度。",
  "支出彈性波動度 %": "旅遊、醫療、照護等彈性支出在壓測中的波動幅度。",
  "一般通膨率 %": "日常物價每年平均上漲多少。",
  "醫療通膨率 %": "醫療支出每年平均上漲多少。",
  "退休前年報酬率 %": "退休前資產每年的報酬假設。",
  "退休後年報酬率 %": "退休後資產每年的報酬假設。",
  "勞務收入有效稅率 %": "薪資、獎金、工作收入大約要課多少稅。",
  "被動收入有效稅率 %": "租金、利息、股利等被動收入大約要課多少稅。",
  "給付收入有效稅率 %": "勞保、勞退、年金等給付大約要課多少稅。",
  "流動性月數": "目前現金和活存大約可以撐幾個月必要支出。",
  "被動收入合計": "目前所有被動收入加總後的年金額。",
  "被動收入占比": "被動收入占整體收入的比例。",
  "被動收入覆蓋率": "被動收入大約可以覆蓋多少家庭支出。",
  "儲蓄率": "收入扣掉支出後，能留下來儲蓄的比例。",
  "固定提領率 %": "退休後每年固定提領資產的比例，每年仍會回頭重估一次。",
  "年化波動度 %": "資產報酬每年上下擺動的程度。",
  "顯示原始輸入摘要": "把你在表單輸入的重點先整理給你看。",
  "顯示運算邏輯": "把系統怎麼算這些數字講成白話。",
  "顯示顧問備註": "把顧問備註一起顯示出來。",
  "退休前資產圖": "顯示退休前資產如何累積的走勢圖。",
  "退休後資產圖": "顯示退休後提領後的資產變化圖。",
  "A/B/C 方案比較圖": "顯示三個情境方案的資產比較圖。",
  "Monte Carlo 路徑圖": "顯示隨機壓測的 P10 / P50 / P90 路徑。",
  "Monte Carlo 摘要": "把壓測結果濃縮成容易閱讀的摘要。",
  "優化模式": "選擇方案 C 要優先調整哪一個可控假設。",
  "報酬率加幅 %": "方案 C 在報酬率優化時，要額外提高多少年報酬。",
  "延後退休年數": "方案 C 在延後退休優化時，要把退休年齡往後延幾年。",
  "提撥加幅 %": "方案 C 在提高提撥優化時，每月投入要比目前多多少百分比。",
  "資產名稱": "這筆資產的名稱，方便你辨認是哪一筆資產。",
  "帳戶名稱": "這筆帳戶的名稱，方便你辨認是哪一筆資產。",
  "房產模式": "決定這間房子是只看淨值、指定出售，還是不納入退休池。",
  "房產類型": "這間房子是自住、出租，還是其他用途。",
  "將房產列入退休資金池": "勾選後，這筆房產淨值會當成退休可動用資金。",
  "投資帳戶": "放股票、ETF、基金等投資資產的地方。",
  "退休帳戶 / 保單帳戶": "放退休金、保單現金價值等比較偏長期的資產。"
});

function normalizeFieldHelpText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/[：:]\s*$/, "")
    .trim();
}

function buildGenericFieldHelpText(labelText) {
  const text = normalizeFieldHelpText(labelText);
  if (!text) return "這個欄位用來填寫對應資料，請依你的實際情況輸入。";

  if (FIELD_HELP_TEXTS[text]) return FIELD_HELP_TEXTS[text];

  if (text.includes("年齡")) {
    return "這裡填年齡，系統會拿來排時間軸或判斷事件何時發生。";
  }
  if (text.includes("年數") || text.includes("持續")) {
    return "這裡填持續多久，系統會用它展開年度現金流。";
  }
  if (text.includes("所有人") || text.includes("所有權人")) {
    return "這筆資料屬於本人、配偶，還是共同持有。";
  }
  if (text.includes("名稱") || text.includes("姓名")) {
    return "這是辨識用名稱，方便你之後看報表或比對版本。";
  }
  if (text.includes("資產類型")) {
    return "請選成長型、收益型，或平衡型，這會影響系統怎麼估算報酬。";
  }
  if (text.includes("類型") || text.includes("類別") || text.includes("型態") || text.includes("模式") || text.includes("處理")) {
    return "這裡是選擇這筆資料的處理方式，會影響後續計算。";
  }
  if (text.includes("合計")) {
    return "這是同類項目的總和。";
  }
  if (text.includes("摘要")) {
    return "這是把主要數字濃縮後的摘要。";
  }
  if (text.includes("圖")) {
    return "這張圖用來看趨勢與比較。";
  }
  if (text.includes("啟用") || text.startsWith("顯示")) {
    return "勾選後這個設定才會生效或顯示。";
  }
  if (text.includes("%") || text.includes("率")) {
    return "這是百分比欄位，請直接填數字，例如 5 代表 5%。";
  }
  if (text.includes("金額") || text.includes("餘額") || text.includes("保費") || text.includes("支出") || text.includes("收入")) {
    return "這是金額欄位，請填入實際金額。";
  }

  return `這是「${text}」欄位，請依你的實際資料填寫。`;
}

function decorateFieldHelpLabel(label) {
  if (!label || label.dataset.helpEnhanced === "true") return;
  const rawText = normalizeFieldHelpText(label.textContent);
  const helpText = buildGenericFieldHelpText(rawText);
  if (!helpText) return;

  label.dataset.helpEnhanced = "true";
  label.dataset.helpLabel = rawText;
  label.classList.add("field-help-enabled");

  const anchor = document.createElement("span");
  anchor.className = "field-help-anchor";

  const trigger = document.createElement("span");
  trigger.className = "field-help-trigger";
  trigger.textContent = "i";
  trigger.setAttribute("aria-hidden", "true");

  const bubble = document.createElement("span");
  bubble.className = "field-help-bubble";
  bubble.textContent = helpText;

  anchor.append(trigger, bubble);
  label.appendChild(anchor);
}

function decorateFieldHelpLabels(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("label").forEach((label) => decorateFieldHelpLabel(label));
}

let fieldHelpObserver = null;

function ensureFieldHelpObserver() {
  if (fieldHelpObserver || !document.body) return;
  fieldHelpObserver = new MutationObserver((mutations) => {
    const pending = new Set();
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.("label")) pending.add(node);
        node.querySelectorAll?.("label").forEach((label) => pending.add(label));
      }
    }
    pending.forEach((label) => decorateFieldHelpLabel(label));
  });
  fieldHelpObserver.observe(document.body, { childList: true, subtree: true });
}

function attachLiveSnapshotListeners() {
  if (document.body.dataset.snapshotListenersAttached === "true") return;
  document.body.dataset.snapshotListenersAttached = "true";

  const handler = (event) => {
    if (!event.target?.closest("#homeSection")) return;
    if (
      ["propertyAssets", "propertyName", "propertyType", "propertyGrowthRate", "propertyFundingMode", "propertySaleAge", "propertySaleCostRate"].includes(event.target.id) ||
      event.target.closest("#incomeContainer") ||
      event.target.closest("#liabilityContainer") ||
      event.target.closest("#accountContainer")
    ) {
      if (event.target.closest("#incomeContainer")) refreshAllIncomeRows();
      refreshAllAccountRows();
      refreshStep3DerivedPanels();
    }
    if (event.target?.id === "annualReviewEnabled") {
      updateAnnualReviewStatusBadge();
      generateSummary();
    }
    scheduleCurrentSnapshotRefresh();
  };

  document.addEventListener("input", handler, true);
  document.addEventListener("change", handler, true);
}

function scheduleCurrentSnapshotRefresh() {
  if (currentSnapshotRefreshHandle !== null) {
    window.cancelAnimationFrame(currentSnapshotRefreshHandle);
  }

  currentSnapshotRefreshHandle = window.requestAnimationFrame(() => {
    currentSnapshotRefreshHandle = null;
    refreshCurrentSnapshot();
  });
}

function removeDynamicRow(button) {
  const row = button?.closest(".account-row, .liability-row, .event-row");
  if (row) {
    const isIncomeRow = row.closest("#incomeContainer") !== null;
    row.remove();
    if (isIncomeRow) refreshAllIncomeRows();
    if (row.classList.contains("account-row")) refreshAllAccountRows();
    if (row.classList.contains("liability-row")) refreshAllLiabilityRows();
    scheduleCurrentSnapshotRefresh();
  }
}

function destroyCharts() {
  Object.keys(chartInstances).forEach((key) => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
  });
}

let pageNoticeTimer = null;

function showPageNotice(message, type = "info") {
  if (!message) return;

  let notice = document.getElementById("pageNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "pageNotice";
    notice.className = "no-print";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    document.body.appendChild(notice);
  }

  const palette = type === "error"
    ? { background: "#fff1f0", border: "#f5b5ae", color: "#8a1f17" }
    : { background: "#eef8f2", border: "#a8d8b7", color: "#155b2a" };

  Object.assign(notice.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "9999",
    maxWidth: "340px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    boxShadow: "0 12px 28px rgba(0,0,0,.18)",
    fontSize: "14px",
    lineHeight: "1.5",
    opacity: "1",
    transition: "opacity 180ms ease"
  });

  notice.textContent = message;
  if (pageNoticeTimer) window.clearTimeout(pageNoticeTimer);

  pageNoticeTimer = window.setTimeout(() => {
    notice.style.opacity = "0";
    window.setTimeout(() => {
      if (notice.parentNode) notice.parentNode.removeChild(notice);
    }, 180);
  }, 2600);
}

function toggleAccordion(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle("open");
  panel.style.display = panel.classList.contains("open") ? "block" : "none";
}

function goToStep(step, options = {}) {
  const { skipValidation = false } = options;
  if (step < 1 || step > totalSteps) return;

  if (!skipValidation && step > currentStep) {
    for (let pendingStep = currentStep; pendingStep < step; pendingStep++) {
      if (!validateStep(pendingStep)) return;
    }
  }

  document.querySelectorAll(".wizard-panel").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`panel${step}`).classList.add("active");

  document.querySelectorAll(".wp-step").forEach((element, index) => {
    const stepNum = index + 1;
    if (stepNum < step) {
      element.classList.add("done");
      element.classList.remove("active");
    } else if (stepNum === step) {
      element.classList.add("active");
      element.classList.remove("done");
    } else {
      element.classList.remove("active", "done");
    }
  });

  currentStep = step;
  if (step === 5) generateSummary();
}

function updateWizardUI() {
  goToStep(currentStep, { skipValidation: true });
}

function nextStep(step) {
  if (validateStep(step)) goToStep(step + 1, { skipValidation: true });
}

function prevStep(step) {
  goToStep(step - 1, { skipValidation: true });
}

function resetWizard() {
  destroyCharts();
  document.getElementById("reportSection").classList.add("hidden");
  document.getElementById("homeSection").classList.remove("hidden");
  document.getElementById("shareBox").classList.add("hidden");
  goToStep(1, { skipValidation: true });
  window.scrollTo(0, 0);
}

function getCurrentHouseholdMode() {
  return document.getElementById("householdMode").value === "couple" ? "couple" : "single";
}

function buildOwnerOptionsHtml(selectedValue = "household", allowSpouse = false) {
  const options = [
    { value: "self", label: "本人" },
    ...(allowSpouse ? [{ value: "spouse", label: "配偶" }] : []),
    { value: "household", label: "家庭共同" }
  ];

  return options.map((option) => (
    `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`
  )).join("");
}

function buildAccountOwnerOptionsHtml(selectedValue = "joint", allowSpouse = false) {
  const options = [
    { value: "self", label: "本人" },
    ...(allowSpouse ? [{ value: "spouse", label: "配偶" }] : []),
    { value: "joint", label: "家庭共同" }
  ];

  return options.map((option) => (
    `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`
  )).join("");
}

function getAccountTypeLabel(type) {
  if (type === "taxable") return "投資帳戶";
  if (type === "retirement") return "退休帳戶";
  if (type === "insurance") return "保單帳戶";
  return "現金帳戶";
}

function getAccountDriverLabel(driver) {
  if (driver === "income") return "收益型";
  if (driver === "mixed") return "平衡型";
  return "成長型";
}

function getAccountOwnerLabel(owner) {
  if (owner === "self") return "本人";
  if (owner === "spouse") return "配偶";
  return "家庭共同";
}

function getAccountPrePolicyLabel(policy) {
  if (policy === "distribution_to_cash") return "收益轉現金";
  return "再投入";
}

function getAccountPostPolicyLabel(policy) {
  if (policy === "distribution_first_then_sell") return "先領收益，不足再賣";
  if (policy === "distribution_to_cash") return "收益直接轉現金";
  if (policy === "reinvest") return "繼續再投入";
  return "只賣單位";
}

function handleHouseholdModeChange() {
  const mode = getCurrentHouseholdMode();
  const spouseFields = document.getElementById("spouseFields");
  if (spouseFields) spouseFields.classList.toggle("hidden", mode !== "couple");

  document.querySelectorAll(".owner-select").forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = buildOwnerOptionsHtml(currentValue, mode === "couple");
    if (mode !== "couple" && currentValue === "spouse") {
      select.value = "household";
    }
  });

  document.querySelectorAll(".a-owner").forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = buildAccountOwnerOptionsHtml(currentValue === "spouse" && mode !== "couple" ? "joint" : currentValue, mode === "couple");
    if (mode !== "couple" && currentValue === "spouse") {
      select.value = "joint";
    }
  });

  generateSummary();
  scheduleCurrentSnapshotRefresh();
}

function handleWithdrawalStrategyChange() {
  const strategy = document.getElementById("withdrawalStrategy").value;
  document.getElementById("fixedRatePanel").classList.toggle("hidden", strategy !== "fixed_rate");
  document.getElementById("guardrailPanel").classList.toggle("hidden", strategy !== "guardrail");
  document.getElementById("bucketPanel")?.classList.toggle("hidden", strategy !== "bucket");
  generateSummary();
  scheduleCurrentSnapshotRefresh();
}

function getPropertyTypeLabel(type) {
  if (type === "rental") return "出租房";
  if (type === "other") return "其他房產";
  return "自住房";
}

function buildDefaultAccountRowsFromBuckets(data = {}) {
  return [
    {
      id: "cash-bucket",
      name: "現金帳戶",
      owner: "joint",
      accountType: "cash",
      assetStyle: "balanced",
      openingBalance: Number.isFinite(Number(data.cashAssets)) ? Number(data.cashAssets) : 500000,
      uiPrimaryDriver: "income",
      preRetirementPolicy: "distribution_to_cash",
      postRetirementPolicy: "distribution_to_cash",
      totalReturnRate: 0,
      cashYieldRate: 0,
      priceGrowthRate: 0,
      withdrawalPriority: 1,
      minimumReserve: 0,
      bucketRole: "bucket1_cash"
    },
    {
      id: "investment-bucket",
      name: "投資帳戶",
      owner: "joint",
      accountType: "taxable",
      assetStyle: "growth",
      openingBalance: Number.isFinite(Number(data.investmentAssets)) ? Number(data.investmentAssets) : 1000000,
      uiPrimaryDriver: "growth",
      preRetirementPolicy: "reinvest",
      postRetirementPolicy: "sell_only",
      totalReturnRate: Number.isFinite(Number(data.returnRate)) ? Number(data.returnRate) : 5,
      cashYieldRate: 0,
      priceGrowthRate: 0,
      withdrawalPriority: 2,
      minimumReserve: 0,
      bucketRole: "bucket3_growth"
    },
    {
      id: "retirement-bucket",
      name: "退休帳戶",
      owner: "joint",
      accountType: "retirement",
      assetStyle: "balanced",
      openingBalance: Number.isFinite(Number(data.retirementAssets)) ? Number(data.retirementAssets) : 500000,
      uiPrimaryDriver: "mixed",
      preRetirementPolicy: "reinvest",
      postRetirementPolicy: "distribution_first_then_sell",
      totalReturnRate: 0,
      cashYieldRate: 0,
      priceGrowthRate: Number.isFinite(Number(data.postReturnRate)) ? Number(data.postReturnRate) : 2,
      withdrawalPriority: 3,
      minimumReserve: 0,
      bucketRole: "bucket2_bond"
    }
  ];
}

function buildAccountLogicText(account) {
  const driver = account.uiPrimaryDriver || "growth";
  const openingBalance = toFiniteNumber(account.openingBalance, 0);
  const totalReturnRate = toFiniteNumber(account.totalReturnRate, 0);
  const cashYieldRate = toFiniteNumber(account.cashYieldRate, 0);
  const priceGrowthRate = toFiniteNumber(account.priceGrowthRate, 0);
  const prePolicy = account.preRetirementPolicy || "reinvest";
  const postPolicy = account.postRetirementPolicy || "sell_only";
  const reserve = toFiniteNumber(account.minimumReserve, 0);

  if (driver === "growth") {
    return `${account.name || "此帳戶"} 視為${getAccountTypeLabel(account.accountType)}，主要靠成長型報酬。起始餘額 ${formatCurrency(openingBalance)}，總報酬率 ${formatPercent(totalReturnRate)}。退休前採 ${prePolicy === "reinvest" ? "再投入" : "轉現金"}，退休後採 ${postPolicy === "sell_only" ? "賣單位支領" : "再投入"}，最低保留 ${formatCurrency(reserve)}。`;
  }

  return `${account.name || "此帳戶"} 視為${getAccountTypeLabel(account.accountType)}，主要靠收益型報酬與成長型報酬。起始餘額 ${formatCurrency(openingBalance)}，現金收益率 ${formatPercent(cashYieldRate)}，價格成長率 ${formatPercent(priceGrowthRate)}。退休前採 ${prePolicy === "distribution_to_cash" ? "收益轉現金" : "收益再投入"}，退休後採 ${postPolicy === "distribution_first_then_sell" ? "先領收益，不足再賣單位" : postPolicy === "distribution_to_cash" ? "收益直接轉現金" : postPolicy === "sell_only" ? "收益留存、缺口再賣單位" : "收益再投入"}，最低保留 ${formatCurrency(reserve)}。`;
}

function refreshAccountRow(row) {
  if (!row) return;

  const driverSelect = row.querySelector(".a-driver");
  const prePolicySelect = row.querySelector(".a-pre-policy");
  const postPolicySelect = row.querySelector(".a-post-policy");
  const totalReturnWrap = row.querySelector(".a-total-return-wrap");
  const yieldWrap = row.querySelector(".a-cash-yield-wrap");
  const growthWrap = row.querySelector(".a-price-growth-wrap");
  const logicText = row.querySelector(".account-logic-text");
  const driver = driverSelect?.value || "growth";

  if (totalReturnWrap) totalReturnWrap.classList.toggle("hidden", driver !== "growth");
  if (yieldWrap) yieldWrap.classList.toggle("hidden", driver === "growth");
  if (growthWrap) growthWrap.classList.toggle("hidden", driver === "growth");

  if (prePolicySelect && driver === "growth" && prePolicySelect.value !== "reinvest") {
    prePolicySelect.value = "reinvest";
  }

  if (postPolicySelect) {
    const allowedGrowthPolicies = new Set(["sell_only", "reinvest"]);
    if (driver === "growth" && !allowedGrowthPolicies.has(postPolicySelect.value)) {
      postPolicySelect.value = "sell_only";
    }
  }

  if (logicText) {
    logicText.textContent = buildAccountLogicText({
      name: row.querySelector(".a-name")?.value.trim(),
      accountType: row.querySelector(".a-type")?.value || "taxable",
      openingBalance: row.querySelector(".a-balance")?.value,
      uiPrimaryDriver: driver,
      totalReturnRate: row.querySelector(".a-total-return-rate")?.value,
      cashYieldRate: row.querySelector(".a-cash-yield-rate")?.value,
      priceGrowthRate: row.querySelector(".a-price-growth-rate")?.value,
      preRetirementPolicy: prePolicySelect?.value || "reinvest",
      postRetirementPolicy: postPolicySelect?.value || "sell_only",
      minimumReserve: row.querySelector(".a-minimum-reserve")?.value
    });

  }
}

function refreshAllAccountRows() {
  Array.from(document.querySelectorAll("#accountContainer .account-row")).forEach((row) => refreshAccountRow(row));
}

function addAccount(data = {}) {
  const container = document.getElementById("accountContainer");
  if (!container) return;

  const allowSpouse = getCurrentHouseholdMode() === "couple";
  const div = document.createElement("div");
  div.className = "income-box account-row";
  div.dataset.accountId = data.id || data.accountId || data.account_id || "";

  const selectedOwner = data.owner || "joint";
  const selectedType = data.accountType || data.account_type || "taxable";
  const selectedDriver = data.uiPrimaryDriver || data.ui_primary_driver || (selectedType === "cash" ? "income" : "growth");
  const selectedPrePolicy = data.preRetirementPolicy || data.pre_retirement_policy || (selectedDriver === "growth" ? "reinvest" : "distribution_to_cash");
  const selectedPostPolicy = data.postRetirementPolicy || data.post_retirement_policy || (selectedDriver === "growth" ? "sell_only" : "distribution_first_then_sell");
  const selectedBucketRole = data.bucketRole || data.bucket_role || (selectedType === "cash" ? "bucket1_cash" : (selectedDriver === "growth" ? "bucket3_growth" : "bucket2_bond"));

  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title" style="color:var(--teal);">帳戶明細</div>
      <button type="button" class="remove-btn" onclick="removeDynamicRow(this)">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>資產名稱</label>
        <input type="text" class="a-name" value="${escapeAttr(data.name || data.account_name || "")}" placeholder="例如：高股息 ETF / 海外券商 / MMF">
      </div>
      <div>
        <label>所有權人</label>
        <select class="a-owner">${buildAccountOwnerOptionsHtml(selectedOwner, allowSpouse)}</select>
      </div>
      <div>
        <label>帳戶類型</label>
        <select class="a-type">
          <option value="cash" ${selectedType === "cash" ? "selected" : ""}>現金帳戶</option>
          <option value="taxable" ${selectedType === "taxable" ? "selected" : ""}>投資帳戶</option>
          <option value="retirement" ${selectedType === "retirement" ? "selected" : ""}>退休帳戶</option>
          <option value="insurance" ${selectedType === "insurance" ? "selected" : ""}>保單帳戶</option>
        </select>
      </div>
      <div>
        <label>目前餘額</label>
        <input type="number" class="a-balance" value="${Number.isFinite(Number(data.openingBalance ?? data.opening_balance)) ? Number(data.openingBalance ?? data.opening_balance) : 0}">
      </div>
      <div>
        <label>資產類型</label>
        <select class="a-driver">
          <option value="growth" ${selectedDriver === "growth" ? "selected" : ""}>成長型</option>
          <option value="income" ${selectedDriver === "income" ? "selected" : ""}>收益型</option>
          <option value="mixed" ${selectedDriver === "mixed" ? "selected" : ""}>平衡型</option>
        </select>
      </div>
      <div>
        <label>退休前處理</label>
        <select class="a-pre-policy">
          <option value="reinvest" ${selectedPrePolicy === "reinvest" ? "selected" : ""}>再投入</option>
          <option value="distribution_to_cash" ${selectedPrePolicy === "distribution_to_cash" ? "selected" : ""}>收益轉現金</option>
        </select>
      </div>
      <div>
        <label>退休後處理</label>
        <select class="a-post-policy">
          <option value="sell_only" ${selectedPostPolicy === "sell_only" ? "selected" : ""}>只賣單位</option>
          <option value="distribution_first_then_sell" ${selectedPostPolicy === "distribution_first_then_sell" ? "selected" : ""}>先領收益，不夠再賣</option>
          <option value="distribution_to_cash" ${selectedPostPolicy === "distribution_to_cash" ? "selected" : ""}>收益直接轉現金</option>
          <option value="reinvest" ${selectedPostPolicy === "reinvest" ? "selected" : ""}>繼續再投入</option>
        </select>
      </div>
      <div class="a-total-return-wrap">
        <label>總報酬率 %</label>
        <input type="number" class="a-total-return-rate" value="${Number.isFinite(Number(data.totalReturnRate ?? data.total_return_rate)) ? Number(data.totalReturnRate ?? data.total_return_rate) : 0}" step="0.1">
      </div>
      <div class="a-cash-yield-wrap">
        <label>現金收益率 %</label>
        <input type="number" class="a-cash-yield-rate" value="${Number.isFinite(Number(data.cashYieldRate ?? data.cash_yield_rate)) ? Number(data.cashYieldRate ?? data.cash_yield_rate) : 0}" step="0.1">
      </div>
      <div class="a-price-growth-wrap">
        <label>價格成長率 %</label>
        <input type="number" class="a-price-growth-rate" value="${Number.isFinite(Number(data.priceGrowthRate ?? data.price_growth_rate)) ? Number(data.priceGrowthRate ?? data.price_growth_rate) : 0}" step="0.1">
      </div>
      <div>
        <label>桶別（三桶金策略用）</label>
        <select class="a-bucket-role">
          <option value="bucket1_cash" ${selectedBucketRole === "bucket1_cash" ? "selected" : ""}>現金桶</option>
          <option value="bucket2_bond" ${selectedBucketRole === "bucket2_bond" ? "selected" : ""}>債券桶</option>
          <option value="bucket3_growth" ${selectedBucketRole === "bucket3_growth" ? "selected" : ""}>成長桶</option>
          <option value="none" ${selectedBucketRole === "none" ? "selected" : ""}>不分桶</option>
        </select>
      </div>
      <div>
        <label>提領順序</label>
        <input type="number" class="a-withdrawal-priority" value="${Number.isFinite(Number(data.withdrawalPriority ?? data.withdrawal_priority)) ? Number(data.withdrawalPriority ?? data.withdrawal_priority) : 1}" min="1">
      </div>
      <div>
        <label>最低保留金額</label>
        <input type="number" class="a-minimum-reserve" value="${Number.isFinite(Number(data.minimumReserve ?? data.minimum_reserve)) ? Number(data.minimumReserve ?? data.minimum_reserve) : 0}">
      </div>
    </div>
    <details class="logic-details" open>
      <summary>帳戶白話運算邏輯</summary>
      <div class="logic-body account-logic-text"></div>
    </details>
  `;

  container.appendChild(div);
  refreshAccountRow(div);
  refreshStep3MathChecks();
  scheduleCurrentSnapshotRefresh();
}

function getPrimaryPropertyDraftFromInputs() {
  const currentMarketValue = Math.max(0, toFiniteNumber(document.getElementById("propertyAssets")?.value, 0));
  if (currentMarketValue <= 0) return null;

  const propertyType = document.getElementById("propertyType")?.value || "residence";
  return {
    property_id: "property-1",
    property_name: document.getElementById("propertyName")?.value.trim() || getPropertyTypeLabel(propertyType),
    property_type: propertyType,
    current_market_value: currentMarketValue,
    annual_appreciation_rate: toFiniteNumber(document.getElementById("propertyGrowthRate")?.value, 0),
    funding_mode: document.getElementById("propertyFundingMode")?.value || "excluded",
    sale_age: Math.trunc(toFiniteNumber(document.getElementById("propertySaleAge")?.value, 0)),
    sale_cost_rate: Math.max(0, toFiniteNumber(document.getElementById("propertySaleCostRate")?.value, 0))
  };
}

function getPropertyLabel(propertyDraft = getPrimaryPropertyDraftFromInputs()) {
  return propertyDraft?.property_name || "房產";
}

function getPropertyFundingModeLabel(mode) {
  if (mode === "net_equity") return "退休起點動用淨值";
  if (mode === "sale_event") return "指定年齡出售";
  return "只列家庭淨值";
}

function getDebtTypeLabel(type) {
  if (type === "mortgage") return "房貸";
  if (type === "personal_loan") return "信貸";
  if (type === "car_loan") return "車貸";
  if (type === "policy_loan") return "保單借款";
  return "其他負債";
}

function getLiabilityTreatmentLabel(mode) {
  return mode === "prepay" ? "提前清償" : "正常攤還";
}

function buildLinkedPropertyOptionsHtml() {
  const propertyDraft = getPrimaryPropertyDraftFromInputs();
  const options = [`<option value="">未連結</option>`];
  if (propertyDraft) {
    options.push(`<option value="${escapeAttr(propertyDraft.property_id)}">${escapeHtml(getPropertyLabel(propertyDraft))}</option>`);
  }
  return options.join("");
}

function getCurrentLinkedLiabilityBalance(propertyId = "property-1") {
  return readLiabilityRows()
    .filter((liability) => liability.linkedPropertyId === propertyId)
    .reduce((sum, liability) => sum + toFiniteNumber(liability.balance, 0), 0);
}

function buildPropertyLogicText() {
  const propertyDraft = getPrimaryPropertyDraftFromInputs();
  if (!propertyDraft) {
    return "目前這筆資料還沒有填入房產估值，因此系統先不把房產或房貸納入退休可提領資產，只先依帳戶資產與其他現金流規則計算。";
  }

  const linkedDebtBalance = getCurrentLinkedLiabilityBalance(propertyDraft.property_id);
  const netEquity = Math.max(0, propertyDraft.current_market_value - linkedDebtBalance);
  const propertyLabel = getPropertyLabel(propertyDraft);

  if (propertyDraft.funding_mode === "net_equity") {
    return `${propertyLabel} 目前設定為「${getPropertyFundingModeLabel(propertyDraft.funding_mode)}」。白話就是：退休起點會先用「房產市值 ${formatCurrency(propertyDraft.current_market_value)} - 已連動房貸 ${formatCurrency(linkedDebtBalance)} = ${formatCurrency(netEquity)}」納入退休可提領資產；但房貸月付仍會持續列入年度現金流，直到清償或提前清償。`;
  }

  if (propertyDraft.funding_mode === "sale_event") {
    return `${propertyLabel} 目前設定為「${getPropertyFundingModeLabel(propertyDraft.funding_mode)}」。白話就是：現在不先把房產算進退休可提領資產；到 ${propertyDraft.sale_age || "指定"} 歲出售時，系統會先扣出售成本 ${formatPercent(propertyDraft.sale_cost_rate, 1)}，再清掉已連動房貸 ${formatCurrency(linkedDebtBalance)}，剩下淨額才轉進退休資金池。`;
  }

  return `${propertyLabel} 目前設定為「${getPropertyFundingModeLabel(propertyDraft.funding_mode)}」。白話就是：房產只計入家庭淨值，不直接拿來支應退休生活；房貸月付仍照現金流規則處理。`;
}

function buildLiabilityLogicText(values) {
  const debtTypeLabel = getDebtTypeLabel(values.debtType);
  const treatmentLabel = getLiabilityTreatmentLabel(values.treatmentMode);
  const annualPayment = Math.max(0, toFiniteNumber(values.monthlyPayment, 0) * 12);

  if (values.treatmentMode === "prepay") {
    const prepayAmount = toFiniteNumber(values.prepayAmount, 0);
    const payoffText = prepayAmount > 0 ? formatCurrency(prepayAmount) : "當時剩餘餘額";
    return `${debtTypeLabel} 目前採「${treatmentLabel}」。系統會先把每月還款 ${formatCurrency(values.monthlyPayment)}（年付 ${formatCurrency(annualPayment)}）列入累積期與退休期現金流；到 ${values.prepayAge || "指定"} 歲時，再一次性清償 ${payoffText}，之後停止月付。${values.linkedPropertyLabel ? `這筆負債目前連動到 ${values.linkedPropertyLabel}。` : ""}`;
  }

  if (values.debtType === "mortgage" && values.linkedPropertyLabel) {
    return `${debtTypeLabel} 目前連動到 ${values.linkedPropertyLabel}，採「${treatmentLabel}」。白話就是：這筆房貸會先用月付 ${formatCurrency(values.monthlyPayment)}（年付 ${formatCurrency(annualPayment)}）壓縮現金流；若房產模式是淨值納入，房貸餘額也會先從可納入淨值中扣掉；若房產指定出售，出售當年會先清掉這筆房貸。`;
  }

  return `${debtTypeLabel} 目前採「${treatmentLabel}」。系統會把每月還款 ${formatCurrency(values.monthlyPayment)}（年付 ${formatCurrency(annualPayment)}）列入現金流，直到 ${values.payoffAge || "清償年齡"} 歲停止；這筆負債不會在起始退休資產中先被整筆重複扣除。`;
}

function refreshPropertyConfigUI() {
  const propertyDraft = getPrimaryPropertyDraftFromInputs();
  const fundingModeSelect = document.getElementById("propertyFundingMode");
  const fundingMode = fundingModeSelect?.value || "excluded";
  const saleAgeWrap = document.getElementById("propertySaleAgeWrap");
  const saleCostWrap = document.getElementById("propertySaleCostWrap");
  const legacyIncludeCheckbox = document.getElementById("includePropertyInFunding");
  const propertyLogicText = document.getElementById("propertyLogicText");

  if (!propertyDraft && fundingMode !== "excluded" && fundingModeSelect) {
    fundingModeSelect.value = "excluded";
  }

  const finalFundingMode = fundingModeSelect?.value || "excluded";
  if (saleAgeWrap) saleAgeWrap.classList.toggle("hidden", finalFundingMode !== "sale_event");
  if (saleCostWrap) saleCostWrap.classList.toggle("hidden", finalFundingMode !== "sale_event");
  if (legacyIncludeCheckbox) legacyIncludeCheckbox.checked = finalFundingMode === "net_equity";
  if (propertyLogicText) propertyLogicText.textContent = buildPropertyLogicText();
}

function handlePropertyFundingModeChange() {
  refreshPropertyConfigUI();
  refreshAllLiabilityRows();
  refreshStep3MathChecks();
  scheduleCurrentSnapshotRefresh();
}

function refreshLiabilityRow(row) {
  if (!row) return;

  const debtTypeSelect = row.querySelector(".l-type");
  const linkedPropertyWrap = row.querySelector(".l-linked-property-wrap");
  const linkedPropertySelect = row.querySelector(".l-linked-property");
  const treatmentModeSelect = row.querySelector(".l-treatment-mode");
  const prepayAgeWrap = row.querySelector(".l-prepay-age-wrap");
  const prepayAmountWrap = row.querySelector(".l-prepay-amount-wrap");
  const logicText = row.querySelector(".liability-logic-text");
  const propertyDraft = getPrimaryPropertyDraftFromInputs();
  const selectedLinkedProperty = linkedPropertySelect?.value || "";

  if (linkedPropertySelect) {
    linkedPropertySelect.innerHTML = buildLinkedPropertyOptionsHtml();
    if (debtTypeSelect?.value === "mortgage" && propertyDraft) {
      linkedPropertySelect.value = selectedLinkedProperty || propertyDraft.property_id;
    } else {
      linkedPropertySelect.value = "";
    }
    linkedPropertySelect.disabled = !propertyDraft || debtTypeSelect?.value !== "mortgage";
  }

  if (linkedPropertyWrap) linkedPropertyWrap.classList.toggle("hidden", debtTypeSelect?.value !== "mortgage");
  if (prepayAgeWrap) prepayAgeWrap.classList.toggle("hidden", treatmentModeSelect?.value !== "prepay");
  if (prepayAmountWrap) prepayAmountWrap.classList.toggle("hidden", treatmentModeSelect?.value !== "prepay");

  if (logicText) {
    logicText.textContent = buildLiabilityLogicText({
      debtType: debtTypeSelect?.value || "other",
      linkedPropertyLabel: propertyDraft && linkedPropertySelect?.value === propertyDraft.property_id ? getPropertyLabel(propertyDraft) : "",
      monthlyPayment: toFiniteNumber(row.querySelector(".l-payment")?.value, 0),
      payoffAge: Math.trunc(toFiniteNumber(row.querySelector(".l-payoff-age")?.value, 0)),
      treatmentMode: treatmentModeSelect?.value || "amortized",
      prepayAge: Math.trunc(toFiniteNumber(row.querySelector(".l-prepay-age")?.value, 0)),
      prepayAmount: toFiniteNumber(row.querySelector(".l-prepay-amount")?.value, 0)
    });
  }
}

function refreshAllLiabilityRows() {
  Array.from(document.querySelectorAll("#liabilityContainer .liability-row")).forEach((row) => refreshLiabilityRow(row));
}

function refreshStep3MathChecks(normalizedPlan = null, projectionResult = null) {
  const container = document.getElementById("step3MathChecks");
  if (!container) return;

  if (!window.PlanNormalizerV1 || !window.ProjectionEngineV1) {
    container.innerHTML = "<div>數學檢核引擎尚未載入。</div>";
    return;
  }

  try {
    const rawFormState = getRawFormState();
    const plan = normalizedPlan || window.PlanNormalizerV1.normalizePlan(rawFormState);
    const result = projectionResult || window.ProjectionEngineV1.buildProjectionResult(plan);
    const snapshot = plan.derived?.current_snapshot || {};
    const property = plan.balance_sheet.properties?.[0] || null;
    const liabilities = plan.balance_sheet.liabilities || [];
    const linkedLiabilities = property
      ? liabilities.filter((liability) => liability.linked_property_id === property.property_id)
      : [];
    const linkedDebtBalance = linkedLiabilities.reduce((sum, liability) => sum + toFiniteNumber(liability.current_balance, 0), 0);
    const accountTotal = (plan.balance_sheet.accounts || []).reduce((sum, account) => sum + toFiniteNumber(account.opening_balance, 0), 0);
    const propertyValue = property ? toFiniteNumber(property.current_market_value, 0) : 0;
    const liabilityTotal = liabilities.reduce((sum, liability) => sum + toFiniteNumber(liability.current_balance, 0), 0);
    const currentDebtService = liabilities.reduce((sum, liability) => sum + toFiniteNumber(liability.monthly_payment, 0) * 12, 0);
    const warnings = [
      ...(plan.derived?.warnings || []),
      ...((result.diagnostics?.warnings) || []),
      ...((result.diagnostics?.anti_double_count_flags) || [])
    ].filter(Boolean);

    /*
    const propertyExplanation = property
      ? `${getPropertyLabel(property)} 目前採 ${getPropertyFundingModeLabel(property.funding_mode)}；市值 ${formatCurrency(propertyValue)}，已連動負債 ${formatCurrency(linkedDebtBalance)}，目前可立即納入退休資產的淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)}。`
      : "目前這筆資料尚未填入房產估值，因此 Step 3 先以帳戶資產與負債現金流計算。";

    container.innerHTML = `
      <div><strong>退休可提領資產起點</strong> = 帳戶資產 ${formatCurrency(snapshot.liquid_retirement_pool_start)} + 可立即納入房產淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)} = ${formatCurrency(snapshot.liquid_retirement_pool_start + snapshot.current_funding_eligible_equity)}</div>
      <div><strong>家庭淨值起點</strong> = 帳戶總額 ${formatCurrency(accountTotal)} + 房產市值 ${formatCurrency(propertyValue)} - 負債餘額 ${formatCurrency(liabilityTotal)} = ${formatCurrency(snapshot.opening_household_net_worth)}</div>
      <div><strong>房產白話摘要</strong> ${escapeHtml(propertyExplanation)}</div>
      <div><strong>目前年負債付款</strong> = ${formatCurrency(currentDebtService)}。這筆金額會優先壓縮累積期與退休期的現金流，不會再在起始退休資產中被整筆重複扣一次。</div>
      <div><strong>即時檢查</strong>${warnings.length ? `<br>${warnings.map((warning) => `• ${escapeHtml(warning)}`).join("<br>")}` : " 目前沒有偵測到房產/負債的數學衝突。"}${result.diagnostics?.blocking_errors?.length ? `<br>${result.diagnostics.blocking_errors.map((warning) => `• ${escapeHtml(warning)}`).join("<br>")}` : ""}</div>
    `;
    */
    /*
    const propertyExplanation = property
      ? `${getPropertyLabel(property)} 目前採 ${getPropertyFundingModeLabel(property.funding_mode)}；市值 ${formatCurrency(propertyValue)}，已連動負債 ${formatCurrency(linkedDebtBalance)}，目前可立即納入退休資產的淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)}。`
      : "目前這筆資料尚未填入房產估值，因此 Step 3 先以帳戶資產與負債現金流計算。";

    const warningHtml = warnings.length
      ? `<br>${warnings.map((warning) => `• ${escapeHtml(warning)}`).join("<br>")}`
      : " 目前沒有偵測到房產/負債的數學衝突。";

    const blockingErrorHtml = result.diagnostics?.blocking_errors?.length
      ? `<br>${result.diagnostics.blocking_errors.map((warning) => `• ${escapeHtml(warning)}`).join("<br>")}`
      : "";

    container.innerHTML = `
      <div><strong>退休可提領資產起點</strong> = 帳戶資產 ${formatCurrency(snapshot.liquid_retirement_pool_start)} + 可立即納入房產淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)} = ${formatCurrency(snapshot.liquid_retirement_pool_start + snapshot.current_funding_eligible_equity)}</div>
      <div><strong>家庭淨值起點</strong> = 帳戶總額 ${formatCurrency(accountTotal)} + 房產市值 ${formatCurrency(propertyValue)} - 負債餘額 ${formatCurrency(liabilityTotal)} = ${formatCurrency(snapshot.opening_household_net_worth)}</div>
      <div><strong>房產白話摘要</strong> ${escapeHtml(propertyExplanation)}</div>
      <div><strong>目前年負債付款</strong> = ${formatCurrency(currentDebtService)}。這筆金額會優先壓縮累積期與退休期的現金流，不會再在起始退休資產中被整筆重複扣一次。</div>
      <div><strong>即時檢查</strong>${warningHtml}${blockingErrorHtml}</div>
    `;
    */
    const propertyExplanation = property
      ? `${getPropertyLabel(property)} 目前採「${getPropertyFundingModeLabel(property.funding_mode)}」；房產市值 ${formatCurrency(propertyValue)}，已連動負債 ${formatCurrency(linkedDebtBalance)}，目前可納入退休資金的房產淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)}。`
      : "目前這筆資料尚未填入可納入退休資金的房產金額，因此 Step 3 先以帳戶資產與負債現金流計算。";

    const warningHtml = warnings.length
      ? `<br>${warnings.map((warning) => `- ${escapeHtml(warning)}`).join("<br>")}`
      : " 目前沒有偵測到房產 / 負債的數學衝突。";

    const blockingErrorHtml = result.diagnostics?.blocking_errors?.length
      ? `<br>${result.diagnostics.blocking_errors.map((warning) => `- ${escapeHtml(warning)}`).join("<br>")}`
      : "";

    container.innerHTML = `
      <div><strong>可動用退休資金起點</strong> = 帳戶資產 ${formatCurrency(snapshot.liquid_retirement_pool_start)} + 可納入退休池的房產淨值 ${formatCurrency(snapshot.current_funding_eligible_equity)} = ${formatCurrency(snapshot.liquid_retirement_pool_start + snapshot.current_funding_eligible_equity)}</div>
      <div><strong>家庭淨值起點</strong> = 帳戶總額 ${formatCurrency(accountTotal)} + 房產市值 ${formatCurrency(propertyValue)} - 負債餘額 ${formatCurrency(liabilityTotal)} = ${formatCurrency(snapshot.opening_household_net_worth)}</div>
      <div><strong>年度可投資淨餘</strong> = 收入 ${formatCurrency(snapshot.annual_income_total)} - 稅額 ${formatCurrency(snapshot.annual_tax_total)} - 支出 ${formatCurrency(snapshot.annual_expense_total)} - 債務服務 ${formatCurrency(snapshot.annual_debt_service_total)} = ${formatCurrency(snapshot.annual_surplus_before_override)}</div>
      <div><strong>保費 + 手動校正</strong> = 年保費 ${formatCurrency(snapshot.annual_premium_total)}；${rawFormState.useManualContributionOverride ? `手動校正已啟用，可投資投入採 ${formatCurrency(snapshot.annual_investable_surplus)}，與自然淨餘差額為 ${formatCurrency(snapshot.manual_override_gap)}` : `手動校正未啟用，可投資投入直接採自然淨餘 ${formatCurrency(snapshot.annual_investable_surplus)}`}</div>
      <div><strong>房產摘要</strong> ${escapeHtml(propertyExplanation)}</div>
      <div><strong>年度債務服務</strong> = ${formatCurrency(currentDebtService)}。這筆現金流會壓縮累積速度與退休可支配現金，但不會再從起始可動用退休資金中重複扣一次。</div>
      <div><strong>檢查結果</strong>${warningHtml}${blockingErrorHtml}</div>
    `;
  } catch (error) {
    container.innerHTML = `<div>Step 3 檢核暫時無法更新：${escapeHtml(error.message || "未知錯誤")}</div>`;
  }
}

function refreshStep3DerivedPanels(normalizedPlan = null, projectionResult = null) {
  refreshPropertyConfigUI();
  refreshAllAccountRows();
  refreshAllLiabilityRows();
  refreshStep3MathChecks(normalizedPlan, projectionResult);
}

function addLiability(data = {}) {
  const container = document.getElementById("liabilityContainer");
  const div = document.createElement("div");
  div.className = "income-box liability-row";
  div.dataset.liabilityId = data.id || data.liabilityId || "";
  const propertyDraft = getPrimaryPropertyDraftFromInputs();
  const selectedDebtType = data.debtType || data.debt_type || (propertyDraft ? "mortgage" : "other");
  const selectedTreatmentMode = data.treatmentMode || data.treatment_mode || (Number(data.prepayAge ?? data.prepay_age) > 0 ? "prepay" : "amortized");
  const selectedLinkedPropertyId = data.linkedPropertyId || data.linked_property_id || (selectedDebtType === "mortgage" && propertyDraft ? propertyDraft.property_id : "");
  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title" style="color:var(--ai);">負債項目</div>
      <button type="button" class="remove-btn" onclick="removeDynamicRow(this)">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>名稱</label>
        <input type="text" class="l-name" value="${escapeAttr(data.name || "")}" placeholder="例：房貸">
      </div>
      <div>
        <label>餘額</label>
        <input type="number" class="l-balance" value="${Number.isFinite(Number(data.balance)) ? Number(data.balance) : 0}">
      </div>
      <div>
        <label>每月還款</label>
        <input type="number" class="l-payment" value="${Number.isFinite(Number(data.monthlyPayment)) ? Number(data.monthlyPayment) : 0}">
      </div>
      <div>
        <label>清償年齡（以本人年齡）</label>
        <input type="number" class="l-payoff-age" value="${Number.isFinite(Number(data.payoffAge)) ? Number(data.payoffAge) : 70}">
      </div>
    </div>
  `;
  container.appendChild(div);
  const fieldGrid = div.querySelector(".field-grid");
  const gridItems = fieldGrid ? Array.from(fieldGrid.children) : [];
  if (gridItems[0]) {
    gridItems[0].insertAdjacentHTML("afterend", `
      <div>
        <label>負債類型</label>
        <select class="l-type">
          <option value="mortgage" ${selectedDebtType === "mortgage" ? "selected" : ""}>房貸</option>
          <option value="personal_loan" ${selectedDebtType === "personal_loan" ? "selected" : ""}>信貸</option>
          <option value="car_loan" ${selectedDebtType === "car_loan" ? "selected" : ""}>車貸</option>
          <option value="policy_loan" ${selectedDebtType === "policy_loan" ? "selected" : ""}>保單借款</option>
          <option value="other" ${selectedDebtType === "other" ? "selected" : ""}>其他</option>
        </select>
      </div>
    `);
  }
  if (gridItems[2]) {
    gridItems[2].insertAdjacentHTML("afterend", `
      <div>
        <label>年利率 %</label>
        <input type="number" class="l-interest-rate" value="${Number.isFinite(Number(data.interestRate ?? data.annualInterestRate)) ? Number(data.interestRate ?? data.annualInterestRate) : 0}" step="0.1">
      </div>
      <div class="l-linked-property-wrap">
        <label>連動房產</label>
        <select class="l-linked-property">${buildLinkedPropertyOptionsHtml()}</select>
      </div>
    `);
  }
  if (fieldGrid) {
    fieldGrid.insertAdjacentHTML("beforeend", `
      <div>
        <label>負債模式</label>
        <select class="l-treatment-mode">
          <option value="amortized" ${selectedTreatmentMode === "amortized" ? "selected" : ""}>正常攤還</option>
          <option value="prepay" ${selectedTreatmentMode === "prepay" ? "selected" : ""}>提前清償</option>
        </select>
      </div>
      <div class="l-prepay-age-wrap">
        <label>提前清償年齡</label>
        <input type="number" class="l-prepay-age" value="${Number.isFinite(Number(data.prepayAge ?? data.prepay_age)) ? Number(data.prepayAge ?? data.prepay_age) : 0}">
      </div>
      <div class="l-prepay-amount-wrap">
        <label>提前清償金額</label>
        <input type="number" class="l-prepay-amount" value="${Number.isFinite(Number(data.prepayAmount ?? data.prepay_amount)) ? Number(data.prepayAmount ?? data.prepay_amount) : 0}">
      </div>
    `);
  }
  div.insertAdjacentHTML("beforeend", `
    <details class="logic-details" open>
      <summary>這筆負債怎麼算</summary>
      <div class="logic-body liability-logic-text"></div>
    </details>
  `);
  const linkedPropertySelect = div.querySelector(".l-linked-property");
  if (linkedPropertySelect) linkedPropertySelect.value = selectedLinkedPropertyId;
  refreshLiabilityRow(div);
  refreshStep3MathChecks();
  scheduleCurrentSnapshotRefresh();
}

function addIncome(data = {}) {
  const container = document.getElementById("incomeContainer");
  const allowSpouse = getCurrentHouseholdMode() === "couple";
  const selectedOwner = data.owner || "household";
  const selectedPreset = data.preset || "salary";
  const selectedType = data.type === "lump" ? "lump" : "monthly";
  const ageValue = Number.isFinite(Number(data.age)) ? Number(data.age) : 65;
  const amountValue = Number.isFinite(Number(data.amount)) ? Number(data.amount) : 20000;
  const yearsValue = Number.isFinite(Number(data.years)) ? Number(data.years) : 20;
  const growthRateValue = Number.isFinite(Number(data.growthRate ?? data.growth_rate)) ? Number(data.growthRate ?? data.growth_rate) : 0;
  const fallbackName = data.name || `${getOwnerLabel(selectedOwner)} ${getIncomePresetLabel(selectedPreset)}`;

  const div = document.createElement("div");
  div.className = "income-box event-row";
  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title" style="color:var(--matcha);">收入事件</div>
      <button type="button" class="remove-btn" onclick="removeDynamicRow(this)">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>收入名稱</label>
        <input type="text" class="i-name" value="${escapeAttr(fallbackName)}" data-auto-label="${escapeAttr(fallbackName)}" placeholder="可留空，系統會依類型帶入">
      </div>
      <div>
        <label>收入類型</label>
        <select class="i-preset" onchange="handleIncomePresetChange(this)">
          <option value="salary" ${selectedPreset === "salary" ? "selected" : ""}>薪資收入</option>
          <option value="bonus" ${selectedPreset === "bonus" ? "selected" : ""}>獎金收入</option>
          <option value="part_time" ${selectedPreset === "part_time" ? "selected" : ""}>兼職收入</option>
          <option value="business" ${selectedPreset === "business" ? "selected" : ""}>事業收入</option>
          <option value="labor_insurance" ${selectedPreset === "labor_insurance" ? "selected" : ""}>勞保給付</option>
          <option value="labor_pension" ${selectedPreset === "labor_pension" ? "selected" : ""}>勞退提領</option>
          <option value="annuity" ${selectedPreset === "annuity" ? "selected" : ""}>商業年金</option>
          <option value="rent" ${selectedPreset === "rent" ? "selected" : ""}>租金收入</option>
          <option value="interest" ${selectedPreset === "interest" ? "selected" : ""}>利息收入</option>
          <option value="dividend" ${selectedPreset === "dividend" ? "selected" : ""}>股利收入</option>
          <option value="distribution" ${selectedPreset === "distribution" ? "selected" : ""}>配息收入</option>
          <option value="custom" ${selectedPreset === "custom" ? "selected" : ""}>自訂收入</option>
        </select>
      </div>
      <div>
        <label>所有人</label>
        <select class="i-owner owner-select" onchange="handleIncomeOwnerChange(this)">${buildOwnerOptionsHtml(selectedOwner, allowSpouse)}</select>
      </div>
      <div>
        <label>發生年齡（填該所有人的年齡）</label>
        <input type="number" class="i-age" value="${ageValue}">
      </div>
      <div>
        <label>型態</label>
        <select class="i-type">
          <option value="monthly" ${selectedType === "monthly" ? "selected" : ""}>每月收入</option>
          <option value="lump" ${selectedType === "lump" ? "selected" : ""}>一次性收入</option>
        </select>
      </div>
      <div>
        <label>金額</label>
        <input type="number" class="i-amount" value="${amountValue}">
      </div>
      <div>
        <label>持續年數</label>
        <input type="number" class="i-years" value="${yearsValue}">
      </div>
      <div style="display:flex;align-items:flex-end;padding-bottom:10px;">
        <label class="check-item"><input type="checkbox" class="i-inflation" ${data.inflation === false ? "" : "checked"}><span>隨通膨調整</span></label>
      </div>
    </div>
  `;
  container.appendChild(div);
  refreshIncomeRow(div);
  scheduleCurrentSnapshotRefresh();
}

function addGoal(data = {}) {
  const container = document.getElementById("goalContainer");
  const allowSpouse = getCurrentHouseholdMode() === "couple";
  const selectedOwner = data.owner || "household";
  const selectedCategory = data.category || "housing";
  const selectedType = data.type === "monthly" ? "monthly" : "lump";

  const div = document.createElement("div");
  div.className = "goal-box event-row";
  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title">目標事件</div>
      <button type="button" class="remove-btn" onclick="removeDynamicRow(this)">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>事件名稱</label>
        <input type="text" class="g-name" value="${escapeAttr(data.name || "")}" placeholder="例：換屋自備款、子女支持">
      </div>
      <div>
        <label>類別</label>
        <select class="g-category">
          <option value="housing" ${selectedCategory === "housing" ? "selected" : ""}>房產</option>
          <option value="care" ${selectedCategory === "care" ? "selected" : ""}>照護</option>
          <option value="family" ${selectedCategory === "family" ? "selected" : ""}>家庭支援</option>
          <option value="travel" ${selectedCategory === "travel" ? "selected" : ""}>旅遊</option>
          <option value="legacy" ${selectedCategory === "legacy" ? "selected" : ""}>傳承</option>
          <option value="custom" ${selectedCategory === "custom" ? "selected" : ""}>自訂</option>
        </select>
      </div>
      <div>
        <label>所有人</label>
        <select class="g-owner owner-select">${buildOwnerOptionsHtml(selectedOwner, allowSpouse)}</select>
      </div>
      <div>
        <label>發生年齡（填該所有人的年齡）</label>
        <input type="number" class="g-age" value="${Number.isFinite(Number(data.age)) ? Number(data.age) : 65}">
      </div>
      <div>
        <label>型態</label>
        <select class="g-type">
          <option value="lump" ${selectedType === "lump" ? "selected" : ""}>一次性支出</option>
          <option value="monthly" ${selectedType === "monthly" ? "selected" : ""}>每月支出</option>
        </select>
      </div>
      <div>
        <label>金額</label>
        <input type="number" class="g-amount" value="${Number.isFinite(Number(data.amount)) ? Number(data.amount) : 500000}">
      </div>
      <div>
        <label>持續年數</label>
        <input type="number" class="g-years" value="${Number.isFinite(Number(data.years)) ? Number(data.years) : 1}">
      </div>
      <div style="display:flex;align-items:flex-end;padding-bottom:10px;">
        <label class="check-item"><input type="checkbox" class="g-inflation" ${data.inflation === false ? "" : "checked"}><span>隨通膨調整</span></label>
      </div>
    </div>
  `;
  container.appendChild(div);
  scheduleCurrentSnapshotRefresh();
}

function handleIncomePresetChange(selectElement) {
  const row = selectElement.closest(".event-row");
  const owner = row?.querySelector(".i-owner")?.value || "household";
  const nameInput = row?.querySelector(".i-name");
  if (!row || !nameInput) return;

  const fallbackName = `${getOwnerLabel(owner)} ${getIncomePresetLabel(selectElement.value)}`;
  if (!nameInput.value.trim() || nameInput.value === nameInput.dataset.autoLabel) {
    nameInput.value = fallbackName;
    nameInput.dataset.autoLabel = fallbackName;
  }
}

function handleIncomeOwnerChange(selectElement) {
  const row = selectElement.closest(".event-row");
  const presetSelect = row?.querySelector(".i-preset");
  if (presetSelect) handleIncomePresetChange(presetSelect);
  if (row) refreshIncomeRow(row);
}

function buildIncomeLogicText(values) {
  const ownerLabel = getOwnerLabel(values.owner || "household");
  const presetLabel = getIncomePresetLabel(values.preset || "salary");
  const amount = Math.max(0, toFiniteNumber(values.amount, 0));
  const annualAmount = values.type === "lump" ? amount : amount * 12;
  const growthRate = toFiniteNumber(values.growthRate, 0);
  const years = Math.max(1, Math.trunc(toFiniteNumber(values.years, 1)));
  const startAge = Math.trunc(toFiniteNumber(values.age, 0));
  const endAge = values.type === "monthly" ? startAge + years - 1 : startAge;
  const inflationText = values.inflation === false
    ? "不隨通膨調整"
    : (growthRate === 0 ? "若未填成長率，系統會以通膨率作為預設成長假設" : "通膨僅作為 fallback 假設");
  const frequencyText = values.type === "monthly" ? `每月收入，年化約 ${formatCurrency(annualAmount)}` : `單筆收入，金額約 ${formatCurrency(annualAmount)}`;

  return `${ownerLabel} 的 ${presetLabel} 收入，從 ${startAge || "指定"} 歲開始${values.type === "monthly" ? `，連續 ${years} 年` : ""}。${frequencyText}。若成長率填 ${formatPercent(growthRate)}，系統就用這個成長率推估未來收入；${inflationText}。`;
}

function refreshIncomeRow(row) {
  if (!row) return;
  const fieldGrid = row.querySelector(".field-grid");
  const yearsGroup = row.querySelector(".i-years")?.closest("div");
  if (fieldGrid && !row.querySelector(".i-growth-rate")) {
    const growthGroup = document.createElement("div");
    growthGroup.innerHTML = `
      <label>年成長率 %</label>
      <input type="number" class="i-growth-rate" value="0" step="0.1" placeholder="例如 2.0">
    `;
    if (yearsGroup) {
      fieldGrid.insertBefore(growthGroup, yearsGroup);
    } else {
      fieldGrid.appendChild(growthGroup);
    }
  }

  if (row && !row.querySelector(".income-logic-text") && fieldGrid) {
    row.insertAdjacentHTML("beforeend", `
      <details class="logic-details" open>
        <summary>收入白話邏輯</summary>
        <div class="logic-body income-logic-text"></div>
      </details>
    `);
  }

  const logicText = row.querySelector(".income-logic-text");
  if (logicText) {
    logicText.textContent = buildIncomeLogicText({
      owner: row.querySelector(".i-owner")?.value || "household",
      preset: row.querySelector(".i-preset")?.value || "salary",
      age: row.querySelector(".i-age")?.value,
      type: row.querySelector(".i-type")?.value || "monthly",
      amount: row.querySelector(".i-amount")?.value,
      growthRate: row.querySelector(".i-growth-rate")?.value,
      years: row.querySelector(".i-years")?.value,
      inflation: row.querySelector(".i-inflation")?.checked
    });
  }
}

function refreshAllIncomeRows() {
  Array.from(document.querySelectorAll("#incomeContainer .event-row")).forEach((row) => refreshIncomeRow(row));
}

function readAccountRows() {
  return Array.from(document.querySelectorAll("#accountContainer .account-row")).map((row, index) => ({
    id: row.dataset.accountId || `account-${index + 1}`,
    name: row.querySelector(".a-name")?.value.trim() || "",
    owner: row.querySelector(".a-owner")?.value || "joint",
    accountType: row.querySelector(".a-type")?.value || "taxable",
    assetStyle: row.querySelector(".a-driver")?.value === "growth"
      ? "growth"
      : row.querySelector(".a-driver")?.value === "income"
        ? "income"
        : "balanced",
    openingBalance: toFiniteNumber(row.querySelector(".a-balance")?.value, 0),
    uiPrimaryDriver: row.querySelector(".a-driver")?.value || "growth",
    preRetirementPolicy: row.querySelector(".a-pre-policy")?.value || "reinvest",
    postRetirementPolicy: row.querySelector(".a-post-policy")?.value || "sell_only",
    totalReturnRate: toFiniteNumber(row.querySelector(".a-total-return-rate")?.value, 0),
    cashYieldRate: toFiniteNumber(row.querySelector(".a-cash-yield-rate")?.value, 0),
    priceGrowthRate: toFiniteNumber(row.querySelector(".a-price-growth-rate")?.value, 0),
    withdrawalPriority: Math.max(1, Math.trunc(toFiniteNumber(row.querySelector(".a-withdrawal-priority")?.value, index + 1))),
    minimumReserve: toFiniteNumber(row.querySelector(".a-minimum-reserve")?.value, 0),
    bucketRole: row.querySelector(".a-bucket-role")?.value || "none"
  }));
}

function readLiabilityRows() {
  return Array.from(document.querySelectorAll("#liabilityContainer .liability-row")).map((row, index) => ({
    id: row.dataset.liabilityId || `liability-${index + 1}`,
    name: row.querySelector(".l-name").value.trim(),
    debtType: row.querySelector(".l-type")?.value || "other",
    balance: toFiniteNumber(row.querySelector(".l-balance").value, 0),
    monthlyPayment: toFiniteNumber(row.querySelector(".l-payment").value, 0),
    interestRate: toFiniteNumber(row.querySelector(".l-interest-rate")?.value, 0),
    linkedPropertyId: row.querySelector(".l-linked-property")?.value || "",
    payoffAge: Math.trunc(toFiniteNumber(row.querySelector(".l-payoff-age").value, 0)),
    treatmentMode: row.querySelector(".l-treatment-mode")?.value || "amortized",
    prepayAge: Math.trunc(toFiniteNumber(row.querySelector(".l-prepay-age")?.value, 0)),
    prepayAmount: toFiniteNumber(row.querySelector(".l-prepay-amount")?.value, 0),
    includeInRetirementCashflow: true
  }));
}

function readEventRows(containerSelector, prefix) {
  return Array.from(document.querySelectorAll(`${containerSelector} .event-row`)).map((row) => ({
    name: row.querySelector(`.${prefix}-name`).value.trim(),
    owner: row.querySelector(`.${prefix}-owner`).value,
    preset: prefix === "i" ? row.querySelector(".i-preset").value : undefined,
    category: prefix === "g" ? row.querySelector(".g-category").value : undefined,
    age: toFiniteNumber(row.querySelector(`.${prefix}-age`).value, 0),
    type: row.querySelector(`.${prefix}-type`).value === "monthly" ? "monthly" : "lump",
    amount: toFiniteNumber(row.querySelector(`.${prefix}-amount`).value, 0),
    growthRate: prefix === "i" ? toFiniteNumber(row.querySelector(".i-growth-rate")?.value, 0) : undefined,
    years: Math.max(1, Math.trunc(toFiniteNumber(row.querySelector(`.${prefix}-years`).value, 1))),
    inflation: row.querySelector(`.${prefix}-inflation`).checked
  }));
}

function clearValidationState() {
  document.querySelectorAll(".field-error").forEach((element) => element.classList.remove("show"));
  document.querySelectorAll("input, select, textarea").forEach((element) => element.classList.remove("invalid"));
}

function markInvalidElement(element, message, issues, errId) {
  if (element) element.classList.add("invalid");
  if (errId) {
    const errElement = document.getElementById(errId);
    if (errElement) errElement.classList.add("show");
  }
  issues.push(message);
}

function validateNumberInput(id, label, issues, options = {}) {
  const { min, max, integer = false, allowZero = true, message = `${label} 需為有效數值。` } = options;
  const element = document.getElementById(id);
  const value = Number(element?.value);
  const isInvalid =
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    (min !== undefined && value < min) ||
    (max !== undefined && value > max) ||
    (!allowZero && value === 0);

  if (isInvalid) {
    markInvalidElement(element, message, issues);
    return null;
  }
  return value;
}

function showError(inputId, errId, message, issues) {
  const input = document.getElementById(inputId);
  if (input) input.classList.add("invalid");
  const errEl = document.getElementById(errId);
  if (errEl) errEl.classList.add("show");
  issues.push(message);
}

function translateOwnerAge(owner, age) {
  const selfCurrentAge = toFiniteNumber(document.getElementById("currentAge").value, 0);
  if (owner === "spouse" && getCurrentHouseholdMode() === "couple") {
    const spouseCurrentAge = toFiniteNumber(document.getElementById("spouseCurrentAge").value, 0);
    return selfCurrentAge + (age - spouseCurrentAge);
  }
  return age;
}

function validateStep(step, options = {}) {
  const { preserveState = false, silent = false, issues = [] } = options;
  let isValid = true;

  if (!preserveState) clearValidationState();

  if (step === 2) {
    const currentAge = Number(document.getElementById("currentAge").value);
    const retireAge = Number(document.getElementById("retireAge").value);
    const lifeExpectancy = Number(document.getElementById("lifeExpectancy").value);

    if (!Number.isInteger(currentAge) || currentAge <= 0) {
      showError("currentAge", "err-currentAge", "本人目前年齡需為正整數。", issues);
      isValid = false;
    }
    if (!Number.isInteger(retireAge) || retireAge <= currentAge) {
      showError("retireAge", "err-retireAge", "本人退休年齡必須大於目前年齡。", issues);
      isValid = false;
    }
    if (!Number.isInteger(lifeExpectancy) || lifeExpectancy <= retireAge) {
      showError("lifeExpectancy", "err-lifeExpectancy", "本人預期壽命必須大於退休年齡。", issues);
      isValid = false;
    }

    if (getCurrentHouseholdMode() === "couple") {
      const spouseCurrentAge = Number(document.getElementById("spouseCurrentAge").value);
      const spouseRetireAge = Number(document.getElementById("spouseRetireAge").value);
      const spouseLifeExpectancy = Number(document.getElementById("spouseLifeExpectancy").value);

      if (!Number.isInteger(spouseCurrentAge) || spouseCurrentAge <= 0) {
        showError("spouseCurrentAge", "err-spouseCurrentAge", "配偶目前年齡需為正整數。", issues);
        isValid = false;
      }
      if (!Number.isInteger(spouseRetireAge) || spouseRetireAge <= spouseCurrentAge) {
        showError("spouseRetireAge", "err-spouseRetireAge", "配偶退休年齡必須大於目前年齡。", issues);
        isValid = false;
      }
      if (!Number.isInteger(spouseLifeExpectancy) || spouseLifeExpectancy <= spouseRetireAge) {
        showError("spouseLifeExpectancy", "err-spouseLifeExpectancy", "配偶預期壽命必須大於退休年齡。", issues);
        isValid = false;
      }
    }
  }

  if (step === 3) {
    const checkedValues = [
      validateNumberInput("cashAssets", "現金與活存", issues, { min: 0 }),
      validateNumberInput("investmentAssets", "投資帳戶", issues, { min: 0 }),
      validateNumberInput("retirementAssets", "退休帳戶", issues, { min: 0 }),
      validateNumberInput("propertyAssets", "房產估值", issues, { min: 0 }),
      validateNumberInput("monthlyContribution", "每月持續投入", issues, { min: 0 }),
      validateNumberInput("essentialExpense", "必要生活支出", issues, { min: 0 }),
      validateNumberInput("discretionaryExpense", "彈性生活支出", issues, { min: 0 }),
      validateNumberInput("monthlyMedicalExpense", "醫療支出", issues, { min: 0 }),
      validateNumberInput("monthlyCareExpense", "照護支出", issues, { min: 0 }),
      validateNumberInput("returnRate", "退休前年報酬率", issues, { min: -100, max: 100 }),
      validateNumberInput("postReturnRate", "退休後年報酬率", issues, { min: -100, max: 100 }),
      validateNumberInput("inflationRate", "一般通膨率", issues, { min: -20, max: 30 }),
      validateNumberInput("medicalInflationRate", "醫療通膨率", issues, { min: -20, max: 50 })
    ];
    if (checkedValues.includes(null)) isValid = false;
    const accountPriorityMap = new Map();

    Array.from(document.querySelectorAll("#accountContainer .account-row")).forEach((row, index) => {
      const nameInput = row.querySelector(".a-name");
      const balanceInput = row.querySelector(".a-balance");
      const typeInput = row.querySelector(".a-account-type");
      const totalReturnInput = row.querySelector(".a-total-return-rate");
      const yieldInput = row.querySelector(".a-cash-yield-rate");
      const growthInput = row.querySelector(".a-price-growth-rate");
      const priorityInput = row.querySelector(".a-withdrawal-priority");
      const reserveInput = row.querySelector(".a-minimum-reserve");
      const prePolicyInput = row.querySelector(".a-pre-policy");
      const postPolicyInput = row.querySelector(".a-post-policy");
      const driverInput = row.querySelector(".a-driver");
      const accountType = typeInput?.value || "taxable";
      const driver = driverInput?.value || "growth";
      const prePolicy = prePolicyInput?.value || "reinvest";
      const postPolicy = postPolicyInput?.value || "sell_only";
      const name = nameInput?.value.trim() || "";
      const balance = Number(balanceInput?.value);
      const totalReturn = Number(totalReturnInput?.value);
      const cashYield = Number(yieldInput?.value);
      const priceGrowth = Number(growthInput?.value);
      const withdrawalPriority = Number(priorityInput?.value);
      const minimumReserve = Number(reserveInput?.value);

      if (Number.isInteger(withdrawalPriority) && withdrawalPriority >= 1) {
        if (!accountPriorityMap.has(withdrawalPriority)) {
          accountPriorityMap.set(withdrawalPriority, []);
        }
        accountPriorityMap.get(withdrawalPriority).push(priorityInput);
      }

      if (!name) {
        markInvalidElement(nameInput, `帳戶 ${index + 1} 需要名稱，方便辨識配息與賣單位來源。`, issues);
        isValid = false;
      }
      if (!Number.isFinite(balance) || balance < 0) {
        markInvalidElement(balanceInput, `帳戶 ${index + 1} 目前餘額需為 0 以上。`, issues);
        isValid = false;
      }
      if (!Number.isFinite(withdrawalPriority) || !Number.isInteger(withdrawalPriority) || withdrawalPriority < 1) {
        markInvalidElement(priorityInput, `帳戶 ${index + 1} 提領順序需為 1 以上的整數。`, issues);
        isValid = false;
      }
      if (!Number.isFinite(minimumReserve) || minimumReserve < 0) {
        markInvalidElement(reserveInput, `帳戶 ${index + 1} 最低保留金額需為 0 以上。`, issues);
        isValid = false;
      }

      if (Number.isFinite(balance) && Number.isFinite(minimumReserve) && minimumReserve > balance) {
        markInvalidElement(reserveInput, `帳戶 ${index + 1} 的最低保留金額不可大於目前餘額。`, issues);
        isValid = false;
      }
      if (accountType === "cash" && driver === "growth") {
        markInvalidElement(driverInput, `帳戶 ${index + 1} 為現金帳戶時，不可設定為成長型報酬模式。`, issues);
        isValid = false;
      }

      if (driver === "growth") {
        if (!Number.isFinite(totalReturn) || totalReturn < -100 || totalReturn > 100) {
          markInvalidElement(totalReturnInput, `帳戶 ${index + 1} 的總報酬率需介於 -100% 到 100%。`, issues);
          isValid = false;
        }
        if (prePolicy !== "reinvest") {
          markInvalidElement(row.querySelector(".a-pre-policy"), `帳戶 ${index + 1} 為成長型時，退休前應採再投入。`, issues);
          isValid = false;
        }
        if (!["sell_only", "reinvest"].includes(postPolicy)) {
          markInvalidElement(row.querySelector(".a-post-policy"), `帳戶 ${index + 1} 為成長型時，退休後應採賣單位或繼續再投入。`, issues);
          isValid = false;
        }
      } else {
        if (!Number.isFinite(cashYield) || cashYield < 0 || cashYield > 100) {
          markInvalidElement(yieldInput, `帳戶 ${index + 1} 的現金收益率需介於 0% 到 100%。`, issues);
          isValid = false;
        }
        if (!Number.isFinite(priceGrowth) || priceGrowth < -100 || priceGrowth > 100) {
          markInvalidElement(growthInput, `帳戶 ${index + 1} 的價格成長率需介於 -100% 到 100%。`, issues);
          isValid = false;
        }
      }
    });

    accountPriorityMap.forEach((inputs, priority) => {
      if (inputs.length > 1) {
        inputs.forEach((input) => {
          markInvalidElement(input, `帳戶提領順序 ${priority} 不可重複。`, issues);
        });
        isValid = false;
      }
    });

    if (validateNumberInput("monthlyPremiumExpense", "每月保費", issues, { min: 0 }) === null) {
      isValid = false;
    }
    if (validateNumberInput("earnedIncomeTaxRate", "勞務收入有效稅率", issues, { min: 0, max: 100 }) === null) {
      isValid = false;
    }
    if (validateNumberInput("passiveIncomeTaxRate", "被動收入有效稅率", issues, { min: 0, max: 100 }) === null) {
      isValid = false;
    }
    if (validateNumberInput("benefitIncomeTaxRate", "給付收入有效稅率", issues, { min: 0, max: 100 }) === null) {
      isValid = false;
    }

    if (validateNumberInput("propertyGrowthRate", "房產年增值率", issues, { min: -50, max: 50 }) === null) {
      isValid = false;
    }

    const propertyFundingMode = document.getElementById("propertyFundingMode")?.value || "excluded";
    const propertyAssetsValue = toFiniteNumber(document.getElementById("propertyAssets")?.value, 0);
    const propertySaleAgeInput = document.getElementById("propertySaleAge");
    const propertySaleCostInput = document.getElementById("propertySaleCostRate");
    if (propertyFundingMode === "sale_event" && propertyAssetsValue > 0) {
      const currentAge = toFiniteNumber(document.getElementById("currentAge")?.value, 0);
      const saleAge = Number(propertySaleAgeInput?.value);
      const saleCostRate = Number(propertySaleCostInput?.value);
      if (!Number.isInteger(saleAge) || saleAge < currentAge) {
        markInvalidElement(propertySaleAgeInput, "房產出售年齡必須大於或等於目前年齡。", issues);
        isValid = false;
      }
      if (!Number.isFinite(saleCostRate) || saleCostRate < 0 || saleCostRate > 50) {
        markInvalidElement(propertySaleCostInput, "房產出售成本率需介於 0% 到 50%。", issues);
        isValid = false;
      }
    }

    if (document.getElementById("withdrawalStrategy").value === "fixed_rate") {
      if (validateNumberInput("fixedWithdrawalRate", "固定提領率", issues, { min: 0, max: 20 }) === null) {
        isValid = false;
      }
    }
    if (validateNumberInput("referenceWithdrawalRate", "參考提領率", issues, { min: 0, max: 20 }) === null) {
      isValid = false;
    }

    if (document.getElementById("withdrawalStrategy").value === "guardrail") {
      const floor = validateNumberInput("strategyGuardrailFloor", "護欄觸發下限", issues, { min: 30, max: 99 });
      const ceiling = validateNumberInput("strategyGuardrailCeiling", "護欄觸發上限", issues, { min: 101, max: 300 });
      const step = validateNumberInput("strategyGuardrailAdjustStep", "護欄調整幅度", issues, { min: 1, max: 50 });
      if (floor === null || ceiling === null || (floor !== null && ceiling !== null && ceiling < floor)) {
        markInvalidElement(document.getElementById("strategyGuardrailCeiling"), "護欄觸發上限不得低於下限。", issues);
        isValid = false;
      }
      if (step === null) isValid = false;
    }

    if (document.getElementById("withdrawalStrategy").value === "bucket") {
      if (validateNumberInput("bucketCashMonths", "現金桶目標月數", issues, { min: 0, max: 120 }) === null) {
        isValid = false;
      }
      if (validateNumberInput("bucketBondYears", "債券桶建議年數", issues, { min: 0, max: 40 }) === null) {
        isValid = false;
      }
    }

    if (document.getElementById("ltcEnabled").value === "true") {
      const currentAge = toFiniteNumber(document.getElementById("currentAge").value, 0);
      const spouseLife = getCurrentHouseholdMode() === "couple"
        ? translateOwnerAge("spouse", toFiniteNumber(document.getElementById("spouseLifeExpectancy").value, 0))
        : 0;
      const maxAge = Math.max(toFiniteNumber(document.getElementById("lifeExpectancy").value, 0), spouseLife);

      const ltcStartAge = validateNumberInput("ltcStartAge", "LTC 起始年齡", issues, { min: currentAge, max: maxAge, integer: true });
      const ltcDurationYears = validateNumberInput("ltcDurationYears", "LTC 持續年數", issues, { min: 1, max: 40, integer: true });
      const ltcExtraCostFactor = validateNumberInput("ltcExtraCostFactor", "LTC 溢價倍數", issues, { min: 1, max: 10 });
      if (ltcStartAge === null || ltcDurationYears === null || ltcExtraCostFactor === null) isValid = false;
    }

    Array.from(document.querySelectorAll("#liabilityContainer .liability-row")).forEach((row, index) => {
      const balanceInput = row.querySelector(".l-balance");
      const paymentInput = row.querySelector(".l-payment");
      const payoffAgeInput = row.querySelector(".l-payoff-age");

      const balance = Number(balanceInput?.value);
      const payment = Number(paymentInput?.value);
      const payoffAge = Number(payoffAgeInput?.value);

      if (!Number.isFinite(balance) || balance < 0) {
        markInvalidElement(balanceInput, `負債 ${index + 1} 餘額不可為負數。`, issues);
        isValid = false;
      }
      if (!Number.isFinite(payment) || payment < 0) {
        markInvalidElement(paymentInput, `負債 ${index + 1} 每月還款不可為負數。`, issues);
        isValid = false;
      }
      if (!Number.isInteger(payoffAge) || payoffAge <= 0) {
        markInvalidElement(payoffAgeInput, `負債 ${index + 1} 清償年齡需為正整數。`, issues);
        isValid = false;
      }
    });

    if (window.PlanNormalizerV1?.normalizePlan) {
      const normalizedPlan = window.PlanNormalizerV1.normalizePlan(getRawFormState());
      const blockingErrors = normalizedPlan?.derived?.blocking_errors || [];
      blockingErrors.forEach((message) => issues.push(message));
      if (blockingErrors.length) {
        isValid = false;
      }
    }
  }

  if (step === 4) {
    const selfCurrentAge = toFiniteNumber(document.getElementById("currentAge").value, 0);
    const spouseCurrentAge = toFiniteNumber(document.getElementById("spouseCurrentAge").value, 0);
    const spouseLifeExpectancy = toFiniteNumber(document.getElementById("spouseLifeExpectancy").value, 0);
    const householdLifeExpectancy = Math.max(
      toFiniteNumber(document.getElementById("lifeExpectancy").value, 0),
      getCurrentHouseholdMode() === "couple" ? translateOwnerAge("spouse", spouseLifeExpectancy) : 0
    );

    const validateRows = (selector, prefix, label) => {
      Array.from(document.querySelectorAll(`${selector} .event-row`)).forEach((row, index) => {
        const owner = row.querySelector(`.${prefix}-owner`).value;
        const ageInput = row.querySelector(`.${prefix}-age`);
        const amountInput = row.querySelector(`.${prefix}-amount`);
        const yearsInput = row.querySelector(`.${prefix}-years`);
        const age = Number(ageInput?.value);
        const amount = Number(amountInput?.value);
        const years = Number(yearsInput?.value);
        const translatedAge = translateOwnerAge(owner, age);
        const ownerCurrentAge = owner === "spouse" ? spouseCurrentAge : selfCurrentAge;

        if (owner === "spouse" && getCurrentHouseholdMode() !== "couple") {
          markInvalidElement(ageInput, `${label} ${index + 1} 指定為配偶，但目前為單人模式。`, issues);
          isValid = false;
        }
        if (!Number.isInteger(age) || age < ownerCurrentAge) {
          markInvalidElement(ageInput, `${label} ${index + 1} 年齡需大於等於所有人的目前年齡。`, issues);
          isValid = false;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          markInvalidElement(amountInput, `${label} ${index + 1} 金額必須大於 0。`, issues);
          isValid = false;
        }
        if (!Number.isInteger(years) || years < 1) {
          markInvalidElement(yearsInput, `${label} ${index + 1} 持續年數至少需為 1。`, issues);
          isValid = false;
        }

        if (prefix === "i") {
          const growthRateInput = row.querySelector(".i-growth-rate");
          const growthRate = Number(growthRateInput?.value);
          if (!Number.isFinite(growthRate) || growthRate < -50 || growthRate > 50) {
            markInvalidElement(growthRateInput, `${label} ${index + 1} 年成長率請填 -50% 到 50% 之間。`, issues);
            isValid = false;
          }
        }

        const type = row.querySelector(`.${prefix}-type`).value;
        const endAge = type === "monthly" ? translatedAge + years - 1 : translatedAge;
        if (translatedAge > householdLifeExpectancy || endAge > householdLifeExpectancy) {
          markInvalidElement(yearsInput, `${label} ${index + 1} 超出家庭規劃壽命範圍。`, issues);
          isValid = false;
        }
      });
    };

    validateRows("#incomeContainer", "i", "收入");
    validateRows("#goalContainer", "g", "事件");
  }

  if (step === 5 && document.getElementById("mcEnabled").checked) {
    const mcRuns = validateNumberInput("mcRuns", "模擬次數", issues, { min: 100, max: 100000, integer: true });
    const mcVolatility = validateNumberInput("mcVolatility", "年化波動度", issues, { min: 0, max: 100 });
    const mcInflationVolatility = validateNumberInput("mcInflationVolatility", "通膨波動度", issues, { min: 0, max: 20 });
    const mcSpendingVolatility = validateNumberInput("mcSpendingVolatility", "支出彈性波動度", issues, { min: 0, max: 50 });
    const mcSpendingFloor = validateNumberInput("mcSpendingFloor", "最低支出比例", issues, { min: 1, max: 100 });
    const mcSpendingCeiling = validateNumberInput("mcSpendingCeiling", "最高支出比例", issues, { min: 100, max: 300 });
    const scenarioCReturnBoostPct = validateNumberInput("scenarioCReturnBoostPct", "報酬率加幅", issues, { min: 0, max: 20 });
    const scenarioCRetireDelayYears = validateNumberInput("scenarioCRetireDelayYears", "延後退休年數", issues, { min: 0, max: 20, integer: true });
    const scenarioCContributionBoostPct = validateNumberInput("scenarioCContributionBoostPct", "提撥加幅", issues, { min: 0, max: 100 });

    if ([mcRuns, mcVolatility, mcInflationVolatility, mcSpendingVolatility, mcSpendingFloor, mcSpendingCeiling, scenarioCReturnBoostPct, scenarioCRetireDelayYears, scenarioCContributionBoostPct].includes(null)) {
      isValid = false;
    }
    if (
      mcSpendingFloor !== null &&
      mcSpendingCeiling !== null &&
      mcSpendingCeiling < mcSpendingFloor
    ) {
      markInvalidElement(document.getElementById("mcSpendingCeiling"), "最高支出比例不得低於最低支出比例。", issues);
      isValid = false;
    }
  }

  if (!isValid && !silent && issues.length) {
    alert(issues.join("\n"));
  }

  return isValid;
}

function validateAllInputs() {
  clearValidationState();
  for (const step of [2, 3, 4, 5]) {
    const issues = [];
    if (!validateStep(step, { preserveState: true, silent: true, issues })) {
      goToStep(step, { skipValidation: true });
      alert(issues.join("\n"));
      return false;
    }
  }
  return true;
}

function getRawFormState() {
  return {
    caseName: document.getElementById("caseName").value.trim(),
    clientName: document.getElementById("clientName").value.trim(),
    versionName: document.getElementById("versionName").value.trim(),
    baselineVersion: document.getElementById("baselineVersion").value.trim(),
    advisorName: document.getElementById("advisorName").value.trim(),
    reportDate: document.getElementById("reportDate").value || getLocalDateString(),
    householdMode: getCurrentHouseholdMode(),
    selfName: document.getElementById("selfName").value.trim(),
    currentAge: Math.trunc(toFiniteNumber(document.getElementById("currentAge").value, 0)),
    retireAge: Math.trunc(toFiniteNumber(document.getElementById("retireAge").value, 0)),
    lifeExpectancy: Math.trunc(toFiniteNumber(document.getElementById("lifeExpectancy").value, 0)),
    selfHealthStatus: document.getElementById("selfHealthStatus").value,
    spouseName: document.getElementById("spouseName").value.trim(),
    spouseCurrentAge: Math.trunc(toFiniteNumber(document.getElementById("spouseCurrentAge").value, 0)),
    spouseRetireAge: Math.trunc(toFiniteNumber(document.getElementById("spouseRetireAge").value, 0)),
    spouseLifeExpectancy: Math.trunc(toFiniteNumber(document.getElementById("spouseLifeExpectancy").value, 0)),
    spouseHealthStatus: document.getElementById("spouseHealthStatus").value,
    advisorNote: document.getElementById("advisorNote").value.trim(),
    cashAssets: toFiniteNumber(document.getElementById("cashAssets").value, 0),
    investmentAssets: toFiniteNumber(document.getElementById("investmentAssets").value, 0),
    retirementAssets: toFiniteNumber(document.getElementById("retirementAssets").value, 0),
    accounts: readAccountRows(),
    propertyAssets: toFiniteNumber(document.getElementById("propertyAssets").value, 0),
    propertyName: document.getElementById("propertyName")?.value.trim() || "",
    propertyOwner: document.getElementById("propertyOwner")?.value || "joint",
    propertyType: document.getElementById("propertyType")?.value || "residence",
    propertyGrowthRate: toFiniteNumber(document.getElementById("propertyGrowthRate")?.value, 0),
    propertyFundingMode: document.getElementById("propertyFundingMode")?.value || "excluded",
    propertySaleAge: Math.trunc(toFiniteNumber(document.getElementById("propertySaleAge")?.value, 0)),
    propertySaleCostRate: toFiniteNumber(document.getElementById("propertySaleCostRate")?.value, 5),
    includePropertyInFunding: (document.getElementById("propertyFundingMode")?.value || "excluded") === "net_equity",
    monthlyContribution: toFiniteNumber(document.getElementById("monthlyContribution").value, 0),
    monthlyContributionOverride: toFiniteNumber(document.getElementById("monthlyContribution").value, 0),
    useManualContributionOverride: document.getElementById("useManualContributionOverride")?.checked === true,
    scenarioCMode: document.getElementById("scenarioCMode")?.value || "mixed",
    scenarioCReturnBoostPct: toFiniteNumber(document.getElementById("scenarioCReturnBoostPct")?.value, 1),
    scenarioCRetireDelayYears: Math.max(0, Math.trunc(toFiniteNumber(document.getElementById("scenarioCRetireDelayYears")?.value, 2))),
    scenarioCContributionBoostPct: toFiniteNumber(document.getElementById("scenarioCContributionBoostPct")?.value, 15),
    liabilities: readLiabilityRows(),
    essentialExpense: toFiniteNumber(document.getElementById("essentialExpense").value, 0),
    discretionaryExpense: toFiniteNumber(document.getElementById("discretionaryExpense").value, 0),
    monthlyMedicalExpense: toFiniteNumber(document.getElementById("monthlyMedicalExpense").value, 0),
    monthlyCareExpense: toFiniteNumber(document.getElementById("monthlyCareExpense").value, 0),
    monthlyPremiumExpense: toFiniteNumber(document.getElementById("monthlyPremiumExpense").value, 0),
    withdrawalStrategy: document.getElementById("withdrawalStrategy").value,
    fixedWithdrawalRate: toFiniteNumber(document.getElementById("fixedWithdrawalRate").value, 4),
    annualReviewEnabled: document.getElementById("annualReviewEnabled")?.checked !== false,
    strategyGuardrailFloor: toFiniteNumber(document.getElementById("strategyGuardrailFloor").value, 80),
    strategyGuardrailCeiling: toFiniteNumber(document.getElementById("strategyGuardrailCeiling").value, 120),
    strategyGuardrailAdjustStep: toFiniteNumber(document.getElementById("strategyGuardrailAdjustStep")?.value, 10),
    bucketCashMonths: toFiniteNumber(document.getElementById("bucketCashMonths")?.value, 24),
    bucketBondYears: toFiniteNumber(document.getElementById("bucketBondYears")?.value, 8),
    bucketAvoidSellingGrowthAfterLoss: document.getElementById("bucketAvoidSellingGrowthAfterLoss")?.checked !== false,
    returnRate: toFiniteNumber(document.getElementById("returnRate").value, 0),
    inflationRate: toFiniteNumber(document.getElementById("inflationRate").value, 0),
    postReturnRate: toFiniteNumber(document.getElementById("postReturnRate").value, 0),
    medicalInflationRate: toFiniteNumber(document.getElementById("medicalInflationRate").value, 0),
    earnedIncomeTaxRate: toFiniteNumber(document.getElementById("earnedIncomeTaxRate").value, 0),
    passiveIncomeTaxRate: toFiniteNumber(document.getElementById("passiveIncomeTaxRate").value, 0),
    benefitIncomeTaxRate: toFiniteNumber(document.getElementById("benefitIncomeTaxRate").value, 0),
    ltcProfile: {
      enabled: document.getElementById("ltcEnabled").value === "true",
      startAge: Math.trunc(toFiniteNumber(document.getElementById("ltcStartAge").value, 80)),
      durationYears: Math.max(1, Math.trunc(toFiniteNumber(document.getElementById("ltcDurationYears").value, 8))),
      extraCostFactor: toFiniteNumber(document.getElementById("ltcExtraCostFactor").value, 1.2)
    },
    goals: readEventRows("#goalContainer", "g"),
    incomes: readEventRows("#incomeContainer", "i"),
    monteCarloOptions: {
      mcEnabled: document.getElementById("mcEnabled").checked,
      mcRandomInflation: document.getElementById("mcRandomInflation").checked,
      mcFlexibleSpending: document.getElementById("mcFlexibleSpending").checked,
      mcRuns: Math.max(100, Math.trunc(toFiniteNumber(document.getElementById("mcRuns").value, 500))),
      mcVolatility: toFiniteNumber(document.getElementById("mcVolatility").value, 12) / 100,
      mcInflationVolatility: toFiniteNumber(document.getElementById("mcInflationVolatility").value, 1.2) / 100,
      mcSpendingVolatility: toFiniteNumber(document.getElementById("mcSpendingVolatility").value, 6) / 100,
      mcSpendingFloor: toFiniteNumber(document.getElementById("mcSpendingFloor").value, 85) / 100,
      mcSpendingCeiling: toFiniteNumber(document.getElementById("mcSpendingCeiling").value, 110) / 100
    },
    showInputSummary: document.getElementById("showInputSummary").checked,
    showAdvisorAdvice: document.getElementById("showAdvisorAdvice").checked,
    showMonteCarloSummary: document.getElementById("showMonteCarloSummary").checked,
    showLogicSteps: document.getElementById("showLogicSteps").checked,
    showPreChart: document.getElementById("showPreChart").checked,
    showPostChart: document.getElementById("showPostChart").checked,
    showScenarioChart: document.getElementById("showScenarioChart").checked,
    showMonteCarloChart: document.getElementById("showMonteCarloChart").checked
  };
}

function getFormData() {
  return getRawFormState();
}

function hydrateRawFormState(data = {}) {
  setInputValue("caseName", data.caseName || "");
  setInputValue("clientName", data.clientName || "");
  setInputValue("versionName", data.versionName || "");
  setInputValue("baselineVersion", data.baselineVersion || "");
  setInputValue("advisorName", data.advisorName || "");
  setInputValue("reportDate", data.reportDate || getLocalDateString());
  setSelectValue("householdMode", data.householdMode === "couple" ? "couple" : "single");
  setInputValue("selfName", data.selfName || "");
  setInputValue("currentAge", Number.isFinite(Number(data.currentAge)) ? Number(data.currentAge) : 40);
  setInputValue("retireAge", Number.isFinite(Number(data.retireAge)) ? Number(data.retireAge) : 65);
  setInputValue("lifeExpectancy", Number.isFinite(Number(data.lifeExpectancy)) ? Number(data.lifeExpectancy) : 90);
  setSelectValue("selfHealthStatus", data.selfHealthStatus || "normal");
  setInputValue("spouseName", data.spouseName || "");
  setInputValue("spouseCurrentAge", Number.isFinite(Number(data.spouseCurrentAge)) ? Number(data.spouseCurrentAge) : 38);
  setInputValue("spouseRetireAge", Number.isFinite(Number(data.spouseRetireAge)) ? Number(data.spouseRetireAge) : 63);
  setInputValue("spouseLifeExpectancy", Number.isFinite(Number(data.spouseLifeExpectancy)) ? Number(data.spouseLifeExpectancy) : 92);
  setSelectValue("spouseHealthStatus", data.spouseHealthStatus || "normal");
  setInputValue("advisorNote", data.advisorNote || "");
  setInputValue("cashAssets", Number.isFinite(Number(data.cashAssets)) ? Number(data.cashAssets) : 500000);
  setInputValue("investmentAssets", Number.isFinite(Number(data.investmentAssets)) ? Number(data.investmentAssets) : 1000000);
  setInputValue("retirementAssets", Number.isFinite(Number(data.retirementAssets)) ? Number(data.retirementAssets) : 500000);
  document.getElementById("accountContainer").innerHTML = "";
  const accountRows = Array.isArray(data.accounts) && data.accounts.length
    ? data.accounts
    : buildDefaultAccountRowsFromBuckets(data);
  accountRows.forEach((account) => addAccount(account));
  setInputValue("propertyAssets", Number.isFinite(Number(data.propertyAssets)) ? Number(data.propertyAssets) : 0);
  setInputValue("propertyName", data.propertyName || "");
  setSelectValue("propertyOwner", data.propertyOwner || "joint");
  setSelectValue("propertyType", data.propertyType || "residence");
  setInputValue("propertyGrowthRate", Number.isFinite(Number(data.propertyGrowthRate)) ? Number(data.propertyGrowthRate) : 0);
  const resolvedPropertyFundingMode = data.propertyFundingMode || (data.includePropertyInFunding ? "net_equity" : "excluded");
  setSelectValue("propertyFundingMode", resolvedPropertyFundingMode);
  setInputValue("propertySaleAge", Number.isFinite(Number(data.propertySaleAge)) ? Number(data.propertySaleAge) : 65);
  setInputValue("propertySaleCostRate", Number.isFinite(Number(data.propertySaleCostRate)) ? Number(data.propertySaleCostRate) : 5);
  setChecked("includePropertyInFunding", resolvedPropertyFundingMode === "net_equity");
  const contributionOverrideValue = Number.isFinite(Number(data.monthlyContributionOverride))
    ? Number(data.monthlyContributionOverride)
    : (Number.isFinite(Number(data.monthlyContribution)) ? Number(data.monthlyContribution) : 15000);
  setInputValue("monthlyContribution", contributionOverrideValue);
  setChecked("useManualContributionOverride", data.useManualContributionOverride === true);
  setSelectValue("scenarioCMode", data.scenarioCMode || "mixed");
  setInputValue("scenarioCReturnBoostPct", Number.isFinite(Number(data.scenarioCReturnBoostPct)) ? Number(data.scenarioCReturnBoostPct) : 1);
  setInputValue("scenarioCRetireDelayYears", Number.isFinite(Number(data.scenarioCRetireDelayYears)) ? Number(data.scenarioCRetireDelayYears) : 2);
  setInputValue("scenarioCContributionBoostPct", Number.isFinite(Number(data.scenarioCContributionBoostPct)) ? Number(data.scenarioCContributionBoostPct) : 15);
  document.getElementById("liabilityContainer").innerHTML = "";
  (data.liabilities?.length ? data.liabilities : [{}]).forEach((liability) => addLiability(liability));
  refreshStep3DerivedPanels();
  setInputValue("essentialExpense", Number.isFinite(Number(data.essentialExpense)) ? Number(data.essentialExpense) : 35000);
  setInputValue("discretionaryExpense", Number.isFinite(Number(data.discretionaryExpense)) ? Number(data.discretionaryExpense) : 15000);
  setInputValue("monthlyMedicalExpense", Number.isFinite(Number(data.monthlyMedicalExpense)) ? Number(data.monthlyMedicalExpense) : 8000);
  setInputValue("monthlyCareExpense", Number.isFinite(Number(data.monthlyCareExpense)) ? Number(data.monthlyCareExpense) : 5000);
  setInputValue("monthlyPremiumExpense", Number.isFinite(Number(data.monthlyPremiumExpense)) ? Number(data.monthlyPremiumExpense) : 0);
  setSelectValue("withdrawalStrategy", data.withdrawalStrategy || "fixed_spending");
  setInputValue("fixedWithdrawalRate", Number.isFinite(Number(data.fixedWithdrawalRate)) ? Number(data.fixedWithdrawalRate) : 4);
  setChecked("annualReviewEnabled", data.annualReviewEnabled !== false);
  setInputValue("strategyGuardrailFloor", Number.isFinite(Number(data.strategyGuardrailFloor)) ? Number(data.strategyGuardrailFloor) : 80);
  setInputValue("strategyGuardrailCeiling", Number.isFinite(Number(data.strategyGuardrailCeiling)) ? Number(data.strategyGuardrailCeiling) : 120);
  setInputValue("strategyGuardrailAdjustStep", Number.isFinite(Number(data.strategyGuardrailAdjustStep)) ? Number(data.strategyGuardrailAdjustStep) : 10);
  setInputValue("bucketCashMonths", Number.isFinite(Number(data.bucketCashMonths)) ? Number(data.bucketCashMonths) : 24);
  setInputValue("bucketBondYears", Number.isFinite(Number(data.bucketBondYears)) ? Number(data.bucketBondYears) : 8);
  setChecked("bucketAvoidSellingGrowthAfterLoss", data.bucketAvoidSellingGrowthAfterLoss !== false);
  setInputValue("returnRate", Number.isFinite(Number(data.returnRate)) ? Number(data.returnRate) : 5);
  setInputValue("postReturnRate", Number.isFinite(Number(data.postReturnRate)) ? Number(data.postReturnRate) : 2);
  setInputValue("inflationRate", Number.isFinite(Number(data.inflationRate)) ? Number(data.inflationRate) : 2);
  setInputValue("medicalInflationRate", Number.isFinite(Number(data.medicalInflationRate)) ? Number(data.medicalInflationRate) : 5);
  setInputValue("earnedIncomeTaxRate", Number.isFinite(Number(data.earnedIncomeTaxRate)) ? Number(data.earnedIncomeTaxRate) : 0);
  setInputValue("passiveIncomeTaxRate", Number.isFinite(Number(data.passiveIncomeTaxRate)) ? Number(data.passiveIncomeTaxRate) : 0);
  setInputValue("benefitIncomeTaxRate", Number.isFinite(Number(data.benefitIncomeTaxRate)) ? Number(data.benefitIncomeTaxRate) : 0);

  const ltcProfile = data.ltcProfile || {};
  setSelectValue("ltcEnabled", ltcProfile.enabled === false ? "false" : "true");
  setInputValue("ltcStartAge", Number.isFinite(Number(ltcProfile.startAge)) ? Number(ltcProfile.startAge) : 80);
  setInputValue("ltcDurationYears", Number.isFinite(Number(ltcProfile.durationYears)) ? Number(ltcProfile.durationYears) : 8);
  setInputValue("ltcExtraCostFactor", Number.isFinite(Number(ltcProfile.extraCostFactor)) ? Number(ltcProfile.extraCostFactor) : 1.2);

  document.getElementById("incomeContainer").innerHTML = "";
  (data.incomes || []).forEach((income) => addIncome(income));
  document.getElementById("goalContainer").innerHTML = "";
  (data.goals || []).forEach((goal) => addGoal(goal));

  const mc = data.monteCarloOptions || {};
  setChecked("mcEnabled", mc.mcEnabled !== false);
  setChecked("mcRandomInflation", mc.mcRandomInflation !== false);
  setChecked("mcFlexibleSpending", mc.mcFlexibleSpending !== false);
  setInputValue("mcRuns", Number.isFinite(Number(mc.mcRuns)) ? Number(mc.mcRuns) : 500);
  setInputValue("mcVolatility", Number.isFinite(Number(mc.mcVolatility)) ? roundForInput(Number(mc.mcVolatility) * 100) : 12);
  setInputValue("mcInflationVolatility", Number.isFinite(Number(mc.mcInflationVolatility)) ? roundForInput(Number(mc.mcInflationVolatility) * 100) : 1.2);
  setInputValue("mcSpendingVolatility", Number.isFinite(Number(mc.mcSpendingVolatility)) ? roundForInput(Number(mc.mcSpendingVolatility) * 100) : 6);
  setInputValue("mcSpendingFloor", Number.isFinite(Number(mc.mcSpendingFloor)) ? roundForInput(Number(mc.mcSpendingFloor) * 100) : 85);
  setInputValue("mcSpendingCeiling", Number.isFinite(Number(mc.mcSpendingCeiling)) ? roundForInput(Number(mc.mcSpendingCeiling) * 100) : 110);

  setChecked("showInputSummary", data.showInputSummary !== false);
  setChecked("showAdvisorAdvice", data.showAdvisorAdvice !== false);
  setChecked("showMonteCarloSummary", data.showMonteCarloSummary !== false);
  setChecked("showLogicSteps", data.showLogicSteps !== false);
  setChecked("showPreChart", data.showPreChart !== false);
  setChecked("showPostChart", data.showPostChart !== false);
  setChecked("showScenarioChart", data.showScenarioChart !== false);
  setChecked("showMonteCarloChart", data.showMonteCarloChart !== false);

  handleHouseholdModeChange();
  handleWithdrawalStrategyChange();
  updateAnnualReviewStatusBadge(data);
  document.getElementById("shareBox").classList.add("hidden");
  goToStep(1, { skipValidation: true });
  clearValidationState();
  generateSummary();
  refreshCurrentSnapshot();
}

function hydrateForm(data = {}) {
  hydrateRawFormState(data);
}

function setTextContent(id, value, fallback = "-") {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value || fallback;
  }
}

function getHealthStatusLabel(status) {
  if (status === "good") return "良好";
  if (status === "warn") return "留意";
  return "偏弱";
}

function renderCurrentSnapshot(viewModel) {
  if (!viewModel) return;

  const relabelSummaryField = (id, text) => {
    const valueNode = document.getElementById(id);
    const labelNode = valueNode?.parentElement?.querySelector("label");
    if (labelNode) {
      labelNode.removeAttribute("data-help-enhanced");
      labelNode.removeAttribute("data-help-label");
      labelNode.textContent = text;
      decorateFieldHelpLabel(labelNode);
    }
  };

  setTextContent("step0CaseName", viewModel.header.case_name || "未命名案件");
  setTextContent("step0VersionName", viewModel.header.version_name || "尚未命名");
  setTextContent("step0BaselineVersion", viewModel.header.baseline_version || "未設定");
  setTextContent("step0HouseholdMode", viewModel.header.household_mode_text || "-");

  relabelSummaryField("step0AnnualSavingTotal", "年儲蓄（自然淨餘）");
  relabelSummaryField("step0LiquidRetirementPool", "目前可提領資產起點（今天）");
  relabelSummaryField("step0FundingEligibleEquity", "目前可納入退休池的房產淨值");
  relabelSummaryField("step0HouseholdNetWorth", "家庭總淨值起點（今天）");

  setTextContent("step0AnnualIncomeTotal", viewModel.current_summary.annual_income_total_text);
  setTextContent("step0AnnualExpenseTotal", viewModel.current_summary.annual_expense_total_text);
  setTextContent("step0AnnualSavingTotal", viewModel.current_summary.annual_saving_total_text);
  setTextContent("step0AnnualTaxTotal", viewModel.current_summary.annual_tax_total_text);
  setTextContent("step0AnnualPremiumTotal", viewModel.current_summary.annual_premium_total_text);
  setTextContent("step0AnnualDebtServiceTotal", viewModel.current_summary.annual_debt_service_total_text);
  setTextContent("step0AnnualSurplusBeforeOverride", viewModel.current_summary.annual_surplus_before_override_text);
  setTextContent("step0AnnualInvestableSurplus", viewModel.current_summary.annual_investable_surplus_text);
  setTextContent("step0ManualOverrideGap", viewModel.current_summary.manual_override_gap_text);
  setTextContent("step0OverrideStatus", viewModel.current_summary.override_status_text);
  setTextContent("step0SavingRate", viewModel.current_summary.saving_rate_text);
  setTextContent("step0PassiveIncomeTotal", viewModel.current_summary.passive_income_total_text);
  setTextContent("step0PassiveIncomeRatio", viewModel.current_summary.passive_income_ratio_text);
  setTextContent("step0PassiveIncomeCoverRatio", viewModel.current_summary.passive_income_cover_ratio_text);
  setTextContent("step0DebtServiceRatio", viewModel.current_summary.debt_service_ratio_text);
  setTextContent("step0LiquidityMonths", viewModel.current_summary.liquidity_months_text);
  setTextContent("step0LiquidRetirementPool", viewModel.current_summary.liquid_retirement_pool_start_text);
  setTextContent("step0FundingEligibleEquity", viewModel.current_summary.current_funding_eligible_equity_text);
  setTextContent("step0HouseholdNetWorth", viewModel.current_summary.household_net_worth_text);

  const cardsContainer = document.getElementById("step0HealthCards");
  if (cardsContainer) {
    cardsContainer.innerHTML = (viewModel.health_check_cards || []).map((card) => `
      <div class="scenario-card">
        <h3>${escapeHtml(card.label)} <span class="report-chip status-${escapeAttr(card.status)}">${escapeHtml(getHealthStatusLabel(card.status))}</span></h3>
        <div class="metric-line"><span class="metric-value">${escapeHtml(card.value_text)}</span></div>
        <p>${escapeHtml(card.help_text || "")}</p>
      </div>
    `).join("");
  }

  const cashflowLogicContainer = document.getElementById("step0CashflowLogic");
  if (cashflowLogicContainer) {
    const lines = viewModel.cashflow_logic_lines || [];
    const overrideHelp = viewModel.current_summary.override_help_text || "";
    cashflowLogicContainer.innerHTML = [
      ...lines.map((line) => `<div>${escapeHtml(line)}</div>`),
      overrideHelp ? `<div style="margin-top:8px;">${escapeHtml(overrideHelp)}</div>` : ""
    ].filter(Boolean).join("");
  }

  const warningsContainer = document.getElementById("step0WarningsList");
  if (warningsContainer) {
    const warnings = viewModel.warnings_banner || [];
    warningsContainer.innerHTML = warnings.length
      ? warnings.map((warning) => `<div>• ${escapeHtml(warning)}</div>`).join("")
      : "目前尚無提醒。";
  }
}

function refreshCurrentSnapshot() {
  if (!window.PlanNormalizerV1 || !window.ProjectionEngineV1 || !window.ReportMapperV1) return;

  try {
    const rawFormState = getRawFormState();
    const normalizedPlan = window.PlanNormalizerV1.normalizePlan(rawFormState);
    const projectionResult = window.ProjectionEngineV1.buildProjectionResult(normalizedPlan);
    const viewModel = window.ReportMapperV1.buildCurrentSnapshotViewModel(normalizedPlan, projectionResult);
    renderCurrentSnapshot(viewModel);
    refreshStep3DerivedPanels(normalizedPlan, projectionResult);
  } catch (error) {
    console.error("Current snapshot render failed", error);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
  showPageNotice("目前設定已儲存。");
}

function buildReportCacheSource(rawData = {}) {
  const viewOnlyKeys = new Set([
    "showInputSummary",
    "showAdvisorAdvice",
    "showMonteCarloSummary",
    "showLogicSteps",
    "showPreChart",
    "showPostChart",
    "showScenarioChart",
    "showMonteCarloChart"
  ]);
  const source = {};

  Object.entries(rawData || {}).forEach(([key, value]) => {
    if (!viewOnlyKeys.has(key)) {
      source[key] = value;
    }
  });

  return {
    engineStamp: REPORT_CACHE_ENGINE_STAMP,
    ...source
  };
}

function stableStringify(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    if (input && typeof input === "object") {
      return Object.keys(input)
        .sort()
        .reduce((acc, key) => {
          acc[key] = normalize(input[key]);
          return acc;
        }, {});
    }
    return input;
  };

  try {
    return JSON.stringify(normalize(value));
  } catch (error) {
    console.warn("快照簽章序列化失敗", error);
    return "";
  }
}

function buildReportCacheSignature(rawData = {}) {
  return stableStringify(buildReportCacheSource(rawData));
}

function saveReportCache(payload) {
  try {
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("儲存報表快照失敗", error);
  }
}

function loadReportCache() {
  try {
    const saved = localStorage.getItem(REPORT_CACHE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.warn("載入報表快照失敗", error);
    return null;
  }
}

function buildAdvisorReportCache(rawData, data, projection, evaluation, scenarioComparisons, mcResults) {
  return {
    schemaVersion: 1,
    source: "advisor",
    signature: buildReportCacheSignature(rawData),
    generatedAt: new Date().toISOString(),
    rawData,
    data,
    projection,
    evaluation,
    scenarioComparisons,
    mcResults
  };
}

function getAdvisorReportCacheForRawData(rawData = getFormData()) {
  const reportCache = loadReportCache();
  if (!reportCache || reportCache.source !== "advisor" || reportCache.schemaVersion !== 1) {
    return null;
  }

  const expectedSignature = buildReportCacheSignature(rawData);
  if (reportCache.signature !== expectedSignature) {
    return null;
  }

  return reportCache;
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    showPageNotice("目前沒有可載入的已存資料。", "error");
    return false;
  }
  try {
    hydrateForm(JSON.parse(saved));
    showPageNotice("已載入上次儲存的設定。");
    refreshCurrentSnapshot();
    return true;
  } catch (error) {
    console.error("載入資料失敗", error);
    showPageNotice("載入失敗，請檢查儲存資料格式。", "error");
    return false;
  }
}

function buildSampleRawState() {
  const reportDate = getLocalDateString();
  return {
    caseName: "夫妻雙薪房產範例",
    clientName: "範例客戶",
    versionName: "Demo Sample",
    baselineVersion: "Baseline",
    advisorName: "系統自動生成",
    reportDate,
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
    advisorNote: "一鍵範例資料，供測試用",
    cashAssets: 500000,
    investmentAssets: 2600000,
    retirementAssets: 1500000,
    accounts: [
      {
        id: "cash-1",
        name: "家庭備用金",
        owner: "joint",
        accountType: "cash",
        assetStyle: "balanced",
        openingBalance: 500000,
        uiPrimaryDriver: "income",
        preRetirementPolicy: "distribution_to_cash",
        postRetirementPolicy: "distribution_to_cash",
        totalReturnRate: 0,
        cashYieldRate: 0,
        priceGrowthRate: 0,
        withdrawalPriority: 1,
        minimumReserve: 200000,
        bucketRole: "bucket1_cash"
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
        minimumReserve: 0,
        bucketRole: "bucket3_growth"
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
        priceGrowthRate: 2,
        withdrawalPriority: 3,
        minimumReserve: 0,
        bucketRole: "bucket2_bond"
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
        cashYieldRate: 3.2,
        priceGrowthRate: 2,
        withdrawalPriority: 4,
        minimumReserve: 0,
        bucketRole: "bucket2_bond"
      }
    ],
    propertyAssets: 10000000,
    propertyName: "新北自住房",
    propertyOwner: "joint",
    propertyType: "residence",
    propertyGrowthRate: 3,
    propertyFundingMode: "net_equity",
    propertySaleAge: 70,
    propertySaleCostRate: 5,
    includePropertyInFunding: true,
    monthlyContribution: 40000,
    monthlyContributionOverride: 40000,
    useManualContributionOverride: false,
    scenarioCMode: "mixed",
    scenarioCReturnBoostPct: 1,
    scenarioCRetireDelayYears: 2,
    scenarioCContributionBoostPct: 15,
    liabilities: [
      {
        id: "mortgage-1",
        name: "房貸",
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
    essentialExpense: 55000,
    discretionaryExpense: 20000,
    monthlyMedicalExpense: 8000,
    monthlyCareExpense: 3000,
    monthlyPremiumExpense: 12000,
    withdrawalStrategy: "fixed_spending",
    fixedWithdrawalRate: 4,
    annualReviewEnabled: true,
    referenceWithdrawalRate: 4,
    strategyGuardrailFloor: 80,
    strategyGuardrailCeiling: 120,
    strategyGuardrailAdjustStep: 10,
    bucketCashMonths: 24,
    bucketBondYears: 8,
    bucketAvoidSellingGrowthAfterLoss: true,
    returnRate: 5,
    postReturnRate: 2,
    inflationRate: 2,
    medicalInflationRate: 5,
    earnedIncomeTaxRate: 10,
    passiveIncomeTaxRate: 5,
    benefitIncomeTaxRate: 5,
    ltcProfile: {
      enabled: false,
      startAge: 80,
      durationYears: 8,
      extraCostFactor: 1.2
    },
    incomes: [
      {
        id: "salary-self",
        name: "王先生薪資",
        owner: "self",
        preset: "salary",
        amount: 160000,
        type: "monthly",
        growthRate: 5,
        years: 20,
        age: 45,
        inflation: true
      },
      {
        id: "salary-spouse",
        name: "王太太薪資",
        owner: "spouse",
        preset: "salary",
        amount: 110000,
        type: "monthly",
        growthRate: 4,
        years: 18,
        age: 43,
        inflation: true
      },
      {
        id: "bonus-1",
        name: "年終獎金",
        owner: "self",
        preset: "bonus",
        amount: 300000,
        type: "lump",
        growthRate: 0,
        years: 1,
        age: 45,
        inflation: false
      },
      {
        id: "rent-1",
        name: "租金收入",
        owner: "household",
        preset: "rent",
        amount: 20000,
        type: "monthly",
        growthRate: 2,
        years: 15,
        age: 45,
        inflation: true
      },
      {
        id: "dividend-1",
        name: "股利收入",
        owner: "self",
        preset: "dividend",
        amount: 10000,
        type: "monthly",
        growthRate: 3,
        years: 20,
        age: 45,
        inflation: false
      },
      {
        id: "labor-pension-1",
        name: "勞退提領",
        owner: "self",
        preset: "labor_pension",
        amount: 25000,
        type: "monthly",
        growthRate: 0,
        years: 25,
        age: 63,
        inflation: true
      }
    ],
    goals: [
      {
        id: "travel-1",
        name: "退休旅遊基金",
        owner: "household",
        category: "travel",
        age: 60,
        type: "lump",
        amount: 500000,
        years: 1,
        inflation: true
      },
      {
        id: "family-1",
        name: "家庭支援",
        owner: "household",
        category: "family",
        age: 50,
        type: "monthly",
        amount: 20000,
        years: 3,
        inflation: true
      }
    ],
    monteCarloOptions: {
      mcEnabled: true,
      mcRandomInflation: true,
      mcFlexibleSpending: true,
      mcRuns: 100,
      mcVolatility: 0.12,
      mcInflationVolatility: 0.012,
      mcSpendingVolatility: 0.06,
      mcSpendingFloor: 0.85,
      mcSpendingCeiling: 1.1
    },
    showInputSummary: true,
    showAdvisorAdvice: true,
    showMonteCarloSummary: true,
    showLogicSteps: true,
    showPreChart: true,
    showPostChart: true,
    showScenarioChart: true,
    showMonteCarloChart: true
  };
}

function loadSampleData() {
  try {
    const sampleRawState = buildSampleRawState();
    hydrateForm(sampleRawState);
    saveData();
    calculateRetirement();
    showPageNotice("已載入範例資料，顧問版已先產出報表。請按上方切換按鈕查看客戶版。");
  } catch (error) {
    console.error("載入範例資料失敗", error);
    showPageNotice("載入範例資料失敗，請稍後再試。", "error");
  }
}

function clearStoredData() {
  if (!window.confirm("要清除已存設定與快照紀錄嗎？")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  showPageNotice("已清除本機儲存資料。");
}

function getSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "[]");
  } catch (error) {
    console.error("解析快照失敗", error);
    return [];
  }
}

function saveSnapshot(snapshot) {
  const snapshots = getSnapshots();
  snapshots.unshift(snapshot);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, 20)));
}

function recordSnapshot(rawData, scenarioComparisons, mcResults) {
  const baseline = scenarioComparisons[0];
  saveSnapshot({
    timestamp: new Date().toISOString(),
    caseName: rawData.caseName || rawData.clientName || "未命名案件",
    versionName: rawData.versionName || "未命名版本",
    baselineVersion: rawData.baselineVersion || "未填基準版本",
    householdMode: rawData.householdMode,
    retirementAsset: baseline?.evaluation?.retirementPoint?.value || 0,
    depletionAge: baseline?.evaluation?.depletionPoint?.age || null,
    finalAsset: baseline?.evaluation?.finalPoint?.value || 0,
    successRate: mcResults?.successRate || null
  });
}

function getStrategyDescription(data) {
  const strategy = data.strategy || {};
  const referenceRate = getReferenceWithdrawalRate(data);
  const annualReviewEnabled = getAnnualReviewEnabled(data);
  const annualReviewText = annualReviewEnabled ? "並預設每年重估一次" : "目前先不啟用年度重估";
  if (strategy.type === "fixed_rate") {
    return `固定提領率（Bengen 4% 法則）${formatPercent(strategy.fixedWithdrawalRate)}，參考提領率 ${formatPercent(referenceRate)}，${annualReviewText}`;
  }
  if (strategy.type === "guardrail") {
    return `Guardrail（Guyton-Klinger 護欄策略），參考提領率 ${formatPercent(referenceRate)}，觸發區間（相對初始提領率）${formatPercent(strategy.guardrailFloor, 0)}～${formatPercent(strategy.guardrailCeiling, 0)}，${annualReviewText}`;
  }
  if (strategy.type === "bucket") {
    return `三桶金（Bucket Portfolios），現金桶目標 ${toFiniteNumber(strategy.bucketCashMonths, 24)} 個月、債券桶建議 ${toFiniteNumber(strategy.bucketBondYears, 8)} 年，${annualReviewText}`;
  }
  return `固定支出策略，參考提領率 ${formatPercent(referenceRate)} 作為比較線，先照既定生活費執行，${annualReviewText}`;
}

function buildWithdrawalStrategyWarnings(data) {
  const strategy = data.strategy || {};
  const referenceRate = getReferenceWithdrawalRate(data);
  const fixedRate = toFiniteNumber(strategy.fixedWithdrawalRate, NaN);
  const warnings = [];
  if (referenceRate < 3.0) {
    warnings.push(`參考提領率 ${formatPercent(referenceRate)} 低於 3%，可能偏保守，請確認是否為刻意設定。`);
  }
  if (referenceRate > 5.5) {
    warnings.push(`參考提領率 ${formatPercent(referenceRate)} 高於 5.5%，風險偏高，建議搭配動態提領或保證收入。`);
  }
  if (strategy.type === "fixed_rate" && Number.isFinite(fixedRate) && fixedRate > 4.5) {
    warnings.push(`固定提領率 ${formatPercent(fixedRate)} 高於 4.5%，建議再確認資產組合與提領年期是否撐得住。`);
  }
  if (strategy.type === "bucket") {
    const cashMonths = toFiniteNumber(strategy.bucketCashMonths, 24);
    const bondYears = toFiniteNumber(strategy.bucketBondYears, 8);
    if (cashMonths < 6) {
      warnings.push(`現金桶目標僅 ${cashMonths} 個月，偏低，建議至少保留 6 個月以上生活費在現金桶。`);
    }
    if (bondYears < 2) {
      warnings.push(`債券桶建議年數僅 ${bondYears} 年，偏低，建議至少 2 年以上以降低成長桶被迫變現的機率。`);
    }
  }
  return warnings;
}

function buildWithdrawalStrategyTexts(data) {
  const strategy = data.strategy || {};
  const referenceRate = getReferenceWithdrawalRate(data);
  const annualReviewEnabled = getAnnualReviewEnabled(data);
  const fixedRate = toFiniteNumber(strategy.fixedWithdrawalRate, NaN);
  const suggestedRate = strategy.type === "fixed_rate" && Number.isFinite(fixedRate) && fixedRate > 0
    ? fixedRate
    : referenceRate;

  const suggestedWithdrawalRateText = `在目前假設下的建議參考提領率是 ${formatPercent(suggestedRate)}；4% 參考線（目前設定 ${formatPercent(referenceRate)}）只是市場常用的比較點，不是保證值，也不是唯一正確答案。`;

  let strategyDescriptionText;
  if (strategy.type === "fixed_rate") {
    strategyDescriptionText = `目前採用「固定提領率（Bengen 4% 法則）」策略：退休當年依約 ${formatPercent(fixedRate > 0 ? fixedRate : suggestedRate)} 提領起始資產金額，之後每年只跟通膨調整，不因資產漲跌重算比例，規則簡單、容易預期。`;
  } else if (strategy.type === "guardrail") {
    strategyDescriptionText = `目前採用「Guardrail（Guyton-Klinger 護欄策略）」：提領金額每年先跟通膨調整（前一年若虧損則凍結該年調整），若提領率超出初始提領率的 ${formatPercent(strategy.guardrailFloor, 0)}～${formatPercent(strategy.guardrailCeiling, 0)} 區間，再依 ${formatPercent(strategy.guardrailAdjustStep, 0)} 幅度調整彈性支出，不會動到必要生活費。`;
  } else if (strategy.type === "bucket") {
    strategyDescriptionText = `目前採用「三桶金（Bucket Portfolios）」策略：現金桶目標 ${toFiniteNumber(strategy.bucketCashMonths, 24)} 個月生活費、債券桶建議 ${toFiniteNumber(strategy.bucketBondYears, 8)} 年，優先動用現金桶支應生活費，現金不足時依序從債券桶、成長桶回補，成長桶前一年虧損時原則上暫緩動用。`;
  } else {
    strategyDescriptionText = `目前採用「固定支出」策略：先照既定生活費執行，${formatPercent(referenceRate)} 參考線只用來對照提領壓力大不大。`;
  }

  const warnings = buildWithdrawalStrategyWarnings(data);
  const reviewText = annualReviewEnabled
    ? "若市場轉弱或支出提高，系統會建議在每年重估時重新檢視提領假設。"
    : "目前未啟用年度重估，建議至少每年手動檢視一次提領假設是否仍然合適。";
  const withdrawalRiskNote = warnings.length ? `${warnings.join(" ")}${reviewText}` : reviewText;

  return { suggestedWithdrawalRateText, strategyDescriptionText, withdrawalRiskNote, warnings };
}

function generateSummaryLegacy() {
  const rawData = getFormData();
  const data = (window.PlanNormalizerV1 && window.ProjectionEngineV1)
    ? window.ProjectionEngineV1.buildLegacyCompatibleData(rawData, window.PlanNormalizerV1.normalizePlan(rawData))
    : normalizePlanData(rawData);
  updateAnnualReviewStatusBadge(data);
  const householdLabel = data.householdMode === "couple" ? "夫妻模式" : "單人模式";
  const annualReviewLabel = getAnnualReviewEnabled(data) ? "預設啟用" : "停用";
  document.getElementById("step4Summary").innerHTML = `
    準備產出 <strong>${escapeHtml(data.caseName || "未命名案件")}</strong> 的第一階段退休規劃報表。<br>
    家庭模式：<strong>${data.householdMode === "couple" ? "夫妻模式" : "單人模式"}</strong>；時間軸以本人 ${data.currentAge} 歲為主，規劃到 ${data.lifeExpectancy} 歲。<br>
    退休資金池：<strong>${formatCurrency(data.assets)}</strong>；提領策略：<strong>${escapeHtml(getStrategyDescription(data))}</strong>；參考提領率：<strong>${formatPercent(getReferenceWithdrawalRate(data))}</strong>；年度重估：<strong>${annualReviewLabel}</strong>。
  `;
  document.getElementById("step4Summary").innerHTML = `
    準備產出 <strong>${escapeHtml(data.caseName || "未命名案件")}</strong> 的第一階段退休規劃報表。<br>
    家庭模式：<strong>${householdLabel}</strong>；時間軸以本人 ${data.currentAge} 歲為主，規劃到 ${data.lifeExpectancy} 歲。<br>
    目前可提領資產起點（今天）：<strong>${formatCurrency(data.assets)}</strong>；提領策略：<strong>${escapeHtml(getStrategyDescription(data))}</strong>；參考提領率：<strong>${formatPercent(getReferenceWithdrawalRate(data))}</strong>；年度重估：<strong>${annualReviewLabel}</strong>。退休時點資產會在正式報表另列。
  `;
}

function generateSummary() {
  const rawData = getFormData();
  const data = (window.PlanNormalizerV1 && window.ProjectionEngineV1)
    ? window.ProjectionEngineV1.buildLegacyCompatibleData(rawData, window.PlanNormalizerV1.normalizePlan(rawData))
    : normalizePlanData(rawData);
  updateAnnualReviewStatusBadge(data);
  const householdLabel = data.householdMode === "couple" ? "夫妻家庭" : "單人家庭";
  const snapshot = data.currentSnapshot || {};
  const naturalSurplus = toFiniteNumber(snapshot.annual_surplus_before_override, 0);
  const investableSurplus = toFiniteNumber(snapshot.annual_investable_surplus, 0);
  const overrideGap = toFiniteNumber(snapshot.manual_override_gap, 0);
  const overrideEnabled = data.useManualContributionOverride === true;
  const annualReviewLabel = getAnnualReviewEnabled(data) ? "預設啟用" : "停用";
  const scenarioCSummary = buildScenarioCSettingsSummary(rawData);
  const overrideText = overrideEnabled
    ? `已啟用手動校正投入，年度投入改採 ${formatCurrency(investableSurplus)}，與自然淨餘差額 ${formatSignedCurrency(overrideGap)}。`
    : `未啟用手動校正投入，年度可投資金額直接採自然淨餘 ${formatCurrency(investableSurplus)}。`;

  document.getElementById("step4Summary").innerHTML = `
    規劃摘要 <strong>${escapeHtml(data.caseName || "未命名案件")}</strong><br>
    家庭型態 <strong>${householdLabel}</strong>，目前年齡 ${data.currentAge} 歲，退休年齡 ${data.retireAge} 歲，規劃至 ${data.lifeExpectancy} 歲。<br>
    目前可提領資產起點 <strong>${formatCurrency(data.assets)}</strong>，退休策略採 <strong>${escapeHtml(getStrategyDescription(data))}</strong>。<br>
    參考提領率 <strong>${formatPercent(getReferenceWithdrawalRate(data))}</strong>，用來對照參考線 / 動態提領的基準線。<br>
    年度重估 <strong>${annualReviewLabel}</strong>，表示每年都會重新檢視一次提領基準。<br>
    年稅額 ${formatCurrency(snapshot.annual_tax_total || 0)}、年保費 ${formatCurrency(snapshot.annual_premium_total || 0)}、自然年度淨餘 <strong>${formatCurrency(naturalSurplus)}</strong>。<br>
    方案 C 設定 <strong>${escapeHtml(scenarioCSummary)}</strong>。<br>
    ${escapeHtml(overrideText)}
  `;
}

function buildSuggestions(data, evaluation, scenarioComparisons, mcResults) {
  const suggestions = [];
  const diagnostics = data.diagnostics || {};
  const baseline = scenarioComparisons[0];
  const conservative = scenarioComparisons[1];
  const improvement = scenarioComparisons[2];
  const referenceRate = getReferenceWithdrawalRate(data);

  if ((diagnostics.blockingErrors || []).length) {
    suggestions.push(`目前還有 ${diagnostics.blockingErrors.length} 項需要先修正的設定，建議先把帳戶、房產、負債的關聯整理好，再往下看退休結果。`);
  }
  if ((diagnostics.antiDoubleCountFlags || []).length) {
    const topFlag = diagnostics.antiDoubleCountFlags[0];
    suggestions.push(`我們先幫您留意到 ${diagnostics.antiDoubleCountFlags.length} 個需要核對的地方，最主要的是：${topFlag}`);
  }

  if (evaluation.depletionPoint) {
    suggestions.push(`照目前基準來看，資產大約會在 ${evaluation.depletionPoint.age} 歲前後用完；如果要改善，先從退休年齡、持續投入、彈性支出三個方向下手。`);
  } else {
    suggestions.push(`照目前基準來看，資產可以一路撐到 ${data.lifeExpectancy} 歲，基本盤已經站得住。`);
  }
  if (evaluation.fundedRatio < 1) {
    suggestions.push(`目前退休資產還沒完全跨過 ${formatPercent(referenceRate)} 的參考門檻，建議先看方案 C 的改善效果。`);
  }
  const withdrawalWarnings = buildWithdrawalStrategyWarnings(data);
  if (withdrawalWarnings.length) {
    suggestions.push(`提領率設定有 ${withdrawalWarnings.length} 項要留意：${withdrawalWarnings[0]}完整警示請看「參考提領檢查」區塊。`);
  }
  if ((data.liabilities || []).some((item) => item.monthlyPayment > 0 && item.payoffAge > data.retireAge)) {
    suggestions.push("有幾筆負債會延續到退休後，這部分建議納入正式還款安排。");
  }
  if (data.householdMode === "couple" && data.spousePerson) {
    suggestions.push("目前這次規劃已把配偶壽命一起算進去；下一步可以再看遺屬年金和單人存活的情境。");
  }
  if (mcResults && mcResults.successRate < 70) {
    suggestions.push("情境壓測的成功率還偏低，代表安全邊際不夠，守門線或延後退休可以先列入討論。");
  }
  if (
    conservative?.evaluation?.finalPoint?.value <
    baseline?.evaluation?.finalPoint?.value
  ) {
    suggestions.push("保守版一拉出來就看得出來，這個案子對報酬和通膨很敏感；後面可以再把稅務和帳戶配置拆細。");
  }
  if (
    improvement?.evaluation?.finalPoint?.value >
    baseline?.evaluation?.finalPoint?.value * 1.15
  ) {
    suggestions.push("改善版的差距很明顯，代表只要調整幾個關鍵參數，結果就會拉開。");
  }
  return suggestions;
}

function getScenarioStatus(evaluation) {
  if (evaluation.depletionPoint) return { label: "需調整", className: "status-bad" };
  if (evaluation.fundedRatio < 1) return { label: "邊界", className: "status-warn" };
  return { label: "穩健", className: "status-good" };
}

function calculateRetirement() {
  if (!validateAllInputs()) return;

  const rawData = getFormData();
  const normalizedPlan = window.PlanNormalizerV1?.normalizePlan
    ? window.PlanNormalizerV1.normalizePlan(rawData)
    : null;
  const projectionResult = normalizedPlan && window.ProjectionEngineV1?.buildProjectionResult
    ? window.ProjectionEngineV1.buildProjectionResult(normalizedPlan, {
        rawFormState: rawData,
        includeScenarios: true,
        includeMonteCarlo: true
      })
    : null;
  const scenarioComparisons = projectionResult?.legacy?.scenarioComparisons?.length
    ? projectionResult.legacy.scenarioComparisons
    : buildScenarioVariants(rawData);
  const baseline = scenarioComparisons[0];
  const mcResults = projectionResult?.legacy?.monteCarlo
    || (baseline?.data?.monteCarloOptions?.mcEnabled ? runMonteCarlo(rawData) : null);

  lastRenderedRawData = rawData;
  lastRenderedData = baseline.data;
  lastRenderedProjection = baseline.projection;
  lastRenderedMonteCarlo = mcResults;
  lastRenderedScenarioComparisons = scenarioComparisons;

  recordSnapshot(rawData, scenarioComparisons, mcResults);
  saveReportCache(buildAdvisorReportCache(rawData, baseline.data, baseline.projection, baseline.evaluation, scenarioComparisons, mcResults));

  document.getElementById("shareBox").classList.add("hidden");
  document.getElementById("homeSection").classList.add("hidden");
  document.getElementById("reportSection").classList.remove("hidden");
  window.scrollTo(0, 0);

  renderReportByMode(baseline.data, baseline.projection, baseline.evaluation, scenarioComparisons, mcResults);

  if (typeof Chart !== "undefined") {
    renderCharts(baseline.data, baseline.projection, scenarioComparisons, mcResults);
  } else {
    console.warn("未偵測到 Chart.js，跳過圖表渲染。");
    alert("系統未偵測到繪圖核心，圖表將無法顯示。請確認可正常載入 Chart.js。");
  }
}

function renderScenarioComparison(scenarioComparisons) {
  document.getElementById("scenarioComparisonSummary").innerHTML = buildScenarioComparisonSummaryText(scenarioComparisons);

  document.getElementById("scenarioComparisonGrid").innerHTML = scenarioComparisons.map((scenario) => {
    const status = getScenarioStatus(scenario.evaluation);
    return `
      <div class="scenario-card">
        <h3>${escapeHtml(scenario.label)} <span class="report-chip ${status.className}">${escapeHtml(status.label)}</span></h3>
        <p>${escapeHtml(scenario.description)}</p>
        <div class="metric-line">退休起點資產：<span class="metric-value">${formatCurrency(scenario.evaluation.retirementPoint.value)}</span></div>
        <div class="metric-line">退休結束時資產：<span class="metric-value">${formatCurrency(scenario.evaluation.finalPoint.value)}</span></div>
        <div class="metric-line">參考覆蓋率：<span class="metric-value">${(scenario.evaluation.fundedRatio * 100).toFixed(1)}%</span></div>
        <div class="metric-line">資產用完年齡：<span class="metric-value">${scenario.evaluation.depletionPoint ? `${scenario.evaluation.depletionPoint.age} 歲` : "尚未用完"}</span></div>
      </div>
    `;
  }).join("");
}

function buildAccountReportLogic(account) {
  const name = account.name || "帳戶";
  const openingBalance = Number(account.openingBalance || 0);
  const reserve = Number(account.minimumReserve || 0);

  if (account.inputMode === "total_return") {
    return `${name} 先用總報酬法看，起始餘額是 ${formatCurrency(openingBalance)}，假設總報酬率 ${formatPercent(account.totalReturnRate || 0)}。退休前先採 ${getAccountPrePolicyLabel(account.preRetirementPolicy)}，退休後先採 ${getAccountPostPolicyLabel(account.postRetirementPolicy)}，最低保留 ${formatCurrency(reserve)}。這類帳戶不另外拆股利或利息，現金需求主要靠賣單位來補。`;
  }

  return `${name} 先用收益加成長法看，起始餘額是 ${formatCurrency(openingBalance)}，收益率 ${formatPercent(account.cashYieldRate || 0)}，價格成長率 ${formatPercent(account.priceGrowthRate || 0)}。退休前先採 ${getAccountPrePolicyLabel(account.preRetirementPolicy)}，退休後先採 ${getAccountPostPolicyLabel(account.postRetirementPolicy)}，最低保留 ${formatCurrency(reserve)}。如果收益不夠，再照提領順序補賣單位。`;
}

function buildAccountReportSummary(data) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const summary = data.accountSummary || {};
  const balanceOf = (account) => toFiniteNumber(account.openingBalance ?? account.opening_balance, 0);
  const annualDistributionOf = (account) => toFiniteNumber(account.expectedAnnualDistribution ?? account.expected_annual_distribution, 0);
  const annualGrowthOf = (account) => toFiniteNumber(account.expectedAnnualGrowth ?? account.expected_annual_growth, 0);

  const totalBalance = accounts.reduce((sum, account) => sum + balanceOf(account), 0);
  const incomeStyleBalance = accounts
    .filter((account) => (account.inputMode ?? account.input_mode) === "yield_plus_growth")
    .reduce((sum, account) => sum + balanceOf(account), 0);
  const growthStyleBalance = accounts
    .filter((account) => (account.inputMode ?? account.input_mode) === "total_return")
    .reduce((sum, account) => sum + balanceOf(account), 0);
  const retirementEligibleBalance = accounts
    .filter((account) => (account.retirementEligible ?? account.retirement_eligible) !== false)
    .reduce((sum, account) => sum + balanceOf(account), 0);
  const cashAccountBalance = accounts
    .filter((account) => (account.accountType ?? account.account_type) === "cash")
    .reduce((sum, account) => sum + balanceOf(account), 0);
  const expectedAnnualDistribution = accounts.reduce((sum, account) => sum + annualDistributionOf(account), 0);
  const expectedAnnualGrowth = accounts.reduce((sum, account) => sum + annualGrowthOf(account), 0);

  return {
    count: Number.isFinite(summary.count) ? summary.count : accounts.length,
    totalBalance: Number.isFinite(summary.totalBalance) ? summary.totalBalance : totalBalance,
    incomeStyleBalance: Number.isFinite(summary.incomeStyleBalance) ? summary.incomeStyleBalance : incomeStyleBalance,
    growthStyleBalance: Number.isFinite(summary.growthStyleBalance) ? summary.growthStyleBalance : growthStyleBalance,
    retirementEligibleBalance: Number.isFinite(summary.retirementEligibleBalance) ? summary.retirementEligibleBalance : retirementEligibleBalance,
    cashAccountBalance: Number.isFinite(summary.cashAccountBalance) ? summary.cashAccountBalance : cashAccountBalance,
    expectedAnnualDistribution: Number.isFinite(summary.expectedAnnualDistribution) ? summary.expectedAnnualDistribution : expectedAnnualDistribution,
    expectedAnnualGrowth: Number.isFinite(summary.expectedAnnualGrowth) ? summary.expectedAnnualGrowth : expectedAnnualGrowth
  };
}

function buildAccountReportWarnings(data) {
  const diagnostics = data.diagnostics || {};
  const warnings = [];

  if ((diagnostics.blockingErrors || []).length) {
    warnings.push(`目前有 ${diagnostics.blockingErrors.length} 項需要先修正的設定，請先整理好再看帳戶報表。`);
  }
  if ((diagnostics.antiDoubleCountFlags || []).length) {
    const topFlag = diagnostics.antiDoubleCountFlags[0];
    warnings.push(`我們先幫您留意到 ${diagnostics.antiDoubleCountFlags.length} 項需要核對的地方，最主要的是：${topFlag}`);
  }
  if ((diagnostics.warnings || []).length) {
    warnings.push(`我們還有 ${diagnostics.warnings.length} 項小提醒，像是提領順序、最低保留金額、名稱重複等設定，建議再核對一次。`);
  }

  return warnings;
}

function renderAccountReports(data) {
  const accountBlock = document.getElementById("accountBlock");
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const summary = buildAccountReportSummary(data);
  const globalWarnings = buildAccountReportWarnings(data);

  if (!accountBlock) return;
  if (!accounts.length) {
    accountBlock.style.display = "none";
    accountBlock.innerHTML = "";
    return;
  }

  const priorityMap = new Map();
  const accountWarnings = [];

  accounts.forEach((account, index) => {
    const accountName = account.name || account.accountName || `帳戶 ${index + 1}`;
    const openingBalance = toFiniteNumber(account.openingBalance ?? account.opening_balance, 0);
    const reserve = toFiniteNumber(account.minimumReserve ?? account.minimum_reserve, 0);
    const inputMode = account.inputMode ?? account.input_mode;
    const postPolicy = account.postRetirementPolicy ?? account.post_retirement_policy;
    const priority = Number(account.withdrawalPriority ?? account.withdrawal_priority);

    if (Number.isFinite(priority) && priority > 0) {
      if (!priorityMap.has(priority)) {
        priorityMap.set(priority, []);
      }
      priorityMap.get(priority).push(accountName);
    } else {
      accountWarnings.push(`⚠️ ${accountName} 還沒設定提領順序，系統會先照畫面順序暫代，建議補一個明確數字。`);
    }

    if (reserve > openingBalance && openingBalance > 0) {
      accountWarnings.push(`⚠️ ${accountName} 的最低保留金額高於目前餘額，建議再確認一次是不是輸入太大。`);
    }

    if (inputMode === "total_return" && postPolicy === "distribution_to_cash") {
      accountWarnings.push(`⚠️ ${accountName} 目前用的是總報酬模式，但退休後又直接領現金，這種組合比較容易混淆，建議看看是否要改成收益+成長模式。`);
    }

    if (inputMode === "yield_plus_growth" && postPolicy === "sell_only") {
      accountWarnings.push(`⚠️ ${accountName} 目前用的是收益+成長模式，但退休後只賣單位，建議確認配息是否已經有正確納入現金流。`);
    }
  });

  priorityMap.forEach((names, priority) => {
    if (names.length > 1) {
      accountWarnings.push(`⚠️ 提領順序 ${priority} 有 ${names.length} 筆帳戶同時使用，建議再確認先後順序是不是你刻意安排的：${names.join("、")}`);
    }
  });

  const warningLines = [...globalWarnings, ...accountWarnings];
  const summaryLines = [
    `帳戶筆數：${summary.count} 筆`,
    `帳戶總額：${formatCurrency(summary.totalBalance)}`,
    `可動用退休帳戶：${formatCurrency(summary.retirementEligibleBalance)}`,
    `現金帳戶餘額：${formatCurrency(summary.cashAccountBalance)}`,
    `收益型資產：${formatCurrency(summary.incomeStyleBalance)}｜成長型資產：${formatCurrency(summary.growthStyleBalance)}`,
    `預期年度配息 / 收益：${formatCurrency(summary.expectedAnnualDistribution)}｜預期年度成長：${formatCurrency(summary.expectedAnnualGrowth)}`,
    `白話提醒：提領順序數字越小越先用；最低保留金額會先保留，不會被提領。`
  ];

  accountBlock.style.display = "block";
  accountBlock.innerHTML = `
    <strong>帳戶層摘要</strong><br>
    <div class="cashflow-audit">${summaryLines.map((line) => escapeHtml(line)).join("<br>")}</div>
    ${warningLines.length ? `
      <div class="cashflow-audit" style="margin-top:10px; padding:12px; border-left:4px solid var(--accent-warn); background: rgba(233, 125, 61, 0.08);">
        <strong>帳戶層警示</strong><br>
        ${warningLines.map((line) => escapeHtml(line)).join("<br>")}
      </div>
    ` : ""}
    <div style="margin-top:10px;">
      ${accounts.map((account, index) => {
        const accountName = account.name || account.accountName || `帳戶 ${index + 1}`;
        const openingBalance = toFiniteNumber(account.openingBalance ?? account.opening_balance, 0);
        const annualDistribution = toFiniteNumber(account.expectedAnnualDistribution ?? account.expected_annual_distribution, 0);
        const annualGrowth = toFiniteNumber(account.expectedAnnualGrowth ?? account.expected_annual_growth, 0);
        const reserve = toFiniteNumber(account.minimumReserve ?? account.minimum_reserve, 0);
        const inputMode = account.inputMode ?? account.input_mode;
        const postPolicy = account.postRetirementPolicy ?? account.post_retirement_policy;
        const priority = Number(account.withdrawalPriority ?? account.withdrawal_priority);
        const itemWarnings = [];

        if (reserve > openingBalance && openingBalance > 0) {
          itemWarnings.push("最低保留金額高於目前餘額");
        }
        if (inputMode === "total_return" && postPolicy === "distribution_to_cash") {
          itemWarnings.push("總報酬模式卻直接領現金");
        }
        if (inputMode === "yield_plus_growth" && postPolicy === "sell_only") {
          itemWarnings.push("收益+成長模式卻只賣單位");
        }
        if (!Number.isFinite(priority) || priority <= 0) {
          itemWarnings.push("尚未設定提領順序");
        }

        return `
          <div class="card" style="margin-top:10px; padding:12px;">
            <div class="metric-line">
              <span>${escapeHtml(accountName)}</span>
              <span class="metric-value">${formatCurrency(openingBalance)}</span>
            </div>
            <div>所有權人：${escapeHtml(getAccountOwnerLabel(account.owner))}｜類型：${escapeHtml(getAccountTypeLabel(account.accountType))}｜資產類型：${escapeHtml(getAccountDriverLabel(account.primaryDriver))}</div>
            <div>退休前：${escapeHtml(getAccountPrePolicyLabel(account.preRetirementPolicy))}｜退休後：${escapeHtml(getAccountPostPolicyLabel(account.postRetirementPolicy))}</div>
            <div>提領順序：${Number.isFinite(priority) && priority > 0 ? priority : "未設定"}｜最低保留金額：${formatCurrency(reserve)}</div>
            <div>今年預估配息 / 收益：${formatCurrency(annualDistribution)}｜今年預估成長：${formatCurrency(annualGrowth)}</div>
            ${itemWarnings.length ? `<div class="cashflow-audit" style="margin-top:8px; padding:10px; border-left:4px solid var(--accent-warn); background: rgba(233, 125, 61, 0.08);">${itemWarnings.map((line) => escapeHtml(`⚠️ ${line}`)).join("<br>")}</div>` : ""}
            <details class="logic-details" style="margin-top:8px;">
              <summary>帳戶白話運算邏輯</summary>
              <div style="margin-top:6px;">${escapeHtml(buildAccountReportLogic(account))}</div>
            </details>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildPropertyReportLogic(property) {
  const name = property.name || "未命名房產";
  const linkedDebt = Number(property.linkedLiabilityBalance || 0);
  const marketValue = Number(property.currentMarketValue || 0);
  const netEquity = Number(property.netEquity || 0);
  const saleAgeText = property.saleAge ? `${property.saleAge} 歲` : "指定出售年齡";

  if (property.fundingMode === "net_equity") {
    return `${name} 目前走「${getPropertyFundingModeLabel(property.fundingMode)}」：白話就是先看房子扣完已連動房貸後還剩多少淨值，也就是房產市值 ${formatCurrency(marketValue)} - 已連動負債 ${formatCurrency(linkedDebt)} = ${formatCurrency(netEquity)}。房貸月付還是會照年度現金流慢慢扣，不會在起跑點再重算一次。`;
  }

  if (property.fundingMode === "sale_event") {
    return `${name} 目前走「${getPropertyFundingModeLabel(property.fundingMode)}」：白話就是目前這筆房產設定選擇先不納入退休可提領資產，等到 ${saleAgeText} 出售時，系統會先扣出售成本 ${formatPercent(property.saleCostRate || 0)}，再清掉已連動負債 ${formatCurrency(linkedDebt)}，最後剩下的淨額才轉進退休資金池。`;
  }

  return `${name} 目前走「${getPropertyFundingModeLabel(property.fundingMode)}」：白話就是這間房先只放在家庭淨值裡，不直接當退休生活費來源；如果有房貸，月付還是會照常壓縮每年的現金流。`;
}

function buildLiabilityReportLogic(liability) {
  const annualPayment = Number.isFinite(liability.annualPayment) ? liability.annualPayment : Number(liability.monthlyPayment || 0) * 12;
  const payoffText = liability.payoffAge ? `${liability.payoffAge} 歲` : "清償年齡";
  const linkedPropertyText = liability.linkedPropertyName ? `，目前連動 ${liability.linkedPropertyName}` : "";

  if (liability.treatmentMode === "prepay") {
    const prepayAmountText = liability.prepayAmount > 0 ? formatCurrency(liability.prepayAmount) : "當時剩餘餘額";
    return `${liability.name || "未命名負債"} 目前走「${getLiabilityTreatmentLabel(liability.treatmentMode)}」：白話就是平常先把每月還款 ${formatCurrency(liability.monthlyPayment)}（年付 ${formatCurrency(annualPayment)}）算進現金流；到了 ${liability.prepayAge || "指定"} 歲再一次清掉 ${prepayAmountText}，之後就不再月付${linkedPropertyText}。`;
  }

  return `${liability.name || "未命名負債"} 目前走「${getLiabilityTreatmentLabel(liability.treatmentMode)}」：白話就是每年先把債務付款 ${formatCurrency(annualPayment)} 算進現金流，直到 ${payoffText} 停止；這筆負債不會在起始退休資產裡再被整筆重扣${linkedPropertyText}。`;
}

function renderPropertyAndLiabilityReports(data) {
  const propertyBlock = document.getElementById("propertyBlock");
  const liabilityBlock = document.getElementById("liabilityBlock");
  const properties = Array.isArray(data.properties) ? data.properties : [];
  const liabilities = Array.isArray(data.liabilities) ? data.liabilities : [];
  const propertySummary = data.propertySummary || {};
  const liabilitySummary = data.liabilitySummary || {};

  if (propertyBlock) {
    if (!properties.length) {
      propertyBlock.style.display = "none";
    } else {
      propertyBlock.style.display = "block";
      propertyBlock.innerHTML = `
        <strong>房產摘要（顧問白話版）</strong><br>
        目前共有 ${properties.length} 筆房產；市值合計 ${formatCurrency(propertySummary.totalMarketValue || 0)}，家庭淨值中的房產部分 ${formatCurrency(propertySummary.totalNetEquity || 0)}，可直接納入退休資金池的房產淨值 ${formatCurrency(propertySummary.fundingEligibleEquity || 0)}。${propertySummary.saleEventCount ? ` 其中 ${propertySummary.saleEventCount} 筆是先等未來出售。` : ""}${propertySummary.netEquityCount ? ` 其中 ${propertySummary.netEquityCount} 筆是先算淨值納入。` : ""}
        <div style="margin-top:10px;">
          ${properties.map((property) => `
            <div class="card" style="margin-top:10px; padding:12px;">
              <div class="metric-line"><span>${escapeHtml(property.name || "未命名房產")}</span><span class="metric-value">${formatCurrency(property.currentMarketValue || 0)}</span></div>
              <div>類型：${escapeHtml(getPropertyTypeLabel(property.type))}｜處理方式：${escapeHtml(getPropertyFundingModeLabel(property.fundingMode))}</div>
              <div>已連動負債：${formatCurrency(property.linkedLiabilityBalance || 0)}｜目前房產淨值：${formatCurrency(property.netEquity || 0)}</div>
              ${property.fundingMode === "sale_event" ? `<div>出售設定：${property.saleAge || "未指定"} 歲｜出售成本率：${formatPercent(property.saleCostRate || 0)}</div>` : ""}
              ${property.fundingMode === "net_equity" ? `<div>可直接納入退休資金的金額：${formatCurrency(property.fundingEligibleEquity || 0)}</div>` : ""}
              <details style="margin-top:8px;">
                <summary>這間房的白話說法</summary>
                <div style="margin-top:6px;">${escapeHtml(buildPropertyReportLogic(property))}</div>
              </details>
            </div>
          `).join("")}
        </div>
      `;
    }
  }

  if (liabilityBlock) {
    if (!liabilities.length) {
      liabilityBlock.style.display = "none";
    } else {
      liabilityBlock.style.display = "block";
      liabilityBlock.innerHTML = `
        <strong>負債摘要（顧問白話版）</strong><br>
        目前共有 ${liabilities.length} 筆負債；餘額合計 ${formatCurrency(liabilitySummary.totalBalance || 0)}，每年要付的債務現金流 ${formatCurrency(liabilitySummary.totalAnnualDebtService || 0)}。如果把退休後也一起看，還會持續影響現金流的年付款約 ${formatCurrency(liabilitySummary.retirementAnnualDebtService || 0)}。${liabilitySummary.prepayCount ? ` 其中 ${liabilitySummary.prepayCount} 筆是規劃提前清償。` : ""}
        <div style="margin-top:10px;">
          ${liabilities.map((liability) => `
            <div class="card" style="margin-top:10px; padding:12px;">
              <div class="metric-line"><span>${escapeHtml(liability.name || "未命名負債")}</span><span class="metric-value">${formatCurrency(liability.currentBalance || 0)}</span></div>
              <div>類型：${escapeHtml(getDebtTypeLabel(liability.debtType))}｜處理方式：${escapeHtml(getLiabilityTreatmentLabel(liability.treatmentMode))}</div>
              <div>月付：${formatCurrency(liability.monthlyPayment || 0)}｜年付：${formatCurrency(liability.annualPayment || 0)}｜利率：${formatPercent(liability.annualInterestRate || 0)}</div>
              <div>清償年齡：${liability.payoffAge || "未指定"} 歲｜退休後影響：${liability.extendsIntoRetirement && liability.includeInRetirementCashflow ? "會延續到退休後" : "不延續到退休後或不納入退休現金流"}</div>
              ${liability.linkedPropertyName ? `<div>連動房產：${escapeHtml(liability.linkedPropertyName)}</div>` : ""}
              ${liability.treatmentMode === "prepay" ? `<div>提前清償：${liability.prepayAge || "未指定"} 歲｜金額：${liability.prepayAmount > 0 ? formatCurrency(liability.prepayAmount) : "當時剩餘餘額"}</div>` : ""}
              <details style="margin-top:8px;">
                <summary>這筆負債的白話說法</summary>
                <div style="margin-top:6px;">${escapeHtml(buildLiabilityReportLogic(liability))}</div>
              </details>
            </div>
          `).join("")}
        </div>
      `;
    }
  }
}

function renderTextReportsLegacy(data, projection, evaluation, scenarioComparisons, mcResults) {
  const suggestions = buildSuggestions(data, evaluation, scenarioComparisons, mcResults);
  const snapshots = getSnapshots().slice(0, 3);

  document.getElementById("printMeta").innerHTML = `
    案件：${escapeHtml(data.caseName || data.clientName || "未命名案件")} |
    版本：${escapeHtml(data.versionName || "未命名版本")} |
    基準：${escapeHtml(data.baselineVersion || "未填基準版本")}<br>
    報告日期：${escapeHtml(data.reportDate || getLocalDateString())} |
    家庭模式：${data.householdMode === "couple" ? "夫妻模式" : "單人模式"}
  `;

  document.getElementById("reportSummary").innerHTML = `
    <strong>案件摘要</strong><br>
    案件：${escapeHtml(data.caseName || "未命名案件")}；版本：${escapeHtml(data.versionName || "未命名版本")}；基準版本：${escapeHtml(data.baselineVersion || "未填基準版本")}。<br>
    家庭模式：${data.householdMode === "couple" ? "夫妻模式" : "單人模式"}；本人 ${data.currentAge} 歲，最早退休點 ${data.retireAge} 歲，規劃到 ${data.lifeExpectancy} 歲。<br>
    退休資金池：${formatCurrency(data.assets)}；選用策略：${escapeHtml(getStrategyDescription(data))}。
  `;

  document.getElementById("reportSummary").innerHTML = `
    <strong>案件摘要</strong><br>
    案件：${escapeHtml(data.caseName || "未命名案件")}；版本：${escapeHtml(data.versionName || "未命名版本")}；基準版本：${escapeHtml(data.baselineVersion || "未填基準版本")}。<br>
    家庭模式：${data.householdMode === "couple" ? "夫妻模式" : "單人模式"}；本人 ${data.currentAge} 歲，最早退休點 ${data.retireAge} 歲，規劃到 ${data.lifeExpectancy} 歲。<br>
    目前可提領資產起點（今天）：${formatCurrency(data.assets)}；退休時點資產（模擬值）會依方案在下方另列；選用策略：${escapeHtml(getStrategyDescription(data))}。
  `;

  document.getElementById("snapshotBlock").innerHTML = `
    <strong>版本快照</strong><br>
    本次試算會自動記錄版本名稱與基準版本，方便後續追蹤。<br>
    最近快照：${snapshots.length
      ? snapshots.map((snapshot) => `${escapeHtml(snapshot.versionName)}（${escapeHtml(snapshot.baselineVersion)} / ${snapshot.timestamp.slice(0, 10)}）`).join("、")
      : "目前尚無歷史快照。"}
  `;

  document.getElementById("result").innerHTML = `
    <div class="result-title">核心判讀</div>
    ${suggestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`).join("<br>")}
  `;

  renderScenarioComparison(scenarioComparisons);

  document.getElementById("strategyBlock").innerHTML = `
    <strong>策略與結構摘要</strong><br>
    資產桶：現金 ${formatCurrency(data.assetBuckets.cash)}、投資 ${formatCurrency(data.assetBuckets.investment)}、退休帳戶 ${formatCurrency(data.assetBuckets.retirement)}、房產 ${formatCurrency(data.assetBuckets.property)}${data.assetBuckets.includePropertyInFunding ? "（目前已列入退休資金池）" : "（目前未列入退休資金池）"}。<br>
    支出分類：必要 ${formatCurrency(data.expensePlan.essential * 12)} / 年、彈性 ${formatCurrency(data.expensePlan.discretionary * 12)} / 年、醫療 ${formatCurrency(data.expensePlan.medical * 12)} / 年、照護 ${formatCurrency(data.expensePlan.care * 12)} / 年。<br>
    持續投入：${formatCurrency(data.contribution * 12)} / 年；收入事件 ${data.incomes.length} 筆；目標事件 ${data.goals.length} 筆。
  `;

  document.getElementById("strategyBlock").innerHTML = `
    <strong>策略與結構摘要</strong><br>
    資產桶：現金 ${formatCurrency(data.assetBuckets.cash)}、投資 ${formatCurrency(data.assetBuckets.investment)}、退休帳戶 ${formatCurrency(data.assetBuckets.retirement)}、房產 ${formatCurrency(data.assetBuckets.property)}${data.assetBuckets.includePropertyInFunding ? "（目前已列入可提領資產起點）" : "（目前未列入可提領資產起點）"}。<br>
    支出分類：必要 ${formatCurrency(data.expensePlan.essential * 12)} / 年、彈性 ${formatCurrency(data.expensePlan.discretionary * 12)} / 年、醫療 ${formatCurrency(data.expensePlan.medical * 12)} / 年、照護 ${formatCurrency(data.expensePlan.care * 12)} / 年。<br>
    持續投入：${formatCurrency(data.contribution * 12)} / 年；收入事件 ${data.incomes.length} 筆；目標事件 ${data.goals.length} 筆。
  `;

  renderAccountReports(data);
  renderPropertyAndLiabilityReports(data);

  const referenceRate = getReferenceWithdrawalRate(data);
  document.getElementById("rule4Block").style.display = "block";
  document.getElementById("rule4Block").innerHTML = `
    <strong>參考提領檢查（${formatPercent(referenceRate)}）</strong><br>
    退休第一年總支出約 ${formatCurrency(evaluation.firstYearSpend.total)}，以 ${formatPercent(referenceRate)} 的參考線回推所需退休資產約 <strong>${formatCurrency(evaluation.rule4Target)}</strong>。<br>
    基準方案退休起點資產約 <strong>${formatCurrency(evaluation.retirementPoint.value)}</strong>，資金覆蓋比約 <strong>${(evaluation.fundedRatio * 100).toFixed(1)}%</strong>。
  `;

  document.getElementById("rule4Block").innerHTML = `
    <strong>參考提領檢查（${formatPercent(referenceRate)}）</strong><br>
    退休第一年總支出約 ${formatCurrency(evaluation.firstYearSpend.total)}，以 ${formatPercent(referenceRate)} 的參考線回推所需退休時點資產約 <strong>${formatCurrency(evaluation.rule4Target)}</strong>。<br>
    基準方案退休時點資產約 <strong>${formatCurrency(evaluation.retirementPoint.value)}</strong>，資金覆蓋比約 <strong>${(evaluation.fundedRatio * 100).toFixed(1)}%</strong>。
  `;

  document.getElementById("medicalBlock").style.display = "block";
  document.getElementById("medicalBlock").innerHTML = `
    <strong>醫療 / 照護 / LTC 假設</strong><br>
    現值月醫療 ${formatCurrency(data.expensePlan.medical)}、月照護 ${formatCurrency(data.expensePlan.care)}、醫療通膨 ${formatPercent(data.medicalInflationRate)}。<br>
    LTC：${data.ltcProfile.enabled
      ? `啟用，自 ${data.ltcProfile.startAge} 歲起 ${data.ltcProfile.durationYears} 年，溢價倍數 ${data.ltcProfile.extraCostFactor.toFixed(2)}`
      : "停用"}。<br>
    退休首年醫療 + 照護 + LTC 合計約 ${formatCurrency(evaluation.firstYearSpend.baseMedical + evaluation.firstYearSpend.care + evaluation.firstYearSpend.ltc)}。
  `;

  document.getElementById("inputSummaryBlock").style.display = document.getElementById("showInputSummary").checked ? "block" : "none";
  document.getElementById("inputSummary").innerHTML = `
    <strong>原始輸入摘要</strong><br>
    本人：${escapeHtml(data.selfPerson.name || data.clientName || "本人")} / ${data.selfPerson.currentAge}→${data.selfPerson.retireAge}→${data.selfPerson.lifeExpectancy} 歲。<br>
    ${data.spousePerson ? `配偶：${escapeHtml(data.spousePerson.name || "配偶")} / ${data.spousePerson.currentAge}→${data.spousePerson.retireAge}→${data.spousePerson.lifeExpectancy} 歲。<br>` : ""}
    負債筆數：${data.liabilities.length}；收入事件：${data.incomes.length}；目標事件：${data.goals.length}。<br>
    假設：退休前年報酬 ${formatPercent(data.returnRate)}、退休後 ${formatPercent(data.postReturnRate)}、一般通膨 ${formatPercent(data.inflationRate)}、醫療通膨 ${formatPercent(data.medicalInflationRate)}。
  `;

  if (document.getElementById("showAdvisorAdvice").checked && data.advisorNote) {
    document.getElementById("advisorAdviceBlock").style.display = "block";
    document.getElementById("reportAdvice").innerHTML = `<strong>顧問備註</strong><br>${escapeHtml(data.advisorNote).replace(/\n/g, "<br>")}`;
  } else {
    document.getElementById("advisorAdviceBlock").style.display = "none";
  }

  document.getElementById("logicStepsWrap").style.display = document.getElementById("showLogicSteps").checked ? "block" : "none";
  document.getElementById("logicExplainContent").innerHTML = `
    1. 目前這份規劃把案件主檔、家庭模式與家庭成員表納入資料模型，時間軸以本人年齡為主。<br>
    2. 資產端改成資產桶減負債餘額；房產可依目前設定選擇是否納入退休資金池。<br>
    3. 收入端採制度型預設，支出端拆成必要、彈性、醫療、照護四類。<br>
    4. 提領策略先以固定提領率與 Guardrail 為主，並預設每年重估；固定支出只作比較線。<br>
    5. 報表同時輸出方案 A / B / C，比較目前設定、保守壓力與強化行動版。<br>
    6. Monte Carlo 已改為逐年序列抽樣，會在每一年重抽報酬與通膨，再丟回同一套年度引擎。
  `;

  if (document.getElementById("showMonteCarloSummary").checked && mcResults) {
    document.getElementById("monteCarloSummaryBlock").style.display = "block";
    const successRate = mcResults.successRate.toFixed(1);
    const statusClass = mcResults.successRate >= 85 ? "status-good" : mcResults.successRate >= 60 ? "status-warn" : "status-bad";
    document.getElementById("monteCarloSummary").innerHTML = `
      <strong>Monte Carlo 序列壓測</strong><br>
      模型：${escapeHtml(mcResults.assumptions?.model || "sequence-level annual sampling")}<br>
      支出波動度：${formatPercent(mcResults.assumptions?.spending_volatility || 0)}<br>
      成功率：<span class="${statusClass}"><strong>${successRate}%</strong></span><br>
      P50 最終資產：${formatCurrency(mcResults.p50)}<br>
      P10 最終資產：${formatCurrency(mcResults.p10)}<br>
      中位數最大回撤：${formatPercent(mcResults.medianMaxDrawdown * 100)}<br>
      中位數破產年齡：${mcResults.medianDepletionAge ? `${mcResults.medianDepletionAge.toFixed(1)} 歲` : "未破產"}
    `;
  } else {
    document.getElementById("monteCarloSummaryBlock").style.display = "none";
  }

  renderCashflowTable(projection);
}

function renderAdvisorReport(data, projection, evaluation, scenarioComparisons, mcResults) {
  const suggestions = buildSuggestions(data, evaluation, scenarioComparisons, mcResults);
  const snapshots = getSnapshots().slice(0, 3);
  const snapshot = data.currentSnapshot || {};
  const assetBuckets = data.assetBuckets || {};
  const expensePlan = data.expensePlan || {};
  const taxAssumptions = data.taxAssumptions || {};
  const ltcProfile = data.ltcProfile || {};
  const selfPerson = data.selfPerson || {};
  const spousePerson = data.spousePerson || null;
  const incomes = Array.isArray(data.incomes) ? data.incomes : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const liabilities = Array.isArray(data.liabilities) ? data.liabilities : [];
  const naturalSurplus = toFiniteNumber(snapshot.annual_surplus_before_override, 0);
  const investableSurplus = toFiniteNumber(snapshot.annual_investable_surplus, 0);
  const overrideGap = toFiniteNumber(snapshot.manual_override_gap, 0);
  const overrideEnabled = data.useManualContributionOverride === true;
  const overrideText = overrideEnabled
    ? `已啟用手動校正投入，這次直接採用 ${formatCurrency(investableSurplus)}；和自然淨餘相比，差額是 ${formatSignedCurrency(overrideGap)}。`
    : `未啟用手動校正投入，所以年度可投資金額直接採自然淨餘 ${formatCurrency(investableSurplus)}。`;
  const depletionText = evaluation.depletionPoint ? `${evaluation.depletionPoint.age} 歲` : "尚未用完";
  const householdLabel = data.householdMode === "couple" ? "夫妻家庭" : "單人家庭";

  document.getElementById("printMeta").innerHTML = `
    案件：${escapeHtml(data.caseName || data.clientName || "未命名案件")}｜
    版本：${escapeHtml(data.versionName || "未命名版本")}｜
    基準：${escapeHtml(data.baselineVersion || "未設定基準")}<br>
    報告日期：${escapeHtml(data.reportDate || getLocalDateString())}｜
    家庭型態：${householdLabel}｜
    顯示模式：${getReportViewModeLabel()}｜
    <a href="${isClientReportMode() ? "advisor.html" : "client.html"}">${isClientReportMode() ? "切回顧問版" : "切到客戶版"}</a>
  `;

  document.getElementById("reportSummary").innerHTML = `
    <strong>${isClientReportMode() ? "客戶摘要" : "顧問摘要"}</strong><br>
    這份報表先幫你看三件事：現在手上有多少可以用、每年現金流撐不撐得住、以及退休後風險會不會太大。<br>
    目前是 <strong>${householdLabel}</strong>，本人 ${data.currentAge} 歲，預計退休 ${data.retireAge} 歲，規劃到 ${data.lifeExpectancy} 歲。<br>
    目前可提領資產起點 <strong>${formatCurrency(snapshot.liquid_retirement_pool_start || data.assets || 0)}</strong>，退休時點資產 <strong>${formatCurrency(snapshot.opening_household_net_worth || 0)}</strong>。<br>
    這次採用的退休策略是 <strong>${escapeHtml(getStrategyDescription(data))}</strong>。
  `;

  document.getElementById("snapshotBlock").innerHTML = `
    <strong>最近版本快照</strong><br>
    我們保留最近三次版本，方便你比對每次調整到底差在哪裡。<br>
    ${snapshots.length
      ? snapshots.map((item) => `${escapeHtml(item.versionName)}／${escapeHtml(item.baselineVersion)}／${item.timestamp.slice(0, 10)}`).join("、")
      : "目前還沒有可回看的快照"}
  `;

  document.getElementById("cashflowSummaryBlock").innerHTML = `
    <strong>年度現金流摘要</strong><br>
    今年先看收入 ${formatCurrency(snapshot.annual_income_total || 0)}、稅額 ${formatCurrency(snapshot.annual_tax_total || 0)}、保費 ${formatCurrency(snapshot.annual_premium_total || 0)}、房貸與其他債務付款 ${formatCurrency(snapshot.annual_debt_service_total || 0)}。<br>
    算完之後，自然年度淨餘是 <strong>${formatCurrency(naturalSurplus)}</strong>，年度可投資金額是 <strong>${formatCurrency(investableSurplus)}</strong>。<br>
    ${escapeHtml(overrideText)}
  `;

  document.getElementById("result").innerHTML = `
    <div class="result-title">${isClientReportMode() ? "客戶結論" : "顧問判讀"}</div>
    ${suggestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`).join("<br>")}
  `;

  renderScenarioComparison(scenarioComparisons);

  document.getElementById("strategyBlock").innerHTML = `
    <strong>${isClientReportMode() ? "客戶版資產與支出摘要" : "資產與支出輪廓"}</strong><br>
    ${isClientReportMode()
      ? `
        目前先看資產結構：現金 ${formatCurrency(assetBuckets.cash || 0)}、投資 ${formatCurrency(assetBuckets.investment || 0)}、退休 ${formatCurrency(assetBuckets.retirement || 0)}、房產 ${formatCurrency(assetBuckets.property || 0)}。${assetBuckets.includePropertyInFunding ? "這筆資料已把房產淨值納入可提領資金。" : "這筆資料先不把房產淨值算進可提領資金。"}<br>
        支出結構先看必要支出、彈性支出與醫療照護，這會直接影響你能不能穩定撐到退休目標。<br>
        這份報表沿用同一套年度模型，A / B / C 的差別只在假設怎麼改，不會另外改數學口徑。
      `
      : `
        目前資產分成現金 ${formatCurrency(assetBuckets.cash || 0)}、投資 ${formatCurrency(assetBuckets.investment || 0)}、退休 ${formatCurrency(assetBuckets.retirement || 0)}、房產 ${formatCurrency(assetBuckets.property || 0)}${assetBuckets.includePropertyInFunding ? "；這筆資料目前已把房產淨值納入退休可提領資金" : "；這筆資料目前尚未把房產淨值納入退休可提領資金"}。<br>
        支出輪廓是：必要 ${formatCurrency((expensePlan.essential || 0) * 12)}、彈性 ${formatCurrency((expensePlan.discretionary || 0) * 12)}、醫療 ${formatCurrency((expensePlan.medical || 0) * 12)}、照護 ${formatCurrency((expensePlan.care || 0) * 12)}、保費 ${formatCurrency((expensePlan.premium || 0) * 12)}。<br>
        假設口徑是：退休前報酬 ${formatPercent(data.returnRate)}、退休後報酬 ${formatPercent(data.postReturnRate)}、通膨 ${formatPercent(data.inflationRate)}、醫療通膨 ${formatPercent(data.medicalInflationRate)}。<br>
        稅務口徑是：薪資 ${formatPercent(taxAssumptions.earnedIncomeTaxRate || 0)}、被動收入 ${formatPercent(taxAssumptions.passiveIncomeTaxRate || 0)}、制度給付 ${formatPercent(taxAssumptions.benefitIncomeTaxRate || 0)}。
      `
    }
  `;

  renderAccountReports(data);
  renderPropertyAndLiabilityReports(data);

  const referenceRate = getReferenceWithdrawalRate(data);
  const withdrawalTexts = buildWithdrawalStrategyTexts(data);
  document.getElementById("rule4Block").style.display = "block";
  document.getElementById("rule4Block").innerHTML = isClientReportMode()
    ? `
      <strong>提領建議（白話版）</strong><br>
      ${escapeHtml(withdrawalTexts.suggestedWithdrawalRateText)}<br>
      ${escapeHtml(withdrawalTexts.strategyDescriptionText)}<br>
      以這條參考線回推，大概要準備 <strong>${formatCurrency(evaluation.rule4Target)}</strong>；目前退休時點資產約 <strong>${formatCurrency(evaluation.retirementPoint.value)}</strong>，資金覆蓋比約 <strong>${(evaluation.fundedRatio * 100).toFixed(1)}%</strong>。<br>
      <div class="mini-note">${escapeHtml(withdrawalTexts.withdrawalRiskNote)}</div>
    `
    : `
      <strong>參考提領檢查（${formatPercent(referenceRate)}）</strong><br>
      退休第一年的支出是 ${formatCurrency(evaluation.firstYearSpend.total)}，如果用 ${formatPercent(referenceRate)} 參考線回推，大概要準備 ${formatCurrency(evaluation.rule4Target)}。<br>
      目前退休時點資產是 <strong>${formatCurrency(evaluation.retirementPoint.value)}</strong>，覆蓋率是 <strong>${(evaluation.fundedRatio * 100).toFixed(1)}%</strong>，資產用完年齡則是 <strong>${depletionText}</strong>。<br>
      ${escapeHtml(withdrawalTexts.strategyDescriptionText)}<br>
      ${withdrawalTexts.warnings.length
        ? `<span class="status-warn"><strong>提領率警示</strong></span><br>${withdrawalTexts.warnings.map((item) => `・${escapeHtml(item)}`).join("<br>")}`
        : "提領率設定檢查：參考提領率與固定提領率都在建議範圍內，暫無警示。"}
    `;

  document.getElementById("medicalBlock").style.display = "block";
  document.getElementById("medicalBlock").innerHTML = `
    <strong>醫療與長照</strong><br>
    目前設定的年醫療支出是 ${formatCurrency(expensePlan.medical || 0)}，年照護支出是 ${formatCurrency(expensePlan.care || 0)}，醫療通膨假設是 ${formatPercent(data.medicalInflationRate)}。<br>
    LTC 目前${ltcProfile.enabled
      ? `已啟用，從 ${ltcProfile.startAge} 歲開始，持續 ${ltcProfile.durationYears} 年，額外成本倍數 ${Number(ltcProfile.extraCostFactor || 0).toFixed(2)}`
      : "未啟用"}。<br>
    退休首年醫療、照護與 LTC 合計 ${formatCurrency(evaluation.firstYearSpend.baseMedical + evaluation.firstYearSpend.care + evaluation.firstYearSpend.ltc)}。
  `;

  document.getElementById("inputSummaryBlock").style.display = document.getElementById("showInputSummary").checked ? "block" : "none";
  document.getElementById("inputSummary").innerHTML = `
    <strong>本次輸入重點</strong><br>
    本人：${escapeHtml(selfPerson.name || data.clientName || "本人")} / ${selfPerson.currentAge || 0} 歲 / ${selfPerson.retireAge || 0} 歲 / ${selfPerson.lifeExpectancy || 0} 歲<br>
    ${spousePerson ? `配偶：${escapeHtml(spousePerson.name || "配偶")} / ${spousePerson.currentAge || 0} 歲 / ${spousePerson.retireAge || 0} 歲 / ${spousePerson.lifeExpectancy || 0} 歲<br>` : ""}
    目前共有負債 ${liabilities.length} 筆、收入 ${incomes.length} 筆、目標事件 ${goals.length} 筆。<br>
    主要假設是：退休前 ${formatPercent(data.returnRate)}、退休後 ${formatPercent(data.postReturnRate)}、通膨 ${formatPercent(data.inflationRate)}、醫療通膨 ${formatPercent(data.medicalInflationRate)}。
  `;

  if (document.getElementById("showAdvisorAdvice").checked && data.advisorNote) {
    document.getElementById("advisorAdviceBlock").style.display = "block";
    document.getElementById("reportAdvice").innerHTML = `<strong>顧問備註</strong><br>${escapeHtml(data.advisorNote).replace(/\n/g, "<br>")}`;
  } else {
    document.getElementById("advisorAdviceBlock").style.display = "none";
  }

  document.getElementById("logicStepsWrap").style.display = document.getElementById("showLogicSteps").checked ? "block" : "none";
  document.getElementById("logicExplainContent").innerHTML = `
    1. 先把本人、配偶、退休年齡與壽命放到同一條時間軸。<br>
    2. 再把收入、支出、稅、保費、房貸與房產逐年展開。<br>
    3. 年度可投資金額先看自然淨餘；如果有手動校正，就以校正值為準。<br>
    4. 房產和負債先各自算清楚，避免同一筆錢被重複扣兩次。<br>
    5. 方案 A、B、C 是三種不同假設，重點是看風險差距有多大。<br>
    6. 情境壓測（Monte Carlo）是把年度風險一路跑完，看看結果分布長什麼樣子。
  `;

  if (document.getElementById("showMonteCarloSummary").checked && mcResults) {
    document.getElementById("monteCarloSummaryBlock").style.display = "block";
    const successRate = mcResults.successRate.toFixed(1);
    const statusClass = mcResults.successRate >= 85 ? "status-good" : mcResults.successRate >= 60 ? "status-warn" : "status-bad";
    document.getElementById("monteCarloSummary").innerHTML = `
      <strong>${isClientReportMode() ? "風險範圍摘要" : "情境壓測摘要"}</strong><br>
      ${isClientReportMode()
        ? `
          成功率：<span class="${statusClass}"><strong>${successRate}%</strong></span><br>
          P50 最終資產：${formatCurrency(mcResults.p50)}<br>
          P10 最終資產：${formatCurrency(mcResults.p10)}<br>
          P90 最終資產：${formatCurrency(mcResults.p90)}<br>
          這張圖是在看結果可能落在哪個區間，越穩代表越不容易受到壓力情境影響。
        `
        : `
          模型：${escapeHtml(mcResults.assumptions?.model || "sequence-level annual sampling")}<br>
          支出波動度：${formatPercent(mcResults.assumptions?.spending_volatility || 0)}<br>
          成功率：<span class="${statusClass}"><strong>${successRate}%</strong></span><br>
          P50 最終資產：${formatCurrency(mcResults.p50)}<br>
          P10 最終資產：${formatCurrency(mcResults.p10)}<br>
          中位數最大回撤：${formatPercent(mcResults.medianMaxDrawdown * 100)}<br>
          中位數耗盡年齡：${mcResults.medianDepletionAge ? `${mcResults.medianDepletionAge.toFixed(1)} 歲` : "尚未用完"}
        `
      }
    `;
  } else {
    document.getElementById("monteCarloSummaryBlock").style.display = "none";
  }

  renderCashflowTable(projection);
}

function renderClientReport(data, projection, evaluation, scenarioComparisons, mcResults) {
  applyClientReportDefaults();
  renderAdvisorReport(data, projection, evaluation, scenarioComparisons, mcResults);
  applyReportViewModeVisibility(REPORT_VIEW_MODES.client);
}

function renderClientReportFromCache(reportCache) {
  if (
    !reportCache
    || !reportCache.data
    || !reportCache.projection
    || !reportCache.evaluation
    || !Array.isArray(reportCache.scenarioComparisons)
    || !reportCache.scenarioComparisons.length
  ) {
    return false;
  }

  lastRenderedRawData = reportCache.rawData || getFormData();
  lastRenderedData = reportCache.data;
  lastRenderedProjection = reportCache.projection;
  lastRenderedMonteCarlo = reportCache.mcResults || null;
  lastRenderedScenarioComparisons = reportCache.scenarioComparisons || [];

  renderClientReport(
    reportCache.data,
    reportCache.projection,
    reportCache.evaluation,
    reportCache.scenarioComparisons || [],
    reportCache.mcResults || null
  );

  if (typeof Chart !== "undefined") {
    renderCharts(
      reportCache.data,
      reportCache.projection,
      reportCache.scenarioComparisons || [],
      reportCache.mcResults || null
    );
  }

  return true;
}

function renderTextReports(data, projection, evaluation, scenarioComparisons, mcResults) {
  renderReportByMode(data, projection, evaluation, scenarioComparisons, mcResults);
}

function renderCashflowTable(projection) {
  const cashflowBlock = document.getElementById("cashflowBlock");
  if (cashflowBlock) {
    cashflowBlock.style.display = "block";
  }

  document.getElementById("cashflowAudit").innerHTML =
    "這張表是逐年看錢怎麼進、怎麼出、最後剩多少；先看年初資產，再看投資損益、投入、支出、事件與年末資產。";

  document.getElementById("cashflowTableWrap").innerHTML = `
    <table class="cashflow-table">
      <thead>
        <tr>
          <th>期間</th>
          <th>階段</th>
          <th>期初資產</th>
          <th>投資損益</th>
          <th>持續投入</th>
          <th>必要支出</th>
          <th>彈性支出</th>
          <th>負債付款</th>
          <th>醫療</th>
          <th>照護</th>
          <th>LTC</th>
          <th>事件淨額</th>
          <th>事件明細</th>
          <th>期末資產</th>
        </tr>
      </thead>
      <tbody>
        ${projection.ledger.map((entry) => `
          <tr class="${entry.endAge === lastRenderedData.retireAge ? "cashflow-row-boundary" : ""}">
            <td>${entry.startAge}→${entry.endAge} 歲</td>
            <td><span class="cashflow-phase">${entry.phase === "accumulation" ? "累積期" : "退休期"}</span></td>
            <td>${formatCurrency(entry.startAsset)}</td>
            <td class="${entry.investmentReturn >= 0 ? "cashflow-positive" : "cashflow-negative"}">${formatSignedCurrency(entry.investmentReturn)}</td>
            <td>${entry.contribution > 0 ? formatCurrency(entry.contribution) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.essential > 0 ? formatCurrency(entry.essential) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.discretionary > 0 ? formatCurrency(entry.discretionary) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.debt > 0 ? formatCurrency(entry.debt) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.baseMedical > 0 ? formatCurrency(entry.baseMedical) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.care > 0 ? formatCurrency(entry.care) : '<span class="cashflow-empty">—</span>'}</td>
            <td>${entry.ltc > 0 ? formatCurrency(entry.ltc) : '<span class="cashflow-empty">—</span>'}</td>
            <td class="${entry.eventAmount >= 0 ? "cashflow-positive" : "cashflow-negative"}">${entry.eventAmount !== 0 ? formatSignedCurrency(entry.eventAmount) : '<span class="cashflow-empty">—</span>'}</td>
            <td class="cashflow-event">${entry.eventDetails.length
              ? entry.eventDetails.map((detail) => `<div class="cashflow-event-item">${detail.direction === "inflow" ? "+" : detail.direction === "info" ? "↔" : "-"}${formatCurrency(detail.amount)} ${escapeHtml(detail.name)}</div>`).join("")
              : '<span class="cashflow-empty">—</span>'}</td>
            <td>${formatCurrency(entry.endAsset)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCharts(data, projection, scenarioComparisons, mcResults) {
  destroyCharts();
  const clientMode = isClientReportMode();

  const commonOptions = {
    responsive: true,
    plugins: { tooltip: { mode: "index", intersect: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => `${(value / 10000).toFixed(0)}萬` }
      }
    }
  };

  const preRetireData = projection.path.filter((point) => point.age <= data.retireAge);
  const postRetireData = projection.path.filter((point) => point.age >= data.retireAge);

  if (!clientMode && document.getElementById("showPreChart").checked) {
    document.getElementById("preChartBlock").style.display = "block";
    chartInstances.pre = new Chart(document.getElementById("preRetireChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: preRetireData.map((point) => `${point.age}歲`),
        datasets: [{ label: "退休前累積資產", data: preRetireData.map((point) => point.value), backgroundColor: "#5a7a4a", borderRadius: 4 }]
      },
      options: commonOptions
    });
  } else {
    document.getElementById("preChartBlock").style.display = "none";
  }

  if (!clientMode && document.getElementById("showPostChart").checked) {
    document.getElementById("postChartBlock").style.display = "block";
    chartInstances.post = new Chart(document.getElementById("postRetireChart").getContext("2d"), {
      type: "line",
      data: {
        labels: postRetireData.map((point) => `${point.age}歲`),
        datasets: [{ label: "退休後資產存續", data: postRetireData.map((point) => point.value), borderColor: "#b85c38", backgroundColor: "rgba(184,92,56,0.1)", fill: true, tension: 0.3 }]
      },
      options: commonOptions
    });
  } else {
    document.getElementById("postChartBlock").style.display = "none";
  }

  if (document.getElementById("showScenarioChart").checked) {
    document.getElementById("scenarioChartBlock").style.display = "block";
    chartInstances.scenario = new Chart(document.getElementById("scenarioChart").getContext("2d"), {
      type: "line",
      data: {
        labels: scenarioComparisons[0].projection.path.map((point) => `${point.age}歲`),
        datasets: scenarioComparisons.map((scenario, index) => ({
          label: scenario.label,
          data: scenario.projection.path.map((point) => point.value),
          borderColor: ["#c8841a", "#b03a3a", "#5a7a4a"][index] || "#4a6c8a",
          backgroundColor: "transparent",
          fill: false,
          tension: 0.32,
          borderWidth: index === 0 ? 3 : 2,
          borderDash: index === 1 ? [5, 5] : []
        }))
      },
      options: commonOptions
    });
    document.getElementById("scenarioChartExplainContent").innerHTML = buildScenarioChartExplainText(scenarioComparisons);
  } else {
    document.getElementById("scenarioChartBlock").style.display = "none";
  }

  if (document.getElementById("showMonteCarloChart").checked && mcResults?.percentileSeries) {
    document.getElementById("monteCarloChartBlock").style.display = "block";
    chartInstances.mc = new Chart(document.getElementById("monteCarloChart").getContext("2d"), {
      type: "line",
      data: {
        labels: mcResults.percentileSeries.map((point) => `${point.age}歲`),
        datasets: [
          { label: "P90", data: mcResults.percentileSeries.map((point) => point.p90), borderColor: "#5a7a4a", fill: false, tension: 0.35 },
          { label: "P50", data: mcResults.percentileSeries.map((point) => point.p50), borderColor: "#c8841a", fill: false, tension: 0.35 },
          { label: "P10", data: mcResults.percentileSeries.map((point) => point.p10), borderColor: "#b03a3a", backgroundColor: "rgba(176,58,58,0.08)", fill: "+1", tension: 0.35 }
        ]
      },
      options: commonOptions
    });
    document.getElementById("monteCarloChartExplainContent").innerHTML =
      clientMode
        ? "P50 是較常見的中間路徑，P10 與 P90 則是偏保守與偏樂觀的結果範圍；如果紅線很早貼近 0，代表退休結構還需要再補強。"
        : "P50 是中位數路徑，P10 和 P90 是比較保守與比較樂觀的兩條參考線；支出彈性越高，尾端分布通常會越寬；如果 P10 很早貼近 0，代表退休結構還偏脆弱。";
  } else {
    document.getElementById("monteCarloChartBlock").style.display = "none";
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCashflowCsv() {
  if (!lastRenderedProjection?.ledger?.length) {
    showPageNotice("目前沒有可匯出的年度現金流資料。", "error");
    return;
  }

  const header = ["期間", "階段", "期初資產", "投資損益", "持續投入", "必要支出", "彈性支出", "負債付款", "醫療", "照護", "LTC", "事件淨額", "事件明細", "期末資產"];
  const rows = lastRenderedProjection.ledger.map((entry) => ([
    `${entry.startAge}->${entry.endAge}`,
    entry.phase,
    entry.startAsset,
    entry.investmentReturn,
    entry.contribution,
    entry.essential,
    entry.discretionary,
    entry.debt,
    entry.baseMedical,
    entry.care,
    entry.ltc,
    entry.eventAmount,
    entry.eventDetails.map((detail) => `${detail.direction === "inflow" ? "+" : detail.direction === "info" ? "↔" : "-"}${detail.name}:${detail.amount}`).join(" | "),
    entry.endAsset
  ]));

  const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const caseName = lastRenderedData.caseName || lastRenderedData.clientName || "retirement-plan";
  link.href = url;
  link.download = `${caseName}-cashflow.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function encodeSharePayload(data) {
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decodeSharePayload(encodedData) {
  return JSON.parse(decodeURIComponent(atob(encodedData)));
}

function shareData() {
  const encoded = encodeSharePayload(getFormData());
  const url = new URL(window.location.href);
  url.searchParams.set("data", encoded);
  document.getElementById("shareLink").value = url.toString();
  document.getElementById("shareBox").classList.remove("hidden");
}

async function copyShareLink() {
  const shareInput = document.getElementById("shareLink");
  const text = shareInput.value.trim();
  if (!text) {
    alert("請先產生分享連結。");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      shareInput.focus();
      shareInput.select();
      document.execCommand("copy");
    }
    showPageNotice("分享連結已複製。");
  } catch (error) {
    console.error(error);
    alert("複製失敗，請手動複製連結。");
  }
}

function checkUrlData() {
  const encodedData = new URLSearchParams(window.location.search).get("data");
  if (!encodedData) return false;

  try {
    hydrateForm(decodeSharePayload(encodedData));
    showPageNotice("已自分享連結載入參數。");
    return true;
  } catch (error) {
    console.error("解析網址參數失敗", error);
    showPageNotice("分享連結解析失敗，請確認連結內容完整。", "error");
    return false;
  }
}

function printReport() {
  window.print();
}

