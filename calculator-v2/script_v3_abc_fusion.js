/* =========================
   Shared Utilities
========================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const index = (sortedArr.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sortedArr[lo];
  const weight = index - lo;
  return sortedArr[lo] * (1 - weight) + sortedArr[hi] * weight;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveInt(value, fallback = 0) {
  const number = Math.trunc(toFiniteNumber(value, fallback));
  return number > 0 ? number : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* =========================
   Random Helpers
========================= */

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomChiSquare(df) {
  let sum = 0;
  for (let i = 0; i < df; i++) {
    const z = randomNormal();
    sum += z * z;
  }
  return sum;
}

function randomStudentT(df = 6) {
  const z = randomNormal();
  const chi = randomChiSquare(df);
  if (!Number.isFinite(chi) || chi <= 0) return z;
  return z / Math.sqrt(chi / df);
}

function drawFatTailShock(vol, df = 6) {
  const raw = randomStudentT(df);
  const scale = Math.sqrt(df / (df - 2));
  return (raw / scale) * vol;
}

/* =========================
   Label Helpers
========================= */

function getIncomePresetLabel(preset) {
  const labels = {
    salary: "薪資收入",
    bonus: "獎金收入",
    part_time: "兼職收入",
    business: "事業收入",
    labor_insurance: "勞保給付",
    labor_pension: "勞退提領",
    annuity: "商業年金",
    rent: "租金收入",
    interest: "利息收入",
    dividend: "股利收入",
    distribution: "配息收入",
    custom: "自訂收入"
  };
  return labels[preset] || labels.custom;
}

function getOwnerLabel(owner) {
  const labels = {
    self: "本人",
    spouse: "配偶",
    household: "家庭"
  };
  return labels[owner] || "家庭";
}

/* =========================
   LTC / Medical
========================= */

function getDefaultLtcProfile() {
  return {
    enabled: true,
    startAge: 80,
    durationYears: 8,
    extraCostFactor: 1.2
  };
}

function normalizeLtcProfile(profile) {
  const base = getDefaultLtcProfile();
  return {
    enabled: profile?.enabled ?? base.enabled,
    startAge: toPositiveInt(profile?.startAge, base.startAge),
    durationYears: toPositiveInt(profile?.durationYears, base.durationYears),
    extraCostFactor: toFiniteNumber(profile?.extraCostFactor, base.extraCostFactor)
  };
}

function getMedicalAgeLoad(age) {
  if (age >= 85) return 2.0;
  if (age >= 75) return 1.5;
  return 1;
}

function getCareAgeLoad(age) {
  if (age >= 90) return 1.9;
  if (age >= 85) return 1.6;
  if (age >= 80) return 1.3;
  return 1;
}

function getLtcPremiumCost(age, currentBaseMedicalCost, ltcProfile) {
  const profile = normalizeLtcProfile(ltcProfile);
  if (!profile.enabled) return 0;
  if (age < profile.startAge || age >= profile.startAge + profile.durationYears) return 0;

  const premiumFactor = Math.max(0, profile.extraCostFactor - 1);
  return currentBaseMedicalCost * premiumFactor;
}

/* =========================
   Data Normalization
========================= */

function translateAgeForOwner(plan, owner, ownerAge) {
  const targetAge = toPositiveInt(ownerAge, plan.currentAge);
  if (owner === "spouse" && plan.householdMode === "couple" && plan.spousePerson) {
    const yearOffset = targetAge - plan.spousePerson.currentAge;
    return plan.currentAge + yearOffset;
  }
  return targetAge;
}

function normalizeEventName(row, fallbackName) {
  return String(row?.name || "").trim() || fallbackName;
}

