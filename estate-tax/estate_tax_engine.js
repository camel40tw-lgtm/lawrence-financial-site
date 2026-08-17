(function (global) {
  "use strict";

  const RULE_VERSION = "tw-estate-tax-115-v1.0";
  const RULE_YEAR_LABEL = "115 年度（西元 2026 年）";
  const UPDATED_AT = "2026-08-09";
  const NTD = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

  const RULES_115 = Object.freeze({
    exemption: 13330000,
    deductionSpouse: 5530000,
    deductionLineal: 560000,
    deductionParent: 1380000,
    deductionDisabled: 6930000,
    deductionDependentSiblingGrandparent: 560000,
    deductionFuneral: 1380000,
    excludedDailyNecessitiesCap: 1000000,
    excludedWorkToolsCap: 560000,
    brackets: [
      { ceiling: 50000000, base: 0, floor: 0, rate: 0.1, label: "5,000 萬元以下，適用 10%" },
      { ceiling: 100000000, base: 5000000, floor: 50000000, rate: 0.15, label: "超過 5,000 萬至 1 億元，超過部分適用 15%" },
      { ceiling: Infinity, base: 12500000, floor: 100000000, rate: 0.2, label: "超過 1 億元，超過部分適用 20%" },
    ],
  });

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function toNonNegative(value) {
    return Math.max(0, toNumber(value));
  }

  function money(value) {
    return `NT$ ${NTD.format(Math.round(toNumber(value)))}`;
  }

  function percent(value) {
    return `${Math.round(toNumber(value) * 100)}%`;
  }

  function parseDateOnly(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function compareDate(a, b) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  }

  function resolveRuleSet(deathDateValue) {
    const deathDate = parseDateOnly(deathDateValue);
    if (!deathDate) {
      return {
        ruleSet: RULES_115,
        deathDate,
        label: RULE_YEAR_LABEL,
        warnings: ["請輸入死亡日／繼承事實發生日；目前暫以 115 年度規則試算。"],
      };
    }
    if (compareDate(deathDate, { year: 2026, month: 1, day: 1 }) < 0) {
      return {
        ruleSet: RULES_115,
        deathDate,
        label: RULE_YEAR_LABEL,
        warnings: ["目前頁面只內建 115 年度（2026 年）公告金額；死亡日早於 2026-01-01 時，請改用該年度正式公告金額覆核。"],
      };
    }
    return { ruleSet: RULES_115, deathDate, label: RULE_YEAR_LABEL, warnings: [] };
  }

  function validate(input) {
    const errors = [];
    const warnings = [];
    const numericFields = [
      ["grossEstate", "遺產總額"],
      ["dailyNecessitiesValue", "日常生活器具及用具總值"],
      ["workToolsValue", "職業上工具總值"],
      ["spouseCount", "配偶人數"],
      ["linealDescCount", "直系血親卑親屬人數"],
      ["linealMinorExtraYears", "未成年卑親屬距成年年數合計"],
      ["parentCount", "父母人數"],
      ["disabledCount", "重度以上身心障礙特別扣除人數"],
      ["dependentSiblingGrandparentCount", "受扶養兄弟姊妹及祖父母人數"],
      ["dependentSiblingMinorExtraYears", "未成年受扶養兄弟姊妹距成年年數合計"],
    ];
    numericFields.forEach(([key, label]) => {
      if (toNumber(input[key]) < 0) errors.push(`${label}不可小於 0。`);
    });
    if (toNumber(input.grossEstate) <= 0) warnings.push("遺產總額為 0 或尚未輸入時，試算稅額會顯示為 0。");
    if (toNumber(input.spouseCount) > 1) warnings.push("配偶扣除額通常以 0 或 1 人計算，請確認輸入是否合理。");
    if (toNumber(input.parentCount) > 2) warnings.push("父母扣除額通常最多 2 人，請確認輸入是否合理。");
    return { errors, warnings };
  }

  function calculateEstateTax(netEstate, ruleSet = RULES_115) {
    const net = toNonNegative(netEstate);
    const bracket = ruleSet.brackets.find((item) => net <= item.ceiling) || ruleSet.brackets[ruleSet.brackets.length - 1];
    const tax = bracket.base + Math.max(0, net - bracket.floor) * bracket.rate;
    return { tax, bracket };
  }

  function getAdvancedReasons(input) {
    const labels = {
      debts: "需扣除債務、稅捐或未償費用",
      spouseRemainder: "配偶剩餘財產差額分配",
      farmland: "農地或公共設施保留地等特別規定",
      insurance: "保險給付是否計入遺產",
      overseas: "境外財產或非居住者情境",
      trust: "信託、閉鎖公司或股權估值",
      dispute: "繼承人資格、遺產範圍或訴訟爭議",
    };
    return (input.advancedFlags || []).map((key) => labels[key] || key);
  }

  function calculate(input) {
    const version = resolveRuleSet(input.deathDate);
    const ruleSet = version.ruleSet;
    const validation = validate(input);

    const grossEstate = toNonNegative(input.grossEstate);
    const dailyNecessitiesValue = toNonNegative(input.dailyNecessitiesValue);
    const workToolsValue = toNonNegative(input.workToolsValue);
    const excludedDailyNecessities = Math.min(dailyNecessitiesValue, ruleSet.excludedDailyNecessitiesCap);
    const excludedWorkTools = Math.min(workToolsValue, ruleSet.excludedWorkToolsCap);
    const excludedTotal = excludedDailyNecessities + excludedWorkTools;

    const spouseCount = toNonNegative(input.spouseCount);
    const linealDescCount = toNonNegative(input.linealDescCount);
    const linealMinorExtraYears = toNonNegative(input.linealMinorExtraYears);
    const parentCount = toNonNegative(input.parentCount);
    const disabledCount = toNonNegative(input.disabledCount);
    const dependentSiblingGrandparentCount = toNonNegative(input.dependentSiblingGrandparentCount);
    const dependentSiblingMinorExtraYears = toNonNegative(input.dependentSiblingMinorExtraYears);

    const deductions = {
      spouse: spouseCount * ruleSet.deductionSpouse,
      lineal: linealDescCount * ruleSet.deductionLineal,
      linealMinor: linealMinorExtraYears * ruleSet.deductionLineal,
      parent: parentCount * ruleSet.deductionParent,
      disabled: disabledCount * ruleSet.deductionDisabled,
      dependentSiblingGrandparent: dependentSiblingGrandparentCount * ruleSet.deductionDependentSiblingGrandparent,
      dependentSiblingMinor: dependentSiblingMinorExtraYears * ruleSet.deductionDependentSiblingGrandparent,
      funeral: input.funeralDeductionEnabled ? ruleSet.deductionFuneral : 0,
    };
    const deductionsTotal = Object.values(deductions).reduce((sum, value) => sum + value, 0);
    const netEstateBeforeFloor = grossEstate - excludedTotal - deductionsTotal - ruleSet.exemption;
    const netEstate = Math.max(0, netEstateBeforeFloor);
    const taxResult = calculateEstateTax(netEstate, ruleSet);
    const advancedReasons = getAdvancedReasons(input);

    const warnings = [...version.warnings, ...validation.warnings];
    if (dailyNecessitiesValue > ruleSet.excludedDailyNecessitiesCap) {
      warnings.push("日常生活器具及用具已超過法定不計入上限，本工具只排除 100 萬元。");
    }
    if (workToolsValue > ruleSet.excludedWorkToolsCap) {
      warnings.push("職業上工具已超過法定不計入上限，本工具只排除 56 萬元。");
    }
    if (advancedReasons.length) {
      warnings.push("本案勾選進階情境，結果只能作概念性參考，正式申報前需進一步覆核。");
    }

    return {
      ruleVersion: RULE_VERSION,
      ruleYearLabel: version.label,
      updatedAt: UPDATED_AT,
      ruleSet,
      errors: validation.errors,
      warnings,
      advancedReasons,
      advancedReviewRequired: advancedReasons.length > 0 || version.warnings.length > 0,
      grossEstate,
      dailyNecessitiesValue,
      workToolsValue,
      excludedDailyNecessities,
      excludedWorkTools,
      excludedTotal,
      deductions,
      deductionsTotal,
      exemption: ruleSet.exemption,
      netEstateBeforeFloor,
      netEstate,
      bracket: taxResult.bracket,
      estateTax: taxResult.tax,
      effectiveRate: grossEstate > 0 ? taxResult.tax / grossEstate : 0,
      format: { money, percent },
    };
  }

  global.EstateTaxEngine = {
    RULE_VERSION,
    UPDATED_AT,
    RULES_115,
    calculate,
    calculateEstateTax,
    parseDateOnly,
    compareDate,
    money,
    percent,
  };
})(window);
