/* ─────────────────────────────────────────────────────────────
   保單現金流與年化報酬率試算工具 — 計算引擎
   純函式、不碰 DOM，方便獨立測試。掛在 window.PolicyIRREngine。

   演算法：
   - IRR／XIRR 皆先粗掃描（找變號區間）再用二分法收斂、
     Newton-Raphson 加速拋光；找不到收斂解則回傳 null。
   - 搜尋範圍 -99.99% ～ 1000%（見產品規格書 13.2）。
   ───────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  const RATE_MIN = -0.9999;
  const RATE_MAX = 10; // 1000%
  const SCAN_STEPS = 2000;
  const TOLERANCE = 1e-8;
  const MAX_ITER = 200;

  /**
   * 一般 IRR 用的年期折現：NPV = Σ cf_t / (1+r)^t
   * periods 為選填的期數陣列（對應每筆現金流實際發生的保單年度）；
   * 省略時預設為陣列索引 0,1,2...，僅適用於「每年都有一筆現金流、
   * 完全無跳年」的情況。保單年度中間可能跳過沒有金流的年份，
   * 因此呼叫端（policy_irr_ui.js）一律會帶入實際的 policyYear 當作 periods，
   * 避免把「第 3 筆現金流」誤當成「第 3 年」。
   */
  function npv(rate, cashflows, periods) {
    let sum = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const p = periods ? periods[t] : t;
      sum += cashflows[t] / Math.pow(1 + rate, p);
    }
    return sum;
  }

  function dNpv(rate, cashflows, periods) {
    let sum = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const p = periods ? periods[t] : t;
      if (p === 0) continue;
      sum += (-p * cashflows[t]) / Math.pow(1 + rate, p + 1);
    }
    return sum;
  }

  /** XIRR 用的實際天數折現：NPV = Σ cf_i / (1+r)^((d_i-d0)/365) */
  function npvXirr(rate, cashflows, yearFractions) {
    let sum = 0;
    for (let i = 0; i < cashflows.length; i++) {
      sum += cashflows[i] / Math.pow(1 + rate, yearFractions[i]);
    }
    return sum;
  }

  function dNpvXirr(rate, cashflows, yearFractions) {
    let sum = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const t = yearFractions[i];
      if (t === 0) continue;
      sum += (-t * cashflows[i]) / Math.pow(1 + rate, t + 1);
    }
    return sum;
  }

  /** 偵測現金流正負號變化次數（略過 0） */
  function countSignChanges(cashflows) {
    const nonZero = cashflows.filter((v) => Math.abs(v) > 1e-9);
    let changes = 0;
    for (let i = 1; i < nonZero.length; i++) {
      if ((nonZero[i] > 0) !== (nonZero[i - 1] > 0)) changes++;
    }
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

  /**
   * 掃描 RATE_MIN..RATE_MAX，找出所有 NPV 變號區間，
   * 對每個區間用二分法收斂、再用 Newton-Raphson 拋光。
   * npvFn(rate) -> number
   */
  function findRoots(npvFn) {
    const roots = [];
    const step = (RATE_MAX - RATE_MIN) / SCAN_STEPS;
    let prevRate = RATE_MIN;
    let prevVal = npvFn(prevRate);

    for (let i = 1; i <= SCAN_STEPS; i++) {
      const rate = RATE_MIN + step * i;
      const val = npvFn(rate);
      if (isFinite(prevVal) && isFinite(val) && prevVal !== 0 && (prevVal > 0) !== (val > 0)) {
        const root = bisectThenNewton(npvFn, prevRate, rate);
        if (root !== null) roots.push(root);
      } else if (val === 0 && isFinite(val)) {
        roots.push(rate);
      }
      prevRate = rate;
      prevVal = val;
    }
    return roots;
  }

  function bisectThenNewton(npvFn, lo, hi) {
    let a = lo;
    let b = hi;
    let fa = npvFn(a);
    let fb = npvFn(b);
    if (!isFinite(fa) || !isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    if ((fa > 0) === (fb > 0)) return null;

    let mid = (a + b) / 2;
    for (let i = 0; i < MAX_ITER; i++) {
      mid = (a + b) / 2;
      const fm = npvFn(mid);
      if (Math.abs(fm) < TOLERANCE || (b - a) / 2 < TOLERANCE) break;
      if ((fa > 0) === (fm > 0)) {
        a = mid;
        fa = fm;
      } else {
        b = mid;
      }
    }
    return mid;
  }

  function newtonPolish(rate, npvFn, dNpvFn) {
    let r = rate;
    for (let i = 0; i < 50; i++) {
      const f = npvFn(r);
      if (Math.abs(f) < TOLERANCE) return r;
      const d = dNpvFn(r);
      if (!isFinite(d) || Math.abs(d) < 1e-12) return r;
      const next = r - f / d;
      if (!isFinite(next) || next <= RATE_MIN || next >= RATE_MAX) return r;
      if (Math.abs(next - r) < TOLERANCE) return next;
      r = next;
    }
    return r;
  }

  /**
   * 計算年度 IRR。
   * @param {number[]} cashflows 各筆現金流金額
   * @param {number[]} [periods] 各筆現金流對應的保單年度（有跳年時必填，
   *   否則預設每筆間隔剛好 1 年，跳年時期數會算錯）
   * @returns {{rate:number|null, converged:boolean, signChanges:number, hasMultipleRoots:boolean, allRoots:number[]}}
   */
  function irr(cashflows, periods) {
    const signChanges = countSignChanges(cashflows);
    if (!hasPositiveAndNegative(cashflows)) {
      return { rate: null, converged: false, signChanges, hasMultipleRoots: false, allRoots: [] };
    }
    const fn = (r) => npv(r, cashflows, periods);
    const dfn = (r) => dNpv(r, cashflows, periods);
    let roots = findRoots(fn).map((r) => newtonPolish(r, fn, dfn));
    roots = dedupeRoots(roots);

    if (roots.length === 0) {
      return { rate: null, converged: false, signChanges, hasMultipleRoots: signChanges > 1, allRoots: [] };
    }
    // 取離 0 最近（最保守／最直覺）的根作為主要顯示值
    roots.sort((a, b) => Math.abs(a) - Math.abs(b));
    return {
      rate: roots[0],
      converged: true,
      signChanges,
      hasMultipleRoots: roots.length > 1 || signChanges > 1,
      allRoots: roots,
    };
  }

  /**
   * 計算 XIRR（以實際日期折現，Actual/365）。
   * @param {number[]} cashflows
   * @param {string[]} dates ISO 日期字串，長度須與 cashflows 相同
   */
  function xirr(cashflows, dates) {
    const signChanges = countSignChanges(cashflows);
    if (!hasPositiveAndNegative(cashflows) || cashflows.length !== dates.length) {
      return { rate: null, converged: false, signChanges, hasMultipleRoots: false, allRoots: [] };
    }
    const d0 = new Date(dates[0]).getTime();
    const yearFractions = dates.map((d) => (new Date(d).getTime() - d0) / (1000 * 60 * 60 * 24 * 365));

    const fn = (r) => npvXirr(r, cashflows, yearFractions);
    const dfn = (r) => dNpvXirr(r, cashflows, yearFractions);
    let roots = findRoots(fn).map((r) => newtonPolish(r, fn, dfn));
    roots = dedupeRoots(roots);

    if (roots.length === 0) {
      return { rate: null, converged: false, signChanges, hasMultipleRoots: signChanges > 1, allRoots: [] };
    }
    roots.sort((a, b) => Math.abs(a) - Math.abs(b));
    return {
      rate: roots[0],
      converged: true,
      signChanges,
      hasMultipleRoots: roots.length > 1 || signChanges > 1,
      allRoots: roots,
    };
  }

  function dedupeRoots(roots) {
    const out = [];
    for (const r of roots) {
      if (!isFinite(r)) continue;
      if (!out.some((o) => Math.abs(o - r) < 1e-6)) out.push(r);
    }
    return out;
  }

  global.PolicyIRREngine = {
    npv,
    npvXirr,
    irr,
    xirr,
    countSignChanges,
    hasPositiveAndNegative,
    RATE_MIN,
    RATE_MAX,
  };
})(window);
