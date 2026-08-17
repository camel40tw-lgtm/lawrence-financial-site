"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
require(path.join(__dirname, "..", "irr_engine.js"));
const Engine = global.PolicyIRREngine;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}`);
    console.log(`  ${err.message}`);
  }
}

function approxEqual(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, message || `expected ${expected}, got ${actual}`);
}

function buildCashflow(rows, surrenderYear, nonGuaranteedFactor = 100, guaranteedOnly = false, surrenderIncludes = "not_included") {
  const cashflows = [];
  const periods = [];
  rows
    .slice()
    .sort((a, b) => a.policyYear - b.policyYear)
    .forEach((row) => {
      if (row.policyYear > surrenderYear) return;
      const guaranteed = row.guaranteed || 0;
      const nonGuaranteed = guaranteedOnly ? 0 : (row.nonGuaranteed || 0) * (nonGuaranteedFactor / 100);
      const surrender = row.policyYear === surrenderYear ? row.surrender || 0 : 0;
      const inflow = row.policyYear === surrenderYear && surrenderIncludes === "included"
        ? surrender
        : guaranteed + nonGuaranteed + surrender;
      cashflows.push(inflow - (row.premium || 0));
      periods.push(row.policyYear);
    });
  return { cashflows, periods };
}

function irrFor(rows, surrenderYear, nonGuaranteedFactor = 100, guaranteedOnly = false, surrenderIncludes = "not_included") {
  const { cashflows, periods } = buildCashflow(rows, surrenderYear, nonGuaranteedFactor, guaranteedOnly, surrenderIncludes);
  return Engine.irr(cashflows, periods);
}

function portfolioAggregate(policies, options = {}) {
  const factor = options.nonGuaranteedFactor ?? 100;
  const displayCurrency = options.displayCurrency || "auto";
  const currencies = [...new Set(policies.map((p) => p.currency))];
  const usesFx = displayCurrency === "TWD" || currencies.length > 1;
  const byYear = new Map();

  for (const policy of policies) {
    const fx = usesFx ? policy.fxToTwd : 1;
    const trial = buildCashflow(policy.rows, policy.surrenderYear, factor, false, policy.surrenderIncludes);
    const guaranteed = buildCashflow(policy.rows, policy.surrenderYear, 0, true, policy.surrenderIncludes);
    trial.cashflows.forEach((net, index) => {
      const year = trial.periods[index];
      if (!byYear.has(year)) byYear.set(year, { year, guaranteedNet: 0, trialNet: 0 });
      byYear.get(year).trialNet += net * fx;
    });
    guaranteed.cashflows.forEach((net, index) => {
      const year = guaranteed.periods[index];
      if (!byYear.has(year)) byYear.set(year, { year, guaranteedNet: 0, trialNet: 0 });
      byYear.get(year).guaranteedNet += net * fx;
    });
  }

  const rows = [...byYear.values()].sort((a, b) => a.year - b.year);
  return {
    rows,
    usesFx,
    displayCurrency: usesFx ? "TWD" : currencies[0],
    guaranteedIrr: Engine.irr(rows.map((r) => r.guaranteedNet), rows.map((r) => r.year)),
    trialIrr: Engine.irr(rows.map((r) => r.trialNet), rows.map((r) => r.year)),
  };
}

test("年度節點：第 0-5 年各繳 100 萬，第 6 年領 700 萬，IRR 約 4.421312%", () => {
  const rows = [];
  for (let y = 0; y <= 5; y++) rows.push({ policyYear: y, premium: 1000000 });
  rows.push({ policyYear: 6, surrender: 7000000 });
  const result = irrFor(rows, 6);
  assert.strictEqual(result.converged, true);
  approxEqual(result.rate, 0.04421312, 1e-7);
});

test("跳年現金流：只填第 0 年與第 10 年時，periods 必須保留 10 年期距", () => {
  const rows = [{ policyYear: 0, premium: 1000000 }, { policyYear: 10, surrender: 1218994.42 }];
  const result = irrFor(rows, 10);
  approxEqual(result.rate, 0.02, 1e-4);
});

test("同年度淨額合併：同一年度保費、領回、解約金合併成單一淨現金流", () => {
  const rows = [
    { policyYear: 0, premium: 100 },
    { policyYear: 1, premium: 20, guaranteed: 10, nonGuaranteed: 5, surrender: 130 },
  ];
  const built = buildCashflow(rows, 1, 100, false, "not_included");
  assert.deepStrictEqual(built.cashflows, [-100, 125]);
  approxEqual(irrFor(rows, 1).rate, 0.25, 1e-8);
});

test("解約金已包含當年度領回：最後一年不再加計保證/非保證領回", () => {
  const rows = [
    { policyYear: 0, premium: 100 },
    { policyYear: 1, guaranteed: 10, nonGuaranteed: 5, surrender: 130 },
  ];
  assert.deepStrictEqual(buildCashflow(rows, 1, 100, false, "included").cashflows, [-100, 130]);
  assert.deepStrictEqual(buildCashflow(rows, 1, 100, false, "not_included").cashflows, [-100, 145]);
});

test("非保證比例：保證 IRR 排除非保證，試算 IRR 依全域比例折算", () => {
  const rows = [
    { policyYear: 0, premium: 100 },
    { policyYear: 1, guaranteed: 100, nonGuaranteed: 20 },
  ];
  approxEqual(irrFor(rows, 1, 100, true).rate, 0, 1e-8);
  approxEqual(irrFor(rows, 1, 50, false).rate, 0.1, 1e-8);
});

test("同幣別組合：全部 USD 時直接以 USD 加總，不使用匯率", () => {
  const policies = [
    { currency: "USD", fxToTwd: 31, surrenderYear: 1, surrenderIncludes: "not_included", rows: [{ policyYear: 0, premium: 100 }, { policyYear: 1, surrender: 110 }] },
    { currency: "USD", fxToTwd: 32, surrenderYear: 1, surrenderIncludes: "not_included", rows: [{ policyYear: 0, premium: 200 }, { policyYear: 1, surrender: 220 }] },
  ];
  const result = portfolioAggregate(policies);
  assert.strictEqual(result.usesFx, false);
  assert.strictEqual(result.displayCurrency, "USD");
  assert.deepStrictEqual(result.rows.map((r) => r.trialNet), [-300, 330]);
  approxEqual(result.trialIrr.rate, 0.1, 1e-8);
});

test("不同幣別組合：使用各保單對 TWD 匯率後再加總", () => {
  const policies = [
    { currency: "USD", fxToTwd: 30, surrenderYear: 1, surrenderIncludes: "not_included", rows: [{ policyYear: 0, premium: 100 }, { policyYear: 1, surrender: 110 }] },
    { currency: "TWD", fxToTwd: 1, surrenderYear: 1, surrenderIncludes: "not_included", rows: [{ policyYear: 0, premium: 1000 }, { policyYear: 1, surrender: 1200 }] },
  ];
  const result = portfolioAggregate(policies);
  assert.strictEqual(result.usesFx, true);
  assert.strictEqual(result.displayCurrency, "TWD");
  assert.deepStrictEqual(result.rows.map((r) => r.trialNet), [-4000, 4500]);
  approxEqual(result.trialIrr.rate, 0.125, 1e-8);
});

test("強制 TWD：即使同幣別，也可依匯率換算為 TWD；IRR 不因固定比例換算改變", () => {
  const policies = [
    { currency: "USD", fxToTwd: 30, surrenderYear: 1, surrenderIncludes: "not_included", rows: [{ policyYear: 0, premium: 100 }, { policyYear: 1, surrender: 115 }] },
  ];
  const usd = portfolioAggregate(policies);
  const twd = portfolioAggregate(policies, { displayCurrency: "TWD" });
  assert.strictEqual(usd.displayCurrency, "USD");
  assert.strictEqual(twd.displayCurrency, "TWD");
  approxEqual(usd.trialIrr.rate, twd.trialIrr.rate, 1e-10);
  approxEqual(twd.trialIrr.rate, 0.15, 1e-8);
});

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
