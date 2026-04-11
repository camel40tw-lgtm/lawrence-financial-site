/* =========================
   UI 控制與狀態管理 (UI Controller)
========================= */

let currentStep = 1;
const totalSteps = 4;
const STORAGE_KEY = 'cfp_retire_plan_v3';
const chartInstances = {};
let lastRenderedData = null;
let lastRenderedProjection = null;
let lastRenderedMonteCarlo = null;
let selectedReportAge = null;
const currencyFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0
});

document.addEventListener('DOMContentLoaded', () => {
  initializeDefaults();
  updateWizardUI();
  checkUrlData();
});

function initializeDefaults() {
  const reportDateInput = document.getElementById('reportDate');
  if (reportDateInput && !reportDateInput.value) {
    reportDateInput.value = getLocalDateString();
  }

  const shareBox = document.getElementById('shareBox');
  if (shareBox) shareBox.classList.add('hidden');
}

function getLocalDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[char] || char;
  });
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatSignedCurrency(value) {
  const amount = toFiniteNumber(value, 0);
  return `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundForInput(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(toFiniteNumber(value, 0) * factor) / factor;
}

function getPointValueByAge(series, age, key = 'value') {
  if (!Array.isArray(series)) return null;
  const point = series.find((item) => item.age === age);
  if (!point) return null;
  const value = point[key];
  return Number.isFinite(value) ? value : null;
}

let pageNoticeTimer = null;

function showPageNotice(message, type = 'info') {
  if (!message) return;

  let notice = document.getElementById('pageNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'pageNotice';
    notice.className = 'no-print';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.appendChild(notice);
  }

  const palette = type === 'error'
    ? { background: '#fff1f0', border: '#f5b5ae', color: '#8a1f17' }
    : { background: '#eef8f2', border: '#a8d8b7', color: '#155b2a' };

  Object.assign(notice.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '9999',
    maxWidth: '320px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
    fontSize: '14px',
    lineHeight: '1.5',
    opacity: '1',
    transition: 'opacity 180ms ease'
  });

  notice.textContent = message;

  if (pageNoticeTimer) {
    window.clearTimeout(pageNoticeTimer);
  }

  pageNoticeTimer = window.setTimeout(() => {
    notice.style.opacity = '0';
    window.setTimeout(() => {
      if (notice.parentNode) {
        notice.parentNode.removeChild(notice);
      }
    }, 180);
  }, 2600);
}

function clearValidationState() {
  document.querySelectorAll('.field-error').forEach((el) => el.classList.remove('show'));
  document.querySelectorAll('input, select, textarea').forEach((el) => el.classList.remove('invalid'));
}

function markInvalidElement(element, message, issues, errId) {
  if (element) element.classList.add('invalid');
  if (errId) {
    const errEl = document.getElementById(errId);
    if (errEl) errEl.classList.add('show');
  }
  issues.push(message);
}

function validateNumberInput(id, label, issues, options = {}) {
  const {
    min,
    max,
    integer = false,
    allowZero = true,
    message = `${label} 輸入不正確。`
  } = options;

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

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

function setChecked(id, checked) {
  const element = document.getElementById(id);
  if (element) element.checked = Boolean(checked);
}

function setSelectValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function destroyCharts() {
  Object.keys(chartInstances).forEach((key) => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
  });
}

/* ---------- 導航與進度條 ---------- */
function goToStep(step, options = {}) {
  const { skipValidation = false } = options;
  if (step < 1 || step > totalSteps) return;

  if (!skipValidation && step > currentStep) {
    for (let pendingStep = currentStep; pendingStep < step; pendingStep++) {
      if (!validateStep(pendingStep)) return;
    }
  }

  document.querySelectorAll('.wizard-panel').forEach((panel) => {
    panel.classList.remove('active');
  });

  document.getElementById(`panel${step}`).classList.add('active');

  document.querySelectorAll('.wp-step').forEach((element, index) => {
    const stepNum = index + 1;
    if (stepNum < step) {
      element.classList.add('done');
      element.classList.remove('active');
    } else if (stepNum === step) {
      element.classList.add('active');
      element.classList.remove('done');
    } else {
      element.classList.remove('active', 'done');
    }
  });

  currentStep = step;
  if (step === 4) generateSummary();
}

function updateWizardUI() {
  goToStep(currentStep, { skipValidation: true });
}

function nextStep(step) {
  if (validateStep(step)) {
    goToStep(step + 1, { skipValidation: true });
  }
}

function prevStep(step) {
  goToStep(step - 1, { skipValidation: true });
}

function resetWizard() {
  destroyCharts();
  document.getElementById('reportSection').classList.add('hidden');
  document.getElementById('homeSection').classList.remove('hidden');
  document.getElementById('shareBox').classList.add('hidden');
  goToStep(1, { skipValidation: true });
  window.scrollTo(0, 0);
}

/* ---------- 驗證邏輯 ---------- */
function validateStep(step, options = {}) {
  const { preserveState = false, silent = false, issues = [] } = options;
  let isValid = true;

  if (!preserveState) clearValidationState();

  if (step === 1) {
    const currentAge = Number(document.getElementById('currentAge').value);
    const retireAge = Number(document.getElementById('retireAge').value);
    const lifeExpectancy = Number(document.getElementById('lifeExpectancy').value);

    if (!Number.isInteger(currentAge) || currentAge <= 0) {
      showError('currentAge', 'err-currentAge', '目前年齡需為正整數。', issues);
      isValid = false;
    }

    if (!Number.isInteger(retireAge) || retireAge <= currentAge) {
      showError('retireAge', 'err-retireAge', '退休年齡需大於目前年齡。', issues);
      isValid = false;
    }

    if (!Number.isInteger(lifeExpectancy) || lifeExpectancy <= retireAge) {
      showError('lifeExpectancy', 'err-lifeExpectancy', '預計壽命需大於退休年齡。', issues);
      isValid = false;
    }
  }

  if (step === 2) {
    const currentAge = toFiniteNumber(document.getElementById('currentAge').value, 0);
    const lifeExpectancy = toFiniteNumber(document.getElementById('lifeExpectancy').value, 0);

    const checkedValues = [
      validateNumberInput('expense', '每月生活費', issues, { min: 0, message: '每月生活費需為 0 以上的數字。' }),
      validateNumberInput('pension', '每月固定收入', issues, { min: 0, message: '每月固定收入需為 0 以上的數字。' }),
      validateNumberInput('monthlyMedicalExpense', '每月醫療費用', issues, { min: 0, message: '每月醫療費用需為 0 以上的數字。' }),
      validateNumberInput('assets', '目前已準備資產', issues, { min: 0, message: '目前已準備資產需為 0 以上的數字。' }),
      validateNumberInput('contribution', '每月可再投入金額', issues, { min: 0, message: '每月可再投入金額需為 0 以上的數字。' }),
      validateNumberInput('returnRate', '退休前年報酬率', issues, { min: -100, max: 100, message: '退休前年報酬率需介於 -100% 到 100% 之間。' }),
      validateNumberInput('inflationRate', '一般通膨率', issues, { min: -20, max: 30, message: '一般通膨率需介於 -20% 到 30% 之間。' }),
      validateNumberInput('postReturnRate', '退休後報酬率', issues, { min: -100, max: 100, message: '退休後報酬率需介於 -100% 到 100% 之間。' }),
      validateNumberInput('medicalInflationRate', '醫療通膨率', issues, { min: -20, max: 50, message: '醫療通膨率需介於 -20% 到 50% 之間。' })
    ];

    if (checkedValues.includes(null)) isValid = false;

    if (document.getElementById('ltcEnabled').value === 'true') {
      const ltcStartAge = validateNumberInput('ltcStartAge', 'LTC 起始年齡', issues, {
        min: currentAge,
        max: lifeExpectancy,
        integer: true,
        message: `LTC 起始年齡需介於 ${currentAge} 到 ${lifeExpectancy} 歲之間。`
      });
      const ltcDurationYears = validateNumberInput('ltcDurationYears', 'LTC 持續年數', issues, {
        min: 1,
        max: Math.max(1, lifeExpectancy - currentAge + 1),
        integer: true,
        message: 'LTC 持續年數需為 1 年以上的整數。'
      });
      const ltcExtraCostFactor = validateNumberInput('ltcExtraCostFactor', 'LTC 額外成本倍數', issues, {
        min: 1,
        max: 10,
        message: 'LTC 額外成本倍數需介於 1 到 10 之間。'
      });

      if (ltcStartAge === null || ltcDurationYears === null || ltcExtraCostFactor === null) {
        isValid = false;
      }
    }
  }

  if (step === 3) {
    const currentAge = toFiniteNumber(document.getElementById('currentAge').value, 0);
    const lifeExpectancy = toFiniteNumber(document.getElementById('lifeExpectancy').value, 0);

    if (!validateEventRows('#goalContainer', 'g', '財務目標', currentAge, lifeExpectancy, issues)) {
      isValid = false;
    }

    if (!validateEventRows('#incomeContainer', 'i', '收入事件', currentAge, lifeExpectancy, issues)) {
      isValid = false;
    }
  }

  if (step === 4 && document.getElementById('mcEnabled').checked) {
    const mcRuns = validateNumberInput('mcRuns', '模擬次數', issues, {
      min: 100,
      max: 100000,
      integer: true,
      message: '模擬次數至少 100 次，且需為整數。'
    });
    const mcVolatility = validateNumberInput('mcVolatility', '年化波動度', issues, {
      min: 0,
      max: 100,
      message: '年化波動度需介於 0% 到 100% 之間。'
    });
    const mcInflationVolatility = validateNumberInput('mcInflationVolatility', '通膨波動度', issues, {
      min: 0,
      max: 20,
      message: '通膨波動度需介於 0% 到 20% 之間。'
    });
    const mcSpendingFloor = validateNumberInput('mcSpendingFloor', '最低支出比例', issues, {
      min: 1,
      max: 100,
      message: '最低支出比例需介於 1% 到 100% 之間。'
    });
    const mcSpendingCeiling = validateNumberInput('mcSpendingCeiling', '最高支出比例', issues, {
      min: 100,
      max: 300,
      message: '最高支出比例需介於 100% 到 300% 之間。'
    });

    if ([mcRuns, mcVolatility, mcInflationVolatility, mcSpendingFloor, mcSpendingCeiling].includes(null)) {
      isValid = false;
    }

    if (
      mcSpendingFloor !== null &&
      mcSpendingCeiling !== null &&
      mcSpendingCeiling < mcSpendingFloor
    ) {
      markInvalidElement(
        document.getElementById('mcSpendingCeiling'),
        '最高支出比例不可低於最低支出比例。',
        issues
      );
      isValid = false;
    }
  }

  if (!isValid && !silent && issues.length) {
    alert(issues.join('\n'));
  }

  return isValid;
}

function validateEventRows(containerSelector, prefix, label, currentAge, lifeExpectancy, issues) {
  let isValid = true;
  const rows = Array.from(document.querySelectorAll(`${containerSelector} .event-row`));

  rows.forEach((row, index) => {
    const ageInput = row.querySelector(`.${prefix}-age`);
    const amountInput = row.querySelector(`.${prefix}-amount`);
    const yearsInput = row.querySelector(`.${prefix}-years`);
    const typeInput = row.querySelector(`.${prefix}-type`);

    const age = Number(ageInput?.value);
    const amount = Number(amountInput?.value);
    const years = Number(yearsInput?.value);
    const itemLabel = `${label} ${index + 1}`;

    if (!Number.isInteger(age) || age < currentAge || age > lifeExpectancy) {
      markInvalidElement(
        ageInput,
        `${itemLabel} 的發生年齡需介於 ${currentAge} 到 ${lifeExpectancy} 歲之間。`,
        issues
      );
      isValid = false;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      markInvalidElement(amountInput, `${itemLabel} 的金額需大於 0。`, issues);
      isValid = false;
    }

    if (!Number.isInteger(years) || years < 1) {
      markInvalidElement(yearsInput, `${itemLabel} 的持續年數需為 1 以上整數。`, issues);
      isValid = false;
    }

    if (Number.isInteger(age) && Number.isInteger(years) && typeInput?.value === 'monthly') {
      const finalAge = age + years - 1;
      if (finalAge > lifeExpectancy) {
        markInvalidElement(
          yearsInput,
          `${itemLabel} 的持續年數超出規劃年限，最後一期將落在 ${finalAge} 歲。`,
          issues
        );
        isValid = false;
      }
    }
  });

  return isValid;
}

function validateAllInputs() {
  clearValidationState();

  for (const step of [1, 2, 3, 4]) {
    const issues = [];
    if (!validateStep(step, { preserveState: true, silent: true, issues })) {
      goToStep(step, { skipValidation: true });
      alert(issues.join('\n'));
      return false;
    }
  }

  return true;
}

function showError(inputId, errId, message, issues) {
  const input = document.getElementById(inputId);
  if (input) input.classList.add('invalid');
  const errEl = document.getElementById(errId);
  if (errEl) errEl.classList.add('show');
  issues.push(message);
}

/* ---------- 動態事件管理 ---------- */
function addGoal(data = {}) {
  const container = document.getElementById('goalContainer');
  const defaultAge = document.getElementById('retireAge').value || 65;
  const ageValue = Number.isFinite(Number(data.age)) ? Number(data.age) : defaultAge;
  const amountValue = Number.isFinite(Number(data.amount)) ? Number(data.amount) : 500000;
  const yearsValue = Number.isInteger(Number(data.years)) ? Number(data.years) : 1;
  const typeValue = data.type === 'monthly' ? 'monthly' : 'lump';

  const div = document.createElement('div');
  div.className = 'goal-box event-row';
  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title">財務目標</div>
      <button type="button" class="remove-btn" onclick="this.closest('.event-row').remove()">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>目標名稱</label>
        <input type="text" class="g-name" value="${escapeAttr(data.name || '')}" placeholder="如：換車、子女結婚">
      </div>
      <div>
        <label>發生年齡</label>
        <input type="number" class="g-age" value="${ageValue}">
      </div>
      <div>
        <label>發生方式</label>
        <select class="g-type">
          <option value="lump" ${typeValue === 'lump' ? 'selected' : ''}>單筆支出</option>
          <option value="monthly" ${typeValue === 'monthly' ? 'selected' : ''}>每月支出</option>
        </select>
      </div>
      <div>
        <label>金額（現值）</label>
        <input type="number" class="g-amount" value="${amountValue}">
      </div>
      <div>
        <label>持續年數 (單筆填1)</label>
        <input type="number" class="g-years" value="${yearsValue}">
      </div>
      <div style="display:flex; align-items:flex-end; padding-bottom:10px;">
        <label class="check-item"><input type="checkbox" class="g-inflation" ${data.inflation === false ? '' : 'checked'}><span>隨通膨調整</span></label>
      </div>
    </div>
  `;

  container.appendChild(div);
}

