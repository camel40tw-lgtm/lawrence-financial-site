(function (global) {
  "use strict";

  const RULE_VERSION = "house-land-tax-v1.1";
  const NTD = new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: 0,
  });

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    return `NT$ ${NTD.format(Math.round(toNumber(value)))}`;
  }

  function percent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function parseDateOnly(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function anniversary(date, years) {
    const targetYear = date.year + years;
    if (date.month === 2 && date.day === 29 && !isLeapYear(targetYear)) {
      return { year: targetYear, month: 2, day: 28 };
    }
    return { year: targetYear, month: date.month, day: date.day };
  }

  function compareDate(a, b) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  }

  function addDays(date, days) {
    const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
    d.setUTCDate(d.getUTCDate() + days);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }

  function formatDate(date) {
    if (!date) return "—";
    return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  }

  function getResidentTaxRate(acquisitionDate, transferDate) {
    if (!acquisitionDate || !transferDate) {
      return { rate: null, bracket: "資料不足", label: "—" };
    }
    if (compareDate(transferDate, anniversary(acquisitionDate, 2)) <= 0) {
      return { rate: 0.45, bracket: "within_2_years", label: "2 年以內，適用 45%" };
    }
    if (compareDate(transferDate, anniversary(acquisitionDate, 5)) <= 0) {
      return { rate: 0.35, bracket: "over_2_within_5", label: "超過 2 年、未逾 5 年，適用 35%" };
    }
    if (compareDate(transferDate, anniversary(acquisitionDate, 10)) <= 0) {
      return { rate: 0.2, bracket: "over_5_within_10", label: "超過 5 年、未逾 10 年，適用 20%" };
    }
    return { rate: 0.15, bracket: "over_10", label: "超過 10 年，適用 15%" };
  }

  function calculateHoldingLabel(acquisitionDate, transferDate) {
    if (!acquisitionDate || !transferDate) return "—";
    let years = transferDate.year - acquisitionDate.year;
    let months = transferDate.month - acquisitionDate.month;
    let days = transferDate.day - acquisitionDate.day;
    if (days < 0) {
      months -= 1;
      const prevMonth = transferDate.month === 1 ? 12 : transferDate.month - 1;
      const prevMonthYear = transferDate.month === 1 ? transferDate.year - 1 : transferDate.year;
      const lastDayPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate();
      days += lastDayPrevMonth;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return `${Math.max(years, 0)} 年 ${Math.max(months, 0)} 個月 ${Math.max(days, 0)} 日`;
  }

  function getAdvancedReasons(input, dates) {
    const reasons = [];
    if (!input.isIndividual) reasons.push("非自然人案件");
    if (!input.isResident) reasons.push("非中華民國境內居住者");
    if (!["house_land", "house_only", "land_only"].includes(input.assetType)) reasons.push("標的類型非一般房地");
    if (input.acquisitionMethod !== "purchase") reasons.push("取得方式非一般買賣");
    if ((input.specialScenarios || []).length > 0) reasons.push("涉及特殊情境");
    if (!input.datesAreRegistrationDates) reasons.push("日期非所有權移轉登記日");
    if (dates.acquisitionDate && compareDate(dates.acquisitionDate, { year: 2016, month: 1, day: 1 }) < 0) {
      reasons.push("105 年以前取得，可能涉及舊制或過渡規定");
    }
    return reasons;
  }

  function validate(input) {
    const errors = [];
    const warnings = [];
    const acquisitionDate = parseDateOnly(input.acquisitionDate);
    const transferDate = parseDateOnly(input.transferDate);

    if (!acquisitionDate) errors.push("請輸入取得日。");
    if (!transferDate) errors.push("請輸入交易日。");
    if (acquisitionDate && transferDate && compareDate(transferDate, acquisitionDate) < 0) {
      errors.push("交易日不可早於取得日。");
    }
    if (acquisitionDate && compareDate(acquisitionDate, { year: 2016, month: 1, day: 1 }) < 0) {
      warnings.push("105 年以前取得的房地可能涉及舊制或過渡適用條件，本工具將標示為需進階覆核。");
    }

    const numericFields = [
      ["salePrice", "出售成交價額"],
      ["acquisitionCost", "原始取得成本"],
      ["purchaseRelatedCosts", "取得附帶成本"],
      ["improvementCosts", "改良／增置成本"],
      ["transferExpenses", "移轉費用"],
      ["landValueIncrementTotal", "土地漲價總數額"],
      ["currentAssessedLandValue", "交易當年度公告土地現值"],
      ["previousTransferValue", "前次移轉現值"],
      ["landValueIncrementTaxPaid", "已納土地增值稅"],
      ["excessLandValueIncrementTaxPaid", "超限部分對應之土地增值稅"],
    ];

    numericFields.forEach(([key, label]) => {
      if (toNumber(input[key]) < 0) errors.push(`${label}不可小於 0。`);
    });
    if (toNumber(input.salePrice) <= 0) errors.push("成交價額需大於 0 才能試算。");
    if (toNumber(input.acquisitionCost) === 0) warnings.push("原始取得成本為 0 時，結果可能嚴重失真；若無法舉證成本，需進階判斷。");

    return { errors, warnings, acquisitionDate, transferDate };
  }

  function calculate(input) {
    const validation = validate(input);
    const acquisitionDate = validation.acquisitionDate;
    const transferDate = validation.transferDate;
    const taxRate = getResidentTaxRate(acquisitionDate, transferDate);
    const advancedReasons = getAdvancedReasons(input, { acquisitionDate, transferDate });

    const salePrice = toNumber(input.salePrice);
    const acquisitionCost = toNumber(input.acquisitionCost);
    const purchaseRelatedCosts = toNumber(input.purchaseRelatedCosts);
    const improvementCosts = toNumber(input.improvementCosts);
    const transferExpenses = toNumber(input.transferExpenses);
    const baseExpenses = purchaseRelatedCosts + improvementCosts + transferExpenses;
    const standardExpense = Math.min(salePrice * 0.03, 300000);
    const recognizedBaseExpenses = input.canProvideExpenseEvidence ? baseExpenses : standardExpense;

    const landValueIncrementTotal = toNumber(input.landValueIncrementTotal);
    const currentAssessedLandValue = toNumber(input.currentAssessedLandValue);
    const previousTransferValue = toNumber(input.previousTransferValue);
    const landValueIncrementTaxPaid = toNumber(input.landValueIncrementTaxPaid);
    const landDeductionCap = Math.max(currentAssessedLandValue - previousTransferValue, 0);
    const recognizedLandDeduction = Math.min(landValueIncrementTotal, landDeductionCap);
    const excessLandValueIncrement = Math.max(landValueIncrementTotal - recognizedLandDeduction, 0);
    const excessLandValueIncrementTaxPaid = toNumber(input.excessLandValueIncrementTaxPaid);

    const warnings = [...validation.warnings];
    const errors = [...validation.errors];
    if (!input.canProvideExpenseEvidence && baseExpenses > 0) {
      warnings.push("你目前聲明無法提示成本費用憑證，本工具採 3%／最高 30 萬元概算，已輸入的實際費用不會加總計入。");
    }
    if (input.canProvideExpenseEvidence && baseExpenses < standardExpense) {
      warnings.push("實際可認列費用低於 3%／30 萬概算；是否能採概算仍以申報規定與個案查核為準。");
    }
    if (currentAssessedLandValue < previousTransferValue) {
      warnings.push("交易當年度公告土地現值低於前次移轉現值，法定減除上限將以 0 計算。");
    }
    if (landValueIncrementTaxPaid > 0) {
      warnings.push("已納土地增值稅僅作參考，不會自動全額列為房地合一稅的扣除額或費用。");
    }
    if (excessLandValueIncrementTaxPaid > landValueIncrementTaxPaid) {
      errors.push("超限土地漲價總數額對應之土地增值稅不可大於已納土地增值稅。");
    }
    if (excessLandValueIncrement === 0 && excessLandValueIncrementTaxPaid > 0) {
      errors.push("本案土地漲價總數額未超過法定減除上限，不應填入超限部分對應之土地增值稅。");
    }
    if (landValueIncrementTotal > landDeductionCap) {
      warnings.push("土地漲價總數額超過法定減除上限，本工具將以較低的法定上限作為實際扣除額。");
    }

    const selfUseEligible = Boolean(
      input.checkSelfUseBenefit &&
      input.selfUseRegistered &&
      input.selfUseSixYears &&
      input.selfUseNoRental &&
      input.selfUseNoBusiness &&
      input.selfUseNotUsedBefore
    );

    const recognizedExpenses = recognizedBaseExpenses + excessLandValueIncrementTaxPaid;
    const realEstateTransactionIncome = salePrice - acquisitionCost - recognizedExpenses;
    const taxableIncomeBeforeFloor = realEstateTransactionIncome - recognizedLandDeduction;
    const taxableIncome = Math.max(taxableIncomeBeforeFloor, 0);
    const generalEstimatedTax = taxRate.rate == null ? 0 : taxableIncome * taxRate.rate;
    const selfUseEstimatedTax = selfUseEligible ? Math.max(taxableIncome - 4000000, 0) * 0.1 : null;
    const estimatedTax = selfUseEligible ? selfUseEstimatedTax : generalEstimatedTax;
    const filingDueDate = transferDate ? addDays(transferDate, 30) : null;

    return {
      ruleVersion: RULE_VERSION,
      errors,
      warnings,
      advancedReasons,
      advancedReviewRequired: advancedReasons.length > 0,
      holdingYearsLabel: calculateHoldingLabel(acquisitionDate, transferDate),
      holdingBracket: taxRate.bracket,
      generalTaxRate: taxRate.rate,
      generalTaxRateLabel: taxRate.label,
      filingDueDate: formatDate(filingDueDate),
      baseExpenses,
      standardExpense,
      recognizedBaseExpenses,
      landDeductionCap,
      recognizedLandDeduction,
      excessLandValueIncrement,
      recognizedExpenses,
      realEstateTransactionIncome,
      taxableIncomeBeforeFloor,
      taxableIncome,
      generalEstimatedTax,
      selfUseEligible,
      selfUseEstimatedTax,
      estimatedTax,
      format: { money, percent },
    };
  }

  global.HouseLandTaxEngine = {
    RULE_VERSION,
    parseDateOnly,
    anniversary,
    compareDate,
    calculate,
    money,
    percent,
  };
})(window);

