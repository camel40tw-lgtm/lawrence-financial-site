(function () {
  const U = window.SharedFinanceUtilsV1;

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function percentile(values, quantile) {
    if (!Array.isArray(values) || !values.length) return 0;
    const sorted = values.slice().sort((left, right) => left - right);
    const index = (sorted.length - 1) * quantile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  function randomNormal() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function randomChiSquare(df) {
    let sum = 0;
    for (let index = 0; index < df; index += 1) {
      const z = randomNormal();
      sum += z * z;
    }
    return sum;
  }

  function randomStudentT(df = 6) {
    const z = randomNormal();
    const chiSquare = randomChiSquare(df);
    if (!Number.isFinite(chiSquare) || chiSquare <= 0) return z;
    return z / Math.sqrt(chiSquare / df);
  }

  function drawFatTailShock(volatility, df = 6) {
    if (!Number.isFinite(volatility) || volatility <= 0) return 0;
    const raw = randomStudentT(df);
    const scale = Math.sqrt(df / Math.max(1, df - 2));
    return (raw / scale) * volatility;
  }

  function normalizeFromRaw(rawFormState) {
    if (window.PlanNormalizerV1?.normalizePlan) {
      return window.PlanNormalizerV1.normalizePlan(rawFormState);
    }
    return null;
  }

  function getGeneralInflation(plan) {
    return U.toFiniteNumber(plan?.assumptions?.inflation_rate, 0) / 100;
  }

  function getMedicalInflation(plan) {
    return U.toFiniteNumber(plan?.assumptions?.medical_inflation_rate, 0) / 100;
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

  function getAnnualRateSnapshot(plan, age, options = {}) {
    const rateSeriesByAge = options.rateSeriesByAge || {};
    const sampledRates = rateSeriesByAge[age] || {};
    const basePreRetireReturnRate = U.toFiniteNumber(plan?.assumptions?.pre_retire_return_rate, 0) / 100;
    const basePostRetireReturnRate = U.toFiniteNumber(plan?.assumptions?.post_retire_return_rate, 0) / 100;
    const baseInflationRate = getGeneralInflation(plan);
    const baseMedicalInflationRate = getMedicalInflation(plan);

    return {
      preRetireReturnRate: U.toFiniteNumber(sampledRates.pre_retire_return_rate, basePreRetireReturnRate * 100) / 100,
      postRetireReturnRate: U.toFiniteNumber(sampledRates.post_retire_return_rate, basePostRetireReturnRate * 100) / 100,
      inflationRate: U.toFiniteNumber(sampledRates.inflation_rate, baseInflationRate * 100) / 100,
      medicalInflationRate: U.toFiniteNumber(sampledRates.medical_inflation_rate, baseMedicalInflationRate * 100) / 100
    };
  }

  function getAnnualSpendingSnapshot(plan, age, options = {}) {
    const spendingSeriesByAge = options.spendingSeriesByAge || {};
    const sampledSpending = spendingSeriesByAge[age] || {};

    return {
      discretionaryMultiplier: U.clamp(U.toFiniteNumber(sampledSpending.discretionary_multiplier, 1), 0.5, 2.5),
      medicalMultiplier: U.clamp(U.toFiniteNumber(sampledSpending.medical_multiplier, 1), 0.5, 4),
      careMultiplier: U.clamp(U.toFiniteNumber(sampledSpending.care_multiplier, 1), 0.5, 4)
    };
  }

  function estimateAnnualTax(plan, incomeBreakdown) {
    const tax = getTaxConfig(plan);
    if (tax.mode !== "effective_rate") return 0;

    return (Math.max(0, U.toFiniteNumber(incomeBreakdown?.earnedIncome, 0)) * tax.earned_income_tax_rate)
      + (Math.max(0, U.toFiniteNumber(incomeBreakdown?.passiveIncome, 0)) * tax.passive_income_tax_rate)
      + (Math.max(0, U.toFiniteNumber(incomeBreakdown?.benefitIncome, 0)) * tax.benefit_income_tax_rate);
  }

  function getContributionOverrideAnnual(plan) {
    return Math.max(0, U.toFiniteNumber(plan?.inputs?.monthlyContributionOverride, 0) * 12);
  }

  function createAgeRange(plan) {
    const ages = [];
    for (let age = plan.timeline.current_age; age <= plan.timeline.life_expectancy; age += 1) {
      ages.push(age);
    }
    return ages;
  }

  function growthFactor(rate, years) {
    if (!Number.isFinite(rate) || years <= 0) return 1;
    return Math.pow(1 + rate, years);
  }

  function annualizeValue(amount, frequency) {
    return U.annualizeAmount(amount, frequency);
  }

  function isActiveAtAge(item, age) {
    return Boolean(item) && age >= U.toFiniteNumber(item.start_age, 0) && age <= U.toFiniteNumber(item.end_age, 0);
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

  function getLtcExpense(plan, age, medicalAndCareBase) {
    const ltc = plan?.strategy?.ltc;
    if (!ltc?.enabled) return 0;
    if (age < U.toFiniteNumber(ltc.start_age, 0)) return 0;
    if (age >= U.toFiniteNumber(ltc.start_age, 0) + U.toFiniteNumber(ltc.duration_years, 0)) return 0;
    return Math.max(0, medicalAndCareBase * Math.max(0, U.toFiniteNumber(ltc.extra_cost_factor, 1) - 1));
  }

  function computeEscalatedAmount(item, age, rateFallback = 0) {
    if (!isActiveAtAge(item, age)) return 0;
    const elapsedYears = Math.max(0, age - U.toFiniteNumber(item.start_age, age));
    const rawGrowthRate = U.toFiniteNumber(item.growth_rate, NaN);
    const usesInflationFallback = item.inflation_linked === true || item.inflation_adjusted === true;
    const rate = usesInflationFallback && (!Number.isFinite(rawGrowthRate) || rawGrowthRate === 0)
      ? rateFallback
      : U.toFiniteNumber(item.growth_rate, rateFallback * 100) / 100;
    return annualizeValue(item.amount, item.frequency) * growthFactor(rate, elapsedYears);
  }

  function sumIncomeAtAge(items, age, inflationRate = 0) {
    return U.sumBy(items, (item) => {
      const fallback = item.inflation_linked ? inflationRate : 0;
      return computeEscalatedAmount(item, age, fallback);
    });
  }

  function buildGoalCashflow(plan, age, inflationRate = 0) {
    let netAmount = 0;
    const details = [];

    (plan.cashflow.goal_events || []).forEach((goal) => {
      if (!isActiveAtAge(goal, age)) return;
      const fallback = goal.inflation_adjusted ? inflationRate : 0;
      const amount = computeEscalatedAmount(goal, age, fallback);
      if (amount === 0) return;
      netAmount -= amount;
      details.push({
        direction: "outflow",
        kind: "goal",
        amount,
        name: goal.name || "目標事件"
      });
    });

    return { netAmount, details };
  }

  function createAccountStates(plan) {
    return (plan.balance_sheet.accounts || []).map((account) => ({
      ...cloneJson(account),
      balance: Math.max(0, U.toFiniteNumber(account.opening_balance, 0))
    }));
  }

  function createPropertyStates(plan) {
    return (plan.balance_sheet.properties || []).map((property) => ({
      ...cloneJson(property),
      active: true,
      current_market_value: Math.max(0, U.toFiniteNumber(property.current_market_value, 0))
    }));
  }

  function createLiabilityStates(plan) {
    return (plan.balance_sheet.liabilities || []).map((liability) => ({
      ...cloneJson(liability),
      active: true,
      current_balance: Math.max(0, U.toFiniteNumber(liability.current_balance, 0))
    }));
  }

  function getPropertyLinkedLiabilities(property, liabilityStates) {
    const linkedIds = new Set(property.linked_liability_ids || []);
    return (liabilityStates || []).filter((liability) => {
      if (!liability.active || liability.current_balance <= 0) return false;
      if (liability.linked_property_id && liability.linked_property_id === property.property_id) return true;
      return linkedIds.has(liability.liability_id);
    });
  }

  function getFundingEligiblePropertyEquity(propertyStates, liabilityStates) {
    return U.sumBy(
      (propertyStates || []).filter((property) => property.active && property.funding_mode === "net_equity"),
      (property) => Math.max(0, property.current_market_value - U.sumBy(getPropertyLinkedLiabilities(property, liabilityStates), (liability) => liability.current_balance))
    );
  }

  function getActivePropertyGrossValue(propertyStates) {
    return U.sumBy((propertyStates || []).filter((property) => property.active), (property) => property.current_market_value);
  }

  const BUCKET_ROLE_ORDER = { bucket1_cash: 1, bucket2_bond: 2, bucket3_growth: 3, none: 4 };

  function sortByWithdrawalPriority(accounts) {
    return accounts
      .slice()
      .sort((left, right) => U.toFiniteNumber(left.withdrawal_priority, 999) - U.toFiniteNumber(right.withdrawal_priority, 999));
  }

  function getDepositTargetAccount(accountStates, withdrawalMode) {
    if (withdrawalMode === "bucket") {
      const bucket1Account = sortByWithdrawalPriority(
        accountStates.filter((account) => account.bucket_role === "bucket1_cash")
      )[0];
      if (bucket1Account) return bucket1Account;
    }
    const cashAccount = accountStates.find((account) => account.account_type === "cash");
    if (cashAccount) return cashAccount;
    return sortByWithdrawalPriority(accountStates)[0] || null;
  }

  function getWithdrawalOrder(accountStates, withdrawalMode) {
    if (withdrawalMode === "bucket") {
      return accountStates
        .slice()
        .sort((left, right) => {
          const bucketDelta = U.toFiniteNumber(BUCKET_ROLE_ORDER[left.bucket_role], 4) - U.toFiniteNumber(BUCKET_ROLE_ORDER[right.bucket_role], 4);
          if (bucketDelta !== 0) return bucketDelta;
          return U.toFiniteNumber(left.withdrawal_priority, 999) - U.toFiniteNumber(right.withdrawal_priority, 999);
        });
    }
    const cashAccounts = accountStates.filter((account) => account.account_type === "cash");
    const otherAccounts = sortByWithdrawalPriority(accountStates.filter((account) => account.account_type !== "cash"));
    return [...cashAccounts, ...otherAccounts];
  }

  function applyNetCashToAccounts(accountStates, netCash, withdrawalMode) {
    if (netCash >= 0) {
      const target = getDepositTargetAccount(accountStates, withdrawalMode);
      if (target) target.balance += netCash;
      return {
        principalSales: 0,
        unmetShortfall: 0
      };
    }

    let shortfall = Math.abs(netCash);
    let principalSales = 0;
    getWithdrawalOrder(accountStates, withdrawalMode).forEach((account) => {
      if (shortfall <= 0) return;
      const reserve = Math.max(0, U.toFiniteNumber(account.minimum_reserve, 0));
      const available = Math.max(0, account.balance - reserve);
      const draw = Math.min(available, shortfall);
      account.balance -= draw;
      shortfall -= draw;
      principalSales += draw;
    });

    return {
      principalSales,
      unmetShortfall: shortfall
    };
  }

  function runAccountPerformance(accountStates, age, phase, plan, options = {}) {
    let investmentReturn = 0;
    let distributionCash = 0;
    const returnByBucketRole = {};
    const addBucketReturn = (bucketRole, amount) => {
      const key = bucketRole || "none";
      returnByBucketRole[key] = U.toFiniteNumber(returnByBucketRole[key], 0) + amount;
    };
    const rateSnapshot = getAnnualRateSnapshot(plan, age, options);
    const preRate = rateSnapshot.preRetireReturnRate;
    const postRate = rateSnapshot.postRetireReturnRate;
    const basePreRate = U.toFiniteNumber(plan.assumptions.pre_retire_return_rate, 0) / 100;
    const basePostRate = U.toFiniteNumber(plan.assumptions.post_retire_return_rate, 0) / 100;
    const fallbackTotalReturnRate = phase === "accumulation" ? preRate : postRate;
    const returnDelta = (phase === "accumulation" ? preRate - basePreRate : postRate - basePostRate);

    accountStates.forEach((account) => {
      if (account.balance <= 0) return;

      if (account.input_mode === "yield_plus_growth") {
        const yieldRate = Math.max(0, U.toFiniteNumber(account.cash_yield_rate, 0) / 100);
        const configuredGrowthRate = U.toFiniteNumber(account.price_growth_rate, NaN);
        const growthRate = U.clamp(
          (Number.isFinite(configuredGrowthRate) ? configuredGrowthRate / 100 : fallbackTotalReturnRate) + returnDelta,
          -0.95,
          1.5
        );
        const distribution = account.balance * yieldRate;
        const growth = account.balance * growthRate;
        const policy = phase === "accumulation"
          ? account.pre_retirement_policy
          : account.post_retirement_policy;

        if (policy === "distribution_to_cash" || policy === "distribution_first_then_sell") {
          distributionCash += distribution;
          account.balance += growth;
        } else {
          account.balance += distribution + growth;
        }

        investmentReturn += distribution + growth;
        addBucketReturn(account.bucket_role, distribution + growth);
        return;
      }

      const configuredRate = U.toFiniteNumber(account.total_return_rate, NaN);
      const totalReturnRate = U.clamp(
        (Number.isFinite(configuredRate) ? configuredRate / 100 : fallbackTotalReturnRate) + returnDelta,
        -0.95,
        1.5
      );
      const growth = account.balance * totalReturnRate;
      account.balance += growth;
      investmentReturn += growth;
      addBucketReturn(account.bucket_role, growth);
    });

    return { investmentReturn, distributionCash, returnByBucketRole };
  }

  function runBucketRebalance(accountStates, targetAnnualSpend, plan, priorYearBucket3Negative) {
    if (plan.strategy.withdrawal_mode !== "bucket") {
      return { transferredFromBucket2: 0, transferredFromBucket3: 0, details: [] };
    }

    const cashMonths = Math.max(0, U.toFiniteNumber(plan.strategy.bucket_cash_months, 24));
    const avoidSellingAfterLoss = plan.strategy.bucket_avoid_selling_growth_after_loss !== false;
    const bucket1Accounts = sortByWithdrawalPriority(accountStates.filter((account) => account.bucket_role === "bucket1_cash"));
    if (!bucket1Accounts.length) {
      return { transferredFromBucket2: 0, transferredFromBucket3: 0, details: [] };
    }

    const bucket1Target = (cashMonths / 12) * Math.max(0, U.toFiniteNumber(targetAnnualSpend, 0));
    const bucket1Total = U.sumBy(bucket1Accounts, (account) => account.balance);
    let shortfall = Math.max(0, bucket1Target - bucket1Total);
    if (shortfall <= 0) {
      return { transferredFromBucket2: 0, transferredFromBucket3: 0, details: [] };
    }

    const depositTarget = bucket1Accounts[0];
    const bucket2Accounts = sortByWithdrawalPriority(accountStates.filter((account) => account.bucket_role === "bucket2_bond"));
    const bucket3Accounts = sortByWithdrawalPriority(accountStates.filter((account) => account.bucket_role === "bucket3_growth"));
    let transferredFromBucket2 = 0;
    let transferredFromBucket3 = 0;

    bucket2Accounts.forEach((account) => {
      if (shortfall <= 0) return;
      const reserve = Math.max(0, U.toFiniteNumber(account.minimum_reserve, 0));
      const available = Math.max(0, account.balance - reserve);
      const draw = Math.min(available, shortfall);
      if (draw <= 0) return;
      account.balance -= draw;
      depositTarget.balance += draw;
      shortfall -= draw;
      transferredFromBucket2 += draw;
    });

    const skipBucket3 = avoidSellingAfterLoss && priorYearBucket3Negative === true;
    if (shortfall > 0 && !skipBucket3) {
      bucket3Accounts.forEach((account) => {
        if (shortfall <= 0) return;
        const reserve = Math.max(0, U.toFiniteNumber(account.minimum_reserve, 0));
        const available = Math.max(0, account.balance - reserve);
        const draw = Math.min(available, shortfall);
        if (draw <= 0) return;
        account.balance -= draw;
        depositTarget.balance += draw;
        shortfall -= draw;
        transferredFromBucket3 += draw;
      });
    }

    const details = [];
    if (transferredFromBucket2 > 0) {
      details.push({
        direction: "info",
        kind: "bucket_rebalance",
        amount: transferredFromBucket2,
        name: "三桶金：債券桶回補現金桶"
      });
    }
    if (transferredFromBucket3 > 0) {
      details.push({
        direction: "info",
        kind: "bucket_rebalance",
        amount: transferredFromBucket3,
        name: "三桶金：成長桶回補現金桶"
      });
    }
    if (skipBucket3 && shortfall > 0) {
      details.push({
        direction: "info",
        kind: "bucket_rebalance_skip",
        amount: shortfall,
        name: "三桶金：成長桶前一年虧損，本年度暫緩回補"
      });
    }

    return { transferredFromBucket2, transferredFromBucket3, details };
  }

  function runLiabilityYear(liabilityStates, age) {
    let debtService = 0;
    const details = [];

    liabilityStates.forEach((liability) => {
      if (!liability.active || liability.current_balance <= 0) {
        liability.current_balance = 0;
        liability.active = false;
        return;
      }

      const payoffAge = U.toFiniteNumber(liability.payoff_age, age);
      if (age >= payoffAge) {
        liability.current_balance = 0;
        liability.active = false;
        return;
      }

      const startBalance = Math.max(0, U.toFiniteNumber(liability.current_balance, 0));
      const annualInterest = startBalance * (Math.max(0, U.toFiniteNumber(liability.annual_interest_rate, 0)) / 100);
      const prepayAge = U.toFiniteNumber(liability.prepay_age, 0);

      if (liability.treatment_mode === "prepay" && prepayAge > 0 && age + 1 >= prepayAge) {
        const requestedPrepay = Math.max(0, U.toFiniteNumber(liability.prepay_amount, 0));
        const payoffAmount = requestedPrepay > 0
          ? Math.max(requestedPrepay, startBalance)
          : startBalance + annualInterest;

        debtService += payoffAmount;
        details.push({
          direction: "outflow",
          kind: "liability_prepay",
          amount: payoffAmount,
          name: `${liability.liability_name || "Liability"} prepay`
        });
        liability.current_balance = 0;
        liability.active = false;
        return;
      }

      let annualPayment = Math.max(0, U.toFiniteNumber(liability.monthly_payment, 0) * 12);
      if (age + 1 >= payoffAge) {
        annualPayment = Math.max(annualPayment, startBalance + annualInterest);
      }

      const appliedPayment = Math.min(startBalance + annualInterest, annualPayment);
      liability.current_balance = Math.max(0, startBalance + annualInterest - appliedPayment);
      debtService += appliedPayment;

      if (liability.current_balance <= 0) {
        liability.active = false;
      }
    });

    return {
      debtService,
      details,
      totalLiabilityBalance: U.sumBy(liabilityStates, (liability) => liability.current_balance)
    };
  }

  function runPropertyYear(propertyStates, liabilityStates, age) {
    let propertyEventNet = 0;
    let fundingEligibleEquity = 0;
    let propertyGrossValue = 0;
    let includedPropertyReturn = 0;
    const details = [];

    propertyStates.forEach((property) => {
      if (!property.active) return;

      const startValue = property.current_market_value;
      const appreciationRate = U.toFiniteNumber(property.annual_appreciation_rate, 0) / 100;
      const endValue = startValue * (1 + appreciationRate);
      property.current_market_value = endValue;

      if (property.funding_mode === "sale_event" && age + 1 >= U.toFiniteNumber(property.sale_age, 999)) {
        const saleCost = endValue * (Math.max(0, U.toFiniteNumber(property.sale_cost_rate, 0)) / 100);
        const linkedLiabilities = getPropertyLinkedLiabilities(property, liabilityStates);
        const debtPayoff = U.sumBy(linkedLiabilities, (liability) => liability.current_balance);
        const netProceeds = endValue - saleCost - debtPayoff;
        propertyEventNet += netProceeds;
        if (debtPayoff > 0) {
          details.push({
            direction: "outflow",
            kind: "property_debt_payoff",
            amount: debtPayoff,
            name: `${property.property_name || "Property"} debt payoff`
          });
        }
        details.push({
          direction: netProceeds >= 0 ? "inflow" : "outflow",
          kind: "property_sale",
          amount: Math.abs(netProceeds),
          name: `${property.property_name || "房產"}出售`
        });
        linkedLiabilities.forEach((liability) => {
          liability.current_balance = 0;
          liability.active = false;
        });
        property.current_market_value = 0;
        property.active = false;
        return;
      }

      if (property.funding_mode === "net_equity") {
        const linkedBalance = U.sumBy(getPropertyLinkedLiabilities(property, liabilityStates), (liability) => liability.current_balance);
        fundingEligibleEquity += Math.max(0, endValue - linkedBalance);
        includedPropertyReturn += Math.max(0, endValue - startValue);
      }

      propertyGrossValue += endValue;
    });

    return {
      propertyEventNet,
      fundingEligibleEquity,
      propertyGrossValue,
      includedPropertyReturn,
      details
    };
  }

  function getBaseExpenseAmount(plan, category, age, inflationRate = 0) {
    return U.sumBy(
      (plan.cashflow.expense_items || []).filter((item) => item.category === category),
      (item) => computeEscalatedAmount(item, age, inflationRate)
    );
  }

  function getRetirementSpendBreakdown(plan, age, state, annualRates = {}) {
    const generalInflationRate = U.toFiniteNumber(annualRates.inflationRate, getGeneralInflation(plan));
    const medicalInflationRate = U.toFiniteNumber(annualRates.medicalInflationRate, getMedicalInflation(plan));
    const spending = annualRates.spending || {};
    const discretionaryMultiplier = U.clamp(U.toFiniteNumber(spending.discretionaryMultiplier, 1), 0.5, 2.5);
    const medicalMultiplier = U.clamp(U.toFiniteNumber(spending.medicalMultiplier, 1), 0.5, 4);
    const careMultiplier = U.clamp(U.toFiniteNumber(spending.careMultiplier, 1), 0.5, 4);
    const essential = getBaseExpenseAmount(plan, "essential", age, generalInflationRate);
    const baseDiscretionary = getBaseExpenseAmount(plan, "discretionary", age, generalInflationRate) * discretionaryMultiplier;
    const baseMedicalRaw = getBaseExpenseAmount(plan, "medical", age, medicalInflationRate) * medicalMultiplier;
    const careRaw = getBaseExpenseAmount(plan, "care", age, medicalInflationRate) * careMultiplier;
    const premium = getBaseExpenseAmount(plan, "premium", age, generalInflationRate);
    const baseMedical = baseMedicalRaw * getMedicalAgeLoad(age);
    const care = careRaw * getCareAgeLoad(age);
    const debt = Math.max(0, U.toFiniteNumber(state.debtService, 0));

    let discretionary = baseDiscretionary;
    const retirementStartAsset = Math.max(1, U.toFiniteNumber(state.retirementStartAsset, state.asset));

    if (plan.strategy.withdrawal_mode === "fixed_rate") {
      // Bengen 4% Rule：退休當年提領「起始資產 × rate%」的金額，之後每年只跟通膨調整，
      // 不論資產漲跌都不重算比例（與「資產百分比法」不同）。
      const initialAmount = U.toFiniteNumber(state.initialFixedWithdrawalAmount, NaN);
      const yearsIntoRetirement = Math.max(0, age - U.toFiniteNumber(plan.timeline.retire_age, age));
      const inflatedTarget = Number.isFinite(initialAmount) && initialAmount > 0
        ? initialAmount * Math.pow(1 + generalInflationRate, yearsIntoRetirement)
        : retirementStartAsset * (U.toFiniteNumber(plan.strategy.fixed_withdrawal_rate, 0) / 100);
      const withdrawalTarget = Math.max(essential, inflatedTarget);
      discretionary = Math.max(0, Math.min(baseDiscretionary * 2.5, withdrawalTarget - essential));
    }

    if (plan.strategy.withdrawal_mode === "guardrail") {
      // Guyton-Klinger 護欄策略（三規則）：
      // 1) 通膨規則：提領跟通膨調整，但前一年投資虧損時凍結本年度調整。
      // 2) 資本保全規則：當年提領率 > 初始提領率 × 上限倍數，且距壽命 > 15 年 → 下修。
      // 3) 繁榮規則：當年提領率 < 初始提領率 × 下限倍數 → 上修。
      // 為維持本系統「必要生活費永遠全額滿足」的原則，規則計算用總提領率，但調整動作只套用在彈性支出。
      const priorDiscretionary = Number.isFinite(state.currentDiscretionarySpend)
        ? state.currentDiscretionarySpend
        : baseDiscretionary;
      const priorYearReturnNegative = state.priorYearReturnNegative === true;
      const initialWithdrawalRate = U.toFiniteNumber(state.initialWithdrawalRate, NaN);
      const floorMultiple = U.toFiniteNumber(plan.strategy.guardrail_floor_pct, 80) / 100;
      const ceilingMultiple = U.toFiniteNumber(plan.strategy.guardrail_ceiling_pct, 120) / 100;
      const adjustStep = U.toFiniteNumber(plan.strategy.guardrail_adjust_step_pct, 10) / 100;
      const currentAsset = Math.max(1, U.toFiniteNumber(state.asset, 0));
      const yearsRemaining = U.toFiniteNumber(plan.timeline.life_expectancy, age) - age;

      discretionary = priorYearReturnNegative
        ? priorDiscretionary
        : priorDiscretionary * (1 + generalInflationRate);

      if (Number.isFinite(initialWithdrawalRate) && initialWithdrawalRate > 0) {
        const currentWithdrawalRate = (essential + discretionary) / currentAsset;
        if (currentWithdrawalRate > initialWithdrawalRate * ceilingMultiple && yearsRemaining > 15) {
          discretionary *= (1 - adjustStep);
        } else if (currentWithdrawalRate < initialWithdrawalRate * floorMultiple) {
          discretionary *= (1 + adjustStep);
        }
      }

      discretionary = Math.max(0, Math.min(baseDiscretionary * 2.5, discretionary));
    }

    const ltc = getLtcExpense(plan, age, baseMedical + care);
    return {
      essential,
      discretionary,
      debt,
      baseMedical,
      care,
      premium,
      ltc,
      total: essential + discretionary + debt + baseMedical + care + premium + ltc
    };
  }

  function getAccumulationExpenseBreakdown(plan, age, debtService, annualRates = {}) {
    const generalInflationRate = U.toFiniteNumber(annualRates.inflationRate, getGeneralInflation(plan));
    const medicalInflationRate = U.toFiniteNumber(annualRates.medicalInflationRate, getMedicalInflation(plan));
    const spending = annualRates.spending || {};
    const discretionaryMultiplier = U.clamp(U.toFiniteNumber(spending.discretionaryMultiplier, 1), 0.5, 2.5);
    const medicalMultiplier = U.clamp(U.toFiniteNumber(spending.medicalMultiplier, 1), 0.5, 4);
    const careMultiplier = U.clamp(U.toFiniteNumber(spending.careMultiplier, 1), 0.5, 4);
    const essential = getBaseExpenseAmount(plan, "essential", age, generalInflationRate);
    const discretionary = getBaseExpenseAmount(plan, "discretionary", age, generalInflationRate) * discretionaryMultiplier;
    const baseMedical = getBaseExpenseAmount(plan, "medical", age, medicalInflationRate) * medicalMultiplier;
    const care = getBaseExpenseAmount(plan, "care", age, medicalInflationRate) * careMultiplier;
    const premium = getBaseExpenseAmount(plan, "premium", age, generalInflationRate);
    const ltc = getLtcExpense(plan, age, baseMedical + care);
    return {
      essential,
      discretionary,
      debt: debtService,
      baseMedical,
      care,
      premium,
      ltc,
      total: essential + discretionary + debtService + baseMedical + care + premium + ltc
    };
  }

  function computeOpeningLiquidPool(plan) {
    const accountTotal = U.sumBy(plan.balance_sheet.accounts, (account) => account.opening_balance);
    const propertyStates = createPropertyStates(plan);
    const liabilityStates = createLiabilityStates(plan);
    return accountTotal + getFundingEligiblePropertyEquity(propertyStates, liabilityStates);
  }

  function computeOpeningNetWorth(plan) {
    const accountTotal = U.sumBy(plan.balance_sheet.accounts, (account) => account.opening_balance);
    const propertyTotal = U.sumBy(plan.balance_sheet.properties, (property) => property.current_market_value);
    const liabilityTotal = U.sumBy(plan.balance_sheet.liabilities, (liability) => liability.current_balance);
    return accountTotal + propertyTotal - liabilityTotal;
  }

  function computeCompatContributionAnnual(plan, snapshot) {
    if (plan.inputs?.useManualContributionOverride === true) {
      return getContributionOverrideAnnual(plan);
    }
    const derivedAnnual = Math.max(
      0,
      U.toFiniteNumber(snapshot.annual_investable_surplus, U.toFiniteNumber(snapshot.annual_saving_total, 0))
    );
    if (derivedAnnual > 0 && U.toFiniteNumber(snapshot.annual_income_total, 0) > 0) return derivedAnnual;
    return Math.max(0, U.toFiniteNumber(plan.inputs?.monthlyContribution, 0) * 12);
  }

  function getPropertyLinkedLiabilitiesForSummary(property, liabilities) {
    const linkedIds = new Set(property.linked_liability_ids || []);
    return (liabilities || []).filter((liability) => {
      if (U.toFiniteNumber(liability.current_balance, 0) <= 0) return false;
      if (liability.linked_property_id && liability.linked_property_id === property.property_id) return true;
      return linkedIds.has(liability.liability_id);
    });
  }

  function buildLegacyCompatibleData(rawData, normalizedPlan) {
    const selfPerson = normalizedPlan.household.persons.find((person) => person.role === "self");
    const spousePerson = normalizedPlan.household.persons.find((person) => person.role === "spouse") || null;
    const snapshot = normalizedPlan.derived.current_snapshot;
    const annualContribution = computeCompatContributionAnnual(normalizedPlan, snapshot);
    const currentInflationRate = getGeneralInflation(normalizedPlan);
    const currentMedicalInflationRate = getMedicalInflation(normalizedPlan);
    const includePropertyInFunding = (normalizedPlan.balance_sheet.properties || []).some((property) => property.funding_mode === "net_equity");
    const propertySummaries = (normalizedPlan.balance_sheet.properties || []).map((property) => {
      const linkedLiabilities = getPropertyLinkedLiabilitiesForSummary(property, normalizedPlan.balance_sheet.liabilities || []);
      const linkedLiabilityBalance = U.sumBy(linkedLiabilities, (liability) => liability.current_balance);
      const linkedLiabilityMonthlyPayment = U.sumBy(linkedLiabilities, (liability) => liability.monthly_payment);
      const netEquity = Math.max(0, U.toFiniteNumber(property.current_market_value, 0) - linkedLiabilityBalance);
      return {
        id: property.property_id,
        name: property.property_name,
        type: property.property_type,
        fundingMode: property.funding_mode,
        currentMarketValue: U.toFiniteNumber(property.current_market_value, 0),
        annualAppreciationRate: U.toFiniteNumber(property.annual_appreciation_rate, 0),
        saleAge: U.toFiniteNumber(property.sale_age, 0) || null,
        saleCostRate: U.toFiniteNumber(property.sale_cost_rate, 0),
        linkedLiabilityIds: linkedLiabilities.map((liability) => liability.liability_id),
        linkedLiabilityBalance,
        linkedLiabilityMonthlyPayment,
        netEquity,
        fundingEligibleEquity: property.funding_mode === "net_equity" ? netEquity : 0
      };
    });
    const propertyById = Object.fromEntries(propertySummaries.map((property) => [property.id, property]));
    const liabilitySummaries = (normalizedPlan.balance_sheet.liabilities || []).map((liability) => {
      const linkedProperty = liability.linked_property_id ? propertyById[liability.linked_property_id] : null;
      return {
        id: liability.liability_id,
        name: liability.liability_name,
        debtType: liability.debt_type,
        currentBalance: U.toFiniteNumber(liability.current_balance, 0),
        monthlyPayment: U.toFiniteNumber(liability.monthly_payment, 0),
        annualPayment: U.toFiniteNumber(liability.monthly_payment, 0) * 12,
        annualInterestRate: U.toFiniteNumber(liability.annual_interest_rate, 0),
        payoffAge: U.toFiniteNumber(liability.payoff_age, 0),
        treatmentMode: liability.treatment_mode,
        prepayAge: U.toFiniteNumber(liability.prepay_age, 0) || null,
        prepayAmount: U.toFiniteNumber(liability.prepay_amount, 0),
        includeInRetirementCashflow: liability.include_in_retirement_cashflow !== false,
        linkedPropertyId: liability.linked_property_id || "",
        linkedPropertyName: linkedProperty?.name || "",
        extendsIntoRetirement: U.toFiniteNumber(liability.payoff_age, 0) > normalizedPlan.timeline.retire_age
      };
    });
    const accountSummaries = (normalizedPlan.balance_sheet.accounts || []).map((account) => {
      const openingBalance = U.toFiniteNumber(account.opening_balance, 0);
      const expectedAnnualDistribution = account.input_mode === "yield_plus_growth"
        ? openingBalance * (Math.max(0, U.toFiniteNumber(account.cash_yield_rate, 0)) / 100)
        : 0;
      const expectedAnnualGrowth = openingBalance * (
        account.input_mode === "yield_plus_growth"
          ? U.toFiniteNumber(account.price_growth_rate, 0) / 100
          : U.toFiniteNumber(account.total_return_rate, 0) / 100
      );

      return {
        id: account.account_id,
        name: account.account_name,
        owner: account.owner,
        accountType: account.account_type,
        assetStyle: account.asset_style,
        primaryDriver: account.ui_primary_driver,
        inputMode: account.input_mode,
        openingBalance,
        totalReturnRate: U.toFiniteNumber(account.total_return_rate, 0),
        cashYieldRate: U.toFiniteNumber(account.cash_yield_rate, 0),
        priceGrowthRate: U.toFiniteNumber(account.price_growth_rate, 0),
        economicTotalReturn: U.toFiniteNumber(account.economic_total_return, 0),
        preRetirementPolicy: account.pre_retirement_policy,
        postRetirementPolicy: account.post_retirement_policy,
        withdrawalPriority: U.toPositiveInt(account.withdrawal_priority, 999),
        minimumReserve: Math.max(0, U.toFiniteNumber(account.minimum_reserve, 0)),
        retirementEligible: account.retirement_eligible !== false,
        expectedAnnualDistribution,
        expectedAnnualGrowth
      };
    });
    const accountSummary = {
      count: accountSummaries.length,
      totalBalance: U.sumBy(accountSummaries, (account) => account.openingBalance),
      incomeStyleBalance: U.sumBy(accountSummaries.filter((account) => account.inputMode === "yield_plus_growth"), (account) => account.openingBalance),
      growthStyleBalance: U.sumBy(accountSummaries.filter((account) => account.inputMode === "total_return"), (account) => account.openingBalance),
      retirementEligibleBalance: U.sumBy(accountSummaries.filter((account) => account.retirementEligible), (account) => account.openingBalance),
      cashAccountBalance: U.sumBy(accountSummaries.filter((account) => account.accountType === "cash"), (account) => account.openingBalance),
      expectedAnnualDistribution: U.sumBy(accountSummaries, (account) => account.expectedAnnualDistribution),
      expectedAnnualGrowth: U.sumBy(accountSummaries, (account) => account.expectedAnnualGrowth)
    };
    const propertySummary = {
      count: propertySummaries.length,
      totalMarketValue: U.sumBy(propertySummaries, (property) => property.currentMarketValue),
      totalNetEquity: U.sumBy(propertySummaries, (property) => property.netEquity),
      fundingEligibleEquity: U.sumBy(propertySummaries, (property) => property.fundingEligibleEquity),
      saleEventCount: propertySummaries.filter((property) => property.fundingMode === "sale_event").length,
      netEquityCount: propertySummaries.filter((property) => property.fundingMode === "net_equity").length
    };
    const liabilitySummary = {
      count: liabilitySummaries.length,
      totalBalance: U.sumBy(liabilitySummaries, (liability) => liability.currentBalance),
      totalMonthlyPayment: U.sumBy(liabilitySummaries, (liability) => liability.monthlyPayment),
      totalAnnualDebtService: U.sumBy(liabilitySummaries, (liability) => liability.annualPayment),
      retirementMonthlyPayment: U.sumBy(
        liabilitySummaries.filter((liability) => liability.includeInRetirementCashflow && liability.extendsIntoRetirement),
        (liability) => liability.monthlyPayment
      ),
      retirementAnnualDebtService: U.sumBy(
        liabilitySummaries.filter((liability) => liability.includeInRetirementCashflow && liability.extendsIntoRetirement),
        (liability) => liability.annualPayment
      ),
      prepayCount: liabilitySummaries.filter((liability) => liability.treatmentMode === "prepay").length
    };

    return {
      ...rawData,
      householdMode: normalizedPlan.household.household_mode,
      selfPerson: {
        name: selfPerson?.name || "",
        currentAge: selfPerson?.current_age || normalizedPlan.timeline.current_age,
        retireAge: selfPerson?.retire_age || normalizedPlan.timeline.retire_age,
        lifeExpectancy: selfPerson?.life_expectancy || normalizedPlan.timeline.life_expectancy
      },
      spousePerson: spousePerson
        ? {
            name: spousePerson.name || "",
            currentAge: spousePerson.current_age,
            retireAge: spousePerson.retire_age,
            lifeExpectancy: spousePerson.life_expectancy
          }
        : null,
      members: normalizedPlan.household.persons.map((person) => ({
        role: person.role,
        name: person.name,
        currentAge: person.current_age,
        retireAge: person.retire_age,
        lifeExpectancy: person.life_expectancy
      })),
      currentAge: normalizedPlan.timeline.current_age,
      retireAge: normalizedPlan.timeline.retire_age,
      lifeExpectancy: normalizedPlan.timeline.life_expectancy,
      assetBuckets: {
        cash: U.sumBy(normalizedPlan.balance_sheet.accounts.filter((account) => account.account_type === "cash"), (account) => account.opening_balance),
        investment: U.sumBy(normalizedPlan.balance_sheet.accounts.filter((account) => account.account_type === "taxable"), (account) => account.opening_balance),
        retirement: U.sumBy(normalizedPlan.balance_sheet.accounts.filter((account) => account.account_type === "retirement"), (account) => account.opening_balance),
        property: U.sumBy(normalizedPlan.balance_sheet.properties, (property) => property.current_market_value),
        includePropertyInFunding
      },
      assets: computeOpeningLiquidPool(normalizedPlan),
      currentSnapshot: snapshot,
      contribution: annualContribution / 12,
      contributionOverride: getContributionOverrideAnnual(normalizedPlan) / 12,
      useManualContributionOverride: normalizedPlan.inputs?.useManualContributionOverride === true,
      accounts: accountSummaries,
      accountSummary,
      properties: propertySummaries,
      propertySummary,
      liabilities: liabilitySummaries,
      liabilitySummary,
      incomes: rawData.incomes || [],
      goals: rawData.goals || [],
      expensePlan: {
        essential: getBaseExpenseAmount(normalizedPlan, "essential", normalizedPlan.timeline.current_age, currentInflationRate) / 12,
        discretionary: getBaseExpenseAmount(normalizedPlan, "discretionary", normalizedPlan.timeline.current_age, currentInflationRate) / 12,
        medical: getBaseExpenseAmount(normalizedPlan, "medical", normalizedPlan.timeline.current_age, currentMedicalInflationRate) / 12,
        care: getBaseExpenseAmount(normalizedPlan, "care", normalizedPlan.timeline.current_age, currentMedicalInflationRate) / 12,
        premium: getBaseExpenseAmount(normalizedPlan, "premium", normalizedPlan.timeline.current_age, currentInflationRate) / 12
      },
      strategy: {
        type: normalizedPlan.strategy.withdrawal_mode,
        referenceWithdrawalRate: U.toFiniteNumber(normalizedPlan.strategy.reference_withdrawal_rate, 4),
        fixedWithdrawalRate: U.toFiniteNumber(normalizedPlan.strategy.fixed_withdrawal_rate, 0),
        annualReviewEnabled: normalizedPlan.strategy.annual_review_enabled !== false,
        guardrailFloor: U.toFiniteNumber(normalizedPlan.strategy.guardrail_floor_pct, 0),
        guardrailCeiling: U.toFiniteNumber(normalizedPlan.strategy.guardrail_ceiling_pct, 0),
        guardrailAdjustStep: U.toFiniteNumber(normalizedPlan.strategy.guardrail_adjust_step_pct, 10),
        bucketCashMonths: U.toFiniteNumber(normalizedPlan.strategy.bucket_cash_months, 24),
        bucketBondYears: U.toFiniteNumber(normalizedPlan.strategy.bucket_bond_years, 8),
        bucketAvoidSellingGrowthAfterLoss: normalizedPlan.strategy.bucket_avoid_selling_growth_after_loss !== false
      },
      returnRate: U.toFiniteNumber(normalizedPlan.assumptions.pre_retire_return_rate, 0),
      postReturnRate: U.toFiniteNumber(normalizedPlan.assumptions.post_retire_return_rate, 0),
      inflationRate: U.toFiniteNumber(normalizedPlan.assumptions.inflation_rate, 0),
      medicalInflationRate: U.toFiniteNumber(normalizedPlan.assumptions.medical_inflation_rate, 0),
      taxAssumptions: {
        earnedIncomeTaxRate: U.toFiniteNumber(normalizedPlan.assumptions?.tax?.earned_income_tax_rate, 0),
        passiveIncomeTaxRate: U.toFiniteNumber(normalizedPlan.assumptions?.tax?.passive_income_tax_rate, 0),
        benefitIncomeTaxRate: U.toFiniteNumber(normalizedPlan.assumptions?.tax?.benefit_income_tax_rate, 0)
      },
      ltcProfile: {
        enabled: normalizedPlan.strategy.ltc.enabled,
        startAge: normalizedPlan.strategy.ltc.start_age,
        durationYears: normalizedPlan.strategy.ltc.duration_years,
        extraCostFactor: normalizedPlan.strategy.ltc.extra_cost_factor
      },
      diagnostics: {
        warnings: normalizedPlan.derived?.warnings || [],
        blockingErrors: normalizedPlan.derived?.blocking_errors || [],
        antiDoubleCountFlags: normalizedPlan.derived?.anti_double_count_flags || []
      },
      monteCarloOptions: rawData.monteCarloOptions || {}
    };
  }

  function buildDeterministicProjection(normalizedPlan, options = {}) {
    const plan = normalizedPlan;
    const accountStates = createAccountStates(plan);
    const propertyStates = createPropertyStates(plan);
    const liabilityStates = createLiabilityStates(plan);
    const path = [];
    const netWorthPath = [];
    const annualLedger = [];
    const ages = createAgeRange(plan);
    const initialRetirementSpending = getAnnualSpendingSnapshot(plan, plan.timeline.retire_age, options);
    let currentDiscretionarySpend = getBaseExpenseAmount(
      plan,
      "discretionary",
      plan.timeline.retire_age,
      getGeneralInflation(plan)
    ) * U.toFiniteNumber(initialRetirementSpending.discretionaryMultiplier, 1);
    let retirementStartLiquid = null;
    let retirementStartNetWorth = null;
    let initialFixedWithdrawalAmount = null;
    let initialWithdrawalRate = null;
    let priorYearReturnNegative = false;
    let priorYearBucket3Negative = false;

    ages.slice(0, -1).forEach((age) => {
      const phase = age < plan.timeline.retire_age ? "accumulation" : "retirement";
      const annualRates = getAnnualRateSnapshot(plan, age, options);
      annualRates.spending = getAnnualSpendingSnapshot(plan, age, options);
      const startAccountTotal = U.sumBy(accountStates, (account) => account.balance);
      const startFundingEligibleEquity = getFundingEligiblePropertyEquity(propertyStates, liabilityStates);
      const startPropertyGross = getActivePropertyGrossValue(propertyStates);
      const startLiabilityBalance = U.sumBy(liabilityStates, (liability) => liability.current_balance);
      const startLiquidPool = startAccountTotal + startFundingEligibleEquity;
      const startNetWorth = startAccountTotal + startPropertyGross - startLiabilityBalance;

      if (age === plan.timeline.retire_age) {
        retirementStartLiquid = startLiquidPool;
        retirementStartNetWorth = startNetWorth;
        initialFixedWithdrawalAmount = retirementStartLiquid * (U.toFiniteNumber(plan.strategy.fixed_withdrawal_rate, 0) / 100);
        const initialEssential = getBaseExpenseAmount(plan, "essential", age, getGeneralInflation(plan));
        initialWithdrawalRate = U.safeDivide(initialEssential + currentDiscretionarySpend, Math.max(1, retirementStartLiquid), 0);
      }

      path.push({ age, value: Math.max(0, startLiquidPool) });
      netWorthPath.push({ age, value: startNetWorth });

      const accountPerf = runAccountPerformance(accountStates, age, phase, plan, options);
      const liabilityPerf = runLiabilityYear(liabilityStates, age);
      const propertyPerf = runPropertyYear(propertyStates, liabilityStates, age);

      const earnedIncome = sumIncomeAtAge(plan.cashflow.earned_incomes, age, annualRates.inflationRate);
      const passiveIncome = sumIncomeAtAge(plan.cashflow.passive_incomes, age, annualRates.inflationRate);
      const benefitIncome = sumIncomeAtAge(plan.cashflow.benefit_incomes, age, annualRates.inflationRate);
      const grossRegularIncome = earnedIncome + passiveIncome + benefitIncome + accountPerf.distributionCash;
      const taxExpense = estimateAnnualTax(plan, { earnedIncome, passiveIncome, benefitIncome });

      const goalCashflow = buildGoalCashflow(plan, age, annualRates.inflationRate);
      const spend = phase === "retirement"
        ? getRetirementSpendBreakdown(plan, age, {
            asset: startLiquidPool,
            retirementStartAsset: retirementStartLiquid || startLiquidPool,
            currentDiscretionarySpend,
            debtService: liabilityPerf.debtService,
            initialFixedWithdrawalAmount,
            initialWithdrawalRate,
            priorYearReturnNegative
          }, annualRates)
        : getAccumulationExpenseBreakdown(plan, age, liabilityPerf.debtService, annualRates);

      currentDiscretionarySpend = spend.discretionary;

      const regularNetCashflowBeforeGoals = grossRegularIncome - taxExpense - spend.total;
      const useManualContributionOverride = phase === "accumulation" && plan.inputs?.useManualContributionOverride === true;
      const manualContributionOverrideAnnual = useManualContributionOverride ? getContributionOverrideAnnual(plan) : 0;
      const contributionToAccounts = phase === "accumulation"
        ? (useManualContributionOverride ? manualContributionOverrideAnnual : Math.max(0, regularNetCashflowBeforeGoals))
        : 0;
      const residualNet = phase === "accumulation"
        ? (useManualContributionOverride ? 0 : Math.min(0, regularNetCashflowBeforeGoals))
        : regularNetCashflowBeforeGoals;
      const manualOverrideAdjustment = useManualContributionOverride
        ? manualContributionOverrideAnnual - regularNetCashflowBeforeGoals
        : 0;
      const eventAmount = residualNet + goalCashflow.netAmount + propertyPerf.propertyEventNet;

      const eventDetails = [
        ...goalCashflow.details,
        ...liabilityPerf.details,
        ...propertyPerf.details
      ];

      if (spend.premium > 0) {
        eventDetails.unshift({
          direction: "outflow",
          kind: "premium",
          amount: spend.premium,
          name: "Annual premium expense"
        });
      }
      if (taxExpense > 0) {
        eventDetails.unshift({
          direction: "outflow",
          kind: "tax",
          amount: taxExpense,
          name: "Annual estimated tax"
        });
      }

      if (phase === "retirement" && grossRegularIncome > 0) {
        eventDetails.unshift(
          { direction: "inflow", kind: "benefit_income", amount: benefitIncome, name: "制度型給付" },
          { direction: "inflow", kind: "passive_income", amount: passiveIncome + accountPerf.distributionCash, name: "被動收入 / 帳戶收益" },
          { direction: "inflow", kind: "earned_income", amount: earnedIncome, name: "工作收入" }
        );
      } else if (phase === "accumulation" && useManualContributionOverride) {
        eventDetails.unshift({
          direction: manualOverrideAdjustment >= 0 ? "inflow" : "outflow",
          kind: "manual_contribution_override",
          amount: Math.abs(manualOverrideAdjustment),
          name: "Manual contribution override adjustment"
        });
      } else if (phase === "accumulation" && regularNetCashflowBeforeGoals < 0) {
        eventDetails.unshift({
          direction: "outflow",
          kind: "cashflow_gap",
          amount: Math.abs(regularNetCashflowBeforeGoals),
          name: "年度現金流缺口"
        });
      }

      const bucketRebalance = phase === "retirement"
        ? runBucketRebalance(accountStates, spend.total, plan, priorYearBucket3Negative)
        : { transferredFromBucket2: 0, transferredFromBucket3: 0, details: [] };
      eventDetails.push(...bucketRebalance.details);

      const netCashDelta = contributionToAccounts + eventAmount;
      const cashRouting = applyNetCashToAccounts(accountStates, netCashDelta, plan.strategy.withdrawal_mode);
      priorYearReturnNegative = accountPerf.investmentReturn < 0;
      priorYearBucket3Negative = U.toFiniteNumber(accountPerf.returnByBucketRole?.bucket3_growth, 0) < 0;
      const endAccountTotal = U.sumBy(accountStates, (account) => account.balance);
      const endLiabilityBalance = liabilityPerf.totalLiabilityBalance;
      const endLiquidPool = Math.max(0, endAccountTotal + propertyPerf.fundingEligibleEquity);
      const endNetWorth = endAccountTotal + propertyPerf.propertyGrossValue - endLiabilityBalance;

      annualLedger.push({
        age,
        phase,
        start_liquid_pool: startLiquidPool,
        start_net_worth: startNetWorth,
        earned_income: earnedIncome,
        passive_income_manual: passiveIncome + accountPerf.distributionCash,
        benefit_income: benefitIncome,
        gross_regular_income: grossRegularIncome,
        account_distribution_cash: accountPerf.distributionCash,
        account_principal_sales: cashRouting.principalSales,
        goal_events_net: goalCashflow.netAmount,
        property_events_net: propertyPerf.propertyEventNet,
        essential_expense: spend.essential,
        discretionary_expense: spend.discretionary,
        medical_expense: spend.baseMedical,
        care_expense: spend.care,
        premium_expense: spend.premium,
        tax_expense: taxExpense,
        debt_service: spend.debt,
        ltc_expense: spend.ltc,
        net_regular_cashflow_before_goals: regularNetCashflowBeforeGoals,
        derived_contribution: contributionToAccounts,
        manual_contribution_override_used: useManualContributionOverride,
        manual_override_adjustment: manualOverrideAdjustment,
        net_contribution_to_accounts: contributionToAccounts,
        account_investment_return: accountPerf.investmentReturn + propertyPerf.includedPropertyReturn,
        end_liquid_pool: endLiquidPool,
        end_net_worth: endNetWorth,
        event_details: eventDetails.filter((detail) => U.toFiniteNumber(detail.amount, 0) > 0)
      });
    });

    const finalAccountTotal = U.sumBy(accountStates, (account) => account.balance);
    const finalFundingEligibleEquity = getFundingEligiblePropertyEquity(propertyStates, liabilityStates);
    const finalPropertyGross = getActivePropertyGrossValue(propertyStates);
    const finalLiabilityBalance = U.sumBy(liabilityStates, (liability) => liability.current_balance);
    path.push({ age: plan.timeline.life_expectancy, value: Math.max(0, finalAccountTotal + finalFundingEligibleEquity) });
    netWorthPath.push({ age: plan.timeline.life_expectancy, value: finalAccountTotal + finalPropertyGross - finalLiabilityBalance });

    return {
      path,
      netWorthPath,
      annualLedger,
      retirementStartLiquid: retirementStartLiquid ?? path.find((point) => point.age === plan.timeline.retire_age)?.value ?? 0,
      retirementStartNetWorth: retirementStartNetWorth ?? netWorthPath.find((point) => point.age === plan.timeline.retire_age)?.value ?? 0
    };
  }

  function calcPathMaxDrawdown(path) {
    if (!Array.isArray(path) || !path.length) return 0;
    let peak = Math.max(0, U.toFiniteNumber(path[0].value, 0));
    let maxDrawdown = 0;

    path.forEach((point) => {
      const value = Math.max(0, U.toFiniteNumber(point.value, 0));
      peak = Math.max(peak, value);
      if (peak <= 0) return;
      maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
    });

    return maxDrawdown;
  }

  function evaluateProjection(normalizedPlan, deterministicProjection) {
    const plan = normalizedPlan;
    const retirementPoint = deterministicProjection.path.find((point) => point.age === plan.timeline.retire_age)
      || deterministicProjection.path[deterministicProjection.path.length - 1]
      || { age: plan.timeline.retire_age, value: 0 };
    const finalPoint = deterministicProjection.path[deterministicProjection.path.length - 1]
      || { age: plan.timeline.life_expectancy, value: 0 };
    const depletionPoint = deterministicProjection.path.find((point, index) => index > 0 && point.age >= plan.timeline.retire_age && point.value <= 0);
    const firstRetirementRow = deterministicProjection.annualLedger.find((entry) => entry.phase === "retirement");

    const firstYearSpend = firstRetirementRow
      ? {
          essential: firstRetirementRow.essential_expense,
          discretionary: firstRetirementRow.discretionary_expense,
          debt: firstRetirementRow.debt_service,
          baseMedical: firstRetirementRow.medical_expense,
          care: firstRetirementRow.care_expense,
          premium: firstRetirementRow.premium_expense,
          tax: firstRetirementRow.tax_expense,
          ltc: firstRetirementRow.ltc_expense,
          total: firstRetirementRow.essential_expense + firstRetirementRow.discretionary_expense + firstRetirementRow.debt_service + firstRetirementRow.medical_expense + firstRetirementRow.care_expense + firstRetirementRow.premium_expense + firstRetirementRow.tax_expense + firstRetirementRow.ltc_expense
        }
      : { essential: 0, discretionary: 0, debt: 0, baseMedical: 0, care: 0, premium: 0, tax: 0, ltc: 0, total: 0 };

    const referenceWithdrawalRate = (() => {
      const candidate = U.toFiniteNumber(normalizedPlan.strategy.reference_withdrawal_rate, NaN);
      if (Number.isFinite(candidate) && candidate > 0) return candidate;
      const fixed = U.toFiniteNumber(normalizedPlan.strategy.fixed_withdrawal_rate, NaN);
      if (Number.isFinite(fixed) && fixed > 0) return fixed;
      return 4;
    })();

    const rule4Target = firstYearSpend.total > 0 ? firstYearSpend.total / (referenceWithdrawalRate / 100) : 0;
    const fundedRatio = rule4Target > 0 ? retirementPoint.value / rule4Target : 0;

    return {
      retirementPoint,
      finalPoint,
      depletionPoint: depletionPoint || null,
      firstYearSpend,
      referenceWithdrawalRate,
      rule4Target,
      fundedRatio,
      maxDrawdown: calcPathMaxDrawdown(deterministicProjection.path)
    };
  }

  function toLegacyProjection(deterministicProjection) {
    return {
      path: deterministicProjection.path.map((point) => ({ age: point.age, value: point.value })),
      netWorthPath: deterministicProjection.netWorthPath.map((point) => ({ age: point.age, value: point.value })),
      ledger: deterministicProjection.annualLedger.map((entry) => ({
        phase: entry.phase,
        startAge: entry.age,
        endAge: entry.age + 1,
        startAsset: entry.start_liquid_pool,
        returnRate: 0,
        investmentReturn: entry.account_investment_return,
        contribution: entry.net_contribution_to_accounts,
        essential: entry.essential_expense,
        discretionary: entry.discretionary_expense,
        debt: entry.debt_service,
        baseMedical: entry.medical_expense,
        care: entry.care_expense,
        premium: entry.premium_expense,
        tax: entry.tax_expense,
        ltc: entry.ltc_expense,
        spendTotal: entry.essential_expense + entry.discretionary_expense + entry.debt_service + entry.medical_expense + entry.care_expense + entry.premium_expense + entry.tax_expense + entry.ltc_expense,
        eventAmount: entry.goal_events_net
          + entry.property_events_net
          + (entry.phase === "retirement" ? entry.gross_regular_income : 0)
          + (entry.phase === "accumulation" ? Math.min(0, entry.net_regular_cashflow_before_goals || 0) : 0)
          + (entry.manual_override_adjustment || 0),
        eventDetails: entry.event_details.map((detail) => ({
          direction: detail.direction,
          amount: detail.amount,
          name: detail.name
        })),
        endAsset: entry.end_liquid_pool
      }))
    };
  }

  function normalizeScenarioCMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (["return_rate", "return", "return rate", "?????", "???", "????", "?????"].includes(mode)) {
      return "return_rate";
    }
    if (["retire_delay", "delay", "retire_later", "????", "??????"].includes(mode)) {
      return "retire_delay";
    }
    if (["contribution", "contrib", "??", "????", "??????"].includes(mode)) {
      return "contribution";
    }
    return "mixed";
  }

  function getScenarioCSettings(rawFormState = {}) {
    return {
      mode: normalizeScenarioCMode(rawFormState.scenarioCMode),
      returnBoostPct: Math.max(0, U.toFiniteNumber(rawFormState.scenarioCReturnBoostPct, 1)),
      retireDelayYears: Math.max(0, Math.trunc(U.toFiniteNumber(rawFormState.scenarioCRetireDelayYears, 2))),
      contributionBoostPct: Math.max(0, U.toFiniteNumber(rawFormState.scenarioCContributionBoostPct, 15))
    };
  }

  function getScenarioCModeLabel(mode = "mixed") {
    const normalized = normalizeScenarioCMode(mode);
    if (normalized === "return_rate") return "報酬率優化";
    if (normalized === "retire_delay") return "延後退休優化";
    if (normalized === "contribution") return "提高提撥優化";
    return "綜合優化";
  }

  function buildScenarioCDescription(settings = {}) {
    const modeLabel = getScenarioCModeLabel(settings.mode);
    const parts = [];

    if (settings.mode === "return_rate" || settings.mode === "mixed") {
      parts.push(`報酬率提高 ${U.toFiniteNumber(settings.returnBoostPct, 0).toFixed(1)} 個百分點`);
    }
    if (settings.mode === "retire_delay" || settings.mode === "mixed") {
      parts.push(`退休延後 ${Math.max(0, Math.trunc(U.toFiniteNumber(settings.retireDelayYears, 0)))} 年`);
    }
    if (settings.mode === "contribution" || settings.mode === "mixed") {
      parts.push(`每月提撥提高 ${U.toFiniteNumber(settings.contributionBoostPct, 0).toFixed(0)}%`);
    }

    return parts.length
      ? `C 目前為「${modeLabel}」：${parts.join("、")}。`
      : "C 目前沒有啟用任何優化槓桿。";
  }

  function createScenarioDefinitions(rawFormState = {}) {
    const scenarioCSettings = getScenarioCSettings(rawFormState);
    return [
      {
        id: "A",
        label: "方案 A 基準",
        description: "完全沿用目前輸入，不改任何假設。"
      },
      {
        id: "B",
        label: "方案 B 保守",
        description: "保守壓力情境，會把報酬調低 1 個百分點、通膨調高 0.5 個百分點，看在較不利假設下會掉多少。"
      },
      {
        id: "C",
        label: `方案 C（${getScenarioCModeLabel(scenarioCSettings.mode)}）`,
        description: buildScenarioCDescription(scenarioCSettings),
        settings: scenarioCSettings
      }
    ];
  }

  function buildScenarioRawData(rawFormState, scenarioId) {
    const nextRaw = cloneJson(rawFormState || {});
    if (scenarioId === "B") {
      nextRaw.returnRate = U.toFiniteNumber(rawFormState?.returnRate, 5) - 1;
      nextRaw.postReturnRate = U.toFiniteNumber(rawFormState?.postReturnRate, 2) - 1;
      nextRaw.inflationRate = U.toFiniteNumber(rawFormState?.inflationRate, 2) + 0.5;
      if (Array.isArray(nextRaw.accounts)) {
        nextRaw.accounts = nextRaw.accounts.map((account) => ({
          ...account,
          totalReturnRate: U.toFiniteNumber(account.totalReturnRate ?? account.total_return_rate, 0) - 1,
          priceGrowthRate: U.toFiniteNumber(account.priceGrowthRate ?? account.price_growth_rate, 0) - 1
        }));
      }
    }

    if (scenarioId === "C") {
      const settings = getScenarioCSettings(rawFormState);
      const applyReturnBoost = settings.mode === "return_rate" || settings.mode === "mixed";
      const applyRetireDelay = settings.mode === "retire_delay" || settings.mode === "mixed";
      const applyContributionBoost = settings.mode === "contribution" || settings.mode === "mixed";
      const returnBoost = U.toFiniteNumber(settings.returnBoostPct, 0);
      const contributionBoost = U.toFiniteNumber(settings.contributionBoostPct, 0);
      const retireDelayYears = Math.max(0, Math.trunc(U.toFiniteNumber(settings.retireDelayYears, 0)));

      if (applyReturnBoost) {
        nextRaw.returnRate = U.toFiniteNumber(rawFormState?.returnRate, 5) + returnBoost;
        nextRaw.postReturnRate = U.toFiniteNumber(rawFormState?.postReturnRate, 2) + returnBoost;
        if (Array.isArray(nextRaw.accounts)) {
          nextRaw.accounts = nextRaw.accounts.map((account) => {
            const driver = account.uiPrimaryDriver ?? account.ui_primary_driver ?? "growth";
            const totalReturnRate = U.toFiniteNumber(account.totalReturnRate ?? account.total_return_rate, 0);
            const priceGrowthRate = U.toFiniteNumber(account.priceGrowthRate ?? account.price_growth_rate, 0);
            const cashYieldRate = U.toFiniteNumber(account.cashYieldRate ?? account.cash_yield_rate, 0);

            if (driver === "growth") {
              return {
                ...account,
                totalReturnRate: totalReturnRate + returnBoost
              };
            }

            return {
              ...account,
              totalReturnRate: totalReturnRate + returnBoost,
              cashYieldRate,
              priceGrowthRate: priceGrowthRate + returnBoost
            };
          });
        }
      }

      if (applyRetireDelay) {
        nextRaw.retireAge = Math.min(
          U.toPositiveInt(rawFormState?.lifeExpectancy, 90) - 1,
          U.toPositiveInt(rawFormState?.retireAge, 65) + retireDelayYears
        );
        if (rawFormState?.householdMode === "couple") {
          nextRaw.spouseRetireAge = Math.min(
            U.toPositiveInt(rawFormState?.spouseLifeExpectancy, 92) - 1,
            U.toPositiveInt(rawFormState?.spouseRetireAge, 63) + retireDelayYears
          );
        }
      }

      if (applyContributionBoost) {
        const baseContribution = U.toFiniteNumber(
          rawFormState?.monthlyContributionOverride ?? rawFormState?.monthlyContribution,
          0
        );
        const boostedContribution = Math.round(baseContribution * (1 + contributionBoost / 100));
        nextRaw.monthlyContribution = boostedContribution;
        nextRaw.monthlyContributionOverride = boostedContribution;
        nextRaw.useManualContributionOverride = true;
      } else if (rawFormState?.useManualContributionOverride === true) {
        nextRaw.monthlyContribution = U.toFiniteNumber(
          rawFormState?.monthlyContributionOverride ?? rawFormState?.monthlyContribution,
          0
        );
        nextRaw.monthlyContributionOverride = U.toFiniteNumber(
          rawFormState?.monthlyContributionOverride ?? rawFormState?.monthlyContribution,
          0
        );
        nextRaw.useManualContributionOverride = true;
      }
    }

    return nextRaw;
  }

  function buildScenarioComparisons(rawFormState, normalizedPlan = null) {

    const basePlan = normalizedPlan || normalizeFromRaw(rawFormState);
    if (!basePlan) return [];

    return createScenarioDefinitions(rawFormState).map((definition) => {
      const scenarioRaw = buildScenarioRawData(rawFormState, definition.id);
      const scenarioPlan = normalizeFromRaw(scenarioRaw) || basePlan;
      const projectionResult = buildProjectionResult(scenarioPlan);
      const compatibleData = buildLegacyCompatibleData(scenarioRaw, scenarioPlan);

      return {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        settings: definition.settings || null,
        rawData: scenarioRaw,
        normalizedPlan: scenarioPlan,
        projectionResult,
        data: compatibleData,
        projection: projectionResult.legacy.projection,
        evaluation: projectionResult.legacy.evaluation
      };
    });
  }

  function buildMonteCarloRunRawData(rawFormState, normalizedPlan) {
    const raw = cloneJson(rawFormState || {});
    const mc = normalizedPlan?.monte_carlo || {};
    const basePreReturn = U.toFiniteNumber(normalizedPlan?.assumptions?.pre_retire_return_rate, 0) / 100;
    const basePostReturn = U.toFiniteNumber(normalizedPlan?.assumptions?.post_retire_return_rate, 0) / 100;
    const baseInflation = U.toFiniteNumber(normalizedPlan?.assumptions?.inflation_rate, 0) / 100;
    const baseMedicalInflation = U.toFiniteNumber(normalizedPlan?.assumptions?.medical_inflation_rate, 0) / 100;
    const returnVolatility = Math.max(0, U.toFiniteNumber(mc.return_volatility, 0) / 100);
    const inflationVolatility = Math.max(0, U.toFiniteNumber(mc.inflation_volatility, 0) / 100);
    const medicalSpread = Math.max(0, baseMedicalInflation - baseInflation);

    const sampledPreReturn = U.clamp(basePreReturn + drawFatTailShock(returnVolatility, 6), -0.95, 1.2);
    const sampledPostReturn = U.clamp(basePostReturn + drawFatTailShock(returnVolatility * 0.7, 6), -0.95, 0.9);
    const sampledInflation = U.clamp(baseInflation + randomNormal() * inflationVolatility, -0.02, 0.12);
    const sampledMedicalInflation = Math.max(sampledInflation, sampledInflation + medicalSpread);

    raw.returnRate = sampledPreReturn * 100;
    raw.postReturnRate = sampledPostReturn * 100;
    raw.inflationRate = sampledInflation * 100;
    raw.medicalInflationRate = sampledMedicalInflation * 100;

    if (Array.isArray(raw.accounts)) {
      const preReturnDelta = (sampledPreReturn - basePreReturn) * 100;
      raw.accounts = raw.accounts.map((account) => {
        const driver = account.uiPrimaryDriver || account.ui_primary_driver || "growth";
        const totalReturn = U.toFiniteNumber(account.totalReturnRate ?? account.total_return_rate, 0);
        const priceGrowth = U.toFiniteNumber(account.priceGrowthRate ?? account.price_growth_rate, 0);
        return {
          ...account,
          totalReturnRate: totalReturn + preReturnDelta,
          priceGrowthRate: driver === "growth"
            ? priceGrowth
            : priceGrowth + preReturnDelta
        };
      });
    }

    if (mc.flexible_spending && raw.withdrawalStrategy !== "guardrail") {
      raw.withdrawalStrategy = "guardrail";
      raw.strategyGuardrailFloor = U.toFiniteNumber(mc.spending_floor_pct, 85);
      raw.strategyGuardrailCeiling = U.toFiniteNumber(mc.spending_ceiling_pct, 110);
    }

    return {
      raw,
      sampledAssumptions: {
        pre_retire_return_rate: sampledPreReturn * 100,
        post_retire_return_rate: sampledPostReturn * 100,
        inflation_rate: sampledInflation * 100,
        medical_inflation_rate: sampledMedicalInflation * 100
      }
    };
  }

  function buildLegacyMonteCarloSummary(monteCarloResult) {
    if (!monteCarloResult?.enabled) return null;
    return {
      successRate: U.toFiniteNumber(monteCarloResult.success_rate, 0),
      p10: U.toFiniteNumber(monteCarloResult.p10_final_liquid_pool, 0),
      p50: U.toFiniteNumber(monteCarloResult.p50_final_liquid_pool, 0),
      p90: U.toFiniteNumber(monteCarloResult.p90_final_liquid_pool, 0),
      percentileSeries: (monteCarloResult.percentile_series || []).map((point) => ({
        age: point.age,
        p10: U.toFiniteNumber(point.p10_liquid_pool, 0),
        p50: U.toFiniteNumber(point.p50_liquid_pool, 0),
        p90: U.toFiniteNumber(point.p90_liquid_pool, 0)
      })),
      medianDepletionAge: monteCarloResult.median_depletion_age,
      medianMaxDrawdown: U.toFiniteNumber(monteCarloResult.median_max_drawdown, 0),
      worst10MaxDrawdown: U.toFiniteNumber(monteCarloResult.worst10_max_drawdown, 0),
      assumptions: monteCarloResult.assumptions || {}
    };
  }

  function buildMonteCarloRateSeries(basePlan) {
    const mc = basePlan?.monte_carlo || {};
    const ages = createAgeRange(basePlan).slice(0, -1);
    const rateSeriesByAge = {};
    const spendingSeriesByAge = {};
    const basePreReturn = U.toFiniteNumber(basePlan?.assumptions?.pre_retire_return_rate, 0) / 100;
    const basePostReturn = U.toFiniteNumber(basePlan?.assumptions?.post_retire_return_rate, 0) / 100;
    const baseInflation = getGeneralInflation(basePlan);
    const baseMedicalInflation = getMedicalInflation(basePlan);
    const returnVolatility = Math.max(0, U.toFiniteNumber(mc.return_volatility, 0) / 100);
    const inflationVolatility = Math.max(0, U.toFiniteNumber(mc.inflation_volatility, 0) / 100);
    const spendingVolatility = Math.max(0, U.toFiniteNumber(mc.spending_volatility, 0) / 100);
    const randomInflation = mc.random_inflation !== false;
    const flexibleSpending = mc.flexible_spending === true;
    const medicalVolatility = inflationVolatility * 1.2;
    const retireAge = U.toFiniteNumber(basePlan?.timeline?.retire_age, 0);

    let constantInflationRate = baseInflation;
    let constantMedicalInflationRate = Math.max(baseInflation, baseMedicalInflation);

    if (!randomInflation) {
      constantInflationRate = U.clamp(baseInflation + randomNormal() * inflationVolatility, -0.02, 0.12);
      constantMedicalInflationRate = Math.max(
        constantInflationRate,
        U.clamp(baseMedicalInflation + randomNormal() * medicalVolatility, -0.02, 0.2)
      );
    }

    ages.forEach((age) => {
      const annualReturnShock = drawFatTailShock(returnVolatility, 6);
      const sampledPreReturn = U.clamp(basePreReturn + annualReturnShock, -0.95, 1.2);
      const sampledPostReturn = U.clamp(basePostReturn + annualReturnShock * 0.8, -0.95, 0.9);
      const sampledInflation = randomInflation
        ? U.clamp(baseInflation + randomNormal() * inflationVolatility, -0.02, 0.12)
        : constantInflationRate;
      const sampledMedicalInflation = randomInflation
        ? Math.max(sampledInflation, U.clamp(baseMedicalInflation + randomNormal() * medicalVolatility, -0.02, 0.2))
        : constantMedicalInflationRate;

      rateSeriesByAge[age] = {
        pre_retire_return_rate: sampledPreReturn * 100,
        post_retire_return_rate: sampledPostReturn * 100,
        inflation_rate: sampledInflation * 100,
        medical_inflation_rate: sampledMedicalInflation * 100
      };

      if (!flexibleSpending || spendingVolatility <= 0) {
        spendingSeriesByAge[age] = {
          discretionary_multiplier: 1,
          medical_multiplier: 1,
          care_multiplier: 1
        };
        return;
      }

      const ageFactor = age < retireAge
        ? 0.55
        : 1 + Math.min(1.6, Math.max(0, age - retireAge) / 18 * 0.3);
      const discretionaryShock = randomNormal() * spendingVolatility * ageFactor;
      const medicalShock = drawFatTailShock(spendingVolatility * Math.max(1, getMedicalAgeLoad(age)) * 1.4, 5);
      const careShock = drawFatTailShock(spendingVolatility * Math.max(1, getCareAgeLoad(age)) * 1.8, 4);

      spendingSeriesByAge[age] = {
        discretionary_multiplier: U.clamp(1 + discretionaryShock, 0.5, 2.5),
        medical_multiplier: U.clamp(1 + Math.max(-0.2, medicalShock), 0.5, 4),
        care_multiplier: U.clamp(1 + Math.max(-0.15, careShock), 0.5, 4)
      };
    });

    const modelName = flexibleSpending && spendingVolatility > 0
      ? "sequence-level annual sampling with spending elasticity"
      : "sequence-level annual sampling on unified deterministic engine";

    return {
      rateSeriesByAge,
      spendingSeriesByAge,
      assumptions: {
        model: modelName,
        random_inflation: randomInflation,
        return_volatility: U.toFiniteNumber(mc.return_volatility, 0),
        inflation_volatility: U.toFiniteNumber(mc.inflation_volatility, 0),
        spending_volatility: U.toFiniteNumber(mc.spending_volatility, 0),
        flexible_spending: flexibleSpending
      }
    };
  }

  function runMonteCarlo(rawFormState, normalizedPlan = null) {
    const basePlan = normalizedPlan || normalizeFromRaw(rawFormState);
    if (!basePlan?.monte_carlo?.enabled) return null;

    const runs = Math.max(100, U.toPositiveInt(basePlan.monte_carlo.runs, 500));
    const finalLiquidPools = [];
    const depletionAges = [];
    const maxDrawdowns = [];
    const liquidPathsByRun = [];

    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      const runSetup = buildMonteCarloRateSeries(basePlan);
      const runProjectionResult = buildProjectionResult(basePlan, {
        rateSeriesByAge: runSetup.rateSeriesByAge,
        spendingSeriesByAge: runSetup.spendingSeriesByAge
      });
      const runEvaluation = runProjectionResult.deterministic.evaluation;
      const liquidPath = runProjectionResult.deterministic.liquid_path || [];

      finalLiquidPools.push(U.toFiniteNumber(runEvaluation.final_liquid_pool, 0));
      maxDrawdowns.push(U.toFiniteNumber(runEvaluation.max_drawdown, 0));
      depletionAges.push(runEvaluation.depletion_age);
      liquidPathsByRun.push(liquidPath);
    }

    if (!liquidPathsByRun.length) return null;

    const percentileSeries = [];
    const baselineAges = liquidPathsByRun[0].map((point) => point.age);
    baselineAges.forEach((age, index) => {
      const valuesAtAge = liquidPathsByRun.map((path) => U.toFiniteNumber(path[index]?.value, 0));
      percentileSeries.push({
        age,
        p10_liquid_pool: percentile(valuesAtAge, 0.1),
        p50_liquid_pool: percentile(valuesAtAge, 0.5),
        p90_liquid_pool: percentile(valuesAtAge, 0.9)
      });
    });

    const validDepletionAges = depletionAges
      .filter((age) => Number.isFinite(age))
      .sort((left, right) => left - right);
    const successCount = depletionAges.filter((age) => !Number.isFinite(age)).length;

    const monteCarloResult = {
      enabled: true,
      runs: liquidPathsByRun.length,
      success_rate: (successCount / liquidPathsByRun.length) * 100,
      p10_final_liquid_pool: percentile(finalLiquidPools, 0.1),
      p50_final_liquid_pool: percentile(finalLiquidPools, 0.5),
      p90_final_liquid_pool: percentile(finalLiquidPools, 0.9),
      median_depletion_age: validDepletionAges.length ? percentile(validDepletionAges, 0.5) : null,
      median_max_drawdown: percentile(maxDrawdowns, 0.5),
      worst10_max_drawdown: percentile(maxDrawdowns, 0.9),
      percentile_series: percentileSeries,
      assumptions: {
        model: basePlan.monte_carlo.flexible_spending === true && U.toFiniteNumber(basePlan.monte_carlo.spending_volatility, 0) > 0
          ? "sequence-level annual sampling with spending elasticity"
          : "sequence-level annual sampling on unified deterministic engine",
        return_volatility: U.toFiniteNumber(basePlan.monte_carlo.return_volatility, 0),
        inflation_volatility: U.toFiniteNumber(basePlan.monte_carlo.inflation_volatility, 0),
        spending_volatility: U.toFiniteNumber(basePlan.monte_carlo.spending_volatility, 0),
        random_inflation: basePlan.monte_carlo.random_inflation !== false,
        flexible_spending: basePlan.monte_carlo.flexible_spending === true
      }
    };

    monteCarloResult.legacy = buildLegacyMonteCarloSummary(monteCarloResult);
    return monteCarloResult;
  }

  function buildProjectionResult(normalizedPlan, options = {}) {
    const deterministic = buildDeterministicProjection(normalizedPlan, options);
    const evaluation = evaluateProjection(normalizedPlan, deterministic);
    const legacyProjection = toLegacyProjection(deterministic);
    const includeScenarios = options.includeScenarios === true;
    const includeMonteCarlo = options.includeMonteCarlo === true;
    const rawFormState = options.rawFormState || null;
    const scenarioComparisons = includeScenarios && rawFormState
      ? buildScenarioComparisons(rawFormState, normalizedPlan)
      : [];
    const monteCarloResult = includeMonteCarlo && rawFormState
      ? runMonteCarlo(rawFormState, normalizedPlan)
      : null;

    return {
      engine_meta: {
        engine_version: includeScenarios || includeMonteCarlo ? "v1-scenarios-mc" : "v1-deterministic",
        generated_at: new Date().toISOString(),
        case_name: normalizedPlan?.metadata?.case_name || "",
        version_name: normalizedPlan?.metadata?.version_name || "",
        baseline_version: normalizedPlan?.metadata?.baseline_version || ""
      },
      current_snapshot: normalizedPlan?.derived?.current_snapshot || {},
      deterministic: {
        scenario_id: "A",
        liquid_path: deterministic.path,
        net_worth_path: deterministic.netWorthPath,
        annual_ledger: deterministic.annualLedger,
        evaluation: {
          retirement_start_age: normalizedPlan.timeline.retire_age,
          retirement_start_liquid_pool: evaluation.retirementPoint.value,
          retirement_start_net_worth: deterministic.retirementStartNetWorth,
          first_year_retirement_spend: {
            essential: evaluation.firstYearSpend.essential,
            discretionary: evaluation.firstYearSpend.discretionary,
            debt_service: evaluation.firstYearSpend.debt,
            medical: evaluation.firstYearSpend.baseMedical,
            care: evaluation.firstYearSpend.care,
            premium: evaluation.firstYearSpend.premium,
            ltc: evaluation.firstYearSpend.ltc,
            tax: evaluation.firstYearSpend.tax,
            total: evaluation.firstYearSpend.total
          },
          reference_withdrawal_rate: evaluation.referenceWithdrawalRate,
          rule4_target: evaluation.rule4Target,
          funded_ratio: evaluation.fundedRatio,
          depletion_age: evaluation.depletionPoint?.age || null,
          final_liquid_pool: evaluation.finalPoint.value,
          final_net_worth: deterministic.netWorthPath[deterministic.netWorthPath.length - 1]?.value || 0,
          max_drawdown: evaluation.maxDrawdown
        }
      },
      legacy: {
        projection: legacyProjection,
        evaluation,
        scenarioComparisons,
        monteCarlo: monteCarloResult?.legacy || null
      },
      scenarios: scenarioComparisons.map((scenario) => ({
        scenario_id: scenario.id,
        label: scenario.label,
        description: scenario.description,
        settings: scenario.settings || null,
        evaluation: {
          retirement_start_liquid_pool: scenario.projectionResult.deterministic.evaluation.retirement_start_liquid_pool,
          retirement_start_net_worth: scenario.projectionResult.deterministic.evaluation.retirement_start_net_worth,
          final_liquid_pool: scenario.projectionResult.deterministic.evaluation.final_liquid_pool,
          final_net_worth: scenario.projectionResult.deterministic.evaluation.final_net_worth,
          depletion_age: scenario.projectionResult.deterministic.evaluation.depletion_age,
          funded_ratio: scenario.projectionResult.deterministic.evaluation.funded_ratio
        }
      })),
      monte_carlo: monteCarloResult || {
        enabled: false,
        runs: 0,
        success_rate: 0,
        p10_final_liquid_pool: 0,
        p50_final_liquid_pool: 0,
        p90_final_liquid_pool: 0,
        median_depletion_age: null,
        median_max_drawdown: 0,
        worst10_max_drawdown: 0,
        percentile_series: [],
        assumptions: {}
      },
      diagnostics: {
        warnings: normalizedPlan?.derived?.warnings || [],
        blocking_errors: normalizedPlan?.derived?.blocking_errors || [],
        anti_double_count_flags: normalizedPlan?.derived?.anti_double_count_flags || []
      }
    };
  }

  window.ProjectionEngineV1 = {
    buildDeterministicProjection,
    buildScenarioComparisons,
    buildLegacyCompatibleData,
    buildProjectionResult,
    evaluateProjection,
    runMonteCarlo,
    toLegacyProjection
  };
})();