function addIncome(data = {}) {
  const container = document.getElementById('incomeContainer');
  const defaultAge = document.getElementById('retireAge').value || 65;
  const ageValue = Number.isFinite(Number(data.age)) ? Number(data.age) : defaultAge;
  const amountValue = Number.isFinite(Number(data.amount)) ? Number(data.amount) : 1000000;
  const yearsValue = Number.isInteger(Number(data.years)) ? Number(data.years) : 1;
  const typeValue = data.type === 'monthly' ? 'monthly' : 'lump';

  const div = document.createElement('div');
  div.className = 'income-box event-row';
  div.innerHTML = `
    <div class="goal-top">
      <div class="goal-title" style="color:var(--matcha);">預期收入</div>
      <button type="button" class="remove-btn" onclick="this.closest('.event-row').remove()">移除</button>
    </div>
    <div class="field-grid">
      <div>
        <label>收入名稱</label>
        <input type="text" class="i-name" value="${escapeAttr(data.name || '')}" placeholder="如：儲蓄險滿期、賣房">
      </div>
      <div>
        <label>發生年齡</label>
        <input type="number" class="i-age" value="${ageValue}">
      </div>
      <div>
        <label>發生方式</label>
        <select class="i-type">
          <option value="lump" ${typeValue === 'lump' ? 'selected' : ''}>單筆收入</option>
          <option value="monthly" ${typeValue === 'monthly' ? 'selected' : ''}>每月收入</option>
        </select>
      </div>
      <div>
        <label>金額（現值）</label>
        <input type="number" class="i-amount" value="${amountValue}">
      </div>
      <div>
        <label>持續年數 (單筆填1)</label>
        <input type="number" class="i-years" value="${yearsValue}">
      </div>
      <div style="display:flex; align-items:flex-end; padding-bottom:10px;">
        <label class="check-item"><input type="checkbox" class="i-inflation" ${data.inflation === false ? '' : 'checked'}><span>隨通膨調整</span></label>
      </div>
    </div>
  `;

  container.appendChild(div);
}

function readEventRows(containerSelector, prefix) {
  return Array.from(document.querySelectorAll(`${containerSelector} .event-row`)).map((row) => ({
    name: row.querySelector(`.${prefix}-name`).value.trim(),
    age: toFiniteNumber(row.querySelector(`.${prefix}-age`).value, 0),
    type: row.querySelector(`.${prefix}-type`).value === 'monthly' ? 'monthly' : 'lump',
    amount: toFiniteNumber(row.querySelector(`.${prefix}-amount`).value, 0),
    years: Math.max(1, Math.trunc(toFiniteNumber(row.querySelector(`.${prefix}-years`).value, 1))),
    inflation: row.querySelector(`.${prefix}-inflation`).checked
  }));
}

/* ---------- 資料收集與回填 ---------- */
function getFormData() {
  return {
    clientName: document.getElementById('clientName').value.trim(),
    advisorName: document.getElementById('advisorName').value.trim(),
    reportDate: document.getElementById('reportDate').value || getLocalDateString(),
    currentAge: Math.trunc(toFiniteNumber(document.getElementById('currentAge').value, 0)),
    retireAge: Math.trunc(toFiniteNumber(document.getElementById('retireAge').value, 0)),
    lifeExpectancy: Math.trunc(toFiniteNumber(document.getElementById('lifeExpectancy').value, 0)),
    advisorNote: document.getElementById('advisorNote').value.trim(),

    expense: toFiniteNumber(document.getElementById('expense').value, 0),
    pension: toFiniteNumber(document.getElementById('pension').value, 0),
    monthlyMedicalExpense: toFiniteNumber(document.getElementById('monthlyMedicalExpense').value, 0),
    assets: toFiniteNumber(document.getElementById('assets').value, 0),
    contribution: toFiniteNumber(document.getElementById('contribution').value, 0),

    returnRate: toFiniteNumber(document.getElementById('returnRate').value, 0),
    inflationRate: toFiniteNumber(document.getElementById('inflationRate').value, 0),
    postReturnRate: toFiniteNumber(document.getElementById('postReturnRate').value, 0),
    medicalInflationRate: toFiniteNumber(document.getElementById('medicalInflationRate').value, 0),

    ltcProfile: {
      enabled: document.getElementById('ltcEnabled').value === 'true',
      startAge: Math.trunc(toFiniteNumber(document.getElementById('ltcStartAge').value, 80)),
      durationYears: Math.max(1, Math.trunc(toFiniteNumber(document.getElementById('ltcDurationYears').value, 8))),
      extraCostFactor: toFiniteNumber(document.getElementById('ltcExtraCostFactor').value, 1.2)
    },

    goals: readEventRows('#goalContainer', 'g'),
    incomes: readEventRows('#incomeContainer', 'i'),

    monteCarloOptions: {
      mcEnabled: document.getElementById('mcEnabled').checked,
      mcRandomInflation: document.getElementById('mcRandomInflation').checked,
      mcFlexibleSpending: document.getElementById('mcFlexibleSpending').checked,
      mcRuns: Math.max(100, Math.trunc(toFiniteNumber(document.getElementById('mcRuns').value, 500))),
      mcVolatility: toFiniteNumber(document.getElementById('mcVolatility').value, 12) / 100,
      mcInflationVolatility: toFiniteNumber(document.getElementById('mcInflationVolatility').value, 1.2) / 100,
      mcSpendingFloor: toFiniteNumber(document.getElementById('mcSpendingFloor').value, 85) / 100,
      mcSpendingCeiling: toFiniteNumber(document.getElementById('mcSpendingCeiling').value, 110) / 100
    },

    showInputSummary: document.getElementById('showInputSummary').checked,
    showAdvisorAdvice: document.getElementById('showAdvisorAdvice').checked,
    showMonteCarloSummary: document.getElementById('showMonteCarloSummary').checked,
    showLogicSteps: document.getElementById('showLogicSteps').checked,
    showPreChart: document.getElementById('showPreChart').checked,
    showPostChart: document.getElementById('showPostChart').checked,
    showScenarioChart: document.getElementById('showScenarioChart').checked,
    showMonteCarloChart: document.getElementById('showMonteCarloChart').checked
  };
}