function normalizePlanData(rawData = {}) {
  const householdMode = rawData.householdMode === "couple" ? "couple" : "single";

  const selfPerson = {
    role: "self",
    name: String(rawData.selfName || rawData.clientName || "").trim(),
    currentAge: toPositiveInt(rawData.currentAge, 40),
    retireAge: toPositiveInt(rawData.retireAge, 65),
    lifeExpectancy: toPositiveInt(rawData.lifeExpectancy, 90),
    healthStatus: rawData.selfHealthStatus || "normal"
  };

  const spousePerson = householdMode === "couple"
    ? {
        role: "spouse",
        name: String(rawData.spouseName || "").trim(),
        currentAge: toPositiveInt(rawData.spouseCurrentAge, 38),
        retireAge: toPositiveInt(rawData.spouseRetireAge, 63),
        lifeExpectancy: toPositiveInt(rawData.spouseLifeExpectancy, 92),
        healthStatus: rawData.spouseHealthStatus || "normal"
      }
    : null;

  const members = spousePerson ? [selfPerson, spousePerson] : [selfPerson];

  const basePlan = {
    ...rawData,
    householdMode,
    selfPerson,
    spousePerson,
    members,
    currentAge: selfPerson.currentAge
  };

  const translatedSpouseRetireAge = spousePerson
    ? translateAgeForOwner(basePlan, "spouse", spousePerson.retireAge)
    : selfPerson.retireAge;
  const translatedSpouseLife = spousePerson
    ? translateAgeForOwner(basePlan, "spouse", spousePerson.lifeExpectancy)
    : selfPerson.lifeExpectancy;

  const retireAge = Math.min(selfPerson.retireAge, translatedSpouseRetireAge);
  const lifeExpectancy = Math.max(selfPerson.lifeExpectancy, translatedSpouseLife);

  const liabilities = (rawData.liabilities || []).map((row, index) => ({
    id: row.id || `liability-${index + 1}`,
    name: normalizeEventName(row, `負債 ${index + 1}`),
    balance: Math.max(0, toFiniteNumber(row.balance, 0)),
    monthlyPayment: Math.max(0, toFiniteNumber(row.monthlyPayment, 0)),
    payoffAge: toPositiveInt(row.payoffAge, retireAge)
  }));

  const assetBuckets = {
    cash: Math.max(0, toFiniteNumber(rawData.cashAssets, 0)),
    investment: Math.max(0, toFiniteNumber(rawData.investmentAssets, 0)),
    retirement: Math.max(0, toFiniteNumber(rawData.retirementAssets, 0)),
    property: Math.max(0, toFiniteNumber(rawData.propertyAssets, 0)),
    includePropertyInFunding: Boolean(rawData.includePropertyInFunding)
  };

  const liabilityBalance = liabilities.reduce((sum, item) => sum + item.balance, 0);
  const fundingAssetsGross = assetBuckets.cash + assetBuckets.investment + assetBuckets.retirement +
    (assetBuckets.includePropertyInFunding ? assetBuckets.property : 0);
  const fundingAssetsNet = Math.max(0, fundingAssetsGross - liabilityBalance);

  const expensePlan = {
    essential: Math.max(0, toFiniteNumber(rawData.essentialExpense, 0)),
    discretionary: Math.max(0, toFiniteNumber(rawData.discretionaryExpense, 0)),
    medical: Math.max(0, toFiniteNumber(rawData.monthlyMedicalExpense, 0)),
    care: Math.max(0, toFiniteNumber(rawData.monthlyCareExpense, 0))
  };

  const strategy = {
    type: rawData.withdrawalStrategy || "fixed_spending",
    fixedWithdrawalRate: Math.max(0, toFiniteNumber(rawData.fixedWithdrawalRate, 4)),
    guardrailFloor: Math.max(50, toFiniteNumber(rawData.strategyGuardrailFloor, 90)),
    guardrailCeiling: Math.max(80, toFiniteNumber(rawData.strategyGuardrailCeiling, 115))
  };

  const normalizedPlan = {
    ...rawData,
    householdMode,
    selfPerson,
    spousePerson,
    members,
    currentAge: selfPerson.currentAge,
    retireAge,
    lifeExpectancy,
    assets: fundingAssetsNet,
    contribution: Math.max(0, toFiniteNumber(rawData.monthlyContribution, 0)),
    assetBuckets,
    liabilities,
    expensePlan,
    strategy,
    expense: expensePlan.essential + expensePlan.discretionary,
    monthlyMedicalExpense: expensePlan.medical,
    monthlyCareExpense: expensePlan.care,
    pension: 0,
    ltcProfile: normalizeLtcProfile(rawData.ltcProfile),
    caseName: String(rawData.caseName || "").trim(),
    versionName: String(rawData.versionName || "").trim(),
    baselineVersion: String(rawData.baselineVersion || "").trim(),
    clientName: String(rawData.clientName || "").trim(),
    advisorName: String(rawData.advisorName || "").trim(),
    advisorNote: String(rawData.advisorNote || "").trim(),
    reportDate: rawData.reportDate || ""
  };

  normalizedPlan.incomes = (rawData.incomes || []).map((row, index) => {
    const owner = row.owner || "household";
    const preset = row.preset || "custom";
    const translatedAge = translateAgeForOwner(normalizedPlan, owner, row.age);
    return {
      id: row.id || `income-${index + 1}`,
      owner,
      preset,
      ownerLabel: getOwnerLabel(owner),
      type: row.type === "monthly" ? "monthly" : "lump",
      amount: Math.max(0, toFiniteNumber(row.amount, 0)),
      years: Math.max(1, toPositiveInt(row.years, 1)),
      age: translatedAge,
      ownerAge: toPositiveInt(row.age, normalizedPlan.retireAge),
      inflation: row.inflation !== false,
      name: normalizeEventName(row, `${getOwnerLabel(owner)} ${getIncomePresetLabel(preset)}`)
    };
  });

  normalizedPlan.goals = (rawData.goals || []).map((row, index) => {
    const owner = row.owner || "household";
    const translatedAge = translateAgeForOwner(normalizedPlan, owner, row.age);
    return {
      id: row.id || `goal-${index + 1}`,
      owner,
      ownerLabel: getOwnerLabel(owner),
      category: row.category || "custom",
      type: row.type === "monthly" ? "monthly" : "lump",
      amount: Math.max(0, toFiniteNumber(row.amount, 0)),
      years: Math.max(1, toPositiveInt(row.years, 1)),
      age: translatedAge,
      ownerAge: toPositiveInt(row.age, normalizedPlan.retireAge),
      inflation: row.inflation !== false,
      name: normalizeEventName(row, `${getOwnerLabel(owner)} 事件 ${index + 1}`)
    };
  });

  return normalizedPlan;
}

