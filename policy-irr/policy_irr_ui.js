/* ─────────────────────────────────────────────────────────────
   保單現金流與年化報酬率試算工具 — UI 控制器
   依賴 irr_engine.js（window.PolicyIRREngine）、Chart.js、
   jsPDF ＋ html2canvas（PDF 報告，選用，載入失敗時該按鈕會提示錯誤）。
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const STORAGE_KEY = "policyIrrCalcState_v1";
  const Engine = window.PolicyIRREngine;

  // ── 狀態 ─────────────────────────────────────────────────
  let state = null;
  let history = [];
  let historyIndex = -1;
  let saveTimer = null;
  let renderRAF = null;
  let pendingBatchField = null;
  let charts = { acc: null, irr: null, bar: null };

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function uid() {
    return "r" + Math.random().toString(36).slice(2, 9);
  }

  function defaultState() {
    return {
      meta: {
        name: "",
        product: "",
        currency: "TWD",
        mode: "annual",
        investDate: todayStr(),
        years: 20,
        unit: 1,
        irrDecimals: 2,
      },
      settings: {
        surrenderYear: 10,
        surrenderIncludes: "not_included",
        discountRate: 3,
        nonGuaranteedFactor: 100,
      },
      rows: [
        { id: uid(), policyYear: 0, date: null, premium: 100000, guaranteed: 0, nonGuaranteed: 0, surrender: 0, note: "躉繳／首期保費" },
      ],
    };
  }

  // ── 日期輔助 ─────────────────────────────────────────────
  function addYears(dateStr, n) {
    const d = new Date(dateStr || todayStr());
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  }

  function rowDate(row) {
    if (state.meta.mode === "date" && row.date) return row.date;
    return addYears(state.meta.investDate, row.policyYear);
  }

  // ── 格式化 ───────────────────────────────────────────────
  function formatMoney(v) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    const scaled = v / (state.meta.unit || 1);
    const rounded = Math.round(scaled);
    return rounded.toLocaleString("zh-Hant-TW") + (state.meta.unit === 1 ? "" : state.meta.unit === 100 ? " 百元" : " 千元");
  }

  function formatPercent(rate) {
    if (rate === null || rate === undefined || !isFinite(rate)) return "—";
    return (rate * 100).toFixed(state.meta.irrDecimals) + "%";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ── 歷史（復原／重做） ───────────────────────────────────
  function snapshot() {
    const json = JSON.stringify(state);
    history = history.slice(0, historyIndex + 1);
    history.push(json);
    if (history.length > 30) history.shift();
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    state = JSON.parse(history[historyIndex]);
    scheduleRender();
    scheduleAutoSave();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    state = JSON.parse(history[historyIndex]);
    scheduleRender();
    scheduleAutoSave();
  }

  function mutate(fn) {
    fn();
    snapshot();
    scheduleRender();
    scheduleAutoSave();
  }

  // 用 requestAnimationFrame 把同一批動作（例如連續切換設定、快速點選
  // 年度比較表列）合併成一次重算，避免試算期間拉長（50～60 年）時
  // 反覆觸發整頁重繪造成卡頓。真正降低運算量的關鍵是下面的
  // computeYearlySeries()：把逐年 IRR 只算一次、多處共用。
  function scheduleRender() {
    if (renderRAF) return;
    renderRAF = requestAnimationFrame(() => {
      renderRAF = null;
      renderAll();
    });
  }

  // ── 本機儲存 ─────────────────────────────────────────────
  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    }, 800);
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      alert("已儲存到本機瀏覽器。");
    } catch (e) {
      alert("儲存失敗：" + e.message);
    }
  }

  function loadSaved() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert("目前沒有已儲存的試算資料。");
      return;
    }
    try {
      state = JSON.parse(raw);
      snapshot();
      renderAll();
    } catch (e) {
      alert("讀取失敗，資料可能已損毀。");
    }
  }

  function clearSaved() {
    if (!confirm("確定要清除本機儲存的試算資料嗎？此動作無法復原。")) return;
    localStorage.removeItem(STORAGE_KEY);
    alert("已清除本機儲存資料。");
  }

  // ── 資料列操作 ───────────────────────────────────────────
  function nextPolicyYear() {
    if (!state.rows.length) return 0;
    return Math.max(...state.rows.map((r) => r.policyYear)) + 1;
  }

  function addRow() {
    mutate(() => {
      const year = nextPolicyYear();
      state.rows.push({ id: uid(), policyYear: year, date: addYears(state.meta.investDate, year), premium: 0, guaranteed: 0, nonGuaranteed: 0, surrender: 0, note: "" });
    });
  }

  function buildYears() {
    const input = prompt("要一次建立到第幾年？（已存在的年度不會被覆蓋）", String(state.meta.years || 20));
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n < 0) return;
    mutate(() => {
      const existingYears = new Set(state.rows.map((r) => r.policyYear));
      for (let y = 0; y <= n; y++) {
        if (!existingYears.has(y)) {
          state.rows.push({ id: uid(), policyYear: y, date: addYears(state.meta.investDate, y), premium: 0, guaranteed: 0, nonGuaranteed: 0, surrender: 0, note: "" });
        }
      }
      state.rows.sort((a, b) => a.policyYear - b.policyYear);
      if (n > state.meta.years) state.meta.years = n;
    });
  }

  function duplicateLastRow() {
    if (!state.rows.length) return;
    mutate(() => {
      const last = state.rows[state.rows.length - 1];
      const year = nextPolicyYear();
      state.rows.push({ id: uid(), policyYear: year, date: addYears(state.meta.investDate, year), premium: last.premium, guaranteed: last.guaranteed, nonGuaranteed: last.nonGuaranteed, surrender: 0, note: last.note });
    });
  }

  function deleteRow(id) {
    mutate(() => {
      state.rows = state.rows.filter((r) => r.id !== id);
    });
  }

  function clearAll() {
    if (!confirm("確定要清除全部現金流資料嗎？")) return;
    mutate(() => {
      state.rows = [{ id: uid(), policyYear: 0, date: state.meta.investDate, premium: 0, guaranteed: 0, nonGuaranteed: 0, surrender: 0, note: "" }];
    });
  }

  // ── 批次填入（正式表單彈窗） ─────────────────────────────
  function openBatchFillModal(field, label) {
    pendingBatchField = field;
    document.getElementById("batchFillTitle").textContent = `批次填入「${label}」`;
    document.getElementById("batchFillAmount").value = "0";
    document.getElementById("batchFillFrom").value = "1";
    document.getElementById("batchFillTo").value = String(state.meta.years || 20);
    document.getElementById("batchFillModal").classList.remove("hidden");
  }

  function closeBatchFillModal() {
    document.getElementById("batchFillModal").classList.add("hidden");
    pendingBatchField = null;
  }

  function confirmBatchFill() {
    const val = parseFloat(document.getElementById("batchFillAmount").value);
    const from = parseInt(document.getElementById("batchFillFrom").value, 10);
    const to = parseInt(document.getElementById("batchFillTo").value, 10);
    if (!isFinite(val) || val < 0 || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      alert("請確認金額為非負數字，且「從第幾年」不大於「到第幾年」。");
      return;
    }
    const field = pendingBatchField;
    mutate(() => {
      state.rows.forEach((r) => {
        if (r.policyYear >= from && r.policyYear <= to) r[field] = val;
      });
    });
    closeBatchFillModal();
  }

  // ── 貼上資料 / CSV 解析（共用同一套匯入邏輯） ────────────
  function parsePasteText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      let parts;
      if (line.includes("\t")) parts = line.split("\t");
      else if (line.includes("｜") || line.includes("|")) parts = line.split(/[｜|]/);
      else if (line.includes(",")) parts = line.split(",");
      else parts = line.split(/\s+/);
      parts = parts.map((p) => p.trim());
      const year = parseFloat(parts[0]);
      if (!isFinite(year)) continue; // 標題列或無效列，略過
      rows.push({
        policyYear: Math.round(year),
        premium: parseFloat(parts[1]) || 0,
        guaranteed: parseFloat(parts[2]) || 0,
        nonGuaranteed: parseFloat(parts[3]) || 0,
        surrender: parseFloat(parts[4]) || 0,
      });
    }
    return rows;
  }

  // 正確處理雙引號欄位（例如備註內含逗號）的簡易 CSV 逐行拆解。
  function splitCsvLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        result.push(cur);
        cur = "";
      } else cur += ch;
    }
    result.push(cur);
    return result.map((s) => s.trim());
  }

  // 支援兩種欄位配置：
  // (a) 本工具「匯出 CSV」的完整格式：保單年度,日期,繳入保費,保證領回,非保證領回,解約金,備註
  // (b) 跟「貼上資料」一樣的簡易格式：年度,保費,保證領回,非保證領回,解約金
  function parseCsvText(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      const parts = splitCsvLine(line);
      const year = parseFloat(parts[0]);
      if (!isFinite(year)) continue; // 標題列或無效列，略過
      if (parts.length >= 7) {
        rows.push({
          policyYear: Math.round(year),
          date: parts[1] || null,
          premium: parseFloat(parts[2]) || 0,
          guaranteed: parseFloat(parts[3]) || 0,
          nonGuaranteed: parseFloat(parts[4]) || 0,
          surrender: parseFloat(parts[5]) || 0,
          note: parts[6] || "",
        });
      } else {
        rows.push({
          policyYear: Math.round(year),
          premium: parseFloat(parts[1]) || 0,
          guaranteed: parseFloat(parts[2]) || 0,
          nonGuaranteed: parseFloat(parts[3]) || 0,
          surrender: parseFloat(parts[4]) || 0,
        });
      }
    }
    return rows;
  }

  function handleCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      importPastedRows(parseCsvText(String(reader.result)));
    };
    reader.onerror = () => alert("讀取 CSV 檔案失敗，請確認檔案格式與編碼（建議 UTF-8）。");
    reader.readAsText(file, "utf-8");
  }

  function importPastedRows(parsed) {
    if (!parsed.length) {
      alert("沒有解析到有效資料列，請確認格式。");
      return;
    }
    mutate(() => {
      parsed.forEach((p) => {
        const existing = state.rows.find((r) => r.policyYear === p.policyYear);
        if (existing) {
          existing.premium = p.premium;
          existing.guaranteed = p.guaranteed;
          existing.nonGuaranteed = p.nonGuaranteed;
          existing.surrender = p.surrender;
          if (p.date) existing.date = p.date;
          if (p.note !== undefined && p.note !== "") existing.note = p.note;
        } else {
          state.rows.push({
            id: uid(),
            policyYear: p.policyYear,
            date: p.date || addYears(state.meta.investDate, p.policyYear),
            premium: p.premium,
            guaranteed: p.guaranteed,
            nonGuaranteed: p.nonGuaranteed,
            surrender: p.surrender,
            note: p.note || "",
          });
        }
      });
      state.rows.sort((a, b) => a.policyYear - b.policyYear);
      const maxYear = Math.max(...state.rows.map((r) => r.policyYear));
      if (maxYear > state.meta.years) state.meta.years = maxYear;
    });
  }

  // ── 計算引擎串接 ─────────────────────────────────────────
  /**
   * 依「解約年度」建立淨現金流陣列。
   * guaranteedOnly=true 時完全排除非保證領回（保證 IRR 用）。
   */
  function buildCashflow(surrenderYear, nonGuaranteedFactor, guaranteedOnly) {
    const sorted = state.rows.slice().sort((a, b) => a.policyYear - b.policyYear);
    const cashflows = [];
    const dates = [];
    const periods = [];
    const includes = state.settings.surrenderIncludes;
    for (const row of sorted) {
      if (row.policyYear > surrenderYear) continue;
      const guaranteed = row.guaranteed || 0;
      const nonGuaranteed = guaranteedOnly ? 0 : (row.nonGuaranteed || 0) * (nonGuaranteedFactor / 100);
      let inflow;
      if (row.policyYear < surrenderYear) {
        inflow = guaranteed + nonGuaranteed;
      } else {
        const surrender = row.surrender || 0;
        inflow = includes === "included" ? surrender : guaranteed + nonGuaranteed + surrender;
      }
      cashflows.push(inflow - (row.premium || 0));
      dates.push(rowDate(row));
      periods.push(row.policyYear);
    }
    return { cashflows, dates, periods };
  }

  // 保單年度可能跳年（例如只填了第 0、10 年），期數必須用實際的
  // policyYear 折現，不能用陣列索引，否則會把「第 2 筆現金流」誤當成
  // 「第 2 年」導致 IRR 嚴重失真。
  function irrForYear(surrenderYear, nonGuaranteedFactor, guaranteedOnly) {
    const { cashflows, dates, periods } = buildCashflow(surrenderYear, nonGuaranteedFactor, guaranteedOnly);
    if (state.meta.mode === "date") return Engine.xirr(cashflows, dates);
    return Engine.irr(cashflows, periods);
  }

  function cumField(field, uptoYear, factor) {
    return state.rows.filter((r) => r.policyYear <= uptoYear).reduce((s, r) => s + (r[field] || 0) * (factor || 1), 0);
  }

  // 只算現金流加總，不呼叫 IRR 引擎——回本年度判斷、圖表的累積金額
  // 曲線都只需要這些數字，沒必要每次都連帶算兩次 IRR 掃描。
  function cashflowSummary(year, nonGuaranteedFactor) {
    const premiumSum = cumField("premium", year, 1);
    const guaranteedSum = cumField("guaranteed", year, 1);
    const nonGuaranteedSum = cumField("nonGuaranteed", year, nonGuaranteedFactor / 100);
    const { cashflows } = buildCashflow(year, nonGuaranteedFactor, false);
    const netSum = cashflows.reduce((s, v) => s + v, 0);
    const totalPayout = netSum + premiumSum;
    const profit = netSum;
    const totalReturn = premiumSum > 0 ? profit / premiumSum : null;
    return { year, premiumSum, guaranteedSum, nonGuaranteedSum, totalPayout, profit, totalReturn };
  }

  function yearlyStatsWithIrr(year, nonGuaranteedFactor) {
    const summary = cashflowSummary(year, nonGuaranteedFactor);
    const guaranteedIrr = irrForYear(year, 0, true);
    const trialIrr = irrForYear(year, nonGuaranteedFactor, false);
    return Object.assign({}, summary, { guaranteedIrr, trialIrr });
  }

  // 一次算出 1..maxYear 的逐年序列（含 IRR），年度比較表、圖表、
  // 回本年度判斷全部共用同一份結果，避免同一次重新渲染裡把同一組
  // IRR 反覆算好幾遍（30 年的試算，改前每次重繪要算約 240 次 IRR，
  // 改後只需要 60 次）。
  function computeYearlySeries(maxYear, factor) {
    const series = [];
    for (let y = 1; y <= maxYear; y++) {
      series.push({ trial: yearlyStatsWithIrr(y, factor), guaranteedOnly: cashflowSummary(y, 0) });
    }
    return series;
  }

  // ── 驗證與警示 ───────────────────────────────────────────
  function computeAlerts(mainResult) {
    const alerts = [];
    const rows = state.rows;

    if (!rows.some((r) => (r.premium || 0) > 0)) {
      alerts.push({ level: "warning", text: "目前沒有任何一筆繳入保費，至少需要一筆資金流出才能計算 IRR。" });
    }
    const hasInflow = rows.some((r) => (r.guaranteed || 0) > 0 || (r.nonGuaranteed || 0) > 0 || (r.surrender || 0) > 0);
    if (!hasInflow) {
      alerts.push({ level: "warning", text: "目前沒有任何一筆領回或解約金，至少需要一筆資金流入才能計算 IRR。" });
    }

    const years = rows.map((r) => r.policyYear);
    const dupYears = years.filter((y, i) => years.indexOf(y) !== i);
    if (dupYears.length) {
      alerts.push({ level: "danger", text: `保單年度重複：第 ${[...new Set(dupYears)].join("、")} 年，請合併為單一列後再計算。` });
    }

    if (state.meta.mode === "date") {
      const sorted = rows.slice().sort((a, b) => a.policyYear - b.policyYear).map((r) => new Date(rowDate(r)).getTime());
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] < sorted[i - 1]) {
          alerts.push({ level: "danger", text: "日期未依時間排序，請確認各年度日期正確。" });
          break;
        }
      }
    }

    if (state.settings.surrenderIncludes === "unknown") {
      alerts.push({ level: "warning", text: "尚未確認「解約金是否已包含當年度領回」，系統暫以「未包含」計算，可能導致重複計算，請向保險公司或商品建議書確認後更新設定。" });
    }

    if (mainResult.trial && mainResult.trial.hasMultipleRoots) {
      alerts.push({ level: "danger", text: "此組現金流存在多次正負號變化，可能產生多個內部報酬率。建議搭配淨現值 NPV 或修正內部報酬率 MIRR 判讀，本工具僅顯示絕對值最小的一個根供參考。" });
    }
    if (!mainResult.trial || !mainResult.trial.converged) {
      alerts.push({ level: "danger", text: "目前現金流無法計算 IRR。請確認至少有一筆資金流出及一筆資金流入，且現金流時間與金額設定正確。" });
    }

    if (mainResult.trial && mainResult.trial.converged) {
      const r = mainResult.trial.rate;
      if (r > 0.2) alerts.push({ level: "warning", text: `試算 IRR 高達 ${formatPercent(r)}，明顯偏高，請確認輸入金額是否正確。` });
      if (r < -0.5) alerts.push({ level: "warning", text: `試算 IRR 低於 -50%，請確認輸入金額是否正確。` });
    }

    const y = state.settings.surrenderYear;
    const row = rows.find((r) => r.policyYear === y);
    if (row) {
      const cumPremium = cumField("premium", y, 1);
      if ((row.surrender || 0) > cumPremium * 10 && cumPremium > 0) {
        alerts.push({ level: "warning", text: `第 ${y} 年解約金為累積保費的 10 倍以上，請確認金額是否正確。` });
      }
      if ((row.guaranteed || 0) > 0 && (row.nonGuaranteed || 0) > row.guaranteed * 5) {
        alerts.push({ level: "warning", text: `第 ${y} 年非保證領回超過保證領回的 5 倍，請確認是否合理。` });
      }
      if ((row.premium || 0) === 0 && (row.surrender || 0) > 0) {
        const hasEarlierPremium = rows.some((r) => r.policyYear < y && (r.premium || 0) > 0);
        if (!hasEarlierPremium) alerts.push({ level: "warning", text: `第 ${y} 年填有解約金，但先前並無任何保費繳納紀錄，請確認資料完整。` });
      }
      const prevRow = rows.find((r) => r.policyYear === y - 1);
      if (prevRow && (prevRow.surrender || 0) > 0 && (row.surrender || 0) < prevRow.surrender * 0.5) {
        alerts.push({ level: "warning", text: `第 ${y} 年解約金較前一年度大幅下降，請確認資料是否正確。` });
      }
    }

    return alerts;
  }

  // ── 主渲染 ───────────────────────────────────────────────
  function renderMetaFields() {
    document.getElementById("fName").value = state.meta.name;
    document.getElementById("fProduct").value = state.meta.product;
    document.getElementById("fCurrency").value = state.meta.currency;
    document.getElementById("fMode").value = state.meta.mode;
    document.getElementById("fInvestDate").value = state.meta.investDate;
    document.getElementById("fYears").value = state.meta.years;
    document.getElementById("fUnit").value = state.meta.unit;
    document.getElementById("fIrrDecimals").value = state.meta.irrDecimals;
    document.getElementById("fSurrenderIncludes").value = state.settings.surrenderIncludes;
    document.getElementById("fDiscountRate").value = state.settings.discountRate;
    document.getElementById("fNonGuaranteedFactor").value = state.settings.nonGuaranteedFactor;
    document.getElementById("fNonGuaranteedFactorVal").textContent = state.settings.nonGuaranteedFactor + "%";
    document.getElementById("thDate").style.display = state.meta.mode === "date" ? "" : "none";

    const surrenderSelect = document.getElementById("fSurrenderYear");
    const maxYear = Math.max(state.meta.years, ...state.rows.map((r) => r.policyYear), 1);
    const prevVal = state.settings.surrenderYear;
    surrenderSelect.innerHTML = "";
    for (let y = 1; y <= maxYear; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `第 ${y} 年`;
      surrenderSelect.appendChild(opt);
    }
    if (prevVal > maxYear) state.settings.surrenderYear = maxYear;
    surrenderSelect.value = state.settings.surrenderYear;
  }

  function renderTable() {
    const tbody = document.getElementById("cashflowBody");
    tbody.innerHTML = "";
    const sorted = state.rows.slice().sort((a, b) => a.policyYear - b.policyYear);
    const isDateMode = state.meta.mode === "date";

    sorted.forEach((row) => {
      const net = (row.guaranteed || 0) + (row.nonGuaranteed || 0) * (state.settings.nonGuaranteedFactor / 100) + (row.surrender || 0) - (row.premium || 0);
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td data-label="保單年度"><input type="number" value="${row.policyYear}" data-field="policyYear" style="text-align:center;min-width:56px"></td>
        <td data-label="日期" style="${isDateMode ? "" : "display:none"}"><input type="date" value="${row.date || rowDate(row)}" data-field="date"></td>
        <td data-label="繳入保費"><input type="number" min="0" value="${row.premium || 0}" data-field="premium"></td>
        <td data-label="保證領回"><input type="number" min="0" value="${row.guaranteed || 0}" data-field="guaranteed"></td>
        <td data-label="非保證領回"><input type="number" min="0" value="${row.nonGuaranteed || 0}" data-field="nonGuaranteed"></td>
        <td data-label="解約金"><input type="number" min="0" value="${row.surrender || 0}" data-field="surrender"></td>
        <td data-label="當期淨現金流"><input type="text" readonly value="${Math.round(net).toLocaleString("zh-Hant-TW")}" class="${net < 0 ? "pirr-net-negative" : net > 0 ? "pirr-net-positive" : ""}"></td>
        <td data-label="備註"><input type="text" class="pirr-note-input" value="${row.note ? escapeHtml(row.note) : ""}" data-field="note"></td>
        <td><div class="pirr-row-actions no-print">
          <button type="button" class="pirr-icon-btn" data-action="delete" title="刪除">🗑</button>
        </div></td>
      `;
      if (!isDateMode) tr.querySelector('[data-label="日期"]').style.display = "none";

      tr.querySelectorAll("input[data-field]").forEach((input) => {
        input.addEventListener("change", () => {
          const field = input.dataset.field;
          mutate(() => {
            if (field === "policyYear") row.policyYear = Math.round(parseFloat(input.value)) || 0;
            else if (field === "date" || field === "note") row[field] = input.value;
            else row[field] = Math.max(0, parseFloat(input.value) || 0);
          });
        });
      });
      tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRow(row.id));

      tbody.appendChild(tr);
    });
  }

  function renderAlerts(alerts) {
    const zone = document.getElementById("alertZone");
    zone.innerHTML = alerts
      .map((a) => `<div class="pirr-alert pirr-alert-${a.level}">${a.level === "danger" ? "⚠️ " : "ℹ️ "}${a.text}</div>`)
      .join("");
  }

  function renderResults(series, maxYear) {
    const y = state.settings.surrenderYear;
    const factor = state.settings.nonGuaranteedFactor;
    const stats = series[y - 1].trial;
    const guaranteedResult = stats.guaranteedIrr;
    const trialResult = stats.trialIrr;

    document.getElementById("resultYearLabel").textContent = `（第 ${y} 年解約）`;
    document.getElementById("statGuaranteedIrr").textContent = guaranteedResult.converged ? formatPercent(guaranteedResult.rate) : "無法計算";
    document.getElementById("statTrialIrr").textContent = trialResult.converged ? formatPercent(trialResult.rate) : "無法計算";
    document.getElementById("statIrrDiff").textContent =
      guaranteedResult.converged && trialResult.converged ? ((trialResult.rate - guaranteedResult.rate) * 100).toFixed(state.meta.irrDecimals) + " pp" : "—";

    document.getElementById("statCumPremium").textContent = formatMoney(stats.premiumSum);
    document.getElementById("statCumGuaranteed").textContent = formatMoney(stats.guaranteedSum);
    document.getElementById("statCumNonGuaranteed").textContent = formatMoney(stats.nonGuaranteedSum);
    document.getElementById("statTotalPayout").textContent = formatMoney(stats.totalPayout);
    const profitEl = document.getElementById("statProfit");
    profitEl.textContent = formatMoney(stats.profit);
    profitEl.className = "pirr-stat-value " + (stats.profit >= 0 ? "success" : "danger");
    document.getElementById("statTotalReturn").textContent = stats.totalReturn === null ? "—" : (stats.totalReturn * 100).toFixed(1) + "%";

    // 回本年度：只需要現金流加總（cashflowSummary／series 裡的 profit），
    // 不需要另外呼叫 IRR。
    let nominalBreakeven = null;
    let compoundBreakeven = null;
    const discountRate = (state.settings.discountRate || 0) / 100;
    for (let yy = 1; yy <= maxYear; yy++) {
      const s = series[yy - 1].trial;
      if (nominalBreakeven === null && s.profit >= 0) nominalBreakeven = yy;
      if (compoundBreakeven === null) {
        const { cashflows, periods } = buildCashflow(yy, factor, false);
        if (Engine.npv(discountRate, cashflows, periods) >= 0) compoundBreakeven = yy;
      }
      if (nominalBreakeven !== null && compoundBreakeven !== null) break;
    }
    document.getElementById("statBreakevenNominal").textContent = nominalBreakeven ? `第 ${nominalBreakeven} 年` : "試算期間內尚未回本";
    document.getElementById("statBreakevenCompound").textContent = compoundBreakeven ? `第 ${compoundBreakeven} 年` : "試算期間內尚未回本";

    const { cashflows: trialCashflows, periods: trialPeriods } = buildCashflow(y, factor, false);
    document.getElementById("statNpv").textContent = formatMoney(Engine.npv(discountRate, trialCashflows, trialPeriods));

    // 三情境（僅針對目前選定的解約年度，與逐年序列無關，維持獨立計算）
    const scenarioGrid = document.getElementById("scenarioGrid");
    const scenarios = [
      { name: "保證情境（0%）", factor: 0 },
      { name: "基準情境（100%）", factor: 100 },
      { name: "保守情境（80%）", factor: 80 },
    ];
    scenarioGrid.innerHTML = scenarios
      .map((sc) => {
        const r = irrForYear(y, sc.factor, false);
        return `<div class="pirr-scenario-card"><div class="name">${sc.name}</div><div class="val">${r.converged ? formatPercent(r.rate) : "無法計算"}</div></div>`;
      })
      .join("");

    return { guaranteed: guaranteedResult, trial: trialResult };
  }

  function renderYearTable(series) {
    const tbody = document.getElementById("yearTableBody");
    const rowsHtml = series.map((entry, idx) => {
      const y = idx + 1;
      const s = entry.trial;
      const row = state.rows.find((r) => r.policyYear === y);
      const surrenderVal = row ? row.surrender || 0 : 0;
      const active = y === state.settings.surrenderYear ? "active" : "";
      return `
        <tr class="${active}" data-year="${y}">
          <td>第 ${y} 年</td>
          <td>${formatMoney(s.premiumSum)}</td>
          <td>${formatMoney(s.guaranteedSum)}</td>
          <td>${formatMoney(s.nonGuaranteedSum)}</td>
          <td>${formatMoney(surrenderVal)}</td>
          <td>${formatMoney(s.totalPayout)}</td>
          <td>${s.guaranteedIrr.converged ? formatPercent(s.guaranteedIrr.rate) : "—"}</td>
          <td>${s.trialIrr.converged ? formatPercent(s.trialIrr.rate) : "—"}</td>
          <td class="${s.profit >= 0 ? "breakeven" : ""}">${s.profit >= 0 ? "✅ 已回本" : "—"}</td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml.join("");
    tbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        mutate(() => {
          state.settings.surrenderYear = parseInt(tr.dataset.year, 10);
        });
      });
    });
  }

  function chartColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      navy900: css.getPropertyValue("--navy-900").trim() || "#102947",
      navy700: css.getPropertyValue("--navy-700").trim() || "#244f83",
      amber500: css.getPropertyValue("--amber-500").trim() || "#F59E0B",
      danger: css.getPropertyValue("--danger").trim() || "#dc2626",
      line: css.getPropertyValue("--line").trim() || "#dbe4ee",
      textMain: css.getPropertyValue("--text-main").trim() || "#1a2433",
    };
  }

  function renderCharts(series, maxYear) {
    if (typeof Chart === "undefined") {
      console.warn("未偵測到 Chart.js，跳過圖表渲染。");
      return;
    }
    const colors = chartColors();
    const factor = state.settings.nonGuaranteedFactor;
    const labels = [];
    const cumPremiumSeries = [];
    const cumGuaranteedSeries = [];
    const cumTrialSeries = [];
    const guaranteedIrrSeries = [];
    const trialIrrSeries = [];

    series.forEach((entry, idx) => {
      const y = idx + 1;
      const s = entry.trial;
      labels.push(`第${y}年`);
      cumPremiumSeries.push(Math.round(s.premiumSum / state.meta.unit));
      cumGuaranteedSeries.push(Math.round(entry.guaranteedOnly.totalPayout / state.meta.unit));
      cumTrialSeries.push(Math.round(s.totalPayout / state.meta.unit));
      guaranteedIrrSeries.push(s.guaranteedIrr.converged ? +(s.guaranteedIrr.rate * 100).toFixed(3) : null);
      trialIrrSeries.push(s.trialIrr.converged ? +(s.trialIrr.rate * 100).toFixed(3) : null);
    });

    const sortedRows = state.rows.slice().sort((a, b) => a.policyYear - b.policyYear);
    const barLabels = sortedRows.map((r) => `第${r.policyYear}年`);
    const barPremium = sortedRows.map((r) => -Math.round((r.premium || 0) / state.meta.unit));
    const barGuaranteed = sortedRows.map((r) => Math.round((r.guaranteed || 0) / state.meta.unit));
    const barNonGuaranteed = sortedRows.map((r) => Math.round(((r.nonGuaranteed || 0) * factor / 100) / state.meta.unit));
    const barSurrender = sortedRows.map((r) => Math.round((r.surrender || 0) / state.meta.unit));

    if (charts.acc) charts.acc.destroy();
    if (charts.irr) charts.irr.destroy();
    if (charts.bar) charts.bar.destroy();

    charts.acc = new Chart(document.getElementById("chartAccumulation").getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "累積繳入保費", data: cumPremiumSeries, borderColor: colors.danger, backgroundColor: "transparent", tension: 0.2 },
          { label: "累積保證領回＋解約金", data: cumGuaranteedSeries, borderColor: colors.navy700, backgroundColor: "transparent", tension: 0.2 },
          { label: "累積含非保證領回＋解約金", data: cumTrialSeries, borderColor: colors.amber500, backgroundColor: "transparent", tension: 0.2 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: colors.textMain } } }, scales: { x: { ticks: { color: colors.textMain } }, y: { ticks: { color: colors.textMain }, grid: { color: colors.line } } } },
    });

    charts.irr = new Chart(document.getElementById("chartIrrCurve").getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "保證 IRR (%)", data: guaranteedIrrSeries, borderColor: colors.navy700, backgroundColor: "transparent", tension: 0.2, spanGaps: true },
          { label: "含非保證利益 IRR (%)", data: trialIrrSeries, borderColor: colors.amber500, backgroundColor: "transparent", tension: 0.2, spanGaps: true },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: colors.textMain } } }, scales: { x: { ticks: { color: colors.textMain } }, y: { ticks: { color: colors.textMain }, grid: { color: colors.line } } } },
    });

    charts.bar = new Chart(document.getElementById("chartCashflowBar").getContext("2d"), {
      type: "bar",
      data: {
        labels: barLabels,
        datasets: [
          { label: "保費支出", data: barPremium, backgroundColor: colors.danger },
          { label: "保證領回", data: barGuaranteed, backgroundColor: colors.navy700 },
          { label: "非保證領回", data: barNonGuaranteed, backgroundColor: colors.amber500 },
          { label: "解約金", data: barSurrender, backgroundColor: colors.navy900 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { stacked: true, ticks: { color: colors.textMain } }, y: { stacked: true, ticks: { color: colors.textMain }, grid: { color: colors.line } } }, plugins: { legend: { labels: { color: colors.textMain } } } },
    });
  }

  function renderAll() {
    renderMetaFields();
    renderTable();
    const maxYear = Math.max(state.meta.years, ...state.rows.map((r) => r.policyYear), 1);
    const factor = state.settings.nonGuaranteedFactor;
    const series = computeYearlySeries(maxYear, factor);
    const mainResult = renderResults(series, maxYear);
    renderYearTable(series);
    renderAlerts(computeAlerts(mainResult));
    renderCharts(series, maxYear);
  }

  // ── CSV 匯出 ─────────────────────────────────────────────
  function exportCsv() {
    const header = ["保單年度", "日期", "繳入保費", "保證領回", "非保證領回", "解約金", "備註"];
    const lines = [header.join(",")];
    state.rows
      .slice()
      .sort((a, b) => a.policyYear - b.policyYear)
      .forEach((r) => {
        lines.push([r.policyYear, rowDate(r), r.premium || 0, r.guaranteed || 0, r.nonGuaranteed || 0, r.surrender || 0, `"${(r.note || "").replace(/"/g, '""')}"`].join(","));
      });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.meta.name || "保單現金流試算"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF 精緻報告（jsPDF ＋ html2canvas） ─────────────────
  // jsPDF 內建字型不支援中文字，直接用 doc.text() 寫中文會變空白／亂碼。
  // 做法：把報告內容渲染成隱藏的 HTML 頁面（走瀏覽器原生字型），
  // 再用 html2canvas 逐頁截圖成圖片貼進 PDF，圖表則直接用 canvas
  // 本身的 toDataURL()，不需要額外截圖。
  // scale:1.5 + JPEG（非 PNG）：這幾頁幾乎都是文字／表格，用無損 PNG
  // 在 scale:2 下曾經讓 4 頁報告膨脹到近 30MB。文字＋表格線在中高品質
  // JPEG 下肉眼看不出差異，檔案可縮小到約 1/6～1/8，方便使用者用
  // email／LINE 分享。
  async function addHtmlPageSliced(doc, elId, pageWidth, pageHeight, isFirstPageOverall) {
    const el = document.getElementById(elId);
    const canvas = await window.html2canvas(el, { scale: 1.5, backgroundColor: "#ffffff" });
    const scaleFactor = canvas.width / pageWidth;
    const sliceHeightPx = pageHeight * scaleFactor;
    let renderedHeight = 0;
    let first = true;
    while (renderedHeight < canvas.height) {
      const thisSliceHeight = Math.min(sliceHeightPx, canvas.height - renderedHeight);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = thisSliceHeight;
      const ctx = sliceCanvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, thisSliceHeight, 0, 0, canvas.width, thisSliceHeight);
      if (!(isFirstPageOverall && first)) doc.addPage();
      doc.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageWidth, thisSliceHeight / scaleFactor);
      renderedHeight += thisSliceHeight;
      first = false;
    }
  }

  async function generatePdfReport() {
    const btn = document.getElementById("btnGeneratePdf");
    if (typeof window.jspdf === "undefined" || typeof window.html2canvas === "undefined") {
      alert("PDF 產生元件尚未載入完成（可能是離線或 CDN 資源被封鎖），請確認網路連線後重新整理頁面再試一次。");
      return;
    }
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "產生中…";
    try {
      const y = state.settings.surrenderYear;
      const factor = state.settings.nonGuaranteedFactor;
      const stats = yearlyStatsWithIrr(y, factor);
      const guaranteedResult = stats.guaranteedIrr;
      const trialResult = stats.trialIrr;

      document.getElementById("pdfSummaryContent").innerHTML = `
        <div class="pirr-pdf-kv">
          <div><span>商品名稱</span><span>${escapeHtml(state.meta.product || "（未填寫）")}</span></div>
          <div><span>試算名稱</span><span>${escapeHtml(state.meta.name || "未命名試算")}</span></div>
          <div><span>試算日期</span><span>${todayStr()}</span></div>
          <div><span>幣別</span><span>${state.meta.currency}</span></div>
          <div><span>指定解約年度</span><span>第 ${y} 年</span></div>
          <div><span>計算模式</span><span>${state.meta.mode === "date" ? "精確日期模式（XIRR）" : "年度簡易模式（IRR）"}</span></div>
          <div><span>累積繳入保費</span><span>${formatMoney(stats.premiumSum)}</span></div>
          <div><span>解約時總領回</span><span>${formatMoney(stats.totalPayout)}</span></div>
          <div><span>保證年化 IRR</span><span>${guaranteedResult.converged ? formatPercent(guaranteedResult.rate) : "無法計算"}</span></div>
          <div><span>含非保證利益年化 IRR</span><span>${trialResult.converged ? formatPercent(trialResult.rate) : "無法計算"}</span></div>
          <div><span>損益金額</span><span>${formatMoney(stats.profit)}</span></div>
          <div><span>總報酬率</span><span>${stats.totalReturn === null ? "—" : (stats.totalReturn * 100).toFixed(1) + "%"}</span></div>
        </div>`;

      const sortedRows = state.rows.slice().sort((a, b) => a.policyYear - b.policyYear);
      document.getElementById("pdfCashflowContent").innerHTML = `
        <table class="pirr-pdf-table">
          <thead><tr><th>保單年度</th><th>日期</th><th>繳入保費</th><th>保證領回</th><th>非保證領回</th><th>解約金</th><th>備註</th></tr></thead>
          <tbody>
            ${sortedRows
              .map(
                (r) =>
                  `<tr><td style="text-align:center">第 ${r.policyYear} 年</td><td>${rowDate(r)}</td><td>${formatMoney(r.premium || 0)}</td><td>${formatMoney(r.guaranteed || 0)}</td><td>${formatMoney(r.nonGuaranteed || 0)}</td><td>${formatMoney(r.surrender || 0)}</td><td style="text-align:left">${escapeHtml(r.note || "")}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>`;

      const accCanvas = document.getElementById("chartAccumulation");
      const irrCanvas = document.getElementById("chartIrrCurve");
      document.getElementById("pdfChartsContent").innerHTML = `
        <div style="margin-bottom:24px">
          <div style="font-weight:700;color:#102947;margin-bottom:8px;font-size:13px">圖表一：累積保費與累積價值</div>
          <img id="pdfChartImg1" style="width:100%;display:block">
        </div>
        <div>
          <div style="font-weight:700;color:#102947;margin-bottom:8px;font-size:13px">圖表二：各年度解約 IRR 曲線</div>
          <img id="pdfChartImg2" style="width:100%;display:block">
        </div>`;
      const img1 = document.getElementById("pdfChartImg1");
      const img2 = document.getElementById("pdfChartImg2");
      if (accCanvas && accCanvas.width) {
        img1.src = accCanvas.toDataURL("image/png");
        await img1.decode().catch(() => {});
      }
      if (irrCanvas && irrCanvas.width) {
        img2.src = irrCanvas.toDataURL("image/png");
        await img2.decode().catch(() => {});
      }

      const includesLabel = { not_included: "未包含，另外加計", included: "已包含，不另行加計", unknown: "不確定" }[state.settings.surrenderIncludes];
      document.getElementById("pdfAssumptionsContent").innerHTML = `
        <ul>
          <li>保費繳納時點：各保單年度期初</li>
          <li>領回／解約金給付時點：${state.meta.mode === "date" ? "依實際輸入日期" : "各保單年度期末（簡易年度模式）"}</li>
          <li>是否採實際日期折現：${state.meta.mode === "date" ? "是（XIRR，Actual/365）" : "否（年度 IRR）"}</li>
          <li>解約金是否已包含當年度領回：${includesLabel}</li>
          <li>非保證利益實現比例：${factor}%</li>
          <li>匯率假設：僅顯示幣別（${state.meta.currency}），本工具不進行跨幣別匯率換算</li>
          <li>計算方式：先以粗略掃描定位現金流變號區間，再以二分法收斂、Newton-Raphson 拋光；搜尋範圍 -99.99%～1000%，容許誤差 1e-8</li>
        </ul>
        <p><strong>揭露與免責聲明：</strong>本工具係依使用者輸入之保費、領回金額及解約金進行現金流與內部報酬率試算，不代表保險公司之保證給付、宣告利率、投資績效或實際解約金。實際權利義務及給付金額，仍應以保險契約、保單條款、保險公司正式文件及實際辦理結果為準。</p>
        <p>內部報酬率僅反映所輸入現金流的時間價值，未呈現保險保障成本、死亡保障價值、稅務效果、匯率風險、流動性限制及提前終止契約等因素，不宜作為選擇保險商品的唯一依據。</p>
      `;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "px", format: "a4", compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      await addHtmlPageSliced(doc, "pdfPage1", pageWidth, pageHeight, true);
      await addHtmlPageSliced(doc, "pdfPage2", pageWidth, pageHeight, false);
      await addHtmlPageSliced(doc, "pdfPage3", pageWidth, pageHeight, false);
      await addHtmlPageSliced(doc, "pdfPage4", pageWidth, pageHeight, false);

      doc.save(`${state.meta.name || "保單現金流試算"}_報告.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF 產生失敗：" + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ── 事件綁定 ─────────────────────────────────────────────
  function bindMetaInputs() {
    const bind = (id, path, parser) => {
      document.getElementById(id).addEventListener("change", (e) => {
        mutate(() => {
          const val = parser ? parser(e.target.value) : e.target.value;
          const [group, key] = path;
          state[group][key] = val;
        });
      });
    };
    bind("fName", ["meta", "name"]);
    bind("fProduct", ["meta", "product"]);
    bind("fCurrency", ["meta", "currency"]);
    bind("fMode", ["meta", "mode"]);
    bind("fInvestDate", ["meta", "investDate"]);
    bind("fYears", ["meta", "years"], (v) => Math.max(1, parseInt(v, 10) || 20));
    bind("fUnit", ["meta", "unit"], (v) => parseInt(v, 10));
    bind("fIrrDecimals", ["meta", "irrDecimals"], (v) => parseInt(v, 10));
    bind("fSurrenderYear", ["settings", "surrenderYear"], (v) => parseInt(v, 10));
    bind("fSurrenderIncludes", ["settings", "surrenderIncludes"]);
    bind("fDiscountRate", ["settings", "discountRate"], (v) => parseFloat(v));

    const slider = document.getElementById("fNonGuaranteedFactor");
    slider.addEventListener("input", () => {
      document.getElementById("fNonGuaranteedFactorVal").textContent = slider.value + "%";
    });
    slider.addEventListener("change", () => {
      mutate(() => {
        state.settings.nonGuaranteedFactor = parseInt(slider.value, 10);
      });
    });
  }

  function bindToolbar() {
    document.getElementById("btnAddRow").addEventListener("click", addRow);
    document.getElementById("btnBuildYears").addEventListener("click", buildYears);
    document.getElementById("btnDuplicate").addEventListener("click", duplicateLastRow);
    document.getElementById("btnBatchPremium").addEventListener("click", () => openBatchFillModal("premium", "繳入保費"));
    document.getElementById("btnBatchGuaranteed").addEventListener("click", () => openBatchFillModal("guaranteed", "保證領回"));
    document.getElementById("btnBatchFillCancel").addEventListener("click", closeBatchFillModal);
    document.getElementById("btnBatchFillConfirm").addEventListener("click", confirmBatchFill);
    document.getElementById("btnClear").addEventListener("click", clearAll);
    document.getElementById("btnUndo").addEventListener("click", undo);
    document.getElementById("btnRedo").addEventListener("click", redo);

    document.getElementById("btnPaste").addEventListener("click", () => {
      document.getElementById("pasteModal").classList.remove("hidden");
    });
    document.getElementById("btnPasteCancel").addEventListener("click", () => {
      document.getElementById("pasteModal").classList.add("hidden");
    });
    document.getElementById("btnPasteConfirm").addEventListener("click", () => {
      const text = document.getElementById("pasteTextarea").value;
      importPastedRows(parsePasteText(text));
      document.getElementById("pasteModal").classList.add("hidden");
      document.getElementById("pasteTextarea").value = "";
    });

    document.getElementById("btnUploadCsv").addEventListener("click", () => {
      document.getElementById("csvFileInput").click();
    });
    document.getElementById("csvFileInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleCsvFile(file);
      e.target.value = "";
    });

    document.getElementById("btnSave").addEventListener("click", saveNow);
    document.getElementById("btnLoad").addEventListener("click", loadSaved);
    document.getElementById("btnClearSaved").addEventListener("click", clearSaved);
    document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnGeneratePdf").addEventListener("click", generatePdfReport);
  }

  // ── 初始化 ───────────────────────────────────────────────
  function init() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        state = JSON.parse(raw);
      } catch (e) {
        state = defaultState();
      }
    } else {
      state = defaultState();
    }
    snapshot();
    bindMetaInputs();
    bindToolbar();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