function hydrateForm(data = {}) {
  const ltcProfile = data.ltcProfile || {};
  const mc = data.monteCarloOptions || {};

  setInputValue('clientName', data.clientName || '');
  setInputValue('advisorName', data.advisorName || '');
  setInputValue('reportDate', data.reportDate || getLocalDateString());
  setInputValue('currentAge', Number.isFinite(Number(data.currentAge)) ? Number(data.currentAge) : 40);
  setInputValue('retireAge', Number.isFinite(Number(data.retireAge)) ? Number(data.retireAge) : 65);
  setInputValue('lifeExpectancy', Number.isFinite(Number(data.lifeExpectancy)) ? Number(data.lifeExpectancy) : 90);
  setInputValue('advisorNote', data.advisorNote || '');

  setInputValue('expense', Number.isFinite(Number(data.expense)) ? Number(data.expense) : 50000);
  setInputValue('pension', Number.isFinite(Number(data.pension)) ? Number(data.pension) : 15000);
  setInputValue('monthlyMedicalExpense', Number.isFinite(Number(data.monthlyMedicalExpense)) ? Number(data.monthlyMedicalExpense) : 8000);
  setInputValue('assets', Number.isFinite(Number(data.assets)) ? Number(data.assets) : 2000000);
  setInputValue('contribution', Number.isFinite(Number(data.contribution)) ? Number(data.contribution) : 15000);

  setInputValue('returnRate', Number.isFinite(Number(data.returnRate)) ? Number(data.returnRate) : 5);
  setInputValue('inflationRate', Number.isFinite(Number(data.inflationRate)) ? Number(data.inflationRate) : 2);
  setInputValue('postReturnRate', Number.isFinite(Number(data.postReturnRate)) ? Number(data.postReturnRate) : 2);
  setInputValue('medicalInflationRate', Number.isFinite(Number(data.medicalInflationRate)) ? Number(data.medicalInflationRate) : 5);

  setSelectValue('ltcEnabled', ltcProfile.enabled === false ? 'false' : 'true');
  setInputValue('ltcStartAge', Number.isFinite(Number(ltcProfile.startAge)) ? Number(ltcProfile.startAge) : 80);
  setInputValue('ltcDurationYears', Number.isFinite(Number(ltcProfile.durationYears)) ? Number(ltcProfile.durationYears) : 8);
  setInputValue('ltcExtraCostFactor', Number.isFinite(Number(ltcProfile.extraCostFactor)) ? Number(ltcProfile.extraCostFactor) : 1.2);

  document.getElementById('goalContainer').innerHTML = '';
  (data.goals || []).forEach((goal) => addGoal(goal));

  document.getElementById('incomeContainer').innerHTML = '';
  (data.incomes || []).forEach((income) => addIncome(income));

  setChecked('mcEnabled', mc.mcEnabled !== false);
  setChecked('mcRandomInflation', mc.mcRandomInflation !== false);
  setChecked('mcFlexibleSpending', mc.mcFlexibleSpending !== false);
  setInputValue('mcRuns', Number.isFinite(Number(mc.mcRuns)) ? Number(mc.mcRuns) : 500);
  setInputValue('mcVolatility', Number.isFinite(Number(mc.mcVolatility)) ? roundForInput(Number(mc.mcVolatility) * 100) : 12);
  setInputValue('mcInflationVolatility', Number.isFinite(Number(mc.mcInflationVolatility)) ? roundForInput(Number(mc.mcInflationVolatility) * 100) : 1.2);
  setInputValue('mcSpendingFloor', Number.isFinite(Number(mc.mcSpendingFloor)) ? roundForInput(Number(mc.mcSpendingFloor) * 100) : 85);
  setInputValue('mcSpendingCeiling', Number.isFinite(Number(mc.mcSpendingCeiling)) ? roundForInput(Number(mc.mcSpendingCeiling) * 100) : 110);

  setChecked('showInputSummary', data.showInputSummary !== false);
  setChecked('showAdvisorAdvice', data.showAdvisorAdvice !== false);
  setChecked('showMonteCarloSummary', data.showMonteCarloSummary !== false);
  setChecked('showLogicSteps', data.showLogicSteps !== false);
  setChecked('showPreChart', data.showPreChart !== false);
  setChecked('showPostChart', data.showPostChart !== false);
  setChecked('showScenarioChart', data.showScenarioChart !== false);
  setChecked('showMonteCarloChart', data.showMonteCarloChart !== false);

  document.getElementById('shareBox').classList.add('hidden');
  goToStep(1, { skipValidation: true });
  clearValidationState();
  generateSummary();
}

/* ---------- 摘要與計算 ---------- */
function generateSummary() {
  const data = getFormData();
  const mcStatus = data.monteCarloOptions.mcEnabled ? '啟用' : '停用';

  document.getElementById('step4Summary').innerHTML = `
    準備為 <strong>${escapeHtml(data.clientName || '客戶')}</strong> 產出報告。<br>
    規劃區間：<strong>${data.currentAge} 歲</strong> 至 <strong>${data.lifeExpectancy} 歲</strong>（預計 ${data.retireAge} 歲退休）。<br>
    Monte Carlo 模擬：<strong>${mcStatus}</strong>（執行 ${data.monteCarloOptions.mcRuns} 次路徑計算）。
  `;
}

function getRetirementSpendBreakdown(data, age) {
  const inflationBase = data.inflationRate / 100;
  const medicalInflation = data.medicalInflationRate / 100;
  const realMedicalInflation = (1 + medicalInflation) / (1 + inflationBase) - 1;
  const yearsFromNow = Math.max(0, age - data.currentAge);
  const living = Math.max(0, data.expense - data.pension) * 12;
  const baseMedical =
    data.monthlyMedicalExpense *
    12 *
    Math.pow(1 + realMedicalInflation, yearsFromNow) *
    (typeof getMedicalAgeLoad === 'function' ? getMedicalAgeLoad(age) : 1);
  const ltc =
    typeof getLtcPremiumCost === 'function'
      ? getLtcPremiumCost(age, baseMedical, data.ltcProfile)
      : 0;

  return {
    living,
    baseMedical,
    ltc,
    total: living + baseMedical + ltc
  };
}

function buildLtcExplainHtml(data) {
  const profile = data.ltcProfile || {};
  const factor = Math.max(0, toFiniteNumber(profile.extraCostFactor, 1));
  const premiumRate = Math.max(0, factor - 1);
  const startAge = Math.trunc(toFiniteNumber(profile.startAge, data.retireAge));
  const durationYears = Math.max(0, Math.trunc(toFiniteNumber(profile.durationYears, 0)));
  const endAgeExclusive = startAge + durationYears;

  if (!profile.enabled) {
    return `
      1. 目前這份規劃<strong>未啟用 LTC 壓力測試</strong>，所以年度現金流表中的 LTC 欄位預期會是 0 或 —。<br>
      2. 若之後啟用，系統不是把整體退休支出全部乘上倍數，而是只針對「當年醫療基礎支出」另外加一段 LTC 溢價。<br>
      3. 白話公式是：<strong>LTC 溢價 = 當年醫療基礎支出 ×（LTC 額外成本倍數 - 1）</strong>。<br>
      4. 這樣設計是為了避免把生活費、醫療費與長照成本全部一起重複放大，導致壓力測試失真。
    `;
  }

  const startYearSpend = getRetirementSpendBreakdown(data, startAge);
  const totalMedicalWithLtc = startYearSpend.baseMedical + startYearSpend.ltc;
  const premiumPercent = (premiumRate * 100).toFixed(1);

  return `
    1. 這裡的 <strong>LTC 溢價</strong> 不是另一筆獨立生活費，而是「長照發生時，醫療相關支出比平常再多出來的那一段」。<br>
    2. 白話公式是：<strong>LTC 溢價 = 當年醫療基礎支出 ×（LTC 額外成本倍數 - 1）</strong>。你目前填的倍數是 <strong>${factor.toFixed(2)}</strong>，意思是額外加上 <strong>${premiumPercent}%</strong>，不是把整體退休支出全部乘上 ${factor.toFixed(2)}。<br>
    3. 系統只會在 <strong>${startAge} 歲至 ${Math.max(startAge, endAgeExclusive - 1)} 歲</strong> 這 ${durationYears} 年內計入 LTC 溢價；這段期間外，LTC 欄位會回到 0。<br>
    4. 以你目前設定估算，到了 <strong>${startAge} 歲</strong> 時，當年醫療基礎支出約為 <strong>${formatCurrency(startYearSpend.baseMedical)}</strong>，因此 LTC 溢價約為 <strong>${formatCurrency(startYearSpend.ltc)}</strong>；合計醫療＋LTC 約為 <strong>${formatCurrency(totalMedicalWithLtc)}</strong>。<br>
    5. 這樣拆開算的目的，是讓醫療通膨、高齡醫療負荷與長照額外成本各自有清楚角色，避免同一筆成本被重複放大。
  `;
}

function createInflationIndexByAge(currentAge, lifeExpectancy, inflationBase) {
  let livingInflationIndex = 1;
  const inflationByAge = { [currentAge]: 1 };

  for (let age = currentAge + 1; age <= lifeExpectancy; age++) {
    livingInflationIndex *= (1 + inflationBase);
    inflationByAge[age] = livingInflationIndex;
  }

  return inflationByAge;
}

function getDeterministicEventBundle(data, inflationByAge) {
  if (typeof buildDetailedEventSchedule === 'function') {
    return buildDetailedEventSchedule(
      data.goals,
      data.incomes,
      data.currentAge,
      data.lifeExpectancy,
      inflationByAge
    );
  }

  const schedule =
    typeof buildRandomizedEventSchedule === 'function'
      ? buildRandomizedEventSchedule(
          data.goals,
          data.incomes,
          data.currentAge,
          data.lifeExpectancy,
          inflationByAge
        )
      : {};

  const details = {};
  for (let age = data.currentAge; age <= data.lifeExpectancy; age++) {
    details[age] = [];
  }

  return { schedule, details };
}