/* =========================
   Schedule / Projection
========================= */

function createInflationIndexByAge(currentAge, lifeExpectancy, inflationBase) {
  let inflationIndex = 1;
  const inflationByAge = { [currentAge]: 1 };

  for (let age = currentAge + 1; age <= lifeExpectancy; age++) {
    inflationIndex *= 1 + inflationBase;
    inflationByAge[age] = inflationIndex;
  }

  return inflationByAge;
}

function buildDetailedEventSchedule(goals, incomes, currentAge, lifeExpectancy, inflationByAge) {
  const schedule = {};
  const details = {};

  for (let age = currentAge; age <= lifeExpectancy; age++) {
    schedule[age] = 0;
    details[age] = [];
  }

  (goals || []).forEach((goal) => {
    if (!goal.type || !Number.isFinite(goal.age) || !Number.isFinite(goal.amount)) return;
    const iterations = goal.type === "lump" ? 1 : Number(goal.years || 0);
    for (let k = 0; k < iterations; k++) {
      const age = goal.type === "lump" ? goal.age : goal.age + k;
      if (schedule[age] === undefined) continue;
      const amount = goal.type === "monthly" ? goal.amount * 12 : goal.amount;
      const factor = goal.inflation ? inflationByAge[age] || 1 : 1;
      const adjustedAmount = amount * factor;
      schedule[age] -= adjustedAmount;
      details[age].push({
        kind: "goal",
        direction: "outflow",
        name: goal.name || "",
        owner: goal.owner || "household",
        ownerLabel: goal.ownerLabel || getOwnerLabel(goal.owner),
        category: goal.category || "custom",
        type: goal.type,
        years: iterations,
        inflationAdjusted: goal.inflation !== false,
        baseAmount: amount,
        nominalAmount: adjustedAmount,
        amount: adjustedAmount
      });
    }
  });

  (incomes || []).forEach((income) => {
    if (!income.type || !Number.isFinite(income.age) || !Number.isFinite(income.amount)) return;
    const iterations = income.type === "lump" ? 1 : Number(income.years || 0);
    for (let k = 0; k < iterations; k++) {
      const age = income.type === "lump" ? income.age : income.age + k;
      if (schedule[age] === undefined) continue;
      const amount = income.type === "monthly" ? income.amount * 12 : income.amount;
      const factor = income.inflation ? inflationByAge[age] || 1 : 1;
      const adjustedAmount = amount * factor;
      schedule[age] += adjustedAmount;
      details[age].push({
        kind: "income",
        direction: "inflow",
        name: income.name || "",
        owner: income.owner || "household",
        ownerLabel: income.ownerLabel || getOwnerLabel(income.owner),
        preset: income.preset || "custom",
        type: income.type,
        years: iterations,
        inflationAdjusted: income.inflation !== false,
        baseAmount: amount,
        nominalAmount: adjustedAmount,
        amount: adjustedAmount
      });
    }
  });

  return { schedule, details };
}

