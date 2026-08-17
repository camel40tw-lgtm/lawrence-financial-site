const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
require(path.join(__dirname, "..", "estate_tax_engine.js"));

const E = global.EstateTaxEngine;

function baseInput(overrides = {}) {
  return {
    deathDate: "2026-08-09",
    grossEstate: 30000000,
    dailyNecessitiesValue: 800000,
    workToolsValue: 0,
    spouseCount: 1,
    linealDescCount: 2,
    linealMinorExtraYears: 0,
    parentCount: 0,
    disabledCount: 0,
    dependentSiblingGrandparentCount: 0,
    dependentSiblingMinorExtraYears: 0,
    funeralDeductionEnabled: true,
    advancedFlags: [],
    ...overrides,
  };
}

{
  const result = E.calculate(baseInput());
  assert.equal(result.excludedTotal, 800000);
  assert.equal(result.deductionsTotal, 5530000 + 1120000 + 1380000);
  assert.equal(result.netEstate, 7840000);
  assert.equal(result.estateTax, 784000);
}

{
  const result = E.calculate(baseInput({
    grossEstate: 200000000,
    dailyNecessitiesValue: 2000000,
    workToolsValue: 1000000,
    spouseCount: 0,
    linealDescCount: 0,
    funeralDeductionEnabled: false,
  }));
  assert.equal(result.excludedDailyNecessities, 1000000);
  assert.equal(result.excludedWorkTools, 560000);
  assert.equal(result.netEstate, 185110000);
  assert.equal(result.estateTax, 12500000 + (85110000 * 0.2));
}

{
  assert.equal(E.calculateEstateTax(50000000).tax, 5000000);
  assert.equal(E.calculateEstateTax(100000000).tax, 12500000);
  assert.equal(E.calculateEstateTax(120000000).tax, 16500000);
}

{
  const result = E.calculate(baseInput({ deathDate: "2025-12-31" }));
  assert.equal(result.advancedReviewRequired, true);
  assert.match(result.warnings.join("\n"), /只內建 115 年度/);
}

{
  const result = E.calculate(baseInput({ advancedFlags: ["insurance", "overseas"] }));
  assert.equal(result.advancedReviewRequired, true);
  assert.deepEqual(result.advancedReasons, ["保險給付是否計入遺產", "境外財產或非居住者情境"]);
}

console.log("estate_tax_engine tests passed");