function buildDeterministicProjection(data, returnOffset = 0) {
  let asset = data.assets;
  const path = [];
  const ledger = [];

  const inflationBase = data.inflationRate / 100;
  const preReturn = (data.returnRate / 100) + returnOffset;
  const postReturn = (data.postReturnRate / 100) + returnOffset;

  const inflationByAge = createInflationIndexByAge(
    data.currentAge,
    data.lifeExpectancy,
    inflationBase
  );

  const { schedule, details: eventDetailsByAge } = getDeterministicEventBundle(data, inflationByAge);

  let cumulativeInflation = 1;
  for (let age = data.currentAge; age < data.retireAge; age++) {
    path.push({ age, value: Math.max(0, asset) });

    const startAsset = asset;
    const eventAge = age + 1;
    cumulativeInflation *= (1 + inflationBase);

    const realPre = (1 + preReturn) / (1 + inflationBase) - 1;
    const contributionReal = (data.contribution * 12) / cumulativeInflation;
    const investmentReturn = startAsset * realPre;
    const eventAmount = Number(schedule[eventAge] || 0);

    asset = startAsset + investmentReturn + contributionReal + eventAmount;

    ledger.push({
      phase: 'accumulation',
      startAge: age,
      endAge: eventAge,
      startAsset: Math.max(0, startAsset),
      returnRate: realPre,
      investmentReturn,
      contribution: contributionReal,
      living: 0,
      baseMedical: 0,
      ltc: 0,
      spendTotal: 0,
      eventAmount,
      eventDetails: eventDetailsByAge[eventAge] || [],
      endAsset: Math.max(0, asset)
    });
  }

  for (let age = data.retireAge; age < data.lifeExpectancy; age++) {
    path.push({ age, value: Math.max(0, asset) });

    const nextAge = age + 1;
    const startAsset = Math.max(0, asset);

    const spend = getRetirementSpendBreakdown(data, age);
    const realPost = (1 + postReturn) / (1 + inflationBase) - 1;
    const investmentReturn = startAsset * realPost;
    const eventAmount = Number(schedule[nextAge] || 0);

    asset = startAsset + investmentReturn - spend.total + eventAmount;
    if (asset < 0) asset = 0;

    ledger.push({
      phase: 'retirement',
      startAge: age,
      endAge: nextAge,
      startAsset,
      returnRate: realPost,
      investmentReturn,
      contribution: 0,
      living: spend.living,
      baseMedical: spend.baseMedical,
      ltc: spend.ltc,
      spendTotal: spend.total,
      eventAmount,
      eventDetails: eventDetailsByAge[nextAge] || [],
      endAsset: Math.max(0, asset)
    });
  }

  path.push({ age: data.lifeExpectancy, value: Math.max(0, asset) });

  return { path, ledger, schedule, eventDetailsByAge, inflationByAge };
}

function renderCashflowTableLegacy(data, projection) {
  const auditEl = document.getElementById('cashflowAudit');
  const tableWrap = document.getElementById('cashflowTableWrap');
  const block = document.getElementById('cashflowBlock');

  if (!auditEl || !tableWrap || !block) return;

  block.style.display = 'block';
  auditEl.innerHTML = `
    已依完整表單逐欄重跑。姓名、顧問備註與報表勾選項不影響數值；
    真正影響資產軌跡的是 Step 2 財務數字、Step 3 事件、LTC 與退休後報酬假設。
    本輪檢查除退休邊界事件時點外，未發現其他欄位映射差異。
  `;

  const rowsHtml = projection.ledger.map((entry) => {
    const phaseLabel = entry.phase === 'accumulation' ? '累積期' : '退休期';
    const rowClass =
      entry.endAge === data.retireAge || entry.startAge === data.retireAge
        ? 'cashflow-row-boundary cashflow-row-clickable'
        : 'cashflow-row-clickable';

    const eventHtml = entry.eventDetails.length
      ? entry.eventDetails.map((detail) => {
          const signClass = detail.direction === 'inflow' ? 'cashflow-positive' : 'cashflow-negative';
          const sign = detail.direction === 'inflow' ? '+' : '-';
          const label = escapeHtml(detail.name || (detail.kind === 'income' ? '收入事件' : '支出事件'));
          return `<div class="cashflow-event-item"><span class="${signClass}">${sign}${formatCurrency(detail.amount)}</span> ${label}</div>`;
        }).join('')
      : '<span class="cashflow-empty">—</span>';

    const returnClass = entry.investmentReturn >= 0 ? 'cashflow-positive' : 'cashflow-negative';
    const eventClass = entry.eventAmount >= 0 ? 'cashflow-positive' : 'cashflow-negative';

    return `
      <tr class="${rowClass}" data-start-age="${entry.startAge}" data-end-age="${entry.endAge}">
        <td>${entry.startAge}&rarr;${entry.endAge}歲</td>
        <td><span class="cashflow-phase">${phaseLabel}</span></td>
        <td>${formatCurrency(entry.startAsset)}</td>
        <td class="${returnClass}">${entry.investmentReturn >= 0 ? '+' : '-'}${formatCurrency(Math.abs(entry.investmentReturn))}</td>
        <td>${entry.contribution > 0 ? formatCurrency(entry.contribution) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.living > 0 ? formatCurrency(entry.living) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.baseMedical > 0 ? formatCurrency(entry.baseMedical) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.ltc > 0 ? formatCurrency(entry.ltc) : '<span class="cashflow-empty">—</span>'}</td>
        <td class="${eventClass}">${entry.eventAmount !== 0 ? `${entry.eventAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(entry.eventAmount))}` : '<span class="cashflow-empty">—</span>'}</td>
        <td class="cashflow-event">${eventHtml}</td>
        <td>${formatCurrency(entry.endAsset)}</td>
      </tr>
    `;
  }).join('');

  tableWrap.innerHTML = `
    <table class="cashflow-table">
      <thead>
        <tr>
          <th>年度</th>
          <th>階段</th>
          <th>期初資產</th>
          <th>投資損益</th>
          <th>追加投入</th>
          <th>生活支出</th>
          <th>醫療支出</th>
          <th>LTC 溢價</th>
          <th>事件淨額</th>
          <th>事件明細</th>
          <th>期末餘額</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function renderCashflowTable(data, projection) {
  const auditEl = document.getElementById('cashflowAudit');
  const tableWrap = document.getElementById('cashflowTableWrap');
  const block = document.getElementById('cashflowBlock');

  if (!auditEl || !tableWrap || !block) return;

  block.style.display = 'block';
  auditEl.innerHTML = `
    這張年度現金流明細表會把每一年的期初資產、投資損益、追加投入、退休支出、醫療支出、LTC 與事件淨額拆開列示。
    若事件勾選「隨通膨調整」，事件明細會同步顯示「現值 -> 發生年名目值」，避免把輸入金額和發生年金額混為一談。
  `;

  const rowsHtml = projection.ledger.map((entry) => {
    const phaseLabel = entry.phase === 'accumulation' ? '累積期' : '退休期';
    const rowClass =
      entry.endAge === data.retireAge || entry.startAge === data.retireAge
        ? 'cashflow-row-boundary'
        : '';

    const eventHtml = entry.eventDetails.length
      ? entry.eventDetails.map((detail) => {
          const signClass = detail.direction === 'inflow' ? 'cashflow-positive' : 'cashflow-negative';
          const sign = detail.direction === 'inflow' ? '+' : '-';
          const label = escapeHtml(detail.name || (detail.kind === 'income' ? '收入事件' : '支出事件'));
          const nominalAmount = Number.isFinite(detail.nominalAmount) ? detail.nominalAmount : detail.amount;
          const baseAmount = Number.isFinite(detail.baseAmount) ? detail.baseAmount : nominalAmount;
          const showInflationBridge =
            detail.inflationAdjusted &&
            Math.abs(nominalAmount - baseAmount) >= 1;
          const { presentLabel, nominalLabel } = getEventAmountLabels(detail);
          const detailMeta = showInflationBridge
            ? `<div class="cashflow-event-meta">${presentLabel} ${formatCurrency(baseAmount)} &rarr; ${nominalLabel} ${formatCurrency(nominalAmount)}</div>`
            : '';

          return `<div class="cashflow-event-item"><span class="${signClass}">${sign}${formatCurrency(nominalAmount)}</span> ${label}${detailMeta}</div>`;
        }).join('')
      : '<span class="cashflow-empty">—</span>';

    const returnClass = entry.investmentReturn >= 0 ? 'cashflow-positive' : 'cashflow-negative';
    const eventClass = entry.eventAmount >= 0 ? 'cashflow-positive' : 'cashflow-negative';

    return `
      <tr class="${rowClass}">
        <td>${entry.startAge}&rarr;${entry.endAge}歲</td>
        <td><span class="cashflow-phase">${phaseLabel}</span></td>
        <td>${formatCurrency(entry.startAsset)}</td>
        <td class="${returnClass}">${entry.investmentReturn >= 0 ? '+' : '-'}${formatCurrency(Math.abs(entry.investmentReturn))}</td>
        <td>${entry.contribution > 0 ? formatCurrency(entry.contribution) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.living > 0 ? formatCurrency(entry.living) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.baseMedical > 0 ? formatCurrency(entry.baseMedical) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.ltc > 0 ? formatCurrency(entry.ltc) : '<span class="cashflow-empty">—</span>'}</td>
        <td class="${eventClass}">${entry.eventAmount !== 0 ? `${entry.eventAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(entry.eventAmount))}` : '<span class="cashflow-empty">—</span>'}</td>
        <td class="cashflow-event">${eventHtml}</td>
        <td>${formatCurrency(entry.endAsset)}</td>
      </tr>
    `;
  }).join('');

  tableWrap.innerHTML = `
    <table class="cashflow-table">
      <thead>
        <tr>
          <th>年度</th>
          <th>階段</th>
          <th>期初資產</th>
          <th>投資損益</th>
          <th>追加投入</th>
          <th>生活支出</th>
          <th>醫療支出</th>
          <th>LTC</th>
          <th>事件淨額</th>
          <th>事件明細</th>
          <th>期末餘額</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function calculateRetirement() {
  if (!validateAllInputs()) return;

  const formData = getFormData();
  const mcResults = typeof runMonteCarlo === 'function' ? runMonteCarlo(formData) : null;

  document.getElementById('shareBox').classList.add('hidden');
  document.getElementById('homeSection').classList.add('hidden');
  document.getElementById('reportSection').classList.remove('hidden');
  window.scrollTo(0, 0);

  renderTextReports(formData, mcResults);

  if (typeof Chart !== 'undefined') {
    renderCharts(formData, mcResults);
  } else {
    console.warn('未偵測到 Chart.js，跳過圖表渲染。請確認 HTML 中已引入 Chart.js。');
    alert('系統未偵測到繪圖核心，圖表將無法顯示。請確保有網路連線以載入 Chart.js。');
  }
}

