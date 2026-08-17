/* ─────────────────────────────────────────────────────────────
   投資不動產規劃平台 — UI 控制器
   依賴 property_calc_engine.js（window.PropertyCalcEngine）、Chart.js、
   jsPDF ＋ html2canvas（PDF 報告，選用）。
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const STORAGE_KEY = "propertyInvestState_v1";
  const Engine = window.PropertyCalcEngine;
  const STEP_LABELS = ["資金門檻", "貸款壓力", "營運現金流", "出場假設", "投資判讀"];
  const MODULE_ROLES = [
    "買不買得起",
    "每月負擔與利率",
    "租金能否支撐",
    "持有期與出售回收",
    "情境與風險統整",
  ];

  let state = null;
  let currentStep = 1;
  let activeScenario = "base";
  let currentResult = null; // 步驟1-4：使用者原始輸入的試算結果
  let scenarioResults = null; // 步驟5：{conservative, base, optimistic}
  let stressResults = null;
  let charts = { equity: null, cashflow: null };
  let saveTimer = null;
  let renderRAF = null;

  function uid() {
    return "x" + Math.random().toString(36).slice(2, 9);
  }

  function defaultState() {
    return {
      affordability: {
        availableCash: 4000000, emergencyFund: 600000, monthlyIncome: 150000, monthlyExpense: 70000,
        otherDebtPayment: 10000, mortgageBurdenRate: 0.3,
        purchasePrice: 12000000, appraisalValue: 11500000, loanBaseMethod: "lower_of_two", ltv: 0.7,
        acquisitionFixedCost: 500000, acquisitionCostRate: 0, renovationCost: 600000, maxPurchaseBudget: null,
        borrowerType: "natural_person", existingMortgageCount: 0, hasExistingHouse: "no", replacementNeed: "no", highValueResidence: "no",
      },
      loan: {
        manualLoanAmount: false, loanAmount: 8000000, annualRate: 0.024, termYears: 30,
        repaymentMethod: "annuity", graceMonths: 24,
        rateStage2: { enabled: false, changeMonth: 36, secondAnnualRate: 0.026 },
        prepayments: [],
      },
      rental: {
        monthlyRent: 30000, parkingRent: 0, otherMonthlyIncome: 0, vacancyRate: 0.05, badDebtLoss: 0, rentGrowthRate: 0.01,
        annualOperatingCosts: [
          { id: uid(), name: "管理費", amount: 24000, frequency: "annual", startYear: 1 },
          { id: uid(), name: "修繕預備", amount: 30000, frequency: "annual", startYear: 1 },
          { id: uid(), name: "房屋及地價稅", amount: 16000, frequency: "annual", startYear: 1 },
          { id: uid(), name: "其他費用", amount: 10000, frequency: "annual", startYear: 1 },
        ],
      },
      sale: {
        holdingYears: 5, appreciationMethod: "fixed_rate", appreciationRate: 0.02, targetSalePrice: null,
        saleCostRate: 0.04, fixedSaleCost: 0, saleTaxInput: 0, discountRate: 0.04,
      },
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    const s = raw || {};
    s.affordability = Object.assign({}, base.affordability, s.affordability || {});
    s.loan = Object.assign({}, base.loan, s.loan || {});
    s.loan.rateStage2 = Object.assign({}, base.loan.rateStage2, s.loan.rateStage2 || {});
    s.rental = Object.assign({}, base.rental, s.rental || {});
    s.rental.annualOperatingCosts = Array.isArray(s.rental.annualOperatingCosts) ? s.rental.annualOperatingCosts : base.rental.annualOperatingCosts;
    s.sale = Object.assign({}, base.sale, s.sale || {});
    return s;
  }

  function npvFor(result) {
    const rate = state && state.sale ? state.sale.discountRate || 0 : 0;
    return Engine.calcNpv(rate, result.cashflows);
  }

  // ── 格式化 ───────────────────────────────────────────────
  function formatMoney(v) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    return "NT$ " + Math.round(v).toLocaleString("zh-Hant-TW");
  }
  function formatPercent(v, decimals) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    return (v * 100).toFixed(decimals == null ? 2 : decimals) + "%";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ── 引擎串接 ─────────────────────────────────────────────
  function scenarioFromState(s) {
    s = s || state;
    const termMonths = Math.max(1, Math.round(s.loan.termYears * 12));
    return {
      affordability: {
        availableCash: s.affordability.availableCash,
        emergencyFund: s.affordability.emergencyFund,
        monthlyIncome: s.affordability.monthlyIncome,
        monthlyExpense: s.affordability.monthlyExpense,
        otherDebtPayment: s.affordability.otherDebtPayment,
        mortgageBurdenRate: s.affordability.mortgageBurdenRate,
        maxPurchaseBudget: s.affordability.maxPurchaseBudget || null,
        purchasePrice: s.affordability.purchasePrice,
        appraisalValue: s.affordability.appraisalValue || null,
        loanBaseMethod: s.affordability.loanBaseMethod,
        ltv: s.affordability.ltv,
        acquisitionFixedCost: s.affordability.acquisitionFixedCost,
        acquisitionCostRate: s.affordability.acquisitionCostRate,
        renovationCost: s.affordability.renovationCost,
        annualRate: s.loan.annualRate,
        termMonths,
      },
      loan: {
        loanAmount: s.loan.manualLoanAmount ? s.loan.loanAmount : null,
        annualRate: s.loan.annualRate,
        termMonths,
        repaymentMethod: s.loan.repaymentMethod,
        graceMonths: s.loan.repaymentMethod === "grace" ? s.loan.graceMonths : 0,
        rateStage2: s.loan.rateStage2.enabled ? s.loan.rateStage2 : null,
        prepayments: s.loan.prepayments,
      },
      rental: s.rental,
      sale: s.sale,
      otherInitialInvestment: 0,
    };
  }

  function compute() {
    currentResult = Engine.runFullCalculation(scenarioFromState());
    scenarioResults = {
      conservative: Engine.runPresetScenario(scenarioFromState(), "conservative").result,
      base: Engine.runPresetScenario(scenarioFromState(), "base").result,
      optimistic: Engine.runPresetScenario(scenarioFromState(), "optimistic").result,
    };
    stressResults = Engine.runStressTests(scenarioFromState());
  }

  // ── 歷史（本機儲存） ─────────────────────────────────────
  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    }, 800);
  }
  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      alert("已儲存草稿到本機瀏覽器。");
    } catch (e) {
      alert("儲存失敗：" + e.message);
    }
  }
  function loadSaved() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return alert("目前沒有已儲存的草稿。");
    try {
      state = normalizeState(JSON.parse(raw));
      renderAll();
    } catch (e) {
      alert("讀取失敗，資料可能已損毀。");
    }
  }
  function resetAll() {
    if (!confirm("確定要重新試算嗎？所有輸入資料將會清除。")) return;
    state = normalizeState(defaultState());
    localStorage.removeItem(STORAGE_KEY);
    currentStep = 1;
    renderAll();
  }

  function mutate(fn) {
    fn();
    scheduleRender();
    scheduleAutoSave();
  }
  function scheduleRender() {
    if (renderRAF) return;
    renderRAF = requestAnimationFrame(() => {
      renderRAF = null;
      renderAll();
    });
  }

  // ── 動態列表：營運費用 ───────────────────────────────────
  function renderOperatingCostList() {
    const wrap = document.getElementById("operatingCostList");
    wrap.innerHTML = state.rental.annualOperatingCosts
      .map(
        (c) => `
      <div class="pinv-list-row" data-id="${c.id}">
        <div class="pinv-field"><label>項目名稱</label><input type="text" data-field="name" value="${escapeHtml(c.name)}"></div>
        <div class="pinv-field"><label>金額</label><input type="number" min="0" data-field="amount" value="${c.amount}"></div>
        <div class="pinv-field">
          <label>頻率</label>
          <select data-field="frequency">
            <option value="annual" ${c.frequency === "annual" ? "selected" : ""}>每年</option>
            <option value="monthly" ${c.frequency === "monthly" ? "selected" : ""}>每月</option>
            <option value="one_time" ${c.frequency === "one_time" ? "selected" : ""}>一次性（起始年）</option>
          </select>
        </div>
        <button type="button" class="pinv-icon-btn no-print" data-action="delete" title="刪除">🗑</button>
      </div>`
      )
      .join("");
    wrap.querySelectorAll(".pinv-list-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("change", () => {
          const item = state.rental.annualOperatingCosts.find((c) => c.id === id);
          const field = input.dataset.field;
          mutate(() => {
            item[field] = field === "amount" ? Math.max(0, parseFloat(input.value) || 0) : input.value;
          });
        });
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        mutate(() => {
          state.rental.annualOperatingCosts = state.rental.annualOperatingCosts.filter((c) => c.id !== id);
        });
      });
    });
  }

  // ── 動態列表：提前還款 ───────────────────────────────────
  function renderPrepaymentList() {
    const wrap = document.getElementById("prepaymentList");
    if (!state.loan.prepayments.length) {
      wrap.innerHTML = `<div class="pinv-hint" style="margin-bottom:8px">目前沒有提前還款計畫。</div>`;
    } else {
      wrap.innerHTML = state.loan.prepayments
        .map(
          (p) => `
        <div class="pinv-list-row" data-id="${p.id}">
          <div class="pinv-field"><label>第幾個月</label><input type="number" min="1" data-field="month" value="${p.month}"></div>
          <div class="pinv-field"><label>提前還款金額</label><input type="number" min="0" data-field="amount" value="${p.amount}"></div>
          <div class="pinv-field">
            <label>方式</label>
            <select data-field="mode">
              <option value="reduce_term" ${p.mode === "reduce_term" ? "selected" : ""}>縮短年限（月付不變）</option>
              <option value="reduce_payment" ${p.mode === "reduce_payment" ? "selected" : ""}>減少月付（年限不變）</option>
            </select>
          </div>
          <button type="button" class="pinv-icon-btn no-print" data-action="delete" title="刪除">🗑</button>
        </div>`
        )
        .join("");
    }
    wrap.querySelectorAll(".pinv-list-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("change", () => {
          const item = state.loan.prepayments.find((p) => p.id === id);
          const field = input.dataset.field;
          mutate(() => {
            if (field === "month") item.month = Math.max(1, Math.round(parseFloat(input.value) || 1));
            else if (field === "amount") item.amount = Math.max(0, parseFloat(input.value) || 0);
            else item.mode = input.value;
          });
        });
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        mutate(() => {
          state.loan.prepayments = state.loan.prepayments.filter((p) => p.id !== id);
        });
      });
    });
  }

  // ── 驗證與警示（規格書第 12 章） ─────────────────────────
  function computeAlerts() {
    const alerts = { step1: [], step2: [], step3: [], step4: [], step5: [] };
    const a = state.affordability;
    const l = state.loan;
    const r = state.rental;
    const s = state.sale;
    const res = currentResult;

    if (a.purchasePrice <= 0) alerts.step1.push({ level: "danger", text: "請輸入大於 0 的房屋價格" });
    if (a.loanBaseMethod === "appraisal" && !a.appraisalValue) alerts.step1.push({ level: "danger", text: "請先輸入銀行鑑價" });
    if (res.affordability.appraisalBelowPrice) alerts.step1.push({ level: "warning", text: "銀行鑑價低於成交價，須自行補足鑑價差額" });
    if (!res.affordability.isDownPaymentSufficient) alerts.step1.push({ level: "danger", text: `自備款不足，缺口約 ${formatMoney(Math.abs(res.affordability.downPaymentGap))}` });
    if (res.affordability.estimatedLoanAmount > a.purchasePrice) alerts.step1.push({ level: "warning", text: "貸款金額高於房價，請確認貸款成數是否合理" });
    if (res.affordability.cashflowLimitedPayment <= 0 && a.monthlyIncome > 0) alerts.step1.push({ level: "danger", text: "固定支出與既有債務已吃掉可支配收入，月付能力為 0" });
    else if (res.affordability.cashflowLimitedPayment < res.affordability.burdenLimitedPayment) alerts.step1.push({ level: "warning", text: "月付能力主要受固定支出與既有債務限制，而非收入負擔率" });

    if (a.ltv < 0 || a.ltv > 1) alerts.step2.push({ level: "danger", text: "貸款成數須介於 0% 至 100%" });
    if (l.termYears * 12 < 1) alerts.step2.push({ level: "danger", text: "貸款期間至少為 1 個月" });
    if (l.repaymentMethod === "grace" && l.graceMonths >= l.termYears * 12) alerts.step2.push({ level: "danger", text: "寬限期必須短於貸款期間" });
    if (l.repaymentMethod === "grace" && l.graceMonths > 0) alerts.step2.push({ level: "info", text: "您設定了寬限期：多數央行規範情況下（自然人名下無房貸者除外）不得有寬限期，請自行確認是否符合條件。" });
    if (a.ltv > 0.6) alerts.step2.push({ level: "info", text: "貸款成數高於六成：請自行確認是否符合央行對已有房貸者的成數上限規定。" });
    if (currentResult.monthlyPayment > a.monthlyIncome * 0.5 && a.monthlyIncome > 0) alerts.step2.push({ level: "warning", text: "房貸月付高於收入 50%，請留意還款壓力" });
    const mortgageCount = parseInt(a.existingMortgageCount, 10) || 0;
    const hasGrace = l.repaymentMethod === "grace" && l.graceMonths > 0;
    if (a.borrowerType === "company" && a.ltv > 0.3) alerts.step2.push({ level: "danger", text: "公司法人購置住宅：央行提示最高貸款成數 3 成" });
    if (a.borrowerType === "company" && hasGrace) alerts.step2.push({ level: "danger", text: "公司法人購置住宅：央行提示不得有寬限期" });
    if (a.borrowerType === "natural_person" && a.highValueResidence === "yes" && a.ltv > 0.3) alerts.step2.push({ level: "danger", text: "自然人購置高價住宅：央行提示最高貸款成數 3 成" });
    if (a.borrowerType === "natural_person" && a.highValueResidence === "yes" && hasGrace) alerts.step2.push({ level: "danger", text: "自然人購置高價住宅：央行提示不得有寬限期" });
    if (a.borrowerType === "natural_person" && mortgageCount === 1 && a.replacementNeed !== "yes" && a.ltv > 0.6) alerts.step2.push({ level: "danger", text: "自然人第 2 戶購屋貸款：央行提示最高貸款成數 6 成" });
    if (a.borrowerType === "natural_person" && mortgageCount === 1 && a.replacementNeed !== "yes" && hasGrace) alerts.step2.push({ level: "danger", text: "自然人第 2 戶購屋貸款：央行提示不得有寬限期" });
    if (a.borrowerType === "natural_person" && mortgageCount >= 2 && a.ltv > 0.3) alerts.step2.push({ level: "danger", text: "自然人第 3 戶以上購屋貸款：央行提示最高貸款成數 3 成" });
    if (a.borrowerType === "natural_person" && mortgageCount >= 2 && hasGrace) alerts.step2.push({ level: "danger", text: "自然人第 3 戶以上購屋貸款：央行提示不得有寬限期" });
    if (a.borrowerType === "natural_person" && mortgageCount === 0 && a.hasExistingHouse === "yes" && a.replacementNeed !== "yes" && hasGrace) alerts.step2.push({ level: "danger", text: "自然人名下有房屋者第 1 戶購屋貸款：央行提示不得有寬限期" });

    if (r.vacancyRate > 1) alerts.step3.push({ level: "danger", text: "空置率須介於 0% 至 100%" });
    const y1 = res.rentalByYear[0];
    if (y1 && y1.dscr !== null && y1.dscr < 1) alerts.step3.push({ level: "warning", text: "DSCR 低於 1，租金收入尚不足以覆蓋房貸本息" });
    if (y1 && y1.grossYield !== null && y1.grossYield > 0.1) alerts.step3.push({ level: "warning", text: "毛租金報酬率高於 10%，請確認輸入是否正確" });

    if (s.appreciationMethod === "target_price" && s.targetSalePrice != null && s.targetSalePrice < 0) alerts.step4.push({ level: "danger", text: "出售價格不得為負數" });
    if (Math.abs(s.appreciationRate) > 0.1) alerts.step4.push({ level: "warning", text: "年增值率高於 10%，請確認假設是否合理" });
    if (s.saleCostRate === 0) alerts.step4.push({ level: "warning", text: "出售成本率為 0，請確認是否合理" });
    if (s.saleTaxInput === 0) alerts.step4.push({ level: "warning", text: "稅費估算為 0，實際出售可能仍有房地合一稅等稅負，請自行評估" });

    return alerts;
  }

  function renderAlertZone(id, list) {
    const zone = document.getElementById(id);
    if (!zone) return;
    zone.innerHTML = list
      .map((a) => `<div class="pinv-alert pinv-alert-${a.level === "info" ? "info" : a.level}">${a.level === "danger" ? "⚠️ " : a.level === "warning" ? "⚠️ " : "ℹ️ "}${a.text}</div>`)
      .join("");
  }

  // ── 步驟導覽 ─────────────────────────────────────────────
  function moduleStatuses() {
    const alerts = computeAlerts();
    const y1 = currentResult.rentalByYear[0];
    const monthlyCashFlow = currentResult.firstYearCashFlow / 12;
    const irrOk = currentResult.irr.status === "ok";

    function fromAlerts(list, fallback) {
      if (list.some((a) => a.level === "danger")) return { level: "danger", text: "待修正" };
      if (list.some((a) => a.level === "warning")) return { level: "warn", text: "需注意" };
      return fallback || { level: "ok", text: "可行" };
    }

    return [
      fromAlerts(alerts.step1, currentResult.affordability.isDownPaymentSufficient ? { level: "ok", text: "可負擔" } : { level: "danger", text: "資金不足" }),
      fromAlerts(alerts.step2, { level: "ok", text: "可承受" }),
      fromAlerts(alerts.step3, y1 && y1.dscr !== null && y1.dscr < 1 ? { level: "warn", text: "現金流緊" } : { level: "ok", text: "可持有" }),
      fromAlerts(alerts.step4, currentResult.netSaleProceeds >= 0 ? { level: "ok", text: "可回收" } : { level: "warn", text: "回收偏弱" }),
      irrOk && monthlyCashFlow >= 0 ? { level: "ok", text: "待比較" } : { level: "warn", text: "需情境判讀" },
    ];
  }

  function setOverviewValue(id, text, level) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = level || "";
  }

  function renderLiveOverview() {
    const y1 = currentResult.rentalByYear[0];
    const monthlyCashFlow = currentResult.firstYearCashFlow / 12;
    const cashGap = currentResult.affordability.downPaymentGap;
    const irrText = currentResult.irr.status === "ok" ? formatPercent(currentResult.irr.rate) : "無法計算";

    setOverviewValue("liveCashGap", cashGap >= 0 ? "餘裕 " + formatMoney(cashGap) : "缺口 " + formatMoney(Math.abs(cashGap)), cashGap >= 0 ? "success" : "danger");
    setOverviewValue("liveMonthlyPayment", formatMoney(currentResult.monthlyPayment), "");
    setOverviewValue("liveMonthlyCashFlow", formatMoney(monthlyCashFlow), monthlyCashFlow >= 0 ? "success" : "danger");
    setOverviewValue("liveDscr", y1 && y1.dscr !== null ? y1.dscr.toFixed(2) : "--", y1 && y1.dscr !== null && y1.dscr < 1 ? "warn" : "success");
    setOverviewValue("liveNetSale", formatMoney(currentResult.netSaleProceeds), currentResult.netSaleProceeds >= 0 ? "success" : "danger");
    setOverviewValue("liveIrr", irrText, currentResult.irr.status === "ok" ? "success" : "warn");

    const decision = document.getElementById("overviewDecision");
    if (!decision) return;
    if (cashGap < 0) decision.textContent = "目前主要卡在資金門檻，需降低成交價、提高自備款或調整貸款成數。";
    else if (y1 && y1.dscr !== null && y1.dscr < 1) decision.textContent = "資金可進場，但營運現金流偏緊，應回頭檢查租金、空置、修繕與貸款條件。";
    else if (monthlyCashFlow < 0) decision.textContent = "持有期間仍需補貼現金流，建議用壓力測試確認可承受年限。";
    else if (currentResult.irr.status !== "ok") decision.textContent = "現金流型態不足以計算 IRR，需回到出場假設或租金現金流重新檢查。";
    else decision.textContent = "目前假設下資金、貸款與持有現金流可同步檢視，下一步重點是比較保守情境與壓力測試。";
  }

  function renderProgress() {
    const main = document.querySelector(".pinv-main");
    if (main) main.dataset.currentStep = String(currentStep);
    const bar = document.getElementById("progressBar");
    const statuses = moduleStatuses();
    bar.innerHTML = STEP_LABELS.map((label, i) => {
      const step = i + 1;
      const cls = step === currentStep ? "active" : step < currentStep ? "done" : "";
      const status = statuses[i] || { level: "", text: "待評估" };
      return `
      <button type="button" class="pinv-step-dot ${cls}" data-step="${step}">
        <span class="pinv-circle"><span>${step}</span></span>
        <span class="pinv-step-label">${label}</span>
        <span class="pinv-step-role">${MODULE_ROLES[i]}</span>
        <span class="pinv-step-status ${status.level}">${status.text}</span>
      </button>`;
    }).join("");
    bar.querySelectorAll(".pinv-step-dot").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.step, 10)));
    });
  }

  function goToStep(step) {
    currentStep = Math.min(5, Math.max(1, step));
    document.querySelectorAll(".pinv-step-panel").forEach((panel) => {
      panel.classList.toggle("hidden", parseInt(panel.dataset.step, 10) !== currentStep);
    });
    renderProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentStep === 5) renderStep5();
  }

  // ── 步驟一：購屋能力 ─────────────────────────────────────
  function renderStep1() {
    const a = state.affordability;
    document.getElementById("aAvailableCash").value = a.availableCash;
    document.getElementById("aEmergencyFund").value = a.emergencyFund;
    document.getElementById("aMonthlyIncome").value = a.monthlyIncome;
    document.getElementById("aMonthlyExpense").value = a.monthlyExpense;
    document.getElementById("aOtherDebtPayment").value = a.otherDebtPayment;
    document.getElementById("aMortgageBurdenRate").value = a.mortgageBurdenRate * 100;
    document.getElementById("aPurchasePrice").value = a.purchasePrice;
    document.getElementById("aAppraisalValue").value = a.appraisalValue == null ? "" : a.appraisalValue;
    document.getElementById("aLoanBaseMethod").value = a.loanBaseMethod;
    document.getElementById("aLtv").value = a.ltv * 100;
    document.getElementById("aAcquisitionFixedCost").value = a.acquisitionFixedCost;
    document.getElementById("aAcquisitionCostRate").value = a.acquisitionCostRate * 100;
    document.getElementById("aRenovationCost").value = a.renovationCost;
    document.getElementById("aMaxPurchaseBudget").value = a.maxPurchaseBudget == null ? "" : a.maxPurchaseBudget;
    document.getElementById("aBorrowerType").value = a.borrowerType;
    document.getElementById("aExistingMortgageCount").value = String(a.existingMortgageCount);
    document.getElementById("aHasExistingHouse").value = a.hasExistingHouse;
    document.getElementById("aReplacementNeed").value = a.replacementNeed;
    document.getElementById("aHighValueResidence").value = a.highValueResidence;

    const r = currentResult.affordability;
    document.getElementById("sumLoanBase").textContent = formatMoney(r.loanBase);
    document.getElementById("sumEstimatedLoan").textContent = formatMoney(r.estimatedLoanAmount);
    document.getElementById("sumRequiredDownPayment").textContent = formatMoney(r.requiredDownPayment);
    const statusEl = document.getElementById("sumDownPaymentStatus");
    statusEl.innerHTML = r.isDownPaymentSufficient
      ? `<span class="pinv-status-pill ok">● 足夠</span>`
      : `<span class="pinv-status-pill warn">● 差額 ${formatMoney(Math.abs(r.downPaymentGap))}</span>`;
    document.getElementById("sumMaxMonthlyPayment").textContent = formatMoney(r.maxMonthlyPayment) + " ／月";
    document.getElementById("sumCashLimitedPrice").textContent = formatMoney(r.cashLimitedPrice);
    document.getElementById("sumPmtLimitedPrice").textContent = formatMoney(r.pmtLimitedPrice);
    document.getElementById("sumAffordablePrice").textContent = formatMoney(r.affordablePrice);
  }

  // ── 步驟二：房貸規劃 ─────────────────────────────────────
  function renderStep2() {
    const l = state.loan;
    document.getElementById("lManualLoanAmount").checked = l.manualLoanAmount;
    const loanAmountInput = document.getElementById("lLoanAmount");
    loanAmountInput.disabled = !l.manualLoanAmount;
    loanAmountInput.value = l.manualLoanAmount ? l.loanAmount : Math.round(currentResult.affordability.estimatedLoanAmount);
    document.getElementById("lAnnualRate").value = l.annualRate * 100;
    document.getElementById("lTermYears").value = l.termYears;
    document.querySelectorAll('input[name="repaymentMethod"]').forEach((r) => (r.checked = r.value === l.repaymentMethod));
    document.getElementById("graceFieldWrap").style.display = l.repaymentMethod === "grace" ? "" : "none";
    document.getElementById("lGraceMonths").value = l.graceMonths;
    document.getElementById("lRateStage2Enabled").checked = l.rateStage2.enabled;
    document.getElementById("rateStage2Wrap").classList.toggle("hidden", !l.rateStage2.enabled);
    document.getElementById("lRateStage2ChangeMonth").value = l.rateStage2.changeMonth;
    document.getElementById("lRateStage2Rate").value = l.rateStage2.secondAnnualRate * 100;

    renderPrepaymentList();

    document.getElementById("sumMonthlyPayment").textContent = formatMoney(currentResult.monthlyPayment);
    const totalInterest = currentResult.schedule.reduce((s, p) => s + p.interest, 0);
    document.getElementById("sumTotalInterest").textContent = formatMoney(totalInterest);
    document.getElementById("sumActualTermMonths").textContent = currentResult.schedule.length + " 期";
    document.getElementById("sumBalanceAtSale").textContent = formatMoney(currentResult.loanBalanceAtSale);
    const burdenRatio = state.affordability.monthlyIncome > 0 ? currentResult.monthlyPayment / state.affordability.monthlyIncome : null;
    const burdenEl = document.getElementById("sumBurdenStatus");
    if (burdenRatio === null) burdenEl.innerHTML = "—";
    else if (burdenRatio > 0.5) burdenEl.innerHTML = `<span class="pinv-status-pill warn">● 偏高（${(burdenRatio * 100).toFixed(0)}%）</span>`;
    else burdenEl.innerHTML = `<span class="pinv-status-pill ok">● 可接受（${(burdenRatio * 100).toFixed(0)}%）</span>`;

    renderScheduleTableIfVisible();
  }

  function renderScheduleTableIfVisible() {
    const wrap = document.getElementById("scheduleTableWrap");
    if (wrap.classList.contains("hidden")) return;
    const tbody = document.getElementById("scheduleTableBody");
    tbody.innerHTML = currentResult.schedule
      .map(
        (p) => `<tr><td>${p.period}</td><td>${formatMoney(p.beginningBalance)}</td><td>${formatMoney(p.payment)}</td><td>${formatMoney(p.principal)}</td><td>${formatMoney(p.interest)}</td><td>${p.prepayment ? formatMoney(p.prepayment) : "—"}</td><td>${formatMoney(p.endingBalance)}</td></tr>`
      )
      .join("");
  }

  // ── 步驟三：出租營運 ─────────────────────────────────────
  function renderStep3() {
    const r = state.rental;
    document.getElementById("rMonthlyRent").value = r.monthlyRent;
    document.getElementById("rParkingRent").value = r.parkingRent;
    document.getElementById("rOtherMonthlyIncome").value = r.otherMonthlyIncome;
    document.getElementById("rVacancyRate").value = r.vacancyRate * 100;
    document.getElementById("rBadDebtLoss").value = r.badDebtLoss;
    document.getElementById("rRentGrowthRate").value = r.rentGrowthRate * 100;
    renderOperatingCostList();

    const y1 = currentResult.rentalByYear[0];
    if (y1) {
      document.getElementById("sumPotentialRent").textContent = formatMoney(y1.potentialAnnualRent);
      document.getElementById("sumVacancyLoss").textContent = "-" + formatMoney(y1.vacancyLoss);
      document.getElementById("sumEffectiveRent").textContent = formatMoney(y1.effectiveRent);
      document.getElementById("sumOperatingCosts").textContent = "-" + formatMoney(y1.operatingCosts);
      document.getElementById("sumNoi").textContent = formatMoney(y1.noi);
      document.getElementById("sumMortgagePI").textContent = "-" + formatMoney(y1.annualMortgagePI);
      const cfEl = document.getElementById("sumPreTaxCashFlow");
      cfEl.textContent = formatMoney(y1.preTaxCashFlow);
      cfEl.className = "value lg " + (y1.preTaxCashFlow >= 0 ? "success" : "danger");
      document.getElementById("sumGrossYield").textContent = formatPercent(y1.grossYield);
      document.getElementById("sumCapRate").textContent = formatPercent(y1.capRate);
      document.getElementById("sumDscr").textContent = y1.dscr === null ? "—" : y1.dscr.toFixed(2);
    }
  }

  // ── 步驟四：增值與出售 ───────────────────────────────────
  function renderStep4() {
    const s = state.sale;
    document.getElementById("sHoldingYears").value = s.holdingYears;
    document.querySelectorAll('input[name="appreciationMethod"]').forEach((r) => (r.checked = r.value === s.appreciationMethod));
    document.getElementById("appreciationRateWrap").classList.toggle("hidden", s.appreciationMethod !== "fixed_rate");
    document.getElementById("targetPriceWrap").classList.toggle("hidden", s.appreciationMethod !== "target_price");
    document.getElementById("sAppreciationRate").value = s.appreciationRate * 100;
    document.getElementById("sTargetSalePrice").value = s.targetSalePrice == null ? "" : s.targetSalePrice;
    document.getElementById("sSaleCostRate").value = s.saleCostRate * 100;
    document.getElementById("sFixedSaleCost").value = s.fixedSaleCost;
    document.getElementById("sSaleTaxInput").value = s.saleTaxInput;
    document.getElementById("sDiscountRate").value = s.discountRate * 100;

    document.getElementById("saleSummaryTitle").textContent = `第 ${s.holdingYears} 年出售摘要`;
    document.getElementById("sumSalePrice").textContent = formatMoney(currentResult.salePrice);
    document.getElementById("sumSaleCost").textContent = formatMoney(currentResult.saleCost);
    document.getElementById("sumLoanBalanceAtSale").textContent = formatMoney(currentResult.loanBalanceAtSale);
    document.getElementById("sumNetSaleProceeds").textContent = formatMoney(currentResult.netSaleProceeds);
    document.getElementById("sumHomeEquity").textContent = formatMoney(currentResult.homeEquityAtSale);
    const npvEl = document.getElementById("sumNpv");
    const npv = npvFor(currentResult);
    npvEl.textContent = formatMoney(npv);
    npvEl.className = "value " + (npv >= 0 ? "success" : "danger");
  }

  // ── 步驟五：分析結果 ─────────────────────────────────────
  function chartColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      navy900: css.getPropertyValue("--navy-900").trim() || "#102947",
      navy700: css.getPropertyValue("--navy-700").trim() || "#244f83",
      amber500: css.getPropertyValue("--amber-500").trim() || "#F59E0B",
      danger: css.getPropertyValue("--danger").trim() || "#dc2626",
      success: css.getPropertyValue("--success").trim() || "#0d8b67",
      line: css.getPropertyValue("--line").trim() || "#dbe4ee",
      textMain: css.getPropertyValue("--text-main").trim() || "#1a2433",
    };
  }

  function renderStep5() {
    document.querySelectorAll(".pinv-scenario-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.scenario === activeScenario));
    const result = scenarioResults[activeScenario];

    document.getElementById("statDownPayment").textContent = formatMoney(result.affordability.requiredDownPayment);
    document.getElementById("statMonthlyPayment").textContent = formatMoney(result.monthlyPayment);
    const cfEl = document.getElementById("statMonthlyCashFlow");
    const monthlyCf = result.firstYearCashFlow / 12;
    cfEl.textContent = formatMoney(monthlyCf);
    cfEl.className = "pinv-stat-value " + (monthlyCf >= 0 ? "success" : "danger");
    document.getElementById("statIrr").textContent = result.irr.status === "ok" ? formatPercent(result.irr.rate) : "無法計算";
    const npv = npvFor(result);
    const npvEl = document.getElementById("statNpv");
    npvEl.textContent = formatMoney(npv);
    npvEl.className = "pinv-stat-value " + (npv >= 0 ? "success" : "danger");

    // 三情境比較表
    const compareBody = document.getElementById("scenarioCompareBody");
    compareBody.innerHTML = ["conservative", "base", "optimistic"]
      .map((key) => {
        const r = scenarioResults[key];
        const label = Engine.PRESET_SCENARIOS[key].label;
        const scenarioNpv = npvFor(r);
        return `<tr><td>${label}</td><td>${formatMoney(r.firstYearCashFlow / 12)}</td><td>${formatMoney(r.netSaleProceeds)}</td><td>${r.irr.status === "ok" ? formatPercent(r.irr.rate) : "無法計算"}</td><td>${formatMoney(scenarioNpv)}</td><td>${r.roi === null ? "—" : formatPercent(r.roi)}</td><td>${r.equityMultiple === null ? "—" : r.equityMultiple.toFixed(2) + "x"}</td></tr>`;
      })
      .join("");

    renderCharts(result);
    renderJudgeAndRisk(result);
    renderStressGrid();
    renderRegulatoryTable();
    renderAlertZone("alertZoneRegulatory", computeAlerts().step2.filter((a) => a.level === "info"));
  }

  function renderCharts(result) {
    if (typeof Chart === "undefined") return;
    const colors = chartColors();
    if (charts.equity) charts.equity.destroy();
    if (charts.cashflow) charts.cashflow.destroy();

    const labels = result.equityTimeline.map((e) => `第${e.year}年`);
    charts.equity = new Chart(document.getElementById("chartEquity").getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "房屋市值", data: result.equityTimeline.map((e) => Math.round(e.marketValue)), borderColor: colors.amber500, backgroundColor: "transparent", tension: 0.2 },
          { label: "貸款餘額", data: result.equityTimeline.map((e) => Math.round(e.loanBalance)), borderColor: colors.navy700, backgroundColor: "transparent", tension: 0.2 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: colors.textMain } } }, scales: { x: { ticks: { color: colors.textMain } }, y: { ticks: { color: colors.textMain }, grid: { color: colors.line } } } },
    });

    const cfLabels = result.cashflows.map((_, i) => (i === 0 ? "第0年" : `第${i}年`));
    charts.cashflow = new Chart(document.getElementById("chartCashflow").getContext("2d"), {
      type: "bar",
      data: {
        labels: cfLabels,
        datasets: [{ label: "年度現金流", data: result.cashflows.map((v) => Math.round(v)), backgroundColor: result.cashflows.map((v) => (v < 0 ? colors.danger : colors.success)) }],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.textMain } }, y: { ticks: { color: colors.textMain }, grid: { color: colors.line } } } },
    });
  }

  function renderJudgeAndRisk(result) {
    const judge = [];
    const y1cf = result.firstYearCashFlow;
    if (y1cf < 0) judge.push(`租金無法完全覆蓋房貸，第 1 年約需每年補貼 ${formatMoney(Math.abs(y1cf))} 元`);
    else judge.push(`租金可完全覆蓋房貸，第 1 年稅前現金流為正 ${formatMoney(y1cf)} 元`);
    const principalPaid = (state.loan.manualLoanAmount ? state.loan.loanAmount : result.affordability.estimatedLoanAmount) - result.loanBalanceAtSale;
    const appreciationGain = result.salePrice - state.affordability.purchasePrice;
    judge.push(`持有期間淨值增加主要來自${appreciationGain >= principalPaid ? "房價增值" : "貸款還本"}（增值 ${formatMoney(appreciationGain)} 元／還本 ${formatMoney(principalPaid)} 元）`);
    if (result.irr.status === "ok") judge.push(`整體年化報酬率（IRR）約為 ${formatPercent(result.irr.rate)}${result.irr.hasMultipleRoots ? "（現金流正負號變化多次，建議搭配 NPV 判讀）" : ""}`);
    else judge.push("現金流未出現正向回收，無法計算 IRR");

    const risk = [];
    const y1 = result.rentalByYear[0];
    if (y1 && y1.dscr !== null && y1.dscr < 1) risk.push("DSCR 低於 1，租金收入尚不足以覆蓋房貸本息");
    risk.push("利率上升將擴大負現金流，建議參考下方壓力測試");
    if (result.equityTimeline.some((e) => e.equity < 0)) risk.push("持有期間房屋淨值可能低於 0（房價下跌情境）");
    if (result.affordability.appraisalBelowPrice) risk.push("銀行鑑價低於成交價，需自行補足鑑價差額");
    risk.push("未納入完整交易稅負（房地合一稅、土地增值稅、租賃所得稅等），實際稅負請洽會計師或稅務顧問");

    document.getElementById("judgeList").innerHTML = judge.map((t) => `<li>${t}</li>`).join("");
    document.getElementById("riskList").innerHTML = risk.map((t) => `<li>${t}</li>`).join("");
  }

  function renderStressGrid() {
    const grid = document.getElementById("stressGrid");
    grid.innerHTML = stressResults
      .map(
        (t) => `
      <div class="pinv-stress-card">
        <div class="name">${t.label}</div>
        <div class="row"><span>月付金變化</span><b>${t.monthlyPaymentChange >= 0 ? "+" : ""}${formatMoney(t.monthlyPaymentChange)}</b></div>
        <div class="row"><span>年度現金流變化</span><b>${t.firstYearCashFlowChange >= 0 ? "+" : ""}${formatMoney(t.firstYearCashFlowChange)}</b></div>
        <div class="row"><span>最大累積現金缺口</span><b>${formatMoney(t.maxCumulativeShortfall)}</b></div>
        <div class="row"><span>出售淨回收</span><b>${formatMoney(t.netSaleProceeds)}</b></div>
        <div class="row"><span>IRR 變化</span><b>${t.irrChange === null ? "—" : (t.irrChange >= 0 ? "+" : "") + (t.irrChange * 100).toFixed(2) + " pp"}</b></div>
        <div class="row"><span>房屋淨值曾低於 0</span><b>${t.homeEquityNegative ? "是" : "否"}</b></div>
      </div>`
      )
      .join("");
  }

  function regulatoryRows() {
    const a = state.affordability;
    const rows = [];
    const ltvPercent = (a.ltv || 0) * 100;
    const hasGrace = state.loan.repaymentMethod === "grace" && state.loan.graceMonths > 0;
    const mortgageCount = parseInt(a.existingMortgageCount, 10) || 0;
    const hasHouse = a.hasExistingHouse === "yes";
    const replacement = a.replacementNeed === "yes";

    function add(situation, note, level) {
      rows.push({ situation, note, level: level || "" });
    }

    if (a.borrowerType === "company") {
      add("公司法人購置住宅", "央行選擇性信用管制提示：最高貸款成數 3 成，且不得有寬限期。", "danger");
      if (ltvPercent > 30) add("目前輸入貸款成數", `目前為 ${ltvPercent.toFixed(0)}%，高於上述 3 成提示，請確認銀行核貸條件。`, "danger");
      if (hasGrace) add("目前輸入寬限期", "公司法人購置住宅一般不得有寬限期，請調整或與承貸銀行確認。", "danger");
      return rows;
    }

    if (a.highValueResidence === "yes") {
      add("自然人購置高價住宅", "央行提示：最高貸款成數 3 成，且不得有寬限期。", "danger");
      if (ltvPercent > 30) add("目前輸入貸款成數", `目前為 ${ltvPercent.toFixed(0)}%，高於高價住宅 3 成提示。`, "danger");
      if (hasGrace) add("目前輸入寬限期", "高價住宅貸款一般不得有寬限期。", "danger");
      return rows;
    }

    if (mortgageCount >= 2) {
      add("自然人第 3 戶以上購屋貸款", "央行提示：最高貸款成數 3 成，且不得有寬限期。", "danger");
      if (ltvPercent > 30) add("目前輸入貸款成數", `目前為 ${ltvPercent.toFixed(0)}%，高於第 3 戶以上 3 成提示。`, "danger");
      if (hasGrace) add("目前輸入寬限期", "第 3 戶以上購屋貸款一般不得有寬限期。", "danger");
      return rows;
    }

    if (mortgageCount === 1) {
      if (replacement) {
        add("自然人已有 1 戶房貸且主張換屋自住", "央行問答提示：與承貸金融機構切結後，可能適用先買後賣協處；通常需於撥款後 18 個月內出售原擔保品、清償並塗銷原房貸。", "warn");
      } else {
        add("自然人第 2 戶購屋貸款", "2026-03-20 起央行提示：最高貸款成數 6 成，且不得有寬限期。", "warn");
        if (ltvPercent > 60) add("目前輸入貸款成數", `目前為 ${ltvPercent.toFixed(0)}%，高於第 2 戶 6 成提示。`, "danger");
        if (hasGrace) add("目前輸入寬限期", "第 2 戶購屋貸款一般不得有寬限期。", "danger");
      }
      return rows;
    }

    if (mortgageCount === 0 && hasHouse) {
      if (replacement) {
        add("自然人無房貸但名下有房屋，且主張換屋自住", "央行問答提示：與承貸金融機構切結後，可能不受不得有寬限期限制；通常需於撥款後 18 個月內出售原有房屋並完成移轉登記。", "warn");
      } else {
        add("自然人無房貸但名下有房屋", "央行提示：名下有房屋者申辦第 1 戶購屋貸款一般不得有寬限期。", "warn");
        if (hasGrace) add("目前輸入寬限期", "此條件下一般不得有寬限期，請確認是否符合例外或協處條件。", "danger");
      }
      return rows;
    }

    add("自然人名下無房貸且無房屋", "目前未觸發本工具列出的央行選擇性信用管制成數/寬限期提示；仍須以銀行鑑價、聯徵與正式核貸結果為準。", "ok");
    return rows;
  }

  function renderRegulatoryTable() {
    const body = document.getElementById("regulatoryTableBody");
    if (!body) return;
    body.innerHTML = regulatoryRows()
      .map((r) => `<tr class="${r.level ? "pinv-reg-row-" + r.level : ""}"><td>${r.situation}</td><td>${r.note}</td></tr>`)
      .join("");
  }

  // ── CSV 匯出 ─────────────────────────────────────────────
  function exportCsv() {
    const result = scenarioResults[activeScenario] || currentResult;
    const scenarioLabel = Engine.PRESET_SCENARIOS[activeScenario] ? Engine.PRESET_SCENARIOS[activeScenario].label : "目前輸入";
    const header = ["情境", "年度", "期初貸款餘額", "當年本金", "當年利息", "當年還款", "提前還款", "期末貸款餘額", "有效租金收入", "NOI", "稅前現金流", "期末出售淨回收", "折現率", "NPV", "IRR"];
    const lines = [header.join(",")];
    const npv = npvFor(result);
    const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const money = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v) : "");
    result.yearlySchedule.slice(0, state.sale.holdingYears).forEach((y, i) => {
      const r = result.rentalByYear[i];
      const isSaleYear = i + 1 === state.sale.holdingYears;
      lines.push([
        scenarioLabel,
        y.year,
        money(y.beginningBalance),
        money(y.principal),
        money(y.interest),
        money(y.payment),
        money(y.prepayment),
        money(y.endingBalance),
        r ? money(r.effectiveRent) : "",
        r ? money(r.noi) : "",
        r ? money(r.preTaxCashFlow) : "",
        isSaleYear ? money(result.netSaleProceeds) : "",
        i === 0 ? (state.sale.discountRate * 100).toFixed(2) + "%" : "",
        i === 0 ? money(npv) : "",
        i === 0 && result.irr.status === "ok" ? (result.irr.rate * 100).toFixed(2) + "%" : "",
      ].map(cell).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `投資不動產試算_${scenarioLabel}情境.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF 報告（jsPDF ＋ html2canvas，作法與 policy-irr 相同） ─
  async function addHtmlPageSliced(doc, elId, pageWidth, pageHeight, isFirstPageOverall) {
    const el = document.getElementById(elId);
    const canvas = await window.html2canvas(el, { scale: 1.5, backgroundColor: "#ffffff" });
    const scaleFactor = canvas.width / pageWidth;
    const sliceHeightPx = pageHeight * scaleFactor;
    let renderedHeight = 0;
    let first = true;
    while (renderedHeight < canvas.height) {
      const thisSliceHeight = Math.min(sliceHeightPx, canvas.height - renderedHeight);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = thisSliceHeight;
      const ctx = sliceCanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, thisSliceHeight, 0, 0, canvas.width, thisSliceHeight);
      if (!(isFirstPageOverall && first)) doc.addPage();
      doc.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWidth, thisSliceHeight / scaleFactor);
      renderedHeight += thisSliceHeight;
      first = false;
    }
  }

  async function generatePdfReport() {
    const btn = document.getElementById("btnGeneratePdf");
    if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
      alert("PDF 產生元件尚未載入完成（可能是離線或 CDN 資源被封鎖），請確認網路連線後重新整理頁面再試一次。");
      return;
    }
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "產生中…";
    try {
      const result = scenarioResults[activeScenario];
      const scenarioLabel = Engine.PRESET_SCENARIOS[activeScenario].label;
      const reportNpv = npvFor(result);

      document.getElementById("pdfSummaryContent").innerHTML = `
        <div class="pinv-pdf-kv">
          <div><span>成交價</span><span>${formatMoney(state.affordability.purchasePrice)}</span></div>
          <div><span>試算情境</span><span>${scenarioLabel}情境</span></div>
          <div><span>所需自備款</span><span>${formatMoney(result.affordability.requiredDownPayment)}</span></div>
          <div><span>預估貸款金額</span><span>${formatMoney(result.affordability.estimatedLoanAmount)}</span></div>
          <div><span>每月房貸</span><span>${formatMoney(result.monthlyPayment)}</span></div>
          <div><span>還款方式</span><span>${{ annuity: "本息平均攤還", equal_principal: "本金平均攤還", grace: "還本寬限期" }[state.loan.repaymentMethod]}</span></div>
          <div><span>持有年限</span><span>${state.sale.holdingYears} 年</span></div>
          <div><span>出售淨回收</span><span>${formatMoney(result.netSaleProceeds)}</span></div>
          <div><span>持有期間 IRR</span><span>${result.irr.status === "ok" ? formatPercent(result.irr.rate) : "無法計算"}</span></div>
          <div><span>折現率</span><span>${formatPercent(state.sale.discountRate)}</span></div>
          <div><span>NPV</span><span>${formatMoney(reportNpv)}</span></div>
          <div><span>ROI</span><span>${result.roi === null ? "—" : formatPercent(result.roi)}</span></div>
        </div>`;

      document.getElementById("pdfScheduleContent").innerHTML = `
        <table class="pinv-pdf-table">
          <thead><tr><th>年度</th><th>期初餘額</th><th>本金</th><th>利息</th><th>期末餘額</th><th>NOI</th><th>稅前現金流</th></tr></thead>
          <tbody>
            ${result.yearlySchedule.slice(0, state.sale.holdingYears)
              .map((y, i) => {
                const r = result.rentalByYear[i];
                return `<tr><td style="text-align:center">第${y.year}年</td><td>${formatMoney(y.beginningBalance)}</td><td>${formatMoney(y.principal)}</td><td>${formatMoney(y.interest)}</td><td>${formatMoney(y.endingBalance)}</td><td>${r ? formatMoney(r.noi) : "—"}</td><td>${r ? formatMoney(r.preTaxCashFlow) : "—"}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>`;

      const eqCanvas = document.getElementById("chartEquity");
      const cfCanvas = document.getElementById("chartCashflow");
      document.getElementById("pdfChartsContent").innerHTML = `
        <div style="margin-bottom:24px">
          <div style="font-weight:700;color:#102947;margin-bottom:8px;font-size:13px">房屋市值與貸款餘額</div>
          <img id="pdfChartImg1" style="width:100%;display:block">
        </div>
        <div>
          <div style="font-weight:700;color:#102947;margin-bottom:8px;font-size:13px">年度現金流量</div>
          <img id="pdfChartImg2" style="width:100%;display:block">
        </div>`;
      const img1 = document.getElementById("pdfChartImg1");
      const img2 = document.getElementById("pdfChartImg2");
      if (eqCanvas && eqCanvas.width) {
        img1.src = eqCanvas.toDataURL("image/png");
        await img1.decode().catch(() => {});
      }
      if (cfCanvas && cfCanvas.width) {
        img2.src = cfCanvas.toDataURL("image/png");
        await img2.decode().catch(() => {});
      }

      document.getElementById("pdfAssumptionsContent").innerHTML = `
        <ul>
          <li>貸款計算基礎：${{ purchase_price: "以成交價計算", appraisal: "以銀行鑑價計算", lower_of_two: "成交價與鑑價孰低" }[state.affordability.loanBaseMethod]}</li>
          <li>房價增值假設：${state.sale.appreciationMethod === "target_price" ? "使用者指定出售價格" : `固定年增值率 ${formatPercent(state.sale.appreciationRate)}（${scenarioLabel}情境已套用標準化假設）`}</li>
          <li>租金與空置假設：租金年成長率 ${formatPercent(state.rental.rentGrowthRate)}、空置率 ${formatPercent(state.rental.vacancyRate)}（${scenarioLabel}情境已套用標準化假設）</li>
          <li>NPV 折現率：${formatPercent(state.sale.discountRate)}</li>
          <li>計算版本：1.0.0（原生 JS，延遲取整）；法規提示版本：2026-08-08</li>
        </ul>
        <p><strong>非產品承諾：</strong>本平台不宣稱使用者一定可以取得試算中的貸款金額，試算結果不代表銀行鑑價或核貸結果，房價增值率不代表未來市場預測，試算稅費不是使用者最終稅額，IRR 亦非保證報酬。</p>
        <p>本平台提供的貸款成數、寬限期及房貸條件僅供財務規劃參考。實際適用規範、房貸戶數認定、擔保品鑑價、利率與核貸結果，應以中央銀行最新規定、承貸金融機構審核及正式貸款契約為準。</p>
      `;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "px", format: "a4", compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      await addHtmlPageSliced(doc, "pdfPage1", pageWidth, pageHeight, true);
      await addHtmlPageSliced(doc, "pdfPage2", pageWidth, pageHeight, false);
      await addHtmlPageSliced(doc, "pdfPage3", pageWidth, pageHeight, false);
      await addHtmlPageSliced(doc, "pdfPage4", pageWidth, pageHeight, false);

      doc.save("投資不動產試算報告.pdf");
    } catch (err) {
      console.error(err);
      alert("PDF 產生失敗：" + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ── 主渲染 ───────────────────────────────────────────────
  function renderAll() {
    compute();
    const main = document.querySelector(".pinv-main");
    if (main) main.dataset.currentStep = String(currentStep);
    renderProgress();
    renderLiveOverview();
    document.querySelectorAll(".pinv-step-panel").forEach((panel) => {
      panel.classList.toggle("hidden", parseInt(panel.dataset.step, 10) !== currentStep);
    });
    renderStep1();
    renderStep2();
    renderStep3();
    renderStep4();
    if (currentStep === 5) renderStep5();

    const alerts = computeAlerts();
    renderAlertZone("alertZoneStep1", alerts.step1.filter((a) => a.level !== "info"));
    renderAlertZone("alertZoneStep2", alerts.step2.filter((a) => a.level !== "info"));
    renderAlertZone("alertZoneStep3", alerts.step3);
    renderAlertZone("alertZoneStep4", alerts.step4);
  }

  // ── 事件綁定 ─────────────────────────────────────────────
  function bindNumberField(id, group, key, opts) {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
      const raw = el.value.trim();
      mutate(() => {
        if (raw === "" && opts && opts.nullable) {
          state[group][key] = null;
          return;
        }
        let v = parseFloat(raw);
        if (!isFinite(v)) v = opts && opts.default != null ? opts.default : 0;
        if (opts && opts.percent) v = v / 100;
        if (opts && opts.min0 !== false) v = Math.max(0, v);
        state[group][key] = v;
      });
    });
  }

  function bindSelectField(id, group, key) {
    document.getElementById(id).addEventListener("change", (e) => {
      mutate(() => {
        state[group][key] = e.target.value;
      });
    });
  }

  function bindStep1() {
    bindNumberField("aAvailableCash", "affordability", "availableCash");
    bindNumberField("aEmergencyFund", "affordability", "emergencyFund");
    bindNumberField("aMonthlyIncome", "affordability", "monthlyIncome");
    bindNumberField("aMonthlyExpense", "affordability", "monthlyExpense");
    bindNumberField("aOtherDebtPayment", "affordability", "otherDebtPayment");
    bindNumberField("aMortgageBurdenRate", "affordability", "mortgageBurdenRate", { percent: true });
    bindNumberField("aPurchasePrice", "affordability", "purchasePrice");
    bindNumberField("aAppraisalValue", "affordability", "appraisalValue", { nullable: true });
    bindSelectField("aLoanBaseMethod", "affordability", "loanBaseMethod");
    bindNumberField("aLtv", "affordability", "ltv", { percent: true });
    bindNumberField("aAcquisitionFixedCost", "affordability", "acquisitionFixedCost");
    bindNumberField("aAcquisitionCostRate", "affordability", "acquisitionCostRate", { percent: true });
    bindNumberField("aRenovationCost", "affordability", "renovationCost");
    bindNumberField("aMaxPurchaseBudget", "affordability", "maxPurchaseBudget", { nullable: true });
    bindSelectField("aBorrowerType", "affordability", "borrowerType");
    document.getElementById("aExistingMortgageCount").addEventListener("change", (e) => {
      mutate(() => {
        state.affordability.existingMortgageCount = parseInt(e.target.value, 10) || 0;
      });
    });
    bindSelectField("aHasExistingHouse", "affordability", "hasExistingHouse");
    bindSelectField("aReplacementNeed", "affordability", "replacementNeed");
    bindSelectField("aHighValueResidence", "affordability", "highValueResidence");
  }

  function bindStep2() {
    document.getElementById("lManualLoanAmount").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.manualLoanAmount = e.target.checked;
        if (e.target.checked) state.loan.loanAmount = Math.round(currentResult.affordability.estimatedLoanAmount);
      });
    });
    bindNumberField("lLoanAmount", "loan", "loanAmount");
    bindNumberField("lAnnualRate", "loan", "annualRate", { percent: true });
    document.getElementById("lTermYears").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.termYears = Math.max(1, Math.round(parseFloat(e.target.value) || 30));
      });
    });
    document.querySelectorAll('input[name="repaymentMethod"]').forEach((r) => {
      r.addEventListener("change", () => {
        mutate(() => {
          state.loan.repaymentMethod = r.value;
        });
      });
    });
    document.getElementById("lGraceMonths").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.graceMonths = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
      });
    });
    document.getElementById("lRateStage2Enabled").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.rateStage2.enabled = e.target.checked;
      });
    });
    document.getElementById("lRateStage2ChangeMonth").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.rateStage2.changeMonth = Math.max(1, Math.round(parseFloat(e.target.value) || 1));
      });
    });
    document.getElementById("lRateStage2Rate").addEventListener("change", (e) => {
      mutate(() => {
        state.loan.rateStage2.secondAnnualRate = Math.max(0, (parseFloat(e.target.value) || 0) / 100);
      });
    });
    document.getElementById("btnAddPrepayment").addEventListener("click", () => {
      mutate(() => {
        state.loan.prepayments.push({ id: uid(), month: 12, amount: 500000, mode: "reduce_term" });
      });
    });
    document.getElementById("btnToggleSchedule").addEventListener("click", () => {
      const wrap = document.getElementById("scheduleTableWrap");
      wrap.classList.toggle("hidden");
      if (!wrap.classList.contains("hidden")) renderScheduleTableIfVisible();
    });
  }

  function bindStep3() {
    bindNumberField("rMonthlyRent", "rental", "monthlyRent");
    bindNumberField("rParkingRent", "rental", "parkingRent");
    bindNumberField("rOtherMonthlyIncome", "rental", "otherMonthlyIncome");
    bindNumberField("rVacancyRate", "rental", "vacancyRate", { percent: true });
    bindNumberField("rBadDebtLoss", "rental", "badDebtLoss");
    bindNumberField("rRentGrowthRate", "rental", "rentGrowthRate", { percent: true });
    document.getElementById("btnAddOperatingCost").addEventListener("click", () => {
      mutate(() => {
        state.rental.annualOperatingCosts.push({ id: uid(), name: "新增費用", amount: 0, frequency: "annual", startYear: 1 });
      });
    });
  }

  function bindStep4() {
    document.getElementById("sHoldingYears").addEventListener("change", (e) => {
      mutate(() => {
        state.sale.holdingYears = Math.max(1, Math.round(parseFloat(e.target.value) || 5));
      });
    });
    document.querySelectorAll('input[name="appreciationMethod"]').forEach((r) => {
      r.addEventListener("change", () => {
        mutate(() => {
          state.sale.appreciationMethod = r.value;
        });
      });
    });
    bindNumberField("sAppreciationRate", "sale", "appreciationRate", { percent: true, min0: false });
    bindNumberField("sTargetSalePrice", "sale", "targetSalePrice", { nullable: true });
    bindNumberField("sSaleCostRate", "sale", "saleCostRate", { percent: true });
    bindNumberField("sFixedSaleCost", "sale", "fixedSaleCost");
    bindNumberField("sSaleTaxInput", "sale", "saleTaxInput");
    bindNumberField("sDiscountRate", "sale", "discountRate", { percent: true, min0: false });
  }

  function bindStep5() {
    document.querySelectorAll(".pinv-scenario-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeScenario = tab.dataset.scenario;
        renderStep5();
      });
    });
    document.getElementById("btnSave").addEventListener("click", saveNow);
    document.getElementById("btnLoad").addEventListener("click", loadSaved);
    document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnGeneratePdf").addEventListener("click", generatePdfReport);
    document.getElementById("btnReset").addEventListener("click", resetAll);
  }

  function bindStepNav() {
    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.goto, 10)));
    });
  }

  // ── 初始化 ───────────────────────────────────────────────
  function init() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        state = normalizeState(JSON.parse(raw));
      } catch (e) {
        state = normalizeState(defaultState());
      }
    } else {
      state = normalizeState(defaultState());
    }
    bindStep1();
    bindStep2();
    bindStep3();
    bindStep4();
    bindStep5();
    bindStepNav();
    renderAll();

    // Chart.js 把顏色字串「烤」進圖表設定裡，不會隨 [data-theme] 屬性改變
    // 自動重繪；使用者切換深色模式時要手動用新的 token 顏色重畫一次，
    // 否則文字會用舊主題的顏色留在畫面上，在新底色上變成看不見。
    const themeObserver = new MutationObserver(() => {
      if (currentStep === 5 && scenarioResults) renderCharts(scenarioResults[activeScenario]);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
