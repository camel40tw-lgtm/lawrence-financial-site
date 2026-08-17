/* ─────────────────────────────────────────────────────────────
   property_calc_engine.js 迴歸測試
   對應「投資不動產規劃平台_MVP產品規格書.md」第 13 章全部測試案例。

   執行方式（不需要 npm install，純 Node 內建模組）：
     node property-invest/test/property_calc_engine.test.js
   ───────────────────────────────────────────────────────────── */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
require(path.join(__dirname, "..", "property_calc_engine.js"));
const Engine = global.PropertyCalcEngine;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

function approx(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label || ""} 期望 ${expected}，實際 ${actual}，誤差超過 ${tolerance}`.trim());
}

// ── TC-A01：資金限制可負擔房價 ────────────────────────────
test("TC-A01：資金限制可負擔房價", () => {
  const r = Engine.calcAffordability({
    availableCash: 4000000,
    emergencyFund: 600000,
    acquisitionFixedCost: 200000,
    renovationCost: 400000,
    acquisitionCostRate: 0,
    ltv: 0.7,
    purchasePrice: 0,
  });
  approx(r.availableInitialFunds, 2800000, 1, "可用頭期資金");
  approx(r.cashLimitedPrice, 9333333.33, 1, "資金限制房價");
});

// ── TC-A02：月付能力反推貸款與房價 ────────────────────────
test("TC-A02：月付能力反推貸款與房價", () => {
  const pmtLimitedLoanAmount = Engine.pvOfAnnuity(40000, 0.024 / 12, 360);
  approx(pmtLimitedLoanAmount, 10257952, 1, "可負擔貸款本金");
  const pmtLimitedPrice = pmtLimitedLoanAmount / 0.7;
  approx(pmtLimitedPrice, 14654218, 2, "月付限制房價");
});

test("TC-A03：月付能力須扣除既有債務並受收支餘裕限制", () => {
  const r = Engine.calcAffordability({
    monthlyIncome: 150000,
    monthlyExpense: 120000,
    otherDebtPayment: 10000,
    mortgageBurdenRate: 0.3,
    annualRate: 0.024,
    termMonths: 360,
    ltv: 0.7,
  });
  approx(r.burdenLimitedPayment, 35000, 0.01, "收入負擔率限制");
  approx(r.cashflowLimitedPayment, 20000, 0.01, "收支餘裕限制");
  approx(r.maxMonthlyPayment, 20000, 0.01, "可負擔月付應取較低者");
  approx(r.pmtLimitedLoanAmount, 5128976, 1, "月付能力反推貸款本金");
});

// ── TC-L01：本息平均攤還月付金 ────────────────────────────
const TC_L01_LOAN = { loanAmount: 8000000, annualRate: 0.024, termMonths: 360, repaymentMethod: "annuity" };
test("TC-L01：本息平均攤還月付金", () => {
  const schedule = Engine.buildAmortizationSchedule(TC_L01_LOAN);
  assert.strictEqual(schedule.length, 360, "應產生 360 期");
  approx(schedule[0].payment, 31195.30931363218, 0.01, "未取整月付金");
  const totalPayment = schedule.reduce((s, p) => s + p.payment, 0);
  const totalInterest = schedule.reduce((s, p) => s + p.interest, 0);
  approx(totalPayment, 11230311, 1, "360 期總還款");
  approx(totalInterest, 3230311, 1, "總利息");
  assert.strictEqual(schedule[359].endingBalance, 0, "最後一期後餘額須精確為 0");
});

// ── TC-L02：本息平均攤還第 60 期餘額 ──────────────────────
test("TC-L02：本息平均攤還第 60 期餘額", () => {
  const schedule = Engine.buildAmortizationSchedule(TC_L01_LOAN);
  approx(schedule[59].endingBalance, 7032349.48, 1, "第 60 期後貸款餘額");
});

// ── TC-L03：本金平均攤還 ──────────────────────────────────
test("TC-L03：本金平均攤還", () => {
  const schedule = Engine.buildAmortizationSchedule({ loanAmount: 8000000, annualRate: 0.024, termMonths: 360, repaymentMethod: "equal_principal" });
  approx(schedule[0].interest, 16000, 0.01, "第一期利息");
  approx(schedule[0].payment, 38222.22, 0.01, "第一期應繳");
  approx(schedule[359].interest, 44.44, 0.01, "最後一期利息");
  approx(schedule[359].payment, 22266.67, 0.01, "最後一期應繳");
  const totalInterest = schedule.reduce((s, p) => s + p.interest, 0);
  approx(totalInterest, 2888000, 1, "總利息");
  approx(schedule[59].endingBalance, 6666666.67, 1, "第 60 期後餘額");
  assert.strictEqual(schedule[359].endingBalance, 0, "最後一期後餘額須精確為 0");
});

// ── TC-L04：24 個月寬限期 ─────────────────────────────────
test("TC-L04：24 個月寬限期", () => {
  const schedule = Engine.buildAmortizationSchedule({ loanAmount: 8000000, annualRate: 0.024, termMonths: 360, repaymentMethod: "grace", graceMonths: 24 });
  approx(schedule[0].payment, 16000, 0.01, "寬限期月付利息");
  approx(schedule[0].principal, 0, 1e-9, "寬限期間本金應為 0");
  approx(schedule[23].endingBalance, 8000000, 1, "第 24 期後本金餘額");
  approx(schedule[24].payment, 32721.78, 0.01, "第 25 期起月付金");
  const totalInterest = schedule.reduce((s, p) => s + p.interest, 0);
  approx(totalInterest, 3378517.57, 1, "全期總利息");
  assert.strictEqual(schedule[schedule.length - 1].endingBalance, 0, "最後一期後餘額須精確為 0");
});

// ── TC-L05：零利率 ────────────────────────────────────────
test("TC-L05：零利率不得發生除以 0 錯誤", () => {
  const schedule = Engine.buildAmortizationSchedule({ loanAmount: 1200000, annualRate: 0, termMonths: 120, repaymentMethod: "annuity" });
  approx(schedule[0].payment, 10000, 0.01, "每月還款");
  const totalInterest = schedule.reduce((s, p) => s + p.interest, 0);
  approx(totalInterest, 0, 1e-9, "總利息應為 0");
  assert.strictEqual(schedule[119].endingBalance, 0, "最後一期後餘額須精確為 0");
});

// ── TC-R01：租金與 NOI ────────────────────────────────────
test("TC-R01：租金與 NOI", () => {
  const rental = { monthlyRent: 30000, parkingRent: 0, otherMonthlyIncome: 0, vacancyRate: 0.05, badDebtLoss: 0, rentGrowthRate: 0, annualOperatingCosts: [{ id: "1", name: "營運費用", amount: 80000, frequency: "annual" }] };
  const r = Engine.calcRentalYear(rental, 1, 12000000, 12000000, 0, 0);
  approx(r.potentialAnnualRent, 360000, 1, "年度潛在租金");
  approx(r.vacancyLoss, 18000, 1, "空置損失");
  approx(r.effectiveRent, 342000, 1, "有效租金收入");
  approx(r.noi, 262000, 1, "NOI");
  approx(r.grossYield, 0.03, 1e-6, "毛租金報酬率");
  approx(r.capRate, 0.0218, 1e-4, "Cap Rate");
});

// ── TC-R02：房貸後現金流與 DSCR（沿用 TC-L01） ────────────
test("TC-R02：房貸後現金流與 DSCR", () => {
  const schedule = Engine.buildAmortizationSchedule(TC_L01_LOAN);
  const yearly = Engine.summarizeScheduleByYear(schedule);
  const annualPI = yearly[0].principal + yearly[0].interest;
  approx(annualPI, 374343.71, 0.5, "年度房貸本息");
  const rental = { monthlyRent: 30000, parkingRent: 0, otherMonthlyIncome: 0, vacancyRate: 0.05, badDebtLoss: 0, rentGrowthRate: 0, annualOperatingCosts: [{ id: "1", name: "營運費用", amount: 80000, frequency: "annual" }] };
  const r = Engine.calcRentalYear(rental, 1, 12000000, 12000000, annualPI, 4000000);
  approx(r.preTaxCashFlow, -112343.71, 0.5, "年度稅前現金流");
  approx(r.dscr, 0.7, 0.001, "DSCR");
  approx(r.cashOnCash, -0.0281, 0.0005, "Cash-on-Cash Return");
});

// ── TC-S01：五年房價增值 ──────────────────────────────────
test("TC-S01：五年房價增值", () => {
  const price = Engine.calcSalePrice({ appreciationMethod: "fixed_rate", appreciationRate: 0.02, holdingYears: 5 }, 12000000);
  approx(price, 13248969.64, 1, "五年後房價");
});

// ── TC-S02：出售淨回收 ────────────────────────────────────
test("TC-S02：出售淨回收", () => {
  const salePrice = 13248969.64;
  const cost = Engine.calcSaleCost({ saleCostRate: 0.04, fixedSaleCost: 0, saleTaxInput: 0 }, salePrice);
  approx(cost, 529958.79, 1, "出售成本");
  const net = Engine.calcNetSaleProceeds(salePrice, cost, 7032349.48);
  approx(net, 5686661.37, 1, "出售淨回收");
});

// ── TC-I01：五年投資 IRR ──────────────────────────────────
test("TC-I01：五年投資 IRR ≈ 4.85%", () => {
  const cashflows = [-4000000, -112343.71, -112343.71, -112343.71, -112343.71, 5574317.66];
  const r = Engine.calcIrr(cashflows);
  assert.strictEqual(r.status, "ok");
  approx(r.rate, 0.04846, 0.0001, "年 IRR");
});

// ── TC-I02：IRR 無解 ──────────────────────────────────────
test("TC-I02：現金流未出現正向回收 → insufficient_sign_change", () => {
  const r = Engine.calcIrr([-1000000, -100000, -100000]);
  assert.strictEqual(r.status, "insufficient_sign_change");
  assert.strictEqual(r.rate, null, "不得顯示 0% 冒充結果");
});

// ── TC-I03：多重 IRR 警示 ─────────────────────────────────
test("TC-I03：多重 IRR 警示", () => {
  const r = Engine.calcIrr([-100, 230, -132]);
  assert.strictEqual(r.signChanges, 2, "應偵測到兩次正負號變化");
  assert.strictEqual(r.hasMultipleRoots, true, "即使求得其中一組 IRR 也須標記警示");
});

// ── TC-V01：鑑價低於成交價 ────────────────────────────────
test("TC-V01：鑑價低於成交價 → 須自行補足鑑價差額", () => {
  const r = Engine.calcAffordability({
    availableCash: 12000000,
    emergencyFund: 0,
    purchasePrice: 12000000,
    appraisalValue: 10000000,
    loanBaseMethod: "lower_of_two",
    ltv: 0.7,
    acquisitionFixedCost: 0,
    acquisitionCostRate: 0,
    renovationCost: 0,
  });
  approx(r.loanBase, 10000000, 1, "貸款基礎");
  approx(r.estimatedLoanAmount, 7000000, 1, "預估貸款");
  approx(r.requiredDownPayment, 5000000, 1, "單純房價頭期差額");
  assert.strictEqual(r.appraisalBelowPrice, true, "應標記鑑價低於成交價，顯示警示");
});

// ── 擴充範圍迴歸測試：二段式利率 ──────────────────────────
test("擴充：二段式利率會在轉換月重新計算 PMT", () => {
  const schedule = Engine.buildAmortizationSchedule({
    loanAmount: 8000000,
    annualRate: 0.021,
    termMonths: 360,
    repaymentMethod: "annuity",
    rateStage2: { enabled: true, changeMonth: 37, secondAnnualRate: 0.026 },
  });
  approx(schedule[0].interest, 8000000 * (0.021 / 12), 0.01, "第 1 期用第一段利率");
  approx(schedule[36].interest, schedule[36].beginningBalance * (0.026 / 12), 0.01, "第 37 期起改用第二段利率");
  assert.notStrictEqual(schedule[35].payment.toFixed(2), schedule[36].payment.toFixed(2), "轉換當月應重新計算月付金");
  assert.strictEqual(schedule[schedule.length - 1].endingBalance, 0, "最後一期後餘額須精確為 0");
});

// ── 擴充範圍迴歸測試：提前還款（縮短年限／減少月付） ─────
test("擴充：提前還款－縮短年限模式會提早清償", () => {
  const schedule = Engine.buildAmortizationSchedule({
    loanAmount: 8000000,
    annualRate: 0.024,
    termMonths: 360,
    repaymentMethod: "annuity",
    prepayments: [{ month: 12, amount: 1000000, mode: "reduce_term" }],
  });
  assert.ok(schedule.length < 360, "提前還款後應提早清償，期數應少於 360");
  approx(schedule[11].payment, schedule[10].payment, 0.01, "縮短年限模式：月付金應維持不變");
  assert.strictEqual(schedule[schedule.length - 1].endingBalance, 0, "最後一期後餘額須精確為 0");
});

test("擴充：提前還款－減少月付模式期數不變、月付金下降", () => {
  const schedule = Engine.buildAmortizationSchedule({
    loanAmount: 8000000,
    annualRate: 0.024,
    termMonths: 360,
    repaymentMethod: "annuity",
    prepayments: [{ month: 12, amount: 1000000, mode: "reduce_payment" }],
  });
  assert.strictEqual(schedule.length, 360, "減少月付模式：期數應維持 360 期不變");
  assert.ok(schedule[12].payment < schedule[10].payment, "提前還款後月付金應下降");
  assert.strictEqual(schedule[359].endingBalance, 0, "最後一期後餘額須精確為 0");
});

console.log(`\n${passed} 個通過、${failed} 個失敗（共 ${passed + failed} 個測試）`);
if (failed > 0) process.exit(1);