/* ---------- 純文字報表 ---------- */
function renderTextReports(data, mcResults) {
  const projection = buildDeterministicProjection(data, 0);
  lastRenderedData = data;
  lastRenderedProjection = projection;
  lastRenderedMonteCarlo = mcResults;
  const deterministicPath = projection.path;
  const retirementPoint =
    deterministicPath.find((point) => point.age === data.retireAge) ||
    deterministicPath[deterministicPath.length - 1] ||
    { value: 0 };
  const finalPoint = deterministicPath[deterministicPath.length - 1] || { value: 0, age: data.lifeExpectancy };
  const depletionPoint = deterministicPath.find(
    (point, index) => index > 0 && point.age >= data.retireAge && point.value <= 0
  );
  const firstYearSpend = getRetirementSpendBreakdown(data, data.retireAge);
  const rule4Target = firstYearSpend.total > 0 ? firstYearSpend.total / 0.04 : 0;
  const rule4Ratio = rule4Target > 0 ? retirementPoint.value / rule4Target : 0;
  const goalCount = data.goals.length;
  const incomeCount = data.incomes.length;

  let rule4BadgeClass = 'safe';
  let rule4BadgeText = rule4Target > 0 ? '穩健' : '不適用';
  if (rule4Target > 0 && rule4Ratio < 0.85) {
    rule4BadgeClass = 'danger';
    rule4BadgeText = '不足';
  } else if (rule4Target > 0 && rule4Ratio < 1) {
    rule4BadgeClass = 'caution';
    rule4BadgeText = '邊緣';
  }

  const suggestions = [];
  if (rule4Target > 0 && rule4Ratio < 1) {
    suggestions.push('退休起點資產低於 4% 法則需求，建議提高月投入、延後退休，或下修退休後支出。');
  }
  if (mcResults && mcResults.successRate < 70) {
    suggestions.push('Monte Carlo 成功率偏低，建議調整報酬假設、增加緊急預備金，並降低高波動資產曝險。');
  }
  if (data.monthlyMedicalExpense > 0 && data.medicalInflationRate > data.inflationRate) {
    suggestions.push('醫療通膨高於一般通膨，建議獨立管理醫療／長照準備金，避免與生活費混用。');
  }
  if (!goalCount && !incomeCount) {
    suggestions.push('目前未設定大型支出與收入事件，若未來有換屋、旅遊、保單到期或資產處分，建議納入模型重算。');
  }
  if (!suggestions.length) {
    suggestions.push('目前設定在基準與壓力測試下相對穩健，建議至少每年或遇重大資產變動時重新檢視一次。');
  }

  document.getElementById('printMeta').innerHTML = `
    客戶：${escapeHtml(data.clientName || '未提供')} | 顧問：${escapeHtml(data.advisorName || '未提供')}<br>
    規劃日：${escapeHtml(data.reportDate || getLocalDateString())} | 退休年齡：${data.retireAge} 歲
  `;

  document.getElementById('reportSummary').innerHTML = `
    <strong>總覽摘要：</strong><br>
    目前資產 ${formatCurrency(data.assets)}，每月再投入 ${formatCurrency(data.contribution)}。<br>
    預估退休起點資產約為 <strong>${formatCurrency(retirementPoint.value)}</strong>，規劃觀察到 ${data.lifeExpectancy} 歲時的資產約為 <strong>${formatCurrency(finalPoint.value)}</strong>。<br>
    退休首年預估年支出（含生活、醫療、LTC）約為 <strong>${formatCurrency(firstYearSpend.total)}</strong>。
  `;

  const rule4Block = document.getElementById('rule4Block');
  rule4Block.style.display = 'block';
  rule4Block.innerHTML = `
    <strong>4% 法則檢核</strong>
    <span class="rule4-badge ${rule4BadgeClass}">${rule4BadgeText}</span><br>
    ${rule4Target > 0
      ? `以退休首年年支出 ${formatCurrency(firstYearSpend.total)} 回推，理想退休資產約需 <strong>${formatCurrency(rule4Target)}</strong>。<br>
    目前退休起點資產 / 法則需求比約為 <strong>${(rule4Ratio * 100).toFixed(1)}%</strong>。`
      : '退休首年未估出實質支出，4% 法則在此情境下不適用。'}
  `;

  const medicalBlock = document.getElementById('medicalBlock');
  medicalBlock.style.display = 'block';
  medicalBlock.innerHTML = `
    <strong>醫療與 LTC 壓力說明：</strong><br>
    目前每月醫療費用基礎值為 ${formatCurrency(data.monthlyMedicalExpense)}，醫療通膨率 ${data.medicalInflationRate.toFixed(1)}%。<br>
    退休首年醫療支出估計為 ${formatCurrency(firstYearSpend.baseMedical)}；LTC 額外溢價估計為 ${formatCurrency(firstYearSpend.ltc)}。<br>
    LTC 設定：${data.ltcProfile.enabled ? `啟用，${data.ltcProfile.startAge} 歲起 ${data.ltcProfile.durationYears} 年，額外成本倍數 ${data.ltcProfile.extraCostFactor}` : '未啟用'}。
    <div class="accordion-wrap">
      <button class="accordion-btn" type="button" onclick="toggleAccordion('ltcExplainBox')">LTC 溢價怎麼算？</button>
      <div id="ltcExplainBox" class="accordion-panel">
        <div id="ltcExplainContent" class="accordion-content">${buildLtcExplainHtml(data)}</div>
      </div>
    </div>
  `;

  const inputSummaryBlock = document.getElementById('inputSummaryBlock');
  inputSummaryBlock.style.display = document.getElementById('showInputSummary').checked ? 'block' : 'none';
  document.getElementById('inputSummary').innerHTML = `
    <strong>原始輸入摘要：</strong><br>
    目前年齡 ${data.currentAge} 歲，退休年齡 ${data.retireAge} 歲，預計壽命 ${data.lifeExpectancy} 歲。<br>
    每月生活費 ${formatCurrency(data.expense)}，每月固定收入 ${formatCurrency(data.pension)}，每月醫療費 ${formatCurrency(data.monthlyMedicalExpense)}。<br>
    退休前年報酬率 ${data.returnRate.toFixed(1)}%，退休後報酬率 ${data.postReturnRate.toFixed(1)}%，一般通膨 ${data.inflationRate.toFixed(1)}%，醫療通膨 ${data.medicalInflationRate.toFixed(1)}%。<br>
    已設定 ${goalCount} 筆支出事件、${incomeCount} 筆收入事件。
  `;

  document.getElementById('result').innerHTML = `
    <div class="result-title">核心判讀</div>
    ${depletionPoint ? `基準情境下，資產將於約 <strong>${depletionPoint.age} 歲</strong> 前後用盡。<br>` : `基準情境下，資產可支應至 <strong>${data.lifeExpectancy} 歲</strong>。<br>`}
    ${suggestions.map((item, index) => `${index + 1}. ${escapeHtml(item)}`).join('<br>')}
  `;

  const adviceBlock = document.getElementById('reportAdvice');
  if (document.getElementById('showAdvisorAdvice').checked && data.advisorNote) {
    document.getElementById('advisorAdviceBlock').style.display = 'block';
    adviceBlock.innerHTML = `<strong>顧問觀點與建議：</strong><br>${escapeHtml(data.advisorNote).replace(/\n/g, '<br>')}`;
  } else {
    document.getElementById('advisorAdviceBlock').style.display = 'none';
  }

  const logicWrap = document.getElementById('logicStepsWrap');
  logicWrap.style.display = document.getElementById('showLogicSteps').checked ? 'block' : 'none';
  document.getElementById('logicExplainContent').innerHTML = `
    1. 退休前資產以「退休前報酬率 - 一般通膨」換算成實質報酬，並加入每月投入與事件流。<br>
    2. 退休後以「退休後報酬率 - 一般通膨」估算資產變化，支出端拆成生活費、醫療費、LTC 溢價三部分。<br>
    3. 醫療費用不是直接用醫療通膨名目成長，而是先扣除一般通膨，只保留醫療相對溢價，避免雙重通膨計算。<br>
    4. Monte Carlo 另外加入 fat-tail 報酬、崩跌機率、通膨波動與彈性支出，用於觀察極端情境下的存活率。
  `;

  const mcSummaryBlock = document.getElementById('monteCarloSummary');
  if (document.getElementById('showMonteCarloSummary').checked && mcResults) {
    document.getElementById('monteCarloSummaryBlock').style.display = 'block';
    const successRate = mcResults.successRate.toFixed(1);
    const evalText =
      successRate > 85
        ? '<span class="good">資金充裕，可適度提高生活品質</span>'
        : successRate > 60
          ? '<span class="warn">處於邊緣，建議提高準備金或延後退休</span>'
          : '<span class="bad">風險極高，必須立即調整財務結構</span>';

    mcSummaryBlock.innerHTML = `
      <strong>Monte Carlo 壓力測試結果：</strong><br>
      目標達成機率：<strong>${successRate}%</strong>（${evalText}）<br>
      P50（中位數）最終資產：${formatCurrency(mcResults.p50)}<br>
      P10（後 10% 風險）最終資產：${formatCurrency(mcResults.p10)}<br>
      中位數最大回撤：<strong>${(mcResults.medianMaxDrawdown * 100).toFixed(1)}%</strong><br>
      最嚴峻情境之中位數破產年齡：${mcResults.medianDepletionAge ? `${mcResults.medianDepletionAge} 歲` : '未破產'}
    `;
  } else {
    document.getElementById('monteCarloSummaryBlock').style.display = 'none';
  }

  renderHousingDiagnostics(data, projection);
  renderCashflowTable(data, projection);
}

/* ---------- 決定性路徑試算 ---------- */
function calculateDeterministicPath(data, returnOffset = 0) {
  return buildDeterministicProjection(data, returnOffset).path;
}

