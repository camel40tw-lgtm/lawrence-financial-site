(function () {
  const U = window.SharedFinanceUtilsV1;

  function formatSignedCurrency(value) {
    const amount = U.toFiniteNumber(value, 0);
    const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `${sign}${U.formatCurrency(Math.abs(amount))}`;
  }

  function getStatus(value, goodThreshold, warnThreshold, reverse = false) {
    if (!reverse) {
      if (value >= goodThreshold) return "good";
      if (value >= warnThreshold) return "warn";
      return "bad";
    }

    if (value <= goodThreshold) return "good";
    if (value <= warnThreshold) return "warn";
    return "bad";
  }

  function buildHealthCheckCards(snapshot) {
    return [
      {
        id: "saving_rate",
        label: "儲蓄率",
        value_text: U.formatPercent(snapshot.saving_rate, 1),
        status: getStatus(snapshot.saving_rate, 0.2, 0.1, false),
        help_text: "收入扣完稅、保費、支出與債務後，還能留下多少自然淨餘。"
      },
      {
        id: "passive_cover",
        label: "被動收入覆蓋率",
        value_text: U.formatPercent(snapshot.passive_income_cover_ratio, 1),
        status: getStatus(snapshot.passive_income_cover_ratio, 0.5, 0.2, false),
        help_text: "不工作時，靠租金、股利、利息與制度給付能先覆蓋多少支出。"
      },
      {
        id: "debt_service",
        label: "債務服務比",
        value_text: U.formatPercent(snapshot.debt_service_ratio, 1),
        status: getStatus(snapshot.debt_service_ratio, 0.2, 0.35, true),
        help_text: "家庭收入有多少比例先被房貸或其他貸款月付占用。"
      },
      {
        id: "liquidity_months",
        label: "流動性月數",
        value_text: `${U.toFiniteNumber(snapshot.liquidity_months, 0).toFixed(1)} 個月`,
        status: getStatus(snapshot.liquidity_months, 12, 6, false),
        help_text: "若收入中斷，現金資產能先撐多久。"
      }
    ];
  }

  function buildOverrideText(snapshot, normalizedPlan) {
    const enabled = normalizedPlan?.inputs?.useManualContributionOverride === true;
    const investableSurplus = U.toFiniteNumber(snapshot.annual_investable_surplus, 0);
    const naturalSurplus = U.toFiniteNumber(snapshot.annual_surplus_before_override, 0);
    const gap = U.toFiniteNumber(snapshot.manual_override_gap, 0);

    if (!enabled) {
      return {
        override_status_text: "未啟用，系統採自然淨餘作為年度投入",
        manual_override_gap_text: "未啟用",
        override_help_text: `本期自然年度淨餘為 ${U.formatCurrency(naturalSurplus)}，系統直接視為年度可投資金額。`
      };
    }

    const directionText = gap > 0
      ? "代表你假設另外補入資金"
      : gap < 0
        ? "代表你假設保留部分盈餘不投入"
        : "代表手動校正值剛好等於自然淨餘";

    return {
      override_status_text: `已啟用，年度投入改採手動校正值 ${U.formatCurrency(investableSurplus)}`,
      manual_override_gap_text: formatSignedCurrency(gap),
      override_help_text: `自然淨餘 ${U.formatCurrency(naturalSurplus)}，手動校正後改採 ${U.formatCurrency(investableSurplus)}，${directionText}。`
    };
  }

  function buildCashflowLogicLines(snapshot, normalizedPlan) {
    const annualIncome = U.toFiniteNumber(snapshot.annual_income_total, 0);
    const annualTax = U.toFiniteNumber(snapshot.annual_tax_total, 0);
    const annualPremium = U.toFiniteNumber(snapshot.annual_premium_total, 0);
    const annualDebt = U.toFiniteNumber(snapshot.annual_debt_service_total, 0);
    const annualExpense = U.toFiniteNumber(snapshot.annual_expense_total, 0);
    const regularExpense = Math.max(0, annualExpense - annualPremium);
    const naturalSurplus = U.toFiniteNumber(snapshot.annual_surplus_before_override, 0);
    const investableSurplus = U.toFiniteNumber(snapshot.annual_investable_surplus, 0);
    const overrideEnabled = normalizedPlan?.inputs?.useManualContributionOverride === true;
    const overrideGap = U.toFiniteNumber(snapshot.manual_override_gap, 0);

    const lines = [
      `年支出合計 ${U.formatCurrency(annualExpense)} 內含保費 ${U.formatCurrency(annualPremium)}，因此一般生活與其他支出約為 ${U.formatCurrency(regularExpense)}。`,
      `自然年度淨餘 = 年收入 ${U.formatCurrency(annualIncome)} - 年稅額 ${U.formatCurrency(annualTax)} - 年保費 ${U.formatCurrency(annualPremium)} - 一般支出 ${U.formatCurrency(regularExpense)} - 年債務付款 ${U.formatCurrency(annualDebt)} = ${U.formatCurrency(naturalSurplus)}。`
    ];

    if (overrideEnabled) {
      lines.push(`本次已啟用手動校正投入，所以年度可投資金額改採 ${U.formatCurrency(investableSurplus)}，與自然淨餘差額為 ${formatSignedCurrency(overrideGap)}。`);
    } else {
      lines.push(`本次未啟用手動校正投入，所以年度可投資金額直接採自然淨餘 ${U.formatCurrency(investableSurplus)}。`);
    }

    lines.push(`目前可提領資產起點為 ${U.formatCurrency(snapshot.liquid_retirement_pool_start)}，家庭總淨值起點為 ${U.formatCurrency(snapshot.opening_household_net_worth)}。`);

    return lines;
  }

  function buildCurrentSnapshotViewModel(normalizedPlan, projectionResult) {
    const snapshot = projectionResult?.current_snapshot || normalizedPlan?.derived?.current_snapshot || {};
    const overrideText = buildOverrideText(snapshot, normalizedPlan);
    const diagnostics = projectionResult?.diagnostics || {};
    const warningsBanner = [
      ...(normalizedPlan?.derived?.warnings || []),
      ...(diagnostics.anti_double_count_flags || []),
      ...(diagnostics.blocking_errors || [])
    ];

    return {
      header: {
        case_name: normalizedPlan?.metadata?.case_name || "",
        version_name: normalizedPlan?.metadata?.version_name || "",
        baseline_version: normalizedPlan?.metadata?.baseline_version || "",
        report_date_text: normalizedPlan?.metadata?.report_date || "",
        household_mode_text: normalizedPlan?.household?.household_mode === "couple" ? "夫妻家庭" : "單人家庭"
      },
      current_summary: {
        annual_income_total_text: U.formatCurrency(snapshot.annual_income_total),
        annual_expense_total_text: U.formatCurrency(snapshot.annual_expense_total),
        annual_saving_total_text: U.formatCurrency(snapshot.annual_saving_total),
        annual_tax_total_text: U.formatCurrency(snapshot.annual_tax_total),
        annual_premium_total_text: U.formatCurrency(snapshot.annual_premium_total),
        annual_debt_service_total_text: U.formatCurrency(snapshot.annual_debt_service_total),
        annual_investable_surplus_text: U.formatCurrency(snapshot.annual_investable_surplus),
        saving_rate_text: U.formatPercent(snapshot.saving_rate, 1),
        passive_income_total_text: U.formatCurrency(snapshot.passive_income_total),
        passive_income_ratio_text: U.formatPercent(snapshot.passive_income_ratio, 1),
        passive_income_cover_ratio_text: U.formatPercent(snapshot.passive_income_cover_ratio, 1),
        debt_service_ratio_text: U.formatPercent(snapshot.debt_service_ratio, 1),
        liquidity_months_text: `${U.toFiniteNumber(snapshot.liquidity_months, 0).toFixed(1)} 個月`,
        liquid_retirement_pool_start_text: U.formatCurrency(snapshot.liquid_retirement_pool_start),
        current_funding_eligible_equity_text: U.formatCurrency(snapshot.current_funding_eligible_equity),
        household_net_worth_text: U.formatCurrency(snapshot.opening_household_net_worth),
        annual_surplus_before_override_text: U.formatCurrency(snapshot.annual_surplus_before_override),
        manual_override_gap_text: overrideText.manual_override_gap_text,
        override_status_text: overrideText.override_status_text,
        override_help_text: overrideText.override_help_text
      },
      health_check_cards: buildHealthCheckCards(snapshot),
      cashflow_logic_lines: buildCashflowLogicLines(snapshot, normalizedPlan),
      warnings_banner: [...new Set(warningsBanner)]
    };
  }

  window.ReportMapperV1 = {
    buildCurrentSnapshotViewModel
  };
})();
