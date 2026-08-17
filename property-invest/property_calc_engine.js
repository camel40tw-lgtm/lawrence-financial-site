/* ─────────────────────────────────────────────────────────────
   投資不動產規劃平台 — 計算引擎
   純函式、不碰 DOM，方便獨立測試。掛在 window.PropertyCalcEngine。

   精度策略（對應規格書 15.2 節）：
   全程使用原生 JS Number、絕不在中間步驟 Math.round()，只有
   顯示層（UI）才取整。房貸攤還表每一期都用「期初餘額」而非套公式
   反推，最後一期直接把 principal 設為期初餘額本身，確保期末餘額
   精確為 0，不依賴額外的十進位套件也能符合規格書 ±1 元誤差標準。
   ───────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  // ═══════════════════════════════════════════════════════════
  // A. 購屋能力 FR-A01～FR-A07
  // ═══════════════════════════════════════════════════════════

  function pvOfAnnuity(pmt, monthlyRate, n) {
    if (n <= 0) return 0;
    if (monthlyRate === 0) return pmt * n;
    return (pmt * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate;
  }

  /**
   * @param {object} input AffordabilityInput + 房價/貸款相關欄位（見規格書 9.1）
   * 為了讓「購屋能力」步驟可以獨立於「房貸設定」步驟先給出估算，
   * annualRate／termMonths 允許另外傳入（預設沿用房貸區塊當下的值）。
   */
  function calcAffordability(input) {
    const {
      availableCash = 0,
      emergencyFund = 0,
      monthlyIncome = 0,
      monthlyExpense = 0,
      otherDebtPayment = 0,
      mortgageBurdenRate = 0.3,
      maxPurchaseBudget = null,
      purchasePrice = 0,
      appraisalValue = null,
      loanBaseMethod = "lower_of_two",
      ltv = 0.7,
      acquisitionFixedCost = 0,
      acquisitionCostRate = 0,
      renovationCost = 0,
      annualRate = 0.024,
      termMonths = 360,
    } = input;

    // FR-A02：貸款計算基礎
    let loanBase;
    if (loanBaseMethod === "purchase_price") loanBase = purchasePrice;
    else if (loanBaseMethod === "appraisal") loanBase = appraisalValue != null ? appraisalValue : purchasePrice;
    else loanBase = appraisalValue != null ? Math.min(purchasePrice, appraisalValue) : purchasePrice; // lower_of_two
    const estimatedLoanAmount = loanBase * ltv;

    const acquisitionCost = acquisitionFixedCost + purchasePrice * acquisitionCostRate;

    // FR-A03：所需自備款
    const requiredDownPayment = purchasePrice - estimatedLoanAmount + acquisitionCost + renovationCost;

    // FR-A04：自備款差額
    const downPaymentGap = availableCash - requiredDownPayment - emergencyFund;

    // FR-A05：資金限制可負擔房價
    const availableInitialFunds = availableCash - emergencyFund - acquisitionFixedCost - renovationCost;
    const priceDenominator = 1 - ltv + acquisitionCostRate;
    const cashLimitedPrice = priceDenominator > 0 ? availableInitialFunds / priceDenominator : Infinity;

    // FR-A06：月付限制可負擔貸款／房價。取「收入負擔率扣既有債務」與
    // 「收支餘裕扣既有債務」兩者較低值，避免高估可負擔房貸月付。
    const monthlyRate = annualRate / 12;
    const burdenLimitedPayment = Math.max(0, monthlyIncome * mortgageBurdenRate - otherDebtPayment);
    const cashflowLimitedPayment = Math.max(0, monthlyIncome - monthlyExpense - otherDebtPayment);
    const maxMonthlyPayment = Math.min(burdenLimitedPayment, cashflowLimitedPayment);
    const pmtLimitedLoanAmount = pvOfAnnuity(maxMonthlyPayment, monthlyRate, termMonths);
    const pmtLimitedPrice = ltv > 0 ? pmtLimitedLoanAmount / ltv : Infinity;

    // FR-A07：最終可負擔房價
    const candidates = [cashLimitedPrice, pmtLimitedPrice];
    if (maxPurchaseBudget) candidates.push(maxPurchaseBudget);
    const affordablePrice = Math.min(...candidates);

    // 銀行鑑價低於成交價時的資金缺口提示（情境 TC-V01）。
    // 此時 requiredDownPayment（＝成交價－以鑑價計算出的貸款金額＋購屋成本＋裝潢）
    // 本身就是「頭期差額」，不需要另外一個欄位。
    const appraisalBelowPrice = appraisalValue != null && appraisalValue < purchasePrice;

    return {
      loanBase,
      estimatedLoanAmount,
      acquisitionCost,
      requiredDownPayment,
      downPaymentGap,
      isDownPaymentSufficient: downPaymentGap >= 0,
      availableInitialFunds,
      cashLimitedPrice,
      maxMonthlyPayment,
      burdenLimitedPayment,
      cashflowLimitedPayment,
      pmtLimitedLoanAmount,
      pmtLimitedPrice,
      affordablePrice,
      appraisalBelowPrice,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // B. 房貸攤還表 FR-L01～FR-L06（含二段式利率、提前還款，本次擴充範圍）
  // ═══════════════════════════════════════════════════════════

  function resolveAnnuityPmt(balance, monthsLeft, monthlyRate) {
    if (monthsLeft <= 0) return 0;
    if (monthlyRate === 0) return balance / monthsLeft;
    const f = Math.pow(1 + monthlyRate, monthsLeft);
    return (balance * monthlyRate * f) / (f - 1);
  }

  /**
   * 建立完整月度攤還表。這是全站「單一真相來源」：年度彙總、出售時貸款餘額、
   * IRR 現金流全部從這張表衍生，不另外重算（對應規格書 11.2 節真值來源原則）。
   *
   * @param {object} loan
   *   loanAmount, annualRate, termMonths, repaymentMethod('annuity'|'equal_principal'|'grace'),
   *   graceMonths,
   *   rateStage2: {enabled, changeMonth, secondAnnualRate}（簡化二段式利率，本次擴充範圍）,
   *   prepayments: [{month, amount, mode:'reduce_term'|'reduce_payment'}]（提前還款，本次擴充範圍，不含違約金）
   */
  function buildAmortizationSchedule(loan) {
    const {
      loanAmount,
      annualRate,
      termMonths,
      repaymentMethod,
      graceMonths = 0,
      rateStage2 = null,
      prepayments = [],
    } = loan;

    const prepayMap = new Map();
    (prepayments || []).forEach((p) => {
      if (p.month > 0 && p.amount > 0) prepayMap.set(p.month, p);
    });

    function monthlyRateAt(month) {
      if (rateStage2 && rateStage2.enabled && month >= rateStage2.changeMonth) {
        return rateStage2.secondAnnualRate / 12;
      }
      return annualRate / 12;
    }

    const schedule = [];
    let balance = loanAmount;
    let currentPmt = null;
    let currentFixedPrincipal = null;
    let lastStageIndex = rateStage2 && rateStage2.enabled && 1 >= rateStage2.changeMonth ? 1 : 0;
    let month = 0;
    const maxMonth = termMonths + 1200; // 安全上限，避免異常輸入造成無限迴圈

    while (balance > 0.005 && month < maxMonth) {
      month++;
      const mRate = monthlyRateAt(month);
      const stageIndex = rateStage2 && rateStage2.enabled && month >= rateStage2.changeMonth ? 1 : 0;
      const stageJustChanged = stageIndex !== lastStageIndex;
      lastStageIndex = stageIndex;

      const graceActive = repaymentMethod === "grace" && month <= graceMonths;
      const justExitedGrace = repaymentMethod === "grace" && month === graceMonths + 1;

      const beginningBalance = balance;
      const interest = beginningBalance * mRate;
      const monthsLeftInTerm = termMonths - month + 1;
      const isLastScheduledPeriod = monthsLeftInTerm <= 1;

      let principal, payment;

      if (graceActive) {
        principal = 0;
        payment = interest;
      } else if (repaymentMethod === "equal_principal") {
        if (currentFixedPrincipal === null || justExitedGrace) {
          currentFixedPrincipal = beginningBalance / Math.max(monthsLeftInTerm, 1);
        }
        principal = isLastScheduledPeriod ? beginningBalance : Math.min(currentFixedPrincipal, beginningBalance);
        payment = principal + interest;
      } else {
        // annuity，或 grace 結束後轉本息平均攤還（FR-L04）
        if (currentPmt === null || justExitedGrace || stageJustChanged) {
          currentPmt = resolveAnnuityPmt(beginningBalance, monthsLeftInTerm, mRate);
        }
        principal = isLastScheduledPeriod ? beginningBalance : currentPmt - interest;
        if (principal > beginningBalance) principal = beginningBalance;
        if (principal < 0) principal = 0; // 極端負利率／輸入異常時的保護
        payment = principal + interest;
      }

      let endingBalance = beginningBalance - principal;

      // 提前還款（本次擴充範圍，不含違約金試算）
      let prepaymentAmount = 0;
      const prepay = prepayMap.get(month);
      if (prepay && !graceActive && endingBalance > 0.005) {
        prepaymentAmount = Math.min(prepay.amount, endingBalance);
        endingBalance -= prepaymentAmount;
        const monthsLeftAfter = termMonths - month;
        if (prepay.mode === "reduce_payment" && monthsLeftAfter > 0 && endingBalance > 0.005) {
          if (repaymentMethod === "equal_principal") {
            currentFixedPrincipal = endingBalance / monthsLeftAfter;
          } else {
            currentPmt = resolveAnnuityPmt(endingBalance, monthsLeftAfter, monthlyRateAt(month + 1));
          }
        }
        // reduce_term：PMT／固定本金維持不變，讓餘額提早在後續期數自然歸零
      }

      if (endingBalance < 0.005) endingBalance = 0;

      schedule.push({
        period: month,
        beginningBalance,
        payment,
        principal,
        interest,
        prepayment: prepaymentAmount,
        endingBalance,
      });

      balance = endingBalance;
    }

    return schedule;
  }

  /** FR-L06：年度彙總（由月度攤還表加總，不另外重算） */
  function summarizeScheduleByYear(schedule) {
    const years = [];
    for (let i = 0; i < schedule.length; i += 12) {
      const chunk = schedule.slice(i, i + 12);
      if (!chunk.length) break;
      years.push({
        year: years.length + 1,
        beginningBalance: chunk[0].beginningBalance,
        principal: chunk.reduce((s, p) => s + p.principal, 0),
        interest: chunk.reduce((s, p) => s + p.interest, 0),
        payment: chunk.reduce((s, p) => s + p.payment, 0),
        prepayment: chunk.reduce((s, p) => s + p.prepayment, 0),
        endingBalance: chunk[chunk.length - 1].endingBalance,
      });
    }
    return years;
  }

  /** 取得指定「月份」的期末貸款餘額；超過攤還表長度（已清償）視為 0。 */
  function balanceAtMonth(schedule, month) {
    if (month <= 0) return schedule.length ? schedule[0].beginningBalance : 0;
    if (month > schedule.length) return 0;
    return schedule[month - 1].endingBalance;
  }

  // ═══════════════════════════════════════════════════════════
  // C. 出租營運 FR-R01～FR-R08
  // ═══════════════════════════════════════════════════════════

  function sumOperatingCosts(costs, year) {
    return (costs || []).reduce((sum, c) => {
      const startYear = c.startYear || 1;
      if (year < startYear) return sum;
      if (c.frequency === "one_time") return sum + (year === startYear ? c.amount : 0);
      if (c.frequency === "monthly") return sum + c.amount * 12;
      return sum + c.amount; // annual
    }, 0);
  }

  /**
   * @param {object} rental RentalInput
   * @param {number} year 第幾年（從 1 開始），用於租金成長率與一次性費用起始年
   * @param {number} annualMortgagePI 當年度房貸本息（由攤還表年度彙總取得）
   */
  function calcRentalYear(rental, year, purchasePrice, totalAcquisitionCost, annualMortgagePI, initialEquity) {
    const growthFactor = Math.pow(1 + (rental.rentGrowthRate || 0), year - 1);
    const monthlyGross = (rental.monthlyRent + (rental.parkingRent || 0) + (rental.otherMonthlyIncome || 0)) * growthFactor;
    const potentialAnnualRent = monthlyGross * 12; // FR-R01
    const vacancyLoss = potentialAnnualRent * (rental.vacancyRate || 0);
    const effectiveRent = potentialAnnualRent - vacancyLoss - (rental.badDebtLoss || 0); // FR-R02
    const operatingCosts = sumOperatingCosts(rental.annualOperatingCosts, year);
    const noi = effectiveRent - operatingCosts; // FR-R03
    const grossYield = purchasePrice > 0 ? potentialAnnualRent / purchasePrice : null; // FR-R04
    const capRate = totalAcquisitionCost > 0 ? noi / totalAcquisitionCost : null; // FR-R05
    const preTaxCashFlow = noi - annualMortgagePI; // FR-R06
    const cashOnCash = initialEquity > 0 ? preTaxCashFlow / initialEquity : null; // FR-R07
    const dscr = annualMortgagePI > 0 ? noi / annualMortgagePI : null; // FR-R08
    return { year, potentialAnnualRent, vacancyLoss, effectiveRent, operatingCosts, noi, grossYield, capRate, annualMortgagePI, preTaxCashFlow, cashOnCash, dscr };
  }

  // ═══════════════════════════════════════════════════════════
  // D. 增值與出售 FR-S01～FR-S05
  // ═══════════════════════════════════════════════════════════

  function calcSalePrice(sale, purchasePrice) {
    if (sale.appreciationMethod === "target_price" && sale.targetSalePrice != null) {
      return sale.targetSalePrice;
    }
    return purchasePrice * Math.pow(1 + (sale.appreciationRate || 0), sale.holdingYears); // FR-S01
  }

  function calcSaleCost(sale, salePrice) {
    return salePrice * (sale.saleCostRate || 0) + (sale.fixedSaleCost || 0) + (sale.saleTaxInput || 0); // FR-S03
  }

  function calcNetSaleProceeds(salePrice, saleCost, loanBalanceAtSale) {
    return salePrice - saleCost - loanBalanceAtSale; // FR-S04
  }

  function calcHomeEquity(currentValue, currentLoanBalance) {
    return currentValue - currentLoanBalance; // FR-S05
  }

  // ═══════════════════════════════════════════════════════════
  // E. IRR（供整體投資報酬使用，邏輯沿用 policy-irr 已驗證的
  //     「掃描定位變號區間→二分法收斂→Newton-Raphson 拋光」，
  //     比規格書字面「先 Newton 後二分」更能穩定處理多重 IRR 案例）
  // ═══════════════════════════════════════════════════════════

  const RATE_MIN = -0.9999;
  const RATE_MAX = 10;
  const SCAN_STEPS = 2000;
  const TOLERANCE = 1e-8;
  const MAX_ITER = 200;

  function npv(rate, cashflows) {
    let sum = 0;
    for (let t = 0; t < cashflows.length; t++) sum += cashflows[t] / Math.pow(1 + rate, t);
    return sum;
  }

  function dNpv(rate, cashflows) {
    let sum = 0;
    for (let t = 1; t < cashflows.length; t++) sum += (-t * cashflows[t]) / Math.pow(1 + rate, t + 1);
    return sum;
  }

  function countSignChanges(cashflows) {
    const nonZero = cashflows.filter((v) => Math.abs(v) > 1e-9);
    let changes = 0;
    for (let i = 1; i < nonZero.length; i++) if ((nonZero[i] > 0) !== (nonZero[i - 1] > 0)) changes++;
    return changes;
  }

  function hasPositiveAndNegative(cashflows) {
    let hasPos = false;
    let hasNeg = false;
    for (const v of cashflows) {
      if (v > 1e-9) hasPos = true;
      if (v < -1e-9) hasNeg = true;
    }
    return hasPos && hasNeg;
  }

  function bisectThenNewton(fn, lo, hi) {
    let a = lo;
    let b = hi;
    let fa = fn(a);
    let fb = fn(b);
    if (!isFinite(fa) || !isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    if ((fa > 0) === (fb > 0)) return null;
    let mid = (a + b) / 2;
    for (let i = 0; i < MAX_ITER; i++) {
      mid = (a + b) / 2;
      const fm = fn(mid);
      if (Math.abs(fm) < TOLERANCE || (b - a) / 2 < TOLERANCE) break;
      if ((fa > 0) === (fm > 0)) {
        a = mid;
        fa = fm;
      } else b = mid;
    }
    return mid;
  }

  function newtonPolish(rate, fn, dfn) {
    let r = rate;
    for (let i = 0; i < 50; i++) {
      const f = fn(r);
      if (Math.abs(f) < TOLERANCE) return r;
      const d = dfn(r);
      if (!isFinite(d) || Math.abs(d) < 1e-12) return r;
      const next = r - f / d;
      if (!isFinite(next) || next <= RATE_MIN || next >= RATE_MAX) return r;
      if (Math.abs(next - r) < TOLERANCE) return next;
      r = next;
    }
    return r;
  }

  function findRoots(fn) {
    const roots = [];
    const step = (RATE_MAX - RATE_MIN) / SCAN_STEPS;
    let prevRate = RATE_MIN;
    let prevVal = fn(prevRate);
    for (let i = 1; i <= SCAN_STEPS; i++) {
      const rate = RATE_MIN + step * i;
      const val = fn(rate);
      if (isFinite(prevVal) && isFinite(val) && prevVal !== 0 && (prevVal > 0) !== (val > 0)) {
        const root = bisectThenNewton(fn, prevRate, rate);
        if (root !== null) roots.push(root);
      } else if (val === 0 && isFinite(val)) roots.push(rate);
      prevRate = rate;
      prevVal = val;
    }
    return roots;
  }

  function dedupeRoots(roots) {
    const out = [];
    for (const r of roots) {
      if (!isFinite(r)) continue;
      if (!out.some((o) => Math.abs(o - r) < 1e-6)) out.push(r);
    }
    return out;
  }

  /**
   * @param {number[]} cashflows CF_0..CF_n
   * @returns {{rate:number|null, status:'ok'|'insufficient_sign_change'|'no_convergence', hasMultipleRoots:boolean, signChanges:number, allRoots:number[]}}
   */
  function calcIrr(cashflows) {
    const signChanges = countSignChanges(cashflows);
    if (!hasPositiveAndNegative(cashflows)) {
      return { rate: null, status: "insufficient_sign_change", hasMultipleRoots: false, signChanges, allRoots: [] };
    }
    const fn = (r) => npv(r, cashflows);
    const dfn = (r) => dNpv(r, cashflows);
    let roots = findRoots(fn).map((r) => newtonPolish(r, fn, dfn));
    roots = dedupeRoots(roots);
    if (roots.length === 0) {
      return { rate: null, status: "no_convergence", hasMultipleRoots: signChanges > 1, signChanges, allRoots: [] };
    }
    roots.sort((a, b) => Math.abs(a) - Math.abs(b));
    return {
      rate: roots[0],
      status: "ok",
      hasMultipleRoots: roots.length > 1 || signChanges > 1,
      signChanges,
      allRoots: roots,
    };
  }

  function calcNpv(rate, cashflows) {
    return npv(rate, cashflows);
  }

  // ═══════════════════════════════════════════════════════════
  // F. 綜合報酬 FR-I01～FR-I06
  // ═══════════════════════════════════════════════════════════

  /**
   * @param {number} downPayment 所需自備款（FR-A03 結果，含購屋成本與裝潢家具）
   * @param {number} otherInitialInvestment 其他初期投入
   * @param {Array} yearlyPreTaxCashFlow 逐年稅前現金流（FR-R06 preTaxCashFlow），index 0 = 第 1 年
   * @param {number} netSaleProceeds 出售淨回收（FR-S04）
   * @param {number} saleYear 出售年度（= holdingYears）
   */
  function buildInvestmentCashflows(downPayment, otherInitialInvestment, yearlyPreTaxCashFlow, netSaleProceeds, saleYear) {
    const cf0 = -(downPayment + (otherInitialInvestment || 0)); // FR-I01
    const cashflows = [cf0];
    for (let y = 1; y <= saleYear; y++) {
      let cf = yearlyPreTaxCashFlow[y - 1] || 0; // FR-I02
      if (y === saleYear) cf += netSaleProceeds; // FR-I03
      cashflows.push(cf);
    }
    return cashflows;
  }

  function calcRoi(cashflows) {
    const totalNetGain = cashflows.reduce((s, v) => s + v, 0); // FR-I04：總淨收益＝全部現金流合計（已內含扣回本金）
    const totalInvestedEquity = Math.abs(cashflows[0]);
    return totalInvestedEquity > 0 ? totalNetGain / totalInvestedEquity : null;
  }

  function calcEquityMultiple(cashflows) {
    let pos = 0;
    let neg = 0;
    cashflows.forEach((v) => {
      if (v > 0) pos += v;
      else neg += Math.abs(v);
    });
    return neg > 0 ? pos / neg : null; // FR-I05
  }

  // ═══════════════════════════════════════════════════════════
  // G. 主流程：把 A～F 串成一次完整試算（單一真相來源）
  // ═══════════════════════════════════════════════════════════

  /**
   * @param {object} scenario { affordability, loan, rental, sale, otherInitialInvestment }
   * loan.loanAmount 若未提供，預設沿用 affordability 結果的 estimatedLoanAmount。
   */
  function runFullCalculation(scenario) {
    const affordability = calcAffordability(scenario.affordability);

    const loanAmount = scenario.loan.loanAmount != null ? scenario.loan.loanAmount : affordability.estimatedLoanAmount;
    const schedule = buildAmortizationSchedule(Object.assign({}, scenario.loan, { loanAmount }));
    const yearlySchedule = summarizeScheduleByYear(schedule);

    const purchasePrice = scenario.affordability.purchasePrice;
    const totalAcquisitionCost = purchasePrice + affordability.acquisitionCost + scenario.affordability.renovationCost;
    const initialEquity = affordability.requiredDownPayment;

    const holdingYears = scenario.sale.holdingYears;
    const rentalByYear = [];
    for (let y = 1; y <= holdingYears; y++) {
      const yearSchedule = yearlySchedule[y - 1];
      const annualMortgagePI = yearSchedule ? yearSchedule.principal + yearSchedule.interest : 0;
      rentalByYear.push(calcRentalYear(scenario.rental, y, purchasePrice, totalAcquisitionCost, annualMortgagePI, initialEquity));
    }

    const salePrice = calcSalePrice(scenario.sale, purchasePrice);
    const saleCost = calcSaleCost(scenario.sale, salePrice);
    const loanBalanceAtSale = balanceAtMonth(schedule, holdingYears * 12);
    const netSaleProceeds = calcNetSaleProceeds(salePrice, saleCost, loanBalanceAtSale);
    const homeEquityAtSale = calcHomeEquity(salePrice, loanBalanceAtSale);

    const yearlyPreTaxCashFlow = rentalByYear.map((r) => r.preTaxCashFlow);
    const cashflows = buildInvestmentCashflows(
      affordability.requiredDownPayment,
      scenario.otherInitialInvestment || 0,
      yearlyPreTaxCashFlow,
      netSaleProceeds,
      holdingYears
    );
    const irr = calcIrr(cashflows);
    const roi = calcRoi(cashflows);
    const equityMultiple = calcEquityMultiple(cashflows);

    // 房屋淨值時間序列（供圖表：房屋市值與貸款餘額比較）
    const equityTimeline = [];
    for (let y = 0; y <= holdingYears; y++) {
      const value = purchasePrice * Math.pow(1 + (scenario.sale.appreciationRate || 0), y);
      const balance = balanceAtMonth(schedule, y * 12);
      equityTimeline.push({ year: y, marketValue: value, loanBalance: balance, equity: value - balance });
    }

    return {
      affordability,
      schedule,
      yearlySchedule,
      rentalByYear,
      salePrice,
      saleCost,
      loanBalanceAtSale,
      netSaleProceeds,
      homeEquityAtSale,
      cashflows,
      irr,
      roi,
      equityMultiple,
      equityTimeline,
      monthlyPayment: schedule.length ? schedule[0].payment : 0,
      firstYearCashFlow: rentalByYear.length ? rentalByYear[0].preTaxCashFlow : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // H. 情境分析（第 8 章）：三情境＋六壓力測試
  // ═══════════════════════════════════════════════════════════

  const PRESET_SCENARIOS = {
    conservative: { label: "保守", priceGrowthRate: -0.02, rentGrowthRate: 0, vacancyRate: 0.1, rateAdjustment: 0.01, majorRepairYear: 3, majorRepairAmount: 300000 },
    base: { label: "基準", priceGrowthRate: 0.02, rentGrowthRate: 0.01, vacancyRate: 0.05, rateAdjustment: 0, majorRepairYear: null, majorRepairAmount: 0 },
    optimistic: { label: "樂觀", priceGrowthRate: 0.04, rentGrowthRate: 0.02, vacancyRate: 0.02, rateAdjustment: -0.0025, majorRepairYear: null, majorRepairAmount: 0 },
  };

  function cloneScenario(scenario) {
    return JSON.parse(JSON.stringify(scenario));
  }

  /** 把保守／基準／樂觀其中一組假設套用到（複製後的）情境上，回傳套用後的情境本身。 */
  function applyPresetOverrides(baseScenario, presetKey) {
    const preset = PRESET_SCENARIOS[presetKey];
    const s = cloneScenario(baseScenario);
    s.sale.appreciationMethod = "fixed_rate";
    s.sale.appreciationRate = preset.priceGrowthRate;
    s.rental.rentGrowthRate = preset.rentGrowthRate;
    s.rental.vacancyRate = preset.vacancyRate;
    s.loan.annualRate = Math.max(0, s.loan.annualRate + preset.rateAdjustment);
    if (preset.majorRepairYear) {
      s.rental.annualOperatingCosts = (s.rental.annualOperatingCosts || []).concat([
        { id: "stress-repair", name: "大額修繕", amount: preset.majorRepairAmount, frequency: "one_time", startYear: preset.majorRepairYear },
      ]);
    }
    return s;
  }

  /** 套用保守／基準／樂觀其中一組假設，回傳完整試算結果。 */
  function runPresetScenario(baseScenario, presetKey) {
    const s = applyPresetOverrides(baseScenario, presetKey);
    return { key: presetKey, label: PRESET_SCENARIOS[presetKey].label, result: runFullCalculation(s) };
  }

  const STRESS_TESTS = [
    { key: "rateUp05", label: "利率上升 0.5%", apply: (s) => { s.loan.annualRate += 0.005; } },
    { key: "rateUp1", label: "利率上升 1%", apply: (s) => { s.loan.annualRate += 0.01; } },
    { key: "priceDown10", label: "房價下跌 10%", apply: (s, baseResult) => {
      s.sale.appreciationMethod = "target_price";
      s.sale.targetSalePrice = baseResult.salePrice * 0.9;
    } },
    { key: "rentDown10", label: "租金下降 10%", apply: (s) => {
      s.rental.monthlyRent *= 0.9;
      s.rental.parkingRent = (s.rental.parkingRent || 0) * 0.9;
      s.rental.otherMonthlyIncome = (s.rental.otherMonthlyIncome || 0) * 0.9;
    } },
    { key: "vacancyExtra1Month", label: "每年增加一個月空置", apply: (s) => { s.rental.vacancyRate = (s.rental.vacancyRate || 0) + 1 / 12; } },
    { key: "repairYear3", label: "第三年發生 30 萬元修繕", apply: (s) => {
      s.rental.annualOperatingCosts = (s.rental.annualOperatingCosts || []).concat([
        { id: "stress-repair-y3", name: "壓力測試修繕", amount: 300000, frequency: "one_time", startYear: 3 },
      ]);
    } },
  ];

  /**
   * 執行全部六個壓力測試，回傳與「基準情境」（8.1 節基準假設，而非
   * 使用者原始輸入）的差異摘要（8.3 節輸出項目），對應規格書 8.2 節
   * 「在基準情境下」的字面要求。
   */
  function runStressTests(rawScenario) {
    const baseScenario = applyPresetOverrides(rawScenario, "base");
    const baseResult = runFullCalculation(cloneScenario(baseScenario));
    return STRESS_TESTS.map((test) => {
      const s = cloneScenario(baseScenario);
      test.apply(s, baseResult);
      const result = runFullCalculation(s);
      const maxCumulativeShortfall = Math.min(
        0,
        ...result.rentalByYear.reduce((acc, r) => {
          const prev = acc.length ? acc[acc.length - 1] : 0;
          acc.push(prev + r.preTaxCashFlow);
          return acc;
        }, [])
      );
      return {
        key: test.key,
        label: test.label,
        monthlyPaymentChange: result.monthlyPayment - baseResult.monthlyPayment,
        firstYearCashFlowChange: result.firstYearCashFlow - baseResult.firstYearCashFlow,
        maxCumulativeShortfall,
        netSaleProceeds: result.netSaleProceeds,
        irrChange: result.irr.status === "ok" && baseResult.irr.status === "ok" ? result.irr.rate - baseResult.irr.rate : null,
        homeEquityNegative: result.equityTimeline.some((e) => e.equity < 0),
        result,
      };
    });
  }

  global.PropertyCalcEngine = {
    pvOfAnnuity,
    calcAffordability,
    resolveAnnuityPmt,
    buildAmortizationSchedule,
    summarizeScheduleByYear,
    balanceAtMonth,
    calcRentalYear,
    calcSalePrice,
    calcSaleCost,
    calcNetSaleProceeds,
    calcHomeEquity,
    calcIrr,
    calcNpv,
    buildInvestmentCashflows,
    calcRoi,
    calcEquityMultiple,
    runFullCalculation,
    PRESET_SCENARIOS,
    applyPresetOverrides,
    runPresetScenario,
    STRESS_TESTS,
    runStressTests,
  };
})(typeof window !== "undefined" ? window : globalThis);