/* ---------- 圖表渲染 ---------- */
function renderCharts(data, mcResults) {
  destroyCharts();

  const commonOptions = {
    responsive: true,
    plugins: { tooltip: { mode: 'index', intersect: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `${(value / 10000).toFixed(0)}萬`
        }
      }
    }
  };

  const pathBase = calculateDeterministicPath(data, 0);
  const pathOpt = calculateDeterministicPath(data, 0.02);
  const pathPess = calculateDeterministicPath(data, -0.02);

  const preRetireData = pathBase.filter((point) => point.age <= data.retireAge);
  const postRetireData = pathBase.filter((point) => point.age >= data.retireAge);

  const fullLabels = pathBase.map((point) => `${point.age}歲`);
  const preLabels = preRetireData.map((point) => `${point.age}歲`);
  const postLabels = postRetireData.map((point) => `${point.age}歲`);

  if (document.getElementById('showPreChart').checked) {
    document.getElementById('preChartBlock').style.display = 'block';
    const ctxPre = document.getElementById('preRetireChart').getContext('2d');
    chartInstances.pre = new Chart(ctxPre, {
      type: 'bar',
      data: {
        labels: preLabels,
        datasets: [
          {
            label: '累積資產（現值）',
            data: preRetireData.map((point) => point.value),
            backgroundColor: '#5a7a4a',
            borderRadius: 4
          }
        ]
      },
      options: commonOptions
    });
  } else {
    document.getElementById('preChartBlock').style.display = 'none';
  }

  if (document.getElementById('showPostChart').checked) {
    document.getElementById('postChartBlock').style.display = 'block';
    const ctxPost = document.getElementById('postRetireChart').getContext('2d');
    chartInstances.post = new Chart(ctxPost, {
      type: 'line',
      data: {
        labels: postLabels,
        datasets: [
          {
            label: '退休金水位（現值）',
            data: postRetireData.map((point) => point.value),
            borderColor: '#b85c38',
            backgroundColor: 'rgba(184,92,56,0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: commonOptions
    });
  } else {
    document.getElementById('postChartBlock').style.display = 'none';
  }

  if (document.getElementById('showScenarioChart').checked) {
    document.getElementById('scenarioChartBlock').style.display = 'block';
    const ctxScenario = document.getElementById('scenarioChart').getContext('2d');
    chartInstances.scen = new Chart(ctxScenario, {
      type: 'line',
      data: {
        labels: fullLabels,
        datasets: [
          { label: '樂觀 (+2%報酬)', data: pathOpt.map((point) => point.value), borderColor: '#5a7a4a', borderDash: [5, 5], fill: false, tension: 0.3 },
          { label: '基準設定', data: pathBase.map((point) => point.value), borderColor: '#c8841a', fill: false, tension: 0.3, borderWidth: 3 },
          { label: '保守 (-2%報酬)', data: pathPess.map((point) => point.value), borderColor: '#b03a3a', borderDash: [5, 5], fill: false, tension: 0.3 }
        ]
      },
      options: commonOptions
    });
  } else {
    document.getElementById('scenarioChartBlock').style.display = 'none';
  }

  if (document.getElementById('showMonteCarloChart').checked && mcResults?.percentileSeries) {
    document.getElementById('monteCarloChartBlock').style.display = 'block';
    const ctxMc = document.getElementById('monteCarloChart').getContext('2d');
    const mcLabels = mcResults.percentileSeries.map((point) => `${point.age}歲`);

    chartInstances.mc = new Chart(ctxMc, {
      type: 'line',
      data: {
        labels: mcLabels,
        datasets: [
          { label: 'P90 (前 10% 表現)', data: mcResults.percentileSeries.map((point) => point.p90), borderColor: '#5a7a4a', backgroundColor: 'rgba(90,122,74,0.1)', fill: false, tension: 0.4 },
          { label: 'P50 (中位數路徑)', data: mcResults.percentileSeries.map((point) => point.p50), borderColor: '#c8841a', backgroundColor: 'rgba(200,132,26,0.1)', fill: false, tension: 0.4 },
          { label: 'P10 (後 10% 風險)', data: mcResults.percentileSeries.map((point) => point.p10), borderColor: '#b03a3a', backgroundColor: 'rgba(176,58,58,0.1)', fill: '+1', tension: 0.4 }
        ]
      },
      options: commonOptions
    });
  } else {
    document.getElementById('monteCarloChartBlock').style.display = 'none';
  }

  renderChartExplainers(data, pathBase, pathOpt, pathPess, mcResults);
}

/* ---------- 互動與資料保存 ---------- */
function getEventAmounts(detail) {
  const nominalAmount = Number.isFinite(detail?.nominalAmount) ? detail.nominalAmount : toFiniteNumber(detail?.amount, 0);
  const baseAmount = Number.isFinite(detail?.baseAmount) ? detail.baseAmount : nominalAmount;
  return { baseAmount, nominalAmount };
}

function getSignedEventAmount(detail) {
  const { nominalAmount } = getEventAmounts(detail);
  return detail?.direction === 'outflow' ? -Math.abs(nominalAmount) : Math.abs(nominalAmount);
}

function getEventAmountLabels(detail) {
  if (detail?.type === 'monthly') {
    return {
      presentLabel: '現值年額',
      nominalLabel: '發生年名目年額'
    };
  }

  return {
    presentLabel: '現值',
    nominalLabel: '發生年名目值'
  };
}

function renderChartExplainers(data, pathBase, pathOpt, pathPess, mcResults) {
  const scenarioExplainEl = document.getElementById('scenarioChartExplainContent');
  const monteCarloExplainEl = document.getElementById('monteCarloChartExplainContent');
  const focusAge = data.retireAge;

  if (scenarioExplainEl) {
    const baseAtFocusAge = getPointValueByAge(pathBase, focusAge);
    const optAtFocusAge = getPointValueByAge(pathOpt, focusAge);
    const pessAtFocusAge = getPointValueByAge(pathPess, focusAge);
    const p50AtFocusAge = getPointValueByAge(mcResults?.percentileSeries, focusAge, 'p50');
    const delta = Number.isFinite(baseAtFocusAge) && Number.isFinite(p50AtFocusAge)
      ? p50AtFocusAge - baseAtFocusAge
      : null;
    const deltaText = delta === null
      ? '若你同時打開 Monte Carlo 圖，再和這張圖比較，兩條中間線本來就不一定相同。'
      : `以 ${focusAge} 歲為例，這張圖的基準線約為 ${formatCurrency(baseAtFocusAge)}；同年 Monte Carlo 的 P50 約為 ${formatCurrency(p50AtFocusAge)}，兩者相差 ${formatCurrency(Math.abs(delta))}。這不代表算錯，而是兩張圖在回答不同問題。`;

    scenarioExplainEl.innerHTML = `
      1. 這張圖是<strong>固定假設下的單一路徑比較</strong>：只把報酬率改成「基準、+2%、-2%」，其餘條件都固定不變。<br>
      2. 橘色「基準設定」不是機率中位數，而是「如果未來每年都剛好照基準假設走」時的資產軌跡。<br>
      3. ${deltaText}<br>
      4. 因此，這張圖適合回答「若報酬率高一點或低一點，資產會差多少」；它不是在表達風險分布。
    `;
  }

  if (monteCarloExplainEl) {
    const p90AtFocusAge = getPointValueByAge(mcResults?.percentileSeries, focusAge, 'p90');
    const p50AtFocusAge = getPointValueByAge(mcResults?.percentileSeries, focusAge, 'p50');
    const p10AtFocusAge = getPointValueByAge(mcResults?.percentileSeries, focusAge, 'p10');
    const baseAtFocusAge = getPointValueByAge(pathBase, focusAge);
    const settingNotes = [];

    if (data.monteCarlo?.mcRandomInflation) settingNotes.push('通膨隨機化');
    if (data.monteCarlo?.mcFlexibleSpending) settingNotes.push('退休後支出彈性');

    const settingsText = settingNotes.length
      ? `本次設定另外啟用了 ${settingNotes.join('、')}，所以退休後每條路徑的支出與資產變化不會完全一樣。`
      : '本次設定未額外啟用通膨隨機化或支出彈性，但 Monte Carlo 仍會因報酬波動與崩跌事件而產生分散結果。';

    const comparisonText =
      Number.isFinite(baseAtFocusAge) && Number.isFinite(p50AtFocusAge)
        ? `同樣看 ${focusAge} 歲，基準線約為 ${formatCurrency(baseAtFocusAge)}，但 Monte Carlo 的 P50 約為 ${formatCurrency(p50AtFocusAge)}。P50 較低時，通常代表波動拖累、崩跌事件與通膨/支出調整把「中位數結果」往下拉。`
        : 'Monte Carlo 的 P50 是很多次模擬在同一年齡點的中位數結果，不等於三情境圖的基準線。';

    monteCarloExplainEl.innerHTML = `
      1. 這張圖是<strong>機率分布圖</strong>：同一組規劃跑很多次隨機模擬後，在每個年齡點分別取 P90 / P50 / P10。<br>
      2. P90 代表較好的前 10% 結果，P50 是中位數，P10 則是較差的後 10% 結果。這三條線不是同一個人會走出的三段人生，而是三個分位帶。<br>
      3. ${Number.isFinite(p90AtFocusAge) && Number.isFinite(p50AtFocusAge) && Number.isFinite(p10AtFocusAge)
        ? `以 ${focusAge} 歲為例，P90 約 ${formatCurrency(p90AtFocusAge)}、P50 約 ${formatCurrency(p50AtFocusAge)}、P10 約 ${formatCurrency(p10AtFocusAge)}。`
        : `以退休年齡 ${focusAge} 歲為起點，這張圖會顯示退休後每個年齡點的分位範圍。`}<br>
      4. ${comparisonText}<br>
      5. ${settingsText}<br>
      6. 這張圖適合回答「如果市場有波動，我大概會落在哪個區間」；它不是單一路徑預測，也不保證 P50 會和基準線重合。
    `;
  }
}

function formatEventDetailBridge(detail) {
  const { baseAmount, nominalAmount } = getEventAmounts(detail);
  if (!detail?.inflationAdjusted || Math.abs(nominalAmount - baseAmount) < 1) {
    return '';
  }

  const { presentLabel, nominalLabel } = getEventAmountLabels(detail);
  return `${presentLabel} ${formatCurrency(baseAmount)} -> ${nominalLabel} ${formatCurrency(nominalAmount)}`;
}

function classifyHousingEvent(detail) {
  const rawName = String(detail?.name || '');
  const lowerName = rawName.toLowerCase();

  if (/(賣屋|售屋|賣房|出售|house-sell|sell-home|sell-house|sell-property)/i.test(rawName) || /house-sell|sell-home|sell-house|sell-property/.test(lowerName)) {
    return 'sell';
  }

  if (/(換屋|買屋|買房|購屋|house-buy|buy-home|buy-house|purchase-home|purchase-house)/i.test(rawName) || /house-buy|buy-home|buy-house|purchase-home|purchase-house/.test(lowerName)) {
    return 'buy';
  }

  if (/(屋|房|house|home|property)/i.test(rawName)) {
    return detail?.direction === 'outflow' ? 'buy' : 'sell';
  }

  return null;
}

function collectHousingDiagnostics(projection) {
  if (!projection?.ledger?.length) return [];

  return projection.ledger.flatMap((entry) => {
    const assetBeforeEvents = entry.endAsset - entry.eventAmount;
    const nonEventDelta = entry.investmentReturn + entry.contribution - entry.spendTotal;

    return (entry.eventDetails || []).map((detail, index) => {
      const role = classifyHousingEvent(detail);
      if (!role) return null;

      const { baseAmount, nominalAmount } = getEventAmounts(detail);
      return {
        key: `${entry.startAge}-${entry.endAge}-${role}-${index}`,
        role,
        age: entry.endAge,
        phase: entry.phase,
        name: detail.name || (role === 'sell' ? '賣屋' : '換屋'),
        presentAmount: baseAmount,
        nominalAmount,
        signedAmount: getSignedEventAmount(detail),
        beforeEventAsset: assetBeforeEvents,
        afterEventAsset: entry.endAsset,
        nonEventDelta,
        totalRowDelta: entry.endAsset - entry.startAsset
      };
    }).filter(Boolean);
  }).sort((left, right) => left.age - right.age);
}

function renderHousingDiagnostics(data, projection) {
  const block = document.getElementById('houseDiagnosticsBlock');
  const content = document.getElementById('houseDiagnosticsContent');

  if (!block || !content) return;

  const housingEvents = collectHousingDiagnostics(projection);
  if (!housingEvents.length) {
    block.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const sellEvents = housingEvents.filter((event) => event.role === 'sell');
  const buyEvents = housingEvents.filter((event) => event.role === 'buy');
  const primarySell = sellEvents[0] || null;
  const primaryBuy = buyEvents[0] || null;
  const housingNet = housingEvents.reduce((sum, event) => sum + event.signedAmount, 0);
  const pairGap = primarySell && primaryBuy
    ? primarySell.signedAmount + primaryBuy.signedAmount
    : null;

  const summaryParts = [];
  if (primarySell) summaryParts.push(`賣屋 ${formatSignedCurrency(primarySell.signedAmount)}`);
  if (primaryBuy) summaryParts.push(`換屋 ${formatSignedCurrency(primaryBuy.signedAmount)}`);

  let conclusion = '這張卡把房產事件拆開，直接看每一筆事件前後資產與同年度非事件現金流。';
  if (pairGap !== null) {
    const pairDirection = pairGap >= 0 ? '淨流入' : '淨流出';
    conclusion = `若賣屋與換屋的現值都填 ${formatCurrency(primarySell.presentAmount)}，但發生年齡不同且有勾選通膨，系統會先換算成發生年名目值；單看房產事件本身，兩筆合計是 ${formatSignedCurrency(pairGap)} 的${pairDirection}。`;
  }

  const cardsHtml = housingEvents.map((event) => {
    const bridgeText = formatEventDetailBridge({
      inflationAdjusted: true,
      type: 'lump',
      baseAmount: event.presentAmount,
      nominalAmount: event.nominalAmount
    });
    const nonEventClass = event.nonEventDelta >= 0 ? 'cashflow-positive' : 'cashflow-negative';
    const eventClass = event.signedAmount >= 0 ? 'cashflow-positive' : 'cashflow-negative';
    const title = event.role === 'sell' ? '賣屋事件' : '換屋事件';

    return `
      <button type="button" class="house-diagnostics-item" data-focus-age="${event.age}" data-event-role="${event.role}">
        <div class="house-diagnostics-title">${title}</div>
        <div class="house-diagnostics-subtitle">${escapeHtml(event.name)} / ${event.age} 歲</div>
        <div class="house-diagnostics-bridge">
          <span class="${eventClass}">${formatSignedCurrency(event.signedAmount)}</span>
          ${bridgeText ? `<br>${escapeHtml(bridgeText)}` : ''}
        </div>
        <div class="house-diagnostics-metrics">
          <div class="house-diagnostics-metric">
            <span class="house-diagnostics-label">事件前資產</span>
            <span class="house-diagnostics-value">${formatCurrency(event.beforeEventAsset)}</span>
          </div>
          <div class="house-diagnostics-metric">
            <span class="house-diagnostics-label">事件後資產</span>
            <span class="house-diagnostics-value">${formatCurrency(event.afterEventAsset)}</span>
          </div>
          <div class="house-diagnostics-metric">
            <span class="house-diagnostics-label">房產事件影響</span>
            <span class="house-diagnostics-value ${eventClass}">${formatSignedCurrency(event.signedAmount)}</span>
          </div>
          <div class="house-diagnostics-metric">
            <span class="house-diagnostics-label">同年非事件變動</span>
            <span class="house-diagnostics-value ${nonEventClass}">${formatSignedCurrency(event.nonEventDelta)}</span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  block.style.display = 'block';
  content.innerHTML = `
    <div class="house-diagnostics-summary">
      <strong>房產事件總覽：</strong>
      ${summaryParts.join('，')}，合計淨額 <strong class="${housingNet >= 0 ? 'cashflow-positive' : 'cashflow-negative'}">${formatSignedCurrency(housingNet)}</strong>。
    </div>
    <div class="house-diagnostics-grid">${cardsHtml}</div>
    <div class="house-diagnostics-footnote">${escapeHtml(conclusion)} 點卡片後，下面的年度表與圖表會同步定位到該年。</div>
  `;
}

function renderCashflowTable(data, projection) {
  const auditEl = document.getElementById('cashflowAudit');
  const tableWrap = document.getElementById('cashflowTableWrap');
  const block = document.getElementById('cashflowBlock');

  if (!auditEl || !tableWrap || !block) return;

  block.style.display = 'block';
  auditEl.innerHTML = `
    這張年度現金流明細表會把每年的期初資產、投資損益、追加投入、生活支出、醫療支出、LTC 與事件淨額拆開列示。
    事件若勾選「隨通膨調整」，事件明細會同步顯示「現值 -> 發生年名目值」。你也可以直接點年度列或圖表上的年齡點，互相定位查看是哪一年把資產拉上去或壓下來。
  `;

  const rowsHtml = projection.ledger.map((entry) => {
    const phaseLabel = entry.phase === 'accumulation' ? '累積期' : '退休期';
    const rowClass = entry.endAge === data.retireAge || entry.startAge === data.retireAge
      ? 'cashflow-row-boundary cashflow-row-clickable'
      : 'cashflow-row-clickable';

    const eventHtml = entry.eventDetails.length
      ? entry.eventDetails.map((detail) => {
          const signClass = detail.direction === 'inflow' ? 'cashflow-positive' : 'cashflow-negative';
          const label = escapeHtml(detail.name || (detail.kind === 'income' ? '收入事件' : '支出事件'));
          const bridgeText = formatEventDetailBridge(detail);
          return `
            <div class="cashflow-event-item">
              <span class="${signClass}">${formatSignedCurrency(getSignedEventAmount(detail))}</span> ${label}
              ${bridgeText ? `<div class="cashflow-event-meta">${escapeHtml(bridgeText)}</div>` : ''}
            </div>
          `;
        }).join('')
      : '<span class="cashflow-empty">—</span>';

    const returnClass = entry.investmentReturn >= 0 ? 'cashflow-positive' : 'cashflow-negative';
    const eventClass = entry.eventAmount >= 0 ? 'cashflow-positive' : 'cashflow-negative';

    return `
      <tr class="${rowClass}" data-start-age="${entry.startAge}" data-end-age="${entry.endAge}">
        <td>${entry.startAge}&rarr;${entry.endAge}歲</td>
        <td><span class="cashflow-phase">${phaseLabel}</span></td>
        <td>${formatCurrency(entry.startAsset)}</td>
        <td class="${returnClass}">${formatSignedCurrency(entry.investmentReturn)}</td>
        <td>${entry.contribution > 0 ? formatCurrency(entry.contribution) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.living > 0 ? formatCurrency(entry.living) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.baseMedical > 0 ? formatCurrency(entry.baseMedical) : '<span class="cashflow-empty">—</span>'}</td>
        <td>${entry.ltc > 0 ? formatCurrency(entry.ltc) : '<span class="cashflow-empty">—</span>'}</td>
        <td class="${eventClass}">${entry.eventAmount !== 0 ? formatSignedCurrency(entry.eventAmount) : '<span class="cashflow-empty">—</span>'}</td>
        <td class="cashflow-event">${eventHtml}</td>
        <td>${formatCurrency(entry.endAsset)}</td>
      </tr>
    `;
  }).join('');

  tableWrap.innerHTML = `
    <table class="cashflow-table">
      <thead>
        <tr>
          <th>年度</th>
          <th>階段</th>
          <th>期初資產</th>
          <th>投資損益</th>
          <th>追加投入</th>
          <th>生活支出</th>
          <th>醫療支出</th>
          <th>LTC</th>
          <th>事件淨額</th>
          <th>事件明細</th>
          <th>期末餘額</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCashflowCsvDetail(detail) {
  const label = detail?.name || (detail?.kind === 'income' ? '收入事件' : '支出事件');
  const bridge = formatEventDetailBridge(detail);
  return bridge
    ? `${label} ${formatSignedCurrency(getSignedEventAmount(detail))} (${bridge})`
    : `${label} ${formatSignedCurrency(getSignedEventAmount(detail))}`;
}

function exportCashflowCsv() {
  if (!lastRenderedProjection?.ledger?.length || !lastRenderedData) {
    showPageNotice('請先產出退休規劃報告，再匯出 CSV。', 'error');
    return;
  }

  const header = ['年度', '階段', '期初資產', '投資損益', '追加投入', '生活支出', '醫療支出', 'LTC', '事件淨額', '事件明細', '期末餘額'];
  const rows = lastRenderedProjection.ledger.map((entry) => [
    `${entry.startAge}-${entry.endAge}`,
    entry.phase === 'accumulation' ? '累積期' : '退休期',
    Math.round(entry.startAsset),
    Math.round(entry.investmentReturn),
    Math.round(entry.contribution),
    Math.round(entry.living),
    Math.round(entry.baseMedical),
    Math.round(entry.ltc),
    Math.round(entry.eventAmount),
    entry.eventDetails.map((detail) => buildCashflowCsvDetail(detail)).join(' | '),
    Math.round(entry.endAsset)
  ]);

  const csvContent = `\uFEFF${[header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
  const reportDate = (lastRenderedData.reportDate || getLocalDateString()).replace(/[^0-9-]/g, '');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `retirement-cashflow-${reportDate || 'report'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
  showPageNotice('年度現金流 CSV 已下載。');
}

function parseAgeFromLabel(label) {
  const match = String(label ?? '').match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function getChartAgeValues(chart) {
  if (!chart) return [];
  if (Array.isArray(chart.__ageValues) && chart.__ageValues.length) return chart.__ageValues;

  chart.__ageValues = (chart.data?.labels || []).map((label) => parseAgeFromLabel(label));
  return chart.__ageValues;
}

function findCashflowRowByAge(age) {
  if (!Number.isFinite(age)) return null;
  return (
    document.querySelector(`#cashflowTableWrap tbody tr[data-end-age="${age}"]`) ||
    document.querySelector(`#cashflowTableWrap tbody tr[data-start-age="${age}"]`)
  );
}

function updateCashflowRowSelection(scrollIntoView = false) {
  const rows = Array.from(document.querySelectorAll('#cashflowTableWrap tbody tr[data-end-age]'));
  rows.forEach((row) => row.classList.remove('cashflow-row-selected'));

  const selectedRow = findCashflowRowByAge(selectedReportAge);
  if (!selectedRow) return;

  selectedRow.classList.add('cashflow-row-selected');
  if (scrollIntoView) {
    selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}

function updateHouseDiagnosticSelection() {
  const cards = Array.from(document.querySelectorAll('.house-diagnostics-item[data-focus-age]'));
  cards.forEach((card) => {
    card.classList.toggle('active', Number(card.dataset.focusAge) === selectedReportAge);
  });
}

function applyChartSelectionState() {
  Object.values(chartInstances).forEach((chart) => {
    if (!chart) return;

    const ageValues = getChartAgeValues(chart);
    const selectedIndex = ageValues.findIndex((age) => age === selectedReportAge);
    const isBar = chart.config?.type === 'bar';

    chart.data.datasets.forEach((dataset) => {
      if (isBar) {
        const baseColor = dataset.__baseBackgroundColor ?? dataset.backgroundColor ?? '#5a7a4a';
        dataset.__baseBackgroundColor = baseColor;
        dataset.backgroundColor = ageValues.map((age, index) => {
          if (Array.isArray(baseColor)) {
            return age === selectedReportAge ? '#b85c38' : (baseColor[index] || '#5a7a4a');
          }
          return age === selectedReportAge ? '#b85c38' : baseColor;
        });
        return;
      }

      const lineColor = dataset.borderColor || '#c8841a';
      dataset.pointRadius = ageValues.map((age) => (age === selectedReportAge ? 5 : 0));
      dataset.pointHoverRadius = ageValues.map((age) => (age === selectedReportAge ? 7 : 3));
      dataset.pointBackgroundColor = ageValues.map((age) => (age === selectedReportAge ? '#b85c38' : lineColor));
      dataset.pointBorderColor = ageValues.map((age) => (age === selectedReportAge ? '#fff' : lineColor));
      dataset.pointBorderWidth = ageValues.map((age) => (age === selectedReportAge ? 2 : 0));
    });

    if (selectedIndex >= 0 && typeof chart.setActiveElements === 'function') {
      const activeElements = chart.data.datasets.map((dataset, datasetIndex) => {
        if (Array.isArray(dataset.data) && dataset.data[selectedIndex] != null) {
          return { datasetIndex, index: selectedIndex };
        }
        return null;
      }).filter(Boolean);

      chart.setActiveElements(activeElements);
      if (chart.tooltip?.setActiveElements) {
        chart.tooltip.setActiveElements(activeElements, { x: 0, y: 0 });
      }
    } else if (typeof chart.setActiveElements === 'function') {
      chart.setActiveElements([]);
      if (chart.tooltip?.setActiveElements) {
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      }
    }

    chart.update('none');
  });
}

function setReportFocusAge(age, options = {}) {
  const normalizedAge = Number(age);
  if (!Number.isFinite(normalizedAge)) return;

  selectedReportAge = normalizedAge;
  updateCashflowRowSelection(options.scrollIntoView === true);
  updateHouseDiagnosticSelection();
  applyChartSelectionState();
}

function bindCashflowRowInteractions() {
  document.querySelectorAll('#cashflowTableWrap tbody tr[data-end-age]').forEach((row) => {
    row.addEventListener('click', () => {
      setReportFocusAge(Number(row.dataset.endAge), { scrollIntoView: false });
    });
  });
}

function bindHouseDiagnosticInteractions() {
  document.querySelectorAll('.house-diagnostics-item[data-focus-age]').forEach((card) => {
    card.addEventListener('click', () => {
      setReportFocusAge(Number(card.dataset.focusAge), { scrollIntoView: true });
    });
  });
}

function bindChartInteractions() {
  Object.values(chartInstances).forEach((chart) => {
    if (!chart?.canvas) return;

    chart.canvas.style.cursor = 'pointer';
    chart.canvas.onclick = (event) => {
      const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
      if (!points.length) return;

      const ageValues = getChartAgeValues(chart);
      const age = ageValues[points[0].index];
      if (Number.isFinite(age)) {
        setReportFocusAge(age, { scrollIntoView: true });
      }
    };
  });
}

function initializeReportInteractions() {
  bindCashflowRowInteractions();
  bindHouseDiagnosticInteractions();
  bindChartInteractions();

  if (Number.isFinite(selectedReportAge) && !findCashflowRowByAge(selectedReportAge)) {
    selectedReportAge = null;
  }

  if (!Number.isFinite(selectedReportAge)) {
    const preferredCard =
      document.querySelector('.house-diagnostics-item[data-event-role="buy"]') ||
      document.querySelector('.house-diagnostics-item[data-focus-age]');
    const fallbackAge = preferredCard
      ? Number(preferredCard.dataset.focusAge)
      : Number(document.querySelector('#cashflowTableWrap tbody tr[data-end-age]')?.dataset.endAge);

    if (Number.isFinite(fallbackAge)) {
      selectedReportAge = fallbackAge;
    }
  }

  updateCashflowRowSelection(false);
  updateHouseDiagnosticSelection();
  applyChartSelectionState();
}

classifyHousingEvent = function classifyHousingEventStable(detail) {
  const rawName = String(detail?.name || '');
  const lowerName = rawName.toLowerCase();

  const sellPattern = /(\u8ce3\u5c4b|\u552e\u5c4b|\u8ce3\u623f|\u51fa\u552e|house-sell|sell-home|sell-house|sell-property)/i;
  const buyPattern = /(\u63db\u5c4b|\u8cb7\u5c4b|\u8cb7\u623f|\u8cfc\u5c4b|house-buy|buy-home|buy-house|purchase-home|purchase-house)/i;
  const propertyPattern = /(\u5c4b|\u623f|house|home|property)/i;

  if (sellPattern.test(rawName) || /house-sell|sell-home|sell-house|sell-property/.test(lowerName)) {
    return 'sell';
  }

  if (buyPattern.test(rawName) || /house-buy|buy-home|buy-house|purchase-home|purchase-house/.test(lowerName)) {
    return 'buy';
  }

  if (propertyPattern.test(rawName)) {
    return detail?.direction === 'outflow' ? 'buy' : 'sell';
  }

  return null;
};

const baseCalculateRetirement = calculateRetirement;
calculateRetirement = function calculateRetirementWithInteractions() {
  baseCalculateRetirement();
  initializeReportInteractions();
};

function toggleAccordion(id) {
  const element = document.getElementById(id);
  element.style.display = element.style.display === 'block' ? 'none' : 'block';
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
    alert('資料已儲存於瀏覽器。');
  } catch (error) {
    console.error(error);
    alert('資料儲存失敗，請確認瀏覽器可用空間。');
  }
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    alert('找不到已儲存的資料。');
    return;
  }

  try {
    hydrateForm(JSON.parse(saved));
    alert('資料已成功載入。');
  } catch (error) {
    console.error(error);
    alert('已儲存資料解析失敗，請重新儲存一次。');
  }
}

function clearStoredData() {
  if (confirm('確定要清除儲存的資料嗎？')) {
    localStorage.removeItem(STORAGE_KEY);
    alert('已清除。');
  }
}

function encodeSharePayload(data) {
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decodeSharePayload(encodedData) {
  return JSON.parse(decodeURIComponent(atob(encodedData)));
}

function shareData() {
  const data = getFormData();
  const encoded = encodeSharePayload(data);
  const url = new URL(window.location.href);
  url.searchParams.set('data', encoded);

  const shareInput = document.getElementById('shareLink');
  shareInput.value = url.toString();
  document.getElementById('shareBox').classList.remove('hidden');
}

async function copyShareLink() {
  const shareInput = document.getElementById('shareLink');
  const text = shareInput.value.trim();

  if (!text) {
    alert('請先產生分享連結。');
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      shareInput.focus();
      shareInput.select();
      document.execCommand('copy');
    }
    alert('連結已複製！');
  } catch (error) {
    console.error(error);
    alert('複製失敗，請手動複製連結。');
  }
}

function checkUrlData() {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedData = urlParams.get('data');
  if (!encodedData) return;

  try {
    hydrateForm(decodeSharePayload(encodedData));
    showPageNotice('\u5df2\u81ea\u5206\u4eab\u9023\u7d50\u8f09\u5165\u53c3\u6578\u3002');
    return;
    alert('已自分享連結載入參數。');
  } catch (error) {
    console.error('解析網址參數失敗', error);
    alert('分享連結解析失敗，請確認連結內容完整。');
  }
}

function printReport() {
  window.print();
}
