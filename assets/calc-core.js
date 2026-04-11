/* =========================
   工具函式
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

/* =========================
   隨機分布（Fat Tail）
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
  const scale = Math.sqrt(df / (df - 2)); // df>2 時變異數標準化
  return (raw / scale) * vol;
}

/* =========================
   事件流（沿用現有系統）
========================= */

function buildDetailedEventSchedule(goals, incomes, currentAge, lifeExpectancy, inflationByAge) {
  const schedule = {};
  const details = {};
  for (let age = currentAge; age <= lifeExpectancy; age++) {
    schedule[age] = 0;
    details[age] = [];
  }

  (goals || []).forEach((g) => {
    if (!g.type || !Number.isFinite(g.age) || !Number.isFinite(g.amount)) return;
    const iterations = g.type === "lump" ? 1 : Number(g.years || 0);
    for (let k = 0; k < iterations; k++) {
      const age = g.type === "lump" ? g.age : g.age + k;
      if (schedule[age] === undefined) continue;
      const amount = g.type === "monthly" ? g.amount * 12 : g.amount;
      const factor = g.inflation ? (inflationByAge[age] || 1) : 1;
      const adjustedAmount = amount * factor;
      schedule[age] -= adjustedAmount;
      details[age].push({
        kind: "goal",
        direction: "outflow",
        name: g.name || "",
        type: g.type,
        years: iterations,
        inflationAdjusted: g.inflation !== false,
        baseAmount: amount,
        nominalAmount: adjustedAmount,
        amount: adjustedAmount
      });
    }
  });

  (incomes || []).forEach((i) => {
    if (!i.type || !Number.isFinite(i.age) || !Number.isFinite(i.amount)) return;
    const iterations = i.type === "lump" ? 1 : Number(i.years || 0);
    for (let k = 0; k < iterations; k++) {
      const age = i.type === "lump" ? i.age : i.age + k;
      if (schedule[age] === undefined) continue;
      const amount = i.type === "monthly" ? i.amount * 12 : i.amount;
      const factor = i.inflation ? (inflationByAge[age] || 1) : 1;
      const adjustedAmount = amount * factor;
      schedule[age] += adjustedAmount;
      details[age].push({
        kind: "income",
        direction: "inflow",
        name: i.name || "",
        type: i.type,
        years: iterations,
        inflationAdjusted: i.inflation !== false,
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

/* =========================
   LTC 參數
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
    startAge: Number(profile?.startAge ?? base.startAge),
    durationYears: Number(profile?.durationYears ?? base.durationYears),
    extraCostFactor: Number(profile?.extraCostFactor ?? base.extraCostFactor)
  };
}

/* =========================
   醫療 / LTC
========================= */

function getMedicalAgeLoad(age) {
  if (age >= 85) return 2.0;
  if (age >= 75) return 1.5;
  return 1;
}

// 只計算 LTC 相對於一般醫療成本的「額外溢價」
function getLtcPremiumCost(age, currentBaseMedicalCost, ltcProfile) {
  const profile = normalizeLtcProfile(ltcProfile);
  if (!profile.enabled) return 0;
  if (age < profile.startAge || age >= profile.startAge + profile.durationYears) return 0;

  const premiumFactor = Math.max(0, profile.extraCostFactor - 1);
  return currentBaseMedicalCost * premiumFactor;
}

/* =========================
   最大回撤
========================= */

function calcPathMaxDrawdown(path) {
  if (!Array.isArray(path) || !path.length) return 0;

  let peak = path[0]?.value ?? 0;
  let maxDrawdown = 0;

  for (const point of path) {
    const value = point?.value ?? 0;

    // CFP 角度：退休資產歸零視為 100% 財富回撤
    if (value <= 0 && peak > 0) return 1;

    peak = Math.max(peak, value);
    if (peak <= 0) continue;

    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

/* =========================
   Monte Carlo 主引擎（ABC 融合版）
========================= */

function runMonteCarlo(formData) {
  const mc = formData.monteCarloOptions || {};
  if (!mc.mcEnabled) return null;

  const currentAge = Number(formData.currentAge);
  const retireAge = Number(formData.retireAge);
  const lifeExpectancy = Number(formData.lifeExpectancy);

  const startingAssets = Number(formData.assets);
  const baseMonthlyContribution = Number(formData.contribution);

  const monthlyExpense = Number(formData.expense);
  const monthlyPension = Number(formData.pension);
  const monthlyMedicalExpense = Number(formData.monthlyMedicalExpense ?? 0);

  const meanPreReturn = Number(formData.returnRate) / 100;
  const meanPostReturn = Number(formData.postReturnRate) / 100;

  const inflationBase = Number(formData.inflationRate) / 100;
  const medicalInflation = Number(formData.medicalInflationRate ?? 5) / 100;

  const goals = formData.goals || [];
  const incomes = formData.incomes || [];
  const ltcProfile = normalizeLtcProfile(formData.ltcProfile);

  const retirementYears = Math.max(0, lifeExpectancy - retireAge);
  const runs = Math.max(100, Number(mc.mcRuns || 500));
  const volatility = Math.max(0, Number(mc.mcVolatility || 0.12));
  const inflationVol = mc.mcRandomInflation
    ? Math.max(0, Number(mc.mcInflationVolatility || 0.012))
    : 0;

  const fatTailDf = 6;

  // 比前版合理：退休後預設 crash 機率低於退休前
  const preCrashProb = Number(mc.preCrashProb ?? 0.015);
  const postCrashProb = Number(mc.postCrashProb ?? 0.010);

  // false = 固定實質提撥；true = 固定名目提撥（其實質購買力隨通膨下降）
  const isFixedNominalContribution = !!mc.fixedNominalContribution;

  // 醫療通膨相對於一般通膨的「實質溢價」
  const realMedicalInflation = (1 + medicalInflation) / (1 + inflationBase) - 1;

  let successCount = 0;
  const finalAssets = [];
  const retirementPaths = [];
  const depletionAges = [];
  const maxDrawdowns = [];

  for (let run = 0; run < runs; run++) {
    let asset = startingAssets;
    let cumulativeInflation = 1;

    // 用來處理事件通膨
    let livingInflationIndex = 1;
    const inflationByAge = { [currentAge]: 1 };

    for (let age = currentAge + 1; age <= lifeExpectancy; age++) {
      const inf = mc.mcRandomInflation
        ? clamp(inflationBase + randomNormal() * inflationVol, -0.02, 0.12)
        : inflationBase;

      livingInflationIndex *= (1 + inf);
      inflationByAge[age] = livingInflationIndex;
    }

    const eventSchedule = buildRandomizedEventSchedule(
      goals,
      incomes,
      currentAge,
      lifeExpectancy,
      inflationByAge
    );

    /* ---------- 退休前 ---------- */
    for (let age = currentAge; age < retireAge; age++) {
      const yearlyInflation =
        inflationByAge[age + 1] && inflationByAge[age]
          ? inflationByAge[age + 1] / inflationByAge[age] - 1
          : inflationBase;

      cumulativeInflation *= (1 + yearlyInflation);

      let sampledPreNominal = clamp(
        meanPreReturn + drawFatTailShock(volatility, fatTailDf),
        -0.95,
        1.2
      );

      if (Math.random() < preCrashProb) {
        sampledPreNominal = Math.min(sampledPreNominal, -0.3 - Math.random() * 0.2);
      }

      const sampledPreReal =
        (1 + sampledPreNominal) / (1 + yearlyInflation) - 1;

      const actualContributionReal = isFixedNominalContribution
        ? (baseMonthlyContribution * 12) / cumulativeInflation
        : (baseMonthlyContribution * 12);

      asset = asset * (1 + sampledPreReal) + actualContributionReal;
      asset += Number(eventSchedule[age + 1] || 0);
    }

    /* ---------- 退休後 ---------- */
    let success = true;
    let depletionAge = null;

    const retirementPath = [
      { age: retireAge, value: Math.max(0, asset) }
    ];

    let currentSpendReal = Math.max(0, monthlyExpense - monthlyPension) * 12;
    const spendFloor = currentSpendReal * clamp(mc.mcSpendingFloor ?? 0.85, 0, 1.5);
    const spendCeiling = currentSpendReal * clamp(mc.mcSpendingCeiling ?? 1.10, 0.5, 3);

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

      const sampledPostReal =
        (1 + sampledPostNominal) / (1 + yearlyInflation) - 1;

      // 實質模型：一般生活費購買力固定
      const livingCostReal = Math.max(0, monthlyExpense - monthlyPension) * 12;

      // 醫療費只成長「超過一般通膨的溢價」
      const yearsFromNow = Math.max(0, age - currentAge);
      const baseMedicalCostReal =
        monthlyMedicalExpense *
        12 *
        Math.pow(1 + realMedicalInflation, yearsFromNow) *
        getMedicalAgeLoad(age);

      // LTC 只加額外溢價，避免雙重計費
      const ltcPremiumReal = getLtcPremiumCost(age, baseMedicalCostReal, ltcProfile);

      const targetSpendReal =
        livingCostReal +
        baseMedicalCostReal +
        ltcPremiumReal;

      if (mc.mcFlexibleSpending) {
        if (asset < targetSpendReal * 8) {
          currentSpendReal = Math.max(
            spendFloor,
            Math.min(targetSpendReal, currentSpendReal * 0.96)
          );
        } else if (asset > targetSpendReal * 25) {
          currentSpendReal = Math.min(
            spendCeiling,
            Math.max(targetSpendReal, currentSpendReal * 1.02)
          );
        } else {
          currentSpendReal = targetSpendReal;
        }
      } else {
        currentSpendReal = targetSpendReal;
      }

      asset = startAsset * (1 + sampledPostReal);
      asset -= currentSpendReal;
      // Match accumulation timing so age N values include events scheduled at age N.
      asset += Number(eventSchedule[nextAge] || 0);

      if (asset < 0) {
        asset = 0;
        success = false;
        if (depletionAge === null) depletionAge = nextAge;
      }

      retirementPath.push({ age: nextAge, value: asset });
    }

    const pathMaxDrawdown = calcPathMaxDrawdown(retirementPath);
    maxDrawdowns.push(pathMaxDrawdown);

    if (success) successCount++;
    finalAssets.push(asset);
    retirementPaths.push(retirementPath);
    depletionAges.push(depletionAge);
  }

  finalAssets.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const percentileSeries = [];
  for (let i = 0; i <= retirementYears; i++) {
    const age = retireAge + i;
    const valuesAtAge = retirementPaths
      .map(path => path[i]?.value ?? 0)
      .sort((a, b) => a - b);

    percentileSeries.push({
      age,
      p10: percentile(valuesAtAge, 0.1),
      p50: percentile(valuesAtAge, 0.5),
      p90: percentile(valuesAtAge, 0.9)
    });
  }

  const depletionList = depletionAges
    .filter(v => Number.isFinite(v))
    .sort((a, b) => a - b);

  const medianDepletionAge = depletionList.length
    ? percentile(depletionList, 0.5)
    : null;

  return {
    successRate: (successCount / runs) * 100,
    p10: percentile(finalAssets, 0.1),
    p50: percentile(finalAssets, 0.5),
    p90: percentile(finalAssets, 0.9),
    percentileSeries,
    medianDepletionAge,
    medianMaxDrawdown: percentile(maxDrawdowns, 0.5),
    worst10MaxDrawdown: percentile(maxDrawdowns, 0.9),
    assumptions: {
      contributionModel: isFixedNominalContribution
        ? "Fixed Nominal (Purchasing Power Decays)"
        : "Fixed Real (Scales with Inflation)",
      fatTail: "Student-t df=6",
      preCrashProb,
      postCrashProb
    }
  };
}