function buildRandomizedEventSchedule(goals, incomes, currentAge, lifeExpectancy, inflationByAge) {
  return buildDetailedEventSchedule(goals, incomes, currentAge, lifeExpectancy, inflationByAge).schedule;
}

function getAnnualDebtService(data, age) {
  return (data.liabilities || []).reduce((sum, liability) => {
    if (age < liability.payoffAge) {
      return sum + liability.monthlyPayment * 12;
    }
    return sum;
  }, 0);
}

function getRetirementSpendBreakdown(data, age, state = {}) {
  const inflationBase = toFiniteNumber(data.inflationRate, 2) / 100;
  const medicalInflation = toFiniteNumber(data.medicalInflationRate, 5) / 100;
  const realMedicalInflation = (1 + medicalInflation) / (1 + inflationBase) - 1;
  const yearsFromNow = Math.max(0, age - data.currentAge);

  const essential = Math.max(0, data.expensePlan.essential) * 12;
  const baseDiscretionary = Math.max(0, data.expensePlan.discretionary) * 12;
  const debt = getAnnualDebtService(data, age);

  const baseMedical =
    Math.max(0, data.expensePlan.medical) *
    12 *
    Math.pow(1 + realMedicalInflation, yearsFromNow) *
    getMedicalAgeLoad(age);

  const care =
    Math.max(0, data.expensePlan.care) *
    12 *
    Math.pow(1 + realMedicalInflation, yearsFromNow) *
    getCareAgeLoad(age);

  let discretionary = baseDiscretionary;
  const retirementStartAsset = Math.max(1, state.retirementStartAsset || state.asset || 1);

  if (data.strategy.type === "fixed_rate") {
    const withdrawalTarget = Math.max(essential, (state.asset || 0) * (data.strategy.fixedWithdrawalRate / 100));
    discretionary = Math.max(0, Math.min(baseDiscretionary * 2.5, withdrawalTarget - essential));
  }

  if (data.strategy.type === "guardrail") {
    const priorDiscretionary = Number.isFinite(state.currentDiscretionarySpend)
      ? state.currentDiscretionarySpend
      : baseDiscretionary;
    const floor = baseDiscretionary * (data.strategy.guardrailFloor / 100);
    const ceiling = baseDiscretionary * (data.strategy.guardrailCeiling / 100);
    const assetRatio = (state.asset || 0) / retirementStartAsset;

    if (assetRatio < 0.85) {
      discretionary = Math.max(floor, priorDiscretionary * 0.96);
    } else if (assetRatio > 1.15) {
      discretionary = Math.min(ceiling, priorDiscretionary * 1.03);
    } else {
      discretionary = Math.min(ceiling, Math.max(floor, priorDiscretionary));
    }
  }

  const living = essential + discretionary;
  const ltc = getLtcPremiumCost(age, baseMedical + care, data.ltcProfile);

  return {
    essential,
    discretionary,
    living,
    debt,
    baseMedical,
    care,
    ltc,
    total: living + debt + baseMedical + care + ltc
  };
}

