(function () {
  const U = window.SharedFinanceUtilsV1;

  const EARNED_PRESETS = new Set(["salary", "bonus", "part_time", "business"]);
  const BENEFIT_PRESETS = new Set(["labor_insurance", "labor_pension", "annuity", "survivor_pension"]);
  const PASSIVE_PRESETS = new Set(["rent", "interest", "dividend", "distribution"]);
  const VALID_OWNERS = new Set(["self", "spouse", "household", "joint"]);

  function pickHealthStatus(value) {
    return ["good", "normal", "watch"].includes(value) ? value : "normal";
  }

  function pickOwner(value, fallback = "joint") {
    return VALID_OWNERS.has(value) ? value : fallback;
  }

  function buildPersons(rawFormState) {
    const selfPerson = {
      person_id: "self",
      role: "self",
      name: String(rawFormState.selfName || rawFormState.clientName || "").trim(),
      current_age: U.toPositiveInt(rawFormState.currentAge, 40),
      retire_age: U.toPositiveInt(rawFormState.retireAge, 65),
      life_expectancy: U.toPositiveInt(rawFormState.lifeExpectancy, 90),
      health_status: pickHealthStatus(rawFormState.selfHealthStatus)
    };

    const persons = [selfPerson];
    if (rawFormState.householdMode === "couple") {
      persons.push({
        person_id: "spouse",
        role: "spouse",
        name: String(rawFormState.spouseName || "").trim(),
        current_age: U.toPositiveInt(rawFormState.spouseCurrentAge, 38),
        retire_age: U.toPositiveInt(rawFormState.spouseRetireAge, 63),
        life_expectancy: U.toPositiveInt(rawFormState.spouseLifeExpectancy, 92),
        health_status: pickHealthStatus(rawFormState.spouseHealthStatus)
      });
    }

    return persons;
  }

  function getPersonByRole(persons, role) {
    return (persons || []).find((person) => person.role === role) || null;
  }

  function translateOwnerAge(household, owner, ownerAge) {
    const selfPerson = getPersonByRole(household.persons, "self");
    const spousePerson = getPersonByRole(household.persons, "spouse");
    const normalizedOwnerAge = U.toPositiveInt(ownerAge, selfPerson?.current_age || 0);

    if (owner === "spouse" && spousePerson && selfPerson) {
      return selfPerson.current_age + (normalizedOwnerAge - spousePerson.current_age);
    }

    return normalizedOwnerAge;
  }

  function buildTimeline(household) {
    const selfPerson = getPersonByRole(household.persons, "self");
    const spousePerson = getPersonByRole(household.persons, "spouse");

    const currentAge = selfPerson?.current_age || 40;
    const selfRetireAge = selfPerson?.retire_age || 65;
    const selfLifeAge = selfPerson?.life_expectancy || 90;
    const translatedSpouseRetireAge = spousePerson
      ? translateOwnerAge(household, "spouse", spousePerson.retire_age)
      : selfRetireAge;
    const translatedSpouseLifeAge = spousePerson
      ? translateOwnerAge(household, "spouse", spousePerson.life_expectancy)
      : selfLifeAge;

    return {
      base_person_id: "self",
      current_age: currentAge,
      retire_age: Math.min(selfRetireAge, translatedSpouseRetireAge || selfRetireAge),
      life_expectancy: Math.max(selfLifeAge, translatedSpouseLifeAge || selfLifeAge)
    };
  }

  function getIncomeGroup(preset) {
    if (EARNED_PRESETS.has(preset)) return "earned";
    if (BENEFIT_PRESETS.has(preset)) return "benefit";
    if (PASSIVE_PRESETS.has(preset)) return "passive";
    return "passive";
  }

  function normalizeIncomeRow(row, index, household, timeline) {
    const owner = ["self", "spouse", "household"].includes(row.owner) ? row.owner : "household";
    const preset = String(row.preset || "custom").trim() || "custom";
    const isMonthly = row.type !== "lump";
    const startOwnerAge = U.toPositiveInt(row.age, timeline.retire_age);
    const years = Math.max(1, U.toPositiveInt(row.years, 1));
    const endOwnerAge = isMonthly ? startOwnerAge + years - 1 : startOwnerAge;

    return {
      id: row.id || `income-${index + 1}`,
      name: String(row.name || "").trim(),
      owner,
      preset,
      income_group: getIncomeGroup(preset),
      amount: Math.max(0, U.toFiniteNumber(row.amount, 0)),
      frequency: isMonthly ? "monthly" : "lump_sum",
      growth_rate: U.toFiniteNumber(row.growthRate ?? row.growth_rate, 0),
      start_owner_age: startOwnerAge,
      end_owner_age: endOwnerAge,
      start_age: translateOwnerAge(household, owner, startOwnerAge),
      end_age: translateOwnerAge(household, owner, endOwnerAge),
      inflation_linked: row.inflation !== false
    };
  }

  function normalizeGoalRow(row, index, household, timeline) {
    const owner = ["self", "spouse", "household"].includes(row.owner) ? row.owner : "household";
    const frequency = row.type === "monthly" ? "monthly" : "lump_sum";
    const startOwnerAge = U.toPositiveInt(row.age, timeline.retire_age);
    const durationYears = Math.max(1, U.toPositiveInt(row.years, 1));

    return {
      id: row.id || `goal-${index + 1}`,
      name: String(row.name || "").trim(),
      owner,
      event_type: String(row.category || "other").trim() || "other",
      amount: Math.max(0, U.toFiniteNumber(row.amount, 0)),
      frequency,
      start_owner_age: startOwnerAge,
      duration_years: durationYears,
      start_age: translateOwnerAge(household, owner, startOwnerAge),
      end_age: translateOwnerAge(household, owner, startOwnerAge) + durationYears - 1,
      inflation_adjusted: row.inflation !== false
    };
  }

  function normalizeAccounts(rawFormState) {
    if (Array.isArray(rawFormState.accounts) && rawFormState.accounts.length) {
      return rawFormState.accounts.map((row, index) => {
        const accountType = ["cash", "taxable", "retirement", "insurance"].includes(row.accountType || row.account_type)
          ? (row.accountType || row.account_type)
          : "taxable";
        const primaryDriver = ["growth", "income", "mixed"].includes(row.uiPrimaryDriver || row.ui_primary_driver)
          ? (row.uiPrimaryDriver || row.ui_primary_driver)
          : (accountType === "cash" ? "income" : "growth");
        const inputMode = primaryDriver === "growth" ? "total_return" : "yield_plus_growth";
        const totalReturnRate = U.toFiniteNumber(row.totalReturnRate ?? row.total_return_rate, 0);
        const cashYieldRate = Math.max(0, U.toFiniteNumber(row.cashYieldRate ?? row.cash_yield_rate, 0));
        const priceGrowthRate = U.toFiniteNumber(row.priceGrowthRate ?? row.price_growth_rate, 0);
        const growthOnlyPrePolicy = "reinvest";
        const growthOnlyPostPolicy = ["sell_only", "reinvest"].includes(row.postRetirementPolicy || row.post_retirement_policy)
          ? (row.postRetirementPolicy || row.post_retirement_policy)
          : "sell_only";
        const bucketRole = ["bucket1_cash", "bucket2_bond", "bucket3_growth", "none"].includes(row.bucketRole || row.bucket_role)
          ? (row.bucketRole || row.bucket_role)
          : (accountType === "cash"
            ? "bucket1_cash"
            : (primaryDriver === "growth" ? "bucket3_growth" : "bucket2_bond"));

        return {
          account_id: row.id || row.accountId || row.account_id || `account-${index + 1}`,
          account_name: String(row.name || row.account_name || `Account ${index + 1}`).trim(),
          owner: pickOwner(row.owner, "joint"),
          account_type: accountType,
          asset_style: row.assetStyle || row.asset_style || (primaryDriver === "growth" ? "growth" : primaryDriver === "income" ? "income" : "balanced"),
          opening_balance: Math.max(0, U.toFiniteNumber(row.openingBalance ?? row.opening_balance, 0)),
          retirement_eligible: row.retirementEligible !== false,
          ui_primary_driver: primaryDriver,
          input_mode: inputMode,
          pre_retirement_policy: inputMode === "total_return"
            ? growthOnlyPrePolicy
            : (["reinvest", "distribution_to_cash"].includes(row.preRetirementPolicy || row.pre_retirement_policy)
              ? (row.preRetirementPolicy || row.pre_retirement_policy)
              : "distribution_to_cash"),
          post_retirement_policy: inputMode === "total_return"
            ? growthOnlyPostPolicy
            : (["reinvest", "distribution_to_cash", "distribution_first_then_sell", "sell_only"].includes(row.postRetirementPolicy || row.post_retirement_policy)
              ? (row.postRetirementPolicy || row.post_retirement_policy)
              : "distribution_first_then_sell"),
          total_return_rate: totalReturnRate,
          cash_yield_rate: cashYieldRate,
          price_growth_rate: priceGrowthRate,
          economic_total_return: inputMode === "total_return" ? totalReturnRate : cashYieldRate + priceGrowthRate,
          volatility: Math.max(0, U.toFiniteNumber(row.volatility, U.toFiniteNumber(rawFormState.monteCarloOptions?.mcVolatility, 0) * 100)),
          withdrawal_priority: Math.max(1, U.toPositiveInt(row.withdrawalPriority ?? row.withdrawal_priority, index + 1)),
          minimum_reserve: Math.max(0, U.toFiniteNumber(row.minimumReserve ?? row.minimum_reserve, 0)),
          bucket_role: bucketRole
        };
      });
    }

    return [
      {
        account_id: "cash-bucket",
        account_name: "Cash Bucket",
        owner: "joint",
        account_type: "cash",
        asset_style: "balanced",
        opening_balance: Math.max(0, U.toFiniteNumber(rawFormState.cashAssets, 0)),
        retirement_eligible: true,
        ui_primary_driver: "income",
        input_mode: "yield_plus_growth",
        pre_retirement_policy: "distribution_to_cash",
        post_retirement_policy: "distribution_to_cash",
        total_return_rate: 0,
        cash_yield_rate: 0,
        price_growth_rate: 0,
        economic_total_return: 0,
        volatility: 0,
        withdrawal_priority: 1,
        minimum_reserve: 0,
        bucket_role: "bucket1_cash"
      },
      {
        account_id: "investment-bucket",
        account_name: "Investment Bucket",
        owner: "joint",
        account_type: "taxable",
        asset_style: "growth",
        opening_balance: Math.max(0, U.toFiniteNumber(rawFormState.investmentAssets, 0)),
        retirement_eligible: true,
        ui_primary_driver: "growth",
        input_mode: "total_return",
        pre_retirement_policy: "reinvest",
        post_retirement_policy: "sell_only",
        total_return_rate: U.toFiniteNumber(rawFormState.returnRate, 0),
        cash_yield_rate: 0,
        price_growth_rate: 0,
        economic_total_return: U.toFiniteNumber(rawFormState.returnRate, 0),
        volatility: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcVolatility, 0) * 100,
        withdrawal_priority: 2,
        minimum_reserve: 0,
        bucket_role: "bucket3_growth"
      },
      {
        account_id: "retirement-bucket",
        account_name: "Retirement Bucket",
        owner: "joint",
        account_type: "retirement",
        asset_style: "balanced",
        opening_balance: Math.max(0, U.toFiniteNumber(rawFormState.retirementAssets, 0)),
        retirement_eligible: true,
        ui_primary_driver: "mixed",
        input_mode: "yield_plus_growth",
        pre_retirement_policy: "reinvest",
        post_retirement_policy: "distribution_first_then_sell",
        total_return_rate: 0,
        cash_yield_rate: 0,
        price_growth_rate: Math.max(0, U.toFiniteNumber(rawFormState.postReturnRate, 0)),
        economic_total_return: Math.max(0, U.toFiniteNumber(rawFormState.postReturnRate, 0)),
        volatility: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcVolatility, 0) * 100,
        withdrawal_priority: 3,
        minimum_reserve: 0,
        bucket_role: "bucket2_bond"
      }
    ];
  }

  function pickPropertyFundingMode(rawFormState) {
    const explicitMode = String(rawFormState.propertyFundingMode || rawFormState.property_funding_mode || "").trim();
    if (["excluded", "net_equity", "sale_event"].includes(explicitMode)) return explicitMode;
    return rawFormState.includePropertyInFunding ? "net_equity" : "excluded";
  }

  function buildPropertyDraft(rawFormState, timeline) {
    const propertyValue = Math.max(0, U.toFiniteNumber(rawFormState.propertyAssets, 0));
    if (propertyValue <= 0) return null;

    return {
      property_id: "property-1",
      property_name: String(rawFormState.propertyName || "").trim() || "Primary Property",
      owner: pickOwner(rawFormState.propertyOwner, "joint"),
      property_type: ["residence", "rental", "other"].includes(rawFormState.propertyType)
        ? rawFormState.propertyType
        : "residence",
      current_market_value: propertyValue,
      annual_appreciation_rate: U.toFiniteNumber(rawFormState.propertyGrowthRate, 0),
      funding_mode: pickPropertyFundingMode(rawFormState),
      sale_age: U.toPositiveInt(rawFormState.propertySaleAge, timeline.retire_age),
      sale_cost_rate: Math.max(0, U.toFiniteNumber(rawFormState.propertySaleCostRate, 5))
    };
  }

  function inferLinkedPropertyId(row, rawFormState, propertyDraft) {
    if (!propertyDraft) return "";

    const explicitLink = String(row.linkedPropertyId || row.linked_property_id || "").trim();
    if (explicitLink) return explicitLink;

    const explicitDebtType = String(row.debtType || row.debt_type || "").trim().toLowerCase();
    const name = String(row.name || "").trim();
    const looksLikeMortgage = explicitDebtType === "mortgage" || /房貸|房屋|住宅|mortgage|home loan|housing/i.test(name);

    if (looksLikeMortgage) return propertyDraft.property_id;

    if (propertyDraft.funding_mode !== "excluded" && (rawFormState.liabilities || []).length === 1) {
      return propertyDraft.property_id;
    }

    return "";
  }

  function inferDebtType(row, linkedPropertyId) {
    const explicitDebtType = String(row.debtType || row.debt_type || "").trim();
    if (["mortgage", "personal_loan", "car_loan", "policy_loan", "other"].includes(explicitDebtType)) {
      return explicitDebtType;
    }

    const name = String(row.name || "").trim();
    if (linkedPropertyId) return "mortgage";
    if (/車貸|car/i.test(name)) return "car_loan";
    if (/保單|policy/i.test(name)) return "policy_loan";
    if (/信貸|個人|personal/i.test(name)) return "personal_loan";
    return "other";
  }

  function normalizeProperties(rawFormState, timeline, liabilities) {
    const propertyDraft = buildPropertyDraft(rawFormState, timeline);
    if (!propertyDraft) return [];

    return [
      {
        ...propertyDraft,
        linked_liability_ids: (liabilities || [])
          .filter((liability) => liability.linked_property_id === propertyDraft.property_id)
          .map((liability) => liability.liability_id)
      }
    ];
  }

  function normalizeLiabilities(rawFormState, household, propertyDraft) {
    return (rawFormState.liabilities || []).map((row, index) => {
      const owner = pickOwner(row.owner, "joint");
      const linkedPropertyId = inferLinkedPropertyId(row, rawFormState, propertyDraft);
      const payoffOwnerAge = U.toPositiveInt(row.payoffAge, household.timeline?.retire_age || 65);
      const rawPrepayOwnerAge = U.toPositiveInt(row.prepayAge ?? row.prepay_age, 0);
      const treatmentMode = String(row.treatmentMode || row.treatment_mode || "").trim() === "prepay" || rawPrepayOwnerAge > 0
        ? "prepay"
        : "amortized";

      return {
        liability_id: row.id || `liability-${index + 1}`,
        liability_name: String(row.name || "").trim() || `Liability ${index + 1}`,
        owner,
        debt_type: inferDebtType(row, linkedPropertyId),
        linked_property_id: linkedPropertyId,
        current_balance: Math.max(0, U.toFiniteNumber(row.balance, 0)),
        monthly_payment: Math.max(0, U.toFiniteNumber(row.monthlyPayment, 0)),
        annual_interest_rate: Math.max(0, U.toFiniteNumber(row.interestRate ?? row.annualInterestRate, 0)),
        payoff_owner_age: payoffOwnerAge,
        payoff_age: translateOwnerAge(household, owner, payoffOwnerAge),
        treatment_mode: treatmentMode,
        prepay_owner_age: rawPrepayOwnerAge > 0 ? rawPrepayOwnerAge : null,
        prepay_age: rawPrepayOwnerAge > 0 ? translateOwnerAge(household, owner, rawPrepayOwnerAge) : null,
        prepay_amount: Math.max(0, U.toFiniteNumber(row.prepayAmount ?? row.prepay_amount, 0)),
        include_in_retirement_cashflow: row.includeInRetirementCashflow !== false && row.include_in_retirement_cashflow !== false
      };
    });
  }

  function normalizeExpenseItems(rawFormState, timeline) {
    return [
      {
        id: "expense-essential",
        owner: "household",
        category: "essential",
        amount: Math.max(0, U.toFiniteNumber(rawFormState.essentialExpense, 0)),
        frequency: "monthly",
        growth_rate: U.toFiniteNumber(rawFormState.inflationRate, 0),
        start_owner_age: timeline.current_age,
        end_owner_age: timeline.life_expectancy,
        start_age: timeline.current_age,
        end_age: timeline.life_expectancy
      },
      {
        id: "expense-discretionary",
        owner: "household",
        category: "discretionary",
        amount: Math.max(0, U.toFiniteNumber(rawFormState.discretionaryExpense, 0)),
        frequency: "monthly",
        growth_rate: U.toFiniteNumber(rawFormState.inflationRate, 0),
        start_owner_age: timeline.current_age,
        end_owner_age: timeline.life_expectancy,
        start_age: timeline.current_age,
        end_age: timeline.life_expectancy
      },
      {
        id: "expense-medical",
        owner: "household",
        category: "medical",
        amount: Math.max(0, U.toFiniteNumber(rawFormState.monthlyMedicalExpense, 0)),
        frequency: "monthly",
        growth_rate: U.toFiniteNumber(rawFormState.medicalInflationRate, 0),
        start_owner_age: timeline.current_age,
        end_owner_age: timeline.life_expectancy,
        start_age: timeline.current_age,
        end_age: timeline.life_expectancy
      },
      {
        id: "expense-care",
        owner: "household",
        category: "care",
        amount: Math.max(0, U.toFiniteNumber(rawFormState.monthlyCareExpense, 0)),
        frequency: "monthly",
        growth_rate: U.toFiniteNumber(rawFormState.medicalInflationRate, 0),
        start_owner_age: timeline.current_age,
        end_owner_age: timeline.life_expectancy,
        start_age: timeline.current_age,
        end_age: timeline.life_expectancy
      },
      {
        id: "expense-premium",
        owner: "household",
        category: "premium",
        amount: Math.max(0, U.toFiniteNumber(rawFormState.monthlyPremiumExpense, 0)),
        frequency: "monthly",
        growth_rate: U.toFiniteNumber(rawFormState.inflationRate, 0),
        start_owner_age: timeline.current_age,
        end_owner_age: timeline.life_expectancy,
        start_age: timeline.current_age,
        end_age: timeline.life_expectancy
      }
    ];
  }

  function activeAnnualAmount(item, currentAge) {
    if (!item || currentAge < item.start_age || currentAge > item.end_age) return 0;
    return U.annualizeAmount(item.amount, item.frequency);
  }

  function getLinkedLiabilityBalance(plan, propertyId) {
    return U.sumBy(
      (plan.balance_sheet.liabilities || []).filter((liability) => liability.linked_property_id === propertyId),
      (liability) => liability.current_balance
    );
  }

  function getEssentialMonthlyExpense(plan) {
    const essentialItem = (plan.cashflow.expense_items || []).find((item) => item.category === "essential");
    if (!essentialItem) return 0;
    const annualAmount = activeAnnualAmount(essentialItem, plan.timeline.current_age);
    return annualAmount / 12;
  }

  function getTaxConfig(plan) {
    const tax = plan?.assumptions?.tax || {};
    return {
      mode: tax.mode || "effective_rate",
      earned_income_tax_rate: Math.max(0, U.toFiniteNumber(tax.earned_income_tax_rate, 0)) / 100,
      passive_income_tax_rate: Math.max(0, U.toFiniteNumber(tax.passive_income_tax_rate, 0)) / 100,
      benefit_income_tax_rate: Math.max(0, U.toFiniteNumber(tax.benefit_income_tax_rate, 0)) / 100
    };
  }

  function estimateAnnualTax(plan, earnedIncome, passiveIncome, benefitIncome) {
    const tax = getTaxConfig(plan);
    if (tax.mode !== "effective_rate") return 0;

    return (Math.max(0, earnedIncome) * tax.earned_income_tax_rate)
      + (Math.max(0, passiveIncome) * tax.passive_income_tax_rate)
      + (Math.max(0, benefitIncome) * tax.benefit_income_tax_rate);
  }

  function deriveCurrentSnapshot(plan) {
    const currentAge = plan.timeline.current_age;
    const earnedIncomeTotal = U.sumBy(plan.cashflow.earned_incomes, (item) => activeAnnualAmount(item, currentAge));
    const passiveIncomeTotal = U.sumBy(plan.cashflow.passive_incomes, (item) => activeAnnualAmount(item, currentAge));
    const benefitIncomeTotal = U.sumBy(plan.cashflow.benefit_incomes, (item) => activeAnnualAmount(item, currentAge));
    const annualIncomeTotal = earnedIncomeTotal + passiveIncomeTotal + benefitIncomeTotal;

    const annualExpenseTotal = U.sumBy(plan.cashflow.expense_items, (item) => activeAnnualAmount(item, currentAge));
    const annualPremiumTotal = U.sumBy(
      plan.cashflow.expense_items.filter((item) => item.category === "premium"),
      (item) => activeAnnualAmount(item, currentAge)
    );
    const currentDebtService = U.sumBy(plan.balance_sheet.liabilities, (item) => item.monthly_payment * 12);
    const annualTaxTotal = estimateAnnualTax(plan, earnedIncomeTotal, passiveIncomeTotal, benefitIncomeTotal);
    const annualSavingTotal = annualIncomeTotal - annualExpenseTotal - annualTaxTotal - currentDebtService;
    const manualContributionAnnual = Math.max(0, U.toFiniteNumber(plan.inputs?.monthlyContributionOverride, 0)) * 12;
    const useManualContributionOverride = plan.inputs?.useManualContributionOverride === true;
    const annualInvestableSurplus = useManualContributionOverride
      ? manualContributionAnnual
      : Math.max(0, annualSavingTotal);
    const manualOverrideGap = useManualContributionOverride
      ? manualContributionAnnual - annualSavingTotal
      : 0;

    const liquidAssets = U.sumBy(
      plan.balance_sheet.accounts.filter((account) => ["cash", "taxable", "retirement", "insurance"].includes(account.account_type)),
      (account) => account.opening_balance
    );
    const cashLiquidity = U.sumBy(
      plan.balance_sheet.accounts.filter((account) => account.account_type === "cash"),
      (account) => account.opening_balance
    );
    const propertyValueTotal = U.sumBy(plan.balance_sheet.properties, (item) => item.current_market_value);
    const liabilityBalanceTotal = U.sumBy(plan.balance_sheet.liabilities, (item) => item.current_balance);
    const fundingEligibleEquity = U.sumBy(
      plan.balance_sheet.properties.filter((item) => item.funding_mode !== "excluded"),
      (item) => Math.max(0, item.current_market_value - getLinkedLiabilityBalance(plan, item.property_id))
    );

    return {
      annual_income_total: annualIncomeTotal,
      annual_expense_total: annualExpenseTotal,
      annual_saving_total: annualSavingTotal,
      annual_tax_total: annualTaxTotal,
      annual_premium_total: annualPremiumTotal,
      annual_debt_service_total: currentDebtService,
      annual_surplus_before_override: annualSavingTotal,
      annual_investable_surplus: annualInvestableSurplus,
      manual_override_gap: manualOverrideGap,
      saving_rate: U.safeDivide(annualSavingTotal, annualIncomeTotal, 0),
      passive_income_total: passiveIncomeTotal + benefitIncomeTotal,
      passive_income_ratio: U.safeDivide(passiveIncomeTotal + benefitIncomeTotal, annualIncomeTotal, 0),
      passive_income_cover_ratio: U.safeDivide(passiveIncomeTotal + benefitIncomeTotal, annualExpenseTotal, 0),
      debt_service_ratio: U.safeDivide(currentDebtService, annualIncomeTotal, 0),
      liquidity_months: U.safeDivide(cashLiquidity, Math.max(1, getEssentialMonthlyExpense(plan)), 0),
      liquid_retirement_pool_start: liquidAssets,
      current_funding_eligible_equity: fundingEligibleEquity,
      opening_household_net_worth: liquidAssets + propertyValueTotal - liabilityBalanceTotal
    };
  }

  function normalizeOwnerGroup(owner) {
    const normalizedOwner = String(owner || "").trim().toLowerCase();
    if (["self", "spouse"].includes(normalizedOwner)) return normalizedOwner;
    if (["household", "joint"].includes(normalizedOwner)) return "household";
    return "household";
  }

  function isDistributionPolicy(policy) {
    return ["distribution_to_cash", "distribution_first_then_sell"].includes(String(policy || "").trim());
  }

  function isIncomeStyleAccountCandidate(account) {
    const assetStyle = String(account?.asset_style || account?.ui_primary_driver || "").trim().toLowerCase();
    return (
      String(account?.input_mode || "").trim() === "yield_plus_growth" &&
      U.toFiniteNumber(account?.opening_balance, 0) > 0 &&
      assetStyle !== "growth" &&
      [account?.pre_retirement_policy, account?.post_retirement_policy].some(isDistributionPolicy)
    );
  }

  function isManualPassiveIncomeCandidate(item) {
    return ["interest", "dividend", "distribution"].includes(String(item?.preset || "").trim());
  }

  function collectPotentialDuplicateIncomePairs(plan) {
    const accounts = Array.isArray(plan?.balance_sheet?.accounts) ? plan.balance_sheet.accounts : [];
    const passiveIncomeItems = Array.isArray(plan?.cashflow?.passive_incomes) ? plan.cashflow.passive_incomes : [];
    const candidateAccounts = accounts.filter(isIncomeStyleAccountCandidate);
    const candidatePassiveIncomeItems = passiveIncomeItems.filter(isManualPassiveIncomeCandidate);
    const pairs = [];

    candidateAccounts.forEach((account) => {
      const accountOwner = normalizeOwnerGroup(account.owner);
      const accountName = String(account.name || account.account_name || "未命名帳戶").trim() || "未命名帳戶";
      const accountStyle = String(account.asset_style || account.ui_primary_driver || "").trim() || "income";

      candidatePassiveIncomeItems.forEach((item) => {
        if (accountOwner !== normalizeOwnerGroup(item.owner)) return;
        const passiveName = String(item.name || item.income_type || item.preset || "未命名被動收入").trim() || "未命名被動收入";
        const passivePreset = String(item.preset || item.income_type || "").trim() || "custom";
        pairs.push({ accountName, passiveName, owner: accountOwner, accountStyle, passivePreset });
      });
    });

    return pairs;
  }
  function collectNormalizationWarnings(plan) {
    const warnings = [];
    const snapshot = plan.derived.current_snapshot;
    const manualOverrideGap = Math.abs(U.toFiniteNumber(snapshot.manual_override_gap, 0));
    const fundedProperties = (plan.balance_sheet.properties || []).filter((property) => property.funding_mode !== "excluded");
    const linkedFundingLiabilities = (plan.balance_sheet.liabilities || []).filter((liability) => liability.linked_property_id);
    const incomeStyleAccounts = (plan.balance_sheet.accounts || []).filter((account) => (
      account.input_mode === "yield_plus_growth" &&
      account.opening_balance > 0 &&
      (
        ["distribution_to_cash", "distribution_first_then_sell"].includes(account.pre_retirement_policy) ||
        ["distribution_to_cash", "distribution_first_then_sell"].includes(account.post_retirement_policy)
      )
    ));
    const manualPassiveCashflows = (plan.cashflow.passive_incomes || []).filter((item) =>
      ["interest", "dividend", "distribution"].includes(item.preset)
    );

    if (snapshot.saving_rate < 0) {
      warnings.push("目前年度現金流還有缺口，代表收入尚未完全覆蓋支出與債務付款。");
    }
    if (snapshot.debt_service_ratio > 0.4) {
      warnings.push("目前債務服務比偏高，退休前現金流壓力會比較明顯。");
    }
    if (snapshot.liquidity_months < 6) {
      warnings.push("流動性月數低於 6 個月，建議再多留一點緊急預備金。");
    }
    if (plan.inputs?.useManualContributionOverride === true && manualOverrideGap > 120000) {
      warnings.push("你手動填的每月持續投入，和系統依目前收支推導出的可投資餘額差距較大，建議再核對一次。");
    }
    if (fundedProperties.length > 0 && (plan.balance_sheet.liabilities || []).length > 0 && linkedFundingLiabilities.length === 0) {
      warnings.push("目前這筆房產已列入退休資金池，但還沒有可直接對應的房貸資料，系統先只把已確認的部分納入。");
    }
    if (fundedProperties.length > 0 && snapshot.current_funding_eligible_equity <= 0) {
      warnings.push("目前納入退休資金池的房產淨值為 0，表示房貸餘額幾乎已把可動用價值抵消。");
    }

    const duplicateIncomePairs = collectPotentialDuplicateIncomePairs(plan);
    if (duplicateIncomePairs.length > 0) {
      const detailText = duplicateIncomePairs
        .slice(0, 3)
        .map((pair) => `帳戶「${pair.accountName}」與被動收入「${pair.passiveName}」`)
        .join("、");
      warnings.push(`我們先幫您留意：您目前有 ${duplicateIncomePairs.length} 組看起來是同一位所有人的同類收益來源，例如 ${detailText}。如果這筆配息、利息或賣單位已經算在帳戶收益裡，就不需要再手動輸入一次。`);
    }

    return warnings;
  }

  function collectNormalizationDiagnostics(plan) {
    const warnings = collectNormalizationWarnings(plan);
    const blockingErrors = [];
    const antiDoubleCountFlags = [];
    const accounts = Array.isArray(plan?.balance_sheet?.accounts) ? plan.balance_sheet.accounts : [];
    const passiveIncomeItems = Array.isArray(plan?.cashflow?.passive_incomes) ? plan.cashflow.passive_incomes : [];
    const priorityMap = new Map();
    const accountNameMap = new Map();

    accounts.forEach((account) => {
      const accountName = String(account.account_name || account.account_id || "未命名帳戶").trim();
      const priority = U.toPositiveInt(account.withdrawal_priority, 999);
      const reserve = Math.max(0, U.toFiniteNumber(account.minimum_reserve, 0));
      const balance = Math.max(0, U.toFiniteNumber(account.opening_balance, 0));

      if (!priorityMap.has(priority)) priorityMap.set(priority, []);
      priorityMap.get(priority).push(accountName);

      const normalizedName = accountName.toLowerCase();
      if (!accountNameMap.has(normalizedName)) accountNameMap.set(normalizedName, []);
      accountNameMap.get(normalizedName).push(accountName);

      if (reserve > balance) {
        blockingErrors.push(`帳戶「${accountName}」的最低保留金額高於目前餘額，會讓提領順序失真。`);
      }

      if (account.account_type === "cash" && account.input_mode === "total_return") {
        blockingErrors.push(`帳戶「${accountName}」被設定為現金帳戶，但報酬模式卻是總報酬成長，請調整成收益型或更改帳戶類型。`);
      }

      if (account.input_mode === "total_return") {
        if (account.pre_retirement_policy !== "reinvest") {
          blockingErrors.push(`帳戶「${accountName}」屬於成長型總報酬模式，退休前處理只能是再投入。`);
        }
        if (!["sell_only", "reinvest"].includes(account.post_retirement_policy)) {
          blockingErrors.push(`帳戶「${accountName}」屬於成長型總報酬模式，退休後不可設定為先領收益。`);
        }
      }
    });

    priorityMap.forEach((names, priority) => {
      if (priority < 999 && names.length > 1) {
        blockingErrors.push(`帳戶提領順序 ${priority} 被重複使用在：${names.join("、")}。請改成唯一順序，避免賣單位次序不明確。`);
      }
    });

    accountNameMap.forEach((names) => {
      if (names.length > 1) {
        warnings.push(`帳戶名稱「${names[0]}」重複出現，報表閱讀上可能混淆，建議改成更具辨識度的名稱。`);
      }
    });

    const incomeStyleAccounts = accounts.filter((account) => (
      account.input_mode === "yield_plus_growth" &&
      U.toFiniteNumber(account.opening_balance, 0) > 0 &&
      (
        ["distribution_to_cash", "distribution_first_then_sell"].includes(account.pre_retirement_policy) ||
        ["distribution_to_cash", "distribution_first_then_sell"].includes(account.post_retirement_policy)
      )
    ));
    const manualPassiveCashflows = passiveIncomeItems.filter((item) =>
      ["interest", "dividend", "distribution"].includes(item.preset)
    );

    const duplicateIncomePairs = collectPotentialDuplicateIncomePairs(plan);
    if (duplicateIncomePairs.length > 0) {
      const accountNames = duplicateIncomePairs
        .slice(0, 3)
        .map((pair) => pair.accountName)
        .join("、");
      const passiveNames = duplicateIncomePairs
        .slice(0, 3)
        .map((pair) => pair.passiveName)
        .join("、");
      antiDoubleCountFlags.push(`我們先幫您留意：帳戶「${accountNames}」和被動收入「${passiveNames}」看起來是同一位所有人的同類收益來源。若這筆收益已由帳戶自動產生，就不需要再手動輸入一次。`);
    }

    return {
      warnings: [...new Set(warnings)],
      blocking_errors: [...new Set(blockingErrors)],
      anti_double_count_flags: [...new Set(antiDoubleCountFlags)]
    };
  }

  function normalizePlan(rawFormState = {}) {
    const household = {
      household_mode: rawFormState.householdMode === "couple" ? "couple" : "single",
      persons: buildPersons(rawFormState)
    };
    const timeline = buildTimeline(household);
    const householdWithTimeline = { ...household, timeline };
    const normalizedIncomes = (rawFormState.incomes || []).map((row, index) => normalizeIncomeRow(row, index, householdWithTimeline, timeline));
    const propertyDraft = buildPropertyDraft(rawFormState, timeline);
    const normalizedLiabilities = normalizeLiabilities(rawFormState, householdWithTimeline, propertyDraft);

    const normalizedPlan = {
      metadata: {
        case_name: String(rawFormState.caseName || "").trim(),
        version_name: String(rawFormState.versionName || "").trim(),
        baseline_version: String(rawFormState.baselineVersion || "").trim(),
        advisor_name: String(rawFormState.advisorName || "").trim(),
        report_date: rawFormState.reportDate || "",
        advisor_note: String(rawFormState.advisorNote || "").trim()
      },
      household,
      timeline,
      cashflow: {
        earned_incomes: normalizedIncomes.filter((item) => item.income_group === "earned"),
        passive_incomes: normalizedIncomes.filter((item) => item.income_group === "passive"),
        benefit_incomes: normalizedIncomes.filter((item) => item.income_group === "benefit"),
        expense_items: normalizeExpenseItems(rawFormState, timeline),
        goal_events: (rawFormState.goals || []).map((row, index) => normalizeGoalRow(row, index, householdWithTimeline, timeline))
      },
      balance_sheet: {
        accounts: normalizeAccounts(rawFormState),
        properties: normalizeProperties(rawFormState, timeline, normalizedLiabilities),
        liabilities: normalizedLiabilities
      },
      assumptions: {
        pre_retire_return_rate: U.toFiniteNumber(rawFormState.returnRate, 0),
        post_retire_return_rate: U.toFiniteNumber(rawFormState.postReturnRate, 0),
        inflation_rate: U.toFiniteNumber(rawFormState.inflationRate, 0),
        medical_inflation_rate: U.toFiniteNumber(rawFormState.medicalInflationRate, 0),
        tax: {
          mode: "effective_rate",
          earned_income_tax_rate: U.toFiniteNumber(rawFormState.earnedIncomeTaxRate, 0),
          passive_income_tax_rate: U.toFiniteNumber(rawFormState.passiveIncomeTaxRate, 0),
          benefit_income_tax_rate: U.toFiniteNumber(rawFormState.benefitIncomeTaxRate, 0)
        }
      },
      strategy: {
        withdrawal_mode: rawFormState.withdrawalStrategy || "fixed_spending",
        reference_withdrawal_rate: U.toFiniteNumber(rawFormState.referenceWithdrawalRate, 4),
        fixed_withdrawal_rate: U.toFiniteNumber(rawFormState.fixedWithdrawalRate, 4),
        annual_review_enabled: rawFormState.annualReviewEnabled !== false,
        guardrail_floor_pct: U.toFiniteNumber(rawFormState.strategyGuardrailFloor, 80),
        guardrail_ceiling_pct: U.toFiniteNumber(rawFormState.strategyGuardrailCeiling, 120),
        guardrail_adjust_step_pct: U.toFiniteNumber(rawFormState.strategyGuardrailAdjustStep, 10),
        bucket_cash_months: U.toFiniteNumber(rawFormState.bucketCashMonths, 24),
        bucket_bond_years: U.toFiniteNumber(rawFormState.bucketBondYears, 8),
        bucket_avoid_selling_growth_after_loss: rawFormState.bucketAvoidSellingGrowthAfterLoss !== false,
        ltc: {
          enabled: rawFormState.ltcProfile?.enabled !== false,
          start_age: U.toPositiveInt(rawFormState.ltcProfile?.startAge, 80),
          duration_years: U.toPositiveInt(rawFormState.ltcProfile?.durationYears, 8),
          extra_cost_factor: U.toFiniteNumber(rawFormState.ltcProfile?.extraCostFactor, 1.2)
        }
      },
      monte_carlo: {
        enabled: rawFormState.monteCarloOptions?.mcEnabled !== false,
        runs: U.toPositiveInt(rawFormState.monteCarloOptions?.mcRuns, 500),
        return_volatility: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcVolatility, 0) * 100,
        inflation_volatility: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcInflationVolatility, 0) * 100,
        spending_volatility: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcSpendingVolatility, 0) * 100,
        random_inflation: rawFormState.monteCarloOptions?.mcRandomInflation !== false,
        flexible_spending: rawFormState.monteCarloOptions?.mcFlexibleSpending !== false,
        spending_floor_pct: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcSpendingFloor, 0.85) * 100,
        spending_ceiling_pct: U.toFiniteNumber(rawFormState.monteCarloOptions?.mcSpendingCeiling, 1.1) * 100
      },
      inputs: {
        monthlyContribution: U.toFiniteNumber(rawFormState.monthlyContribution, 0),
        monthlyContributionOverride: U.toFiniteNumber(rawFormState.monthlyContributionOverride ?? rawFormState.monthlyContribution, 0),
        useManualContributionOverride: rawFormState.useManualContributionOverride === true,
        scenarioCMode: String(rawFormState.scenarioCMode || "mixed"),
        scenarioCReturnBoostPct: Math.max(0, U.toFiniteNumber(rawFormState.scenarioCReturnBoostPct, 1)),
        scenarioCRetireDelayYears: Math.max(0, Math.trunc(U.toFiniteNumber(rawFormState.scenarioCRetireDelayYears, 2))),
        scenarioCContributionBoostPct: Math.max(0, U.toFiniteNumber(rawFormState.scenarioCContributionBoostPct, 15))
      },
      derived: {
        current_snapshot: {}
      }
    };

    normalizedPlan.derived.current_snapshot = deriveCurrentSnapshot(normalizedPlan);
    const diagnostics = collectNormalizationDiagnostics(normalizedPlan);
    normalizedPlan.derived.warnings = diagnostics.warnings;
    normalizedPlan.derived.blocking_errors = diagnostics.blocking_errors;
    normalizedPlan.derived.anti_double_count_flags = diagnostics.anti_double_count_flags;
    return normalizedPlan;
  }

  window.PlanNormalizerV1 = {
    collectNormalizationDiagnostics,
    collectNormalizationWarnings,
    deriveCurrentSnapshot,
    normalizePlan,
    translateOwnerAge
  };
})();
