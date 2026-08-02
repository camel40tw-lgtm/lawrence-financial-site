/* ─────────────────────────────────────────────────────────────
   irr_engine.js 迴歸測試
   對應「保單現金價值與IRR試算工具_產品規格書.md」第十四節驗收標準。

   執行方式（不需要 npm install，純 Node 內建模組）：
     node policy-irr/test/irr_engine.test.js

   涵蓋範圍說明：
   規格書第十四節共六項測試，其中「測試二：每年繳費」與「測試四：
   同年度多筆現金流合併」實際上是 policy_irr_ui.js 的業務邏輯
   （buildCashflow 怎麼把使用者輸入組成現金流陣列），不是
   irr_engine.js 這個純函式引擎本身的職責，因此這裡不假裝涵蓋，
   改為在下方以註解說明應如何用瀏覽器手動驗證。
   本檔實際涵蓋：測試一、測試五、測試六，以及一個涵蓋「測試三」
   概念的 XIRR 案例，另外補上先前修過的「跳年現金流」迴歸測試。
   ───────────────────────────────────────────────────────────── */
"use strict";

const assert = require("assert");
const path = require("path");

global.window = global;
require(path.join(__dirname, "..", "irr_engine.js"));
const Engine = global.PolicyIRREngine;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

function approxEqual(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    message || `期望 ${expected}，實際 ${actual}，誤差超過容許值 ${tolerance}`
  );
}

// ── 測試一：單筆投入 ──────────────────────────────────────
// 第 0 年投入 100 萬，第 10 年領回 121.8994 萬，IRR 應接近 2%。
test("測試一：單筆投入 100 萬，第 10 年領回 121.8994 萬 → IRR ≈ 2%", () => {
  const cashflows = [-1000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1218994.42];
  const result = Engine.irr(cashflows);
  assert.strictEqual(result.converged, true, "應該要能收斂出解");
  approxEqual(result.rate, 0.02, 1e-4, "IRR 應接近 2%");
});

// ── 測試三（概念驗證）：不規則日期 XIRR ───────────────────
// 用「10 年整」的日期差距驗證 XIRR 與年度 IRR 結果一致（Actual/365
// 折算會有極小的閏年誤差，容許 1e-3）。若要驗證任意不規則日期與
// Excel XIRR 的精確度，需要另外找實際保單建議書數字人工比對，
// 屬於「規格第十四節測試三」的完整驗證，非本腳本能單獨涵蓋。
test("測試三（概念驗證）：XIRR 10 年期距 → IRR ≈ 2%", () => {
  const cashflows = [-1000000, 1218994.42];
  const dates = ["2016-01-01", "2026-01-01"];
  const result = Engine.xirr(cashflows, dates);
  assert.strictEqual(result.converged, true, "應該要能收斂出解");
  approxEqual(result.rate, 0.02, 1e-3, "XIRR 應接近 2%（Actual/365 閏年誤差容許 1e-3）");
});

// ── 測試五：無解 ──────────────────────────────────────────
// 只有負現金流（只繳費、沒有任何領回），應正確回報無法計算。
test("測試五：只有負現金流 → 無法計算 IRR", () => {
  const cashflows = [-100, -200, -300];
  const result = Engine.irr(cashflows);
  assert.strictEqual(result.converged, false, "沒有正現金流時不應回傳收斂結果");
  assert.strictEqual(result.rate, null, "無解時 rate 應為 null");
});

// ── 測試六：多重 IRR ──────────────────────────────────────
// 現金流正負號反覆變化，系統應偵測到多重根並標記警示旗標。
test("測試六：正負號反覆變化 → 偵測到多重 IRR 並標記警示", () => {
  const cashflows = [-1000, 3000, -3000, 3000, -2000];
  const result = Engine.irr(cashflows);
  assert.ok(result.signChanges > 1, "應偵測到一次以上的正負號變化");
  assert.strictEqual(result.hasMultipleRoots, true, "應標記 hasMultipleRoots");
});

// ── 迴歸測試：跳年現金流的期數折現 ────────────────────────
// 2026-08-01 修正過的 bug：只填第 0 年與第 10 年（中間沒有資料列）
// 時，若把「第 2 筆現金流」誤當成「第 2 年」折現，IRR 會被嚴重高估
// （曾經算出 21.9% 而非正確的 2%）。這裡用 periods 參數釘住正確行為，
// 避免未來重構時又把這個 bug 帶回來。
test("迴歸測試：跳年現金流（只有第 0、10 年）用 periods 折現才正確", () => {
  const cashflows = [-1000000, 1218994.42];
  const periods = [0, 10];
  const wrongResult = Engine.irr(cashflows); // 不帶 periods，錯誤地把索引當期數
  const rightResult = Engine.irr(cashflows, periods); // 正確帶入實際保單年度
  approxEqual(rightResult.rate, 0.02, 1e-4, "帶入正確 periods 後 IRR 應接近 2%");
  assert.ok(
    Math.abs(wrongResult.rate - rightResult.rate) > 0.01,
    "不帶 periods 時應該會算出明顯不同（錯誤）的數字，用來對照差異"
  );
});

// ── 業務邏輯層測試（此腳本無法涵蓋，需人工／瀏覽器驗證）───
// 測試二：每年期初繳交固定保費，第 20 年解約，結果需與 Excel IRR
//         在指定精度內一致 —— 需先用 policy_irr_ui.js 的
//         buildCashflow() 組出現金流陣列，再跟 Excel =IRR() 對照。
// 測試四：同一日期的保費、還本、解約金應先加總再計算 —— 這是
//         buildCashflow() 每個保單年度只產生「一筆」淨現金流的設計
//         本身保證的（見 irr_engine.js 頂部註解），不是 irr()/xirr()
//         這兩個純函式要處理的事，純函式只認得已經算好的陣列。
// 若要把這兩項也自動化，需要在 Node 環境模擬 DOM 或把
// buildCashflow() 抽成不碰 DOM 的獨立模組，屬於下一步優化方向。

console.log(`\n${passed} 個通過、${failed} 個失敗（共 ${passed + failed} 個測試）`);
if (failed > 0) process.exit(1);