function buildDeterministicProjection(rawData, returnOffset = 0) {
  const data = rawData?.members ? rawData : normalizePlanData(rawData);

  let asset = data.assets;
  const path = [];
  const ledger = [];

  const inflationBase = toFiniteNumber(data.inflationRate, 2) / 100;
  const preReturn = toFiniteNumber(data.returnRate, 5) / 100 + returnOffset;
  const postReturn = toFiniteNumber(data.postReturnRate, 2) / 100 + returnOffset;

  const inflationByAge = createInflationIndexByAge(data.currentAge, data.lifeExpectancy, inflationBase);
  const { schedule, details: eventDetailsByAge } = buildDetailedEventSchedule(
    data.goals,
    data.incomes,
    data.currentAge,
    data.lifeExpectancy,
    inflationByAge
  );

  for (let age = data.currentAge; age < data.retireAge; age++) {
    path.push({ age, value: Math.max(0, asset) });

    const startAsset = asset;
    const nextAge = age + 1;
    const realPre = (1 + preReturn) / (1 + inflationBase) - 1;
    const contribution = data.contribution * 12;
    const investmentReturn = startAsset * realPre;
    const eventAmount = Number(schedule[nextAge] || 0);

    asset = startAsset + investmentReturn + contribution + eventAmount;

    ledger.push({
      phase: "accumulation",
      startAge: age,
      endAge: nextAge,
      startAsset: Math.max(0, startAsset),
      returnRate: realPre,
      investmentReturn,
      contribution,
      essential: 0,
      discretionary: 0,
      debt: 0,
      baseMedical: 0,
      care: 0,
      ltc: 0,
      spendTotal: 0,
      eventAmount,
      eventDetails: eventDetailsByAge[nextAge] || [],
      endAsset: Math.max(0, asset)
    });
  }

  const retirementStartAsset = Math.max(0, asset);
  let currentDiscretionarySpend = data.expensePlan.discretionary * 12;

  for (let age = data.retireAge; age < data.lifeExpectancy; age++) {
    path.push({ age, value: Math.max(0, asset) });

    const nextAge = age + 1;
    const startAsset = Math.max(0, asset);
    const spend = getRetirementSpendBreakdown(data, age, {
      asset: startAsset,
      retirementStartAsset,
      currentDiscretionarySpend
    });
    currentDiscretionarySpend = spend.discretionary;

    const realPost = (1 + postReturn) / (1 + inflationBase) - 1;
    const investmentReturn = startAsset * realPost;
    const eventAmount = Number(schedule[nextAge] || 0);

    asset = startAsset + investmentReturn - spend.total + eventAmount;
    if (asset < 0) asset = 0;

    ledger.push({
      phase: "retirement",
      startAge: age,
      endAge: nextAge,
      startAsset,
      returnRate: realPost,
      investmentReturn,
      contribution: 0,
      essential: spend.essential,
      discretionary: spend.discretionary,
      debt: spend.debt,
      baseMedical: spend.baseMedical,
      care: spend.care,
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

function calcPathMaxDrawdown(path) {
  if (!Array.isArray(path) || !path.length) return 0;

  let peak = path[0]?.value ?? 0;
  let maxDrawdown = 0;

  for (const point of path) {
    const value = point?.value ?? 0;
    if (value <= 0 && peak > 0) return 1;

    peak = Math.max(peak, value);
    if (peak <= 0) continue;

    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

function evaluateProjection(rawData, projection) {
  const data = rawData?.members ? rawData : normalizePlanData(rawData);
  const path = projection.path || [];
  const retirementPoint = path.find((point) => point.age === data.retireAge) ||
    path[path.length - 1] ||
    { age: data.retireAge, value: 0 };
  const finalPoint = path[path.length - 1] || { age: data.lifeExpectancy, value: 0 };
  const depletionPoint = path.find((point, index) => index > 0 && point.age >= data.retireAge && point.value <= 0);
  const firstYearSpend = getRetirementSpendBreakdown(data, data.retireAge, {
    asset: retirementPoint.value,
    retirementStartAsset: retirementPoint.value,
    currentDiscretionarySpend: data.expensePlan.discretionary * 12
  });
  const rule4Target = firstYearSpend.total > 0 ? firstYearSpend.total / 0.04 : 0;
  const fundedRatio = rule4Target > 0 ? retirementPoint.value / rule4Target : 0;

  return {
    retirementPoint,
    finalPoint,
    depletionPoint,
    firstYearSpend,
    rule4Target,
    fundedRatio,
    maxDrawdown: calcPathMaxDrawdown(path)
  };
}

/* =========================
   Scenario Builder
========================= */

function buildScenarioVariants(rawData = {}) {
  if (window.PlanNormalizerV1 && window.ProjectionEngineV1?.buildScenarioComparisons) {
    const normalizedPlan = window.PlanNormalizerV1.normalizePlan(rawData);
    return window.ProjectionEngineV1.buildScenarioComparisons(rawData, normalizedPlan);
  }

  const scenarioA = deepClone(rawData);

  const scenarioB = deepClone(rawData);
  scenarioB.returnRate = toFiniteNumber(rawData.returnRate, 5) - 1;
  scenarioB.postReturnRate = toFiniteNumber(rawData.postReturnRate, 2) - 1;
  scenarioB.inflationRate = toFiniteNumber(rawData.inflationRate, 2) + 0.5;

  const scenarioC = deepClone(rawData);
  scenarioC.monthlyContribution = Math.round(toFiniteNumber(rawData.monthlyContribution, 0) * 1.15);
  scenarioC.discretionaryExpense = Math.round(toFiniteNumber(rawData.discretionaryExpense, 0) * 0.9);
  scenarioC.retireAge = Math.min(
    toPositiveInt(rawData.lifeExpectancy, 90) - 1,
    toPositiveInt(rawData.retireAge, 65) + 2
  );
  if (rawData.householdMode === "couple") {
    scenarioC.spouseRetireAge = Math.min(
      toPositiveInt(rawData.spouseLifeExpectancy, 92) - 1,
      toPositiveInt(rawData.spouseRetireAge, 63) + 2
    );
  }

  return [
    {
      id: "A",
      label: "方案 A 基準",
      description: "完全沿用目前輸入條件，不改任何假設，作為基準對照。",
      rawData: scenarioA
    },
    {
      id: "B",
      label: "方案 B 保守",
      description: "保守壓力情境：退休前後報酬率各下修 1 個百分點，通膨上調 0.5 個百分點，用來看在較不利環境下會掉多少。",
      rawData: scenarioB
    },
    {
      id: "C",
      label: "方案 C 強化",
      description: "可控改善情境：每月投入 +15%、彈性支出 -10%、退休延後 2 年；用來估算如果真的把可控假設往有利方向調整，結果能拉回多少。",
      rawData: scenarioC
    }
  ].map((scenario) => {
    if (window.PlanNormalizerV1 && window.ProjectionEngineV1) {
      const normalizedPlan = window.PlanNormalizerV1.normalizePlan(scenario.rawData);
      const projectionResult = window.ProjectionEngineV1.buildProjectionResult(normalizedPlan);
      const compatibleData = window.ProjectionEngineV1.buildLegacyCompatibleData(scenario.rawData, normalizedPlan);
      return {
        ...scenario,
        normalizedPlan,
        projectionResult,
        data: compatibleData,
        projection: projectionResult.legacy.projection,
        evaluation: projectionResult.legacy.evaluation
      };
    }

    const normalized = normalizePlanData(scenario.rawData);
    const projection = buildDeterministicProjection(normalized, 0);
    const evaluation = evaluateProjection(normalized, projection);
    return {
      ...scenario,
      data: normalized,
      projection,
      evaluation
    };
  });
}

/* =========================
   Monte Carlo
========================= */

function runMonteCarlo(rawData) {
  if (window.PlanNormalizerV1 && window.ProjectionEngineV1?.runMonteCarlo) {
    const normalizedPlan = rawData?.household ? rawData : window.PlanNormalizerV1.normalizePlan(rawData);
    return window.ProjectionEngineV1.runMonteCarlo(rawData, normalizedPlan);
  }

  const data = rawData?.members ? rawData : normalizePlanData(rawData);
  const mc = data.monteCarloOptions || {};
  if (!mc.mcEnabled) return null;

  const currentAge = data.currentAge;
  const retireAge = data.retireAge;
  const lifeExpectancy = data.lifeExpectancy;
  const startingAssets = data.assets;
  const baseMonthlyContribution = data.contribution;

  const meanPreReturn = toFiniteNumber(data.returnRate, 5) / 100;
  const meanPostReturn = toFiniteNumber(data.postReturnRate, 2) / 100;
  const inflationBase = toFiniteNumber(data.inflationRate, 2) / 100;

  const goals = data.goals || [];
  const incomes = data.incomes || [];
  const ltcProfile = normalizeLtcProfile(data.ltcProfile);

  const retirementYears = Math.max(0, lifeExpectancy - retireAge);
  const runs = Math.max(100, toPositiveInt(mc.mcRuns, 500));
  const volatility = Math.max(0, toFiniteNumber(mc.mcVolatility, 0.12));
  const inflationVol = mc.mcRandomInflation
    ? Math.max(0, toFiniteNumber(mc.mcInflationVolatility, 0.012))
    : 0;

  const fatTailDf = 6;
  const preCrashProb = toFiniteNumber(mc.preCrashProb, 0.015);
  const postCrashProb = toFiniteNumber(mc.postCrashProb, 0.01);
  const isFixedNominalContribution = Boolean(mc.fixedNominalContribution);

  let successCount = 0;
  const finalAssets = [];
  const retirementPaths = [];
  const depletionAges = [];
  const maxDrawdowns = [];

  for (let run = 0; run < runs; run++) {
    let asset = startingAssets;
    let cumulativeInflation = 1;
    let inflationIndex = 1;
    const inflationByAge = { [currentAge]: 1 };

    for (let age = currentAge + 1; age <= lifeExpectancy; age++) {
      const inf = mc.mcRandomInflation
        ? clamp(inflationBase + randomNormal() * inflationVol, -0.02, 0.12)
        : inflationBase;

      inflationIndex *= 1 + inf;
      inflationByAge[age] = inflationIndex;
    }

    const eventSchedule = buildRandomizedEventSchedule(
      goals,
      incomes,
      currentAge,
      lifeExpectancy,
      inflationByAge
    );

    for (let age = currentAge; age < retireAge; age++) {
      const yearlyInflation =
        inflationByAge[age + 1] && inflationByAge[age]
          ? inflationByAge[age + 1] / inflationByAge[age] - 1
          : inflationBase;

      cumulativeInflation *= 1 + yearlyInflation;

      let sampledPreNominal = clamp(
        meanPreReturn + drawFatTailShock(volatility, fatTailDf),
        -0.95,
        1.2
      );

      if (Math.random() < preCrashProb) {
        sampledPreNominal = Math.min(sampledPreNominal, -0.3 - Math.random() * 0.2);
      }

      const sampledPreReal = (1 + sampledPreNominal) / (1 + yearlyInflation) - 1;
      const actualContribution = isFixedNominalContribution
        ? (baseMonthlyContribution * 12) / cumulativeInflation
        : baseMonthlyContribution * 12;

      asset = asset * (1 + sampledPreReal) + actualContribution + Number(eventSchedule[age + 1] || 0);
    }

    let success = true;
    let depletionAge = null;
    const retirementStartAsset = Math.max(0, asset);
    let currentDiscretionarySpend = data.expensePlan.discretionary * 12;

    const retirementPath = [{ age: retireAge, value: Math.max(0, asset) }];

    const baseLivingSpend = (data.expensePlan.essential + data.expensePlan.discretionary) * 12;
    const spendFloor = baseLivingSpend * clamp(mc.mcSpendingFloor ?? 0.85, 0, 1.5);
    const spendCeiling = baseLivingSpend * clamp(mc.mcSpendingCeiling ?? 1.1, 0.5, 3);

    for (let age = retireAge; age < lifeExpectancy; age++) {
      const nextAge = age + 1;
      const startAsset = Math.max(0, asset);
      if (startAsset <= 0) {
        success = false;
        if (depletionAge === null) depletionAge = age;
      }

      const yearlyInflation =
        inflationByAge[nextAge] && inflationByAge[age]
          ? inflationByAge[nextAge] / inflationByAge[age] - 1
          : inflationBase;

      let sampledPostNominal = clamp(
        meanPostReturn + drawFatTailShock(volatility * 0.7, fatTailDf),
        -0.95,
        0.9
      );

      if (Math.random() < postCrashProb) {
        sampledPostNominal = Math.min(sampledPostNominal, -0.2 - Math.random() * 0.3);
      }

      const sampledPostReal = (1 + sampledPostNominal) / (1 + yearlyInflation) - 1;
      const spend = getRetirementSpendBreakdown(data, age, {
        asset: startAsset,
        retirementStartAsset,
        currentDiscretionarySpend
      });
      currentDiscretionarySpend = spend.discretionary;

      let targetSpendReal = spend.total;
      if (mc.mcFlexibleSpending) {
        if (startAsset < targetSpendReal * 8) {
          targetSpendReal = Math.max(spendFloor, targetSpendReal * 0.96);
        } else if (startAsset > targetSpendReal * 25) {
          targetSpendReal = Math.min(spendCeiling, targetSpendReal * 1.02);
        }
      }

      asset = startAsset * (1 + sampledPostReal) - targetSpendReal + Number(eventSchedule[nextAge] || 0);

      if (asset < 0) {
        asset = 0;
        success = false;
        if (depletionAge === null) depletionAge = nextAge;
      }

      retirementPath.push({ age: nextAge, value: asset });
    }

    maxDrawdowns.push(calcPathMaxDrawdown(retirementPath));
    if (success) successCount++;
    finalAssets.push(asset);
    retirementPaths.push(retirementPath);
    depletionAges.push(depletionAge);
  }

  finalAssets.sort((left, right) => left - right);
  maxDrawdowns.sort((left, right) => left - right);

  const percentileSeries = [];
  for (let i = 0; i <= retirementYears; i++) {
    const age = retireAge + i;
    const valuesAtAge = retirementPaths
      .map((path) => path[i]?.value ?? 0)
      .sort((left, right) => left - right);

    percentileSeries.push({
      age,
      p10: percentile(valuesAtAge, 0.1),
      p50: percentile(valuesAtAge, 0.5),
      p90: percentile(valuesAtAge, 0.9)
    });
  }

  const depletionList = depletionAges
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return {
    successRate: (successCount / runs) * 100,
    p10: percentile(finalAssets, 0.1),
    p50: percentile(finalAssets, 0.5),
    p90: percentile(finalAssets, 0.9),
    percentileSeries,
    medianDepletionAge: depletionList.length ? percentile(depletionList, 0.5) : null,
    medianMaxDrawdown: percentile(maxDrawdowns, 0.5),
    worst10MaxDrawdown: percentile(maxDrawdowns, 0.9),
    assumptions: {
      contributionModel: isFixedNominalContribution
        ? "Fixed Nominal"
        : "Fixed Real",
      fatTail: "Student-t df=6",
      preCrashProb,
      postCrashProb
    }
  };
}
