(function () {
  "use strict";

  const E = window.EstateTaxEngine;
  const $ = (id) => document.getElementById(id);

  function checkboxValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function readInput() {
    return {
      deathDate: $("deathDate").value,
      grossEstate: $("grossEstate").value,
      dailyNecessitiesValue: $("dailyNecessitiesValue").value,
      workToolsValue: $("workToolsValue").value,
      spouseCount: $("spouseCount").value,
      linealDescCount: $("linealDescCount").value,
      linealMinorExtraYears: $("linealMinorExtraYears").value,
      parentCount: $("parentCount").value,
      disabledCount: $("disabledCount").value,
      dependentSiblingGrandparentCount: $("dependentSiblingGrandparentCount").value,
      dependentSiblingMinorExtraYears: $("dependentSiblingMinorExtraYears").value,
      funeralDeductionEnabled: $("funeralDeductionEnabled").checked,
      advancedFlags: checkboxValues("advancedFlags"),
    };
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function alertBox(type, text) {
    const div = document.createElement("div");
    div.className = `etax-alert ${type}`;
    div.textContent = text;
    return div;
  }

  function renderAlerts(result) {
    const zone = $("caseAlerts");
    zone.innerHTML = "";
    if (result.advancedReviewRequired) {
      const reasonText = result.advancedReasons.length ? `：${result.advancedReasons.join("、")}` : "";
      zone.appendChild(alertBox("warn", `此案件需要進階覆核${reasonText}。`));
    } else {
      zone.appendChild(alertBox("ok", "目前以 115 年度核心遺產稅公式進行初步試算。"));
    }
    result.errors.forEach((message) => zone.appendChild(alertBox("error", message)));
    result.warnings.slice(0, 4).forEach((message) => zone.appendChild(alertBox("warn", message)));
  }

  function renderSummary(result) {
    const m = E.money;
    setText("ruleVersion", result.ruleVersion);
    setText("updatedAt", result.updatedAt);
    setText("caseStatus", result.advancedReviewRequired ? "此案件含進階或非 115 年度情境，建議進一步覆核後再作申報判斷。" : "目前可依本頁 115 年度常數做核心公式概算。");
    setText("liveGrossEstate", m(result.grossEstate));
    setText("liveExcluded", m(result.excludedTotal));
    setText("liveDeductions", m(result.deductionsTotal));
    setText("liveNetEstate", m(result.netEstate));
    setText("liveBracket", result.bracket.label);
    setText("liveEstateTax", m(result.estateTax));

    setText("sumRuleYear", result.ruleYearLabel);
    setText("sumExemption", m(result.exemption));
    setText("sumExcludedDaily", m(result.excludedDailyNecessities));
    setText("sumExcludedWork", m(result.excludedWorkTools));
    setText("sumExcludedTotal", m(result.excludedTotal));
    setText("sumSpouse", m(result.deductions.spouse));
    setText("sumLineal", m(result.deductions.lineal + result.deductions.linealMinor));
    setText("sumParent", m(result.deductions.parent));
    setText("sumDisabled", m(result.deductions.disabled));
    setText("sumDependent", m(result.deductions.dependentSiblingGrandparent + result.deductions.dependentSiblingMinor));
    setText("sumFuneral", m(result.deductions.funeral));
    setText("sumDeductionsTotal", m(result.deductionsTotal));
  }

  function resultRows(result) {
    return [
      ["遺產總額", result.grossEstate, true],
      ["不計入遺產總額合計", result.excludedTotal, true],
      ["配偶扣除額", result.deductions.spouse, true],
      ["直系血親卑親屬扣除及未成年加扣", result.deductions.lineal + result.deductions.linealMinor, true],
      ["父母扣除額", result.deductions.parent, true],
      ["身心障礙特別扣除額", result.deductions.disabled, true],
      ["受扶養兄弟姊妹、祖父母扣除及未成年加扣", result.deductions.dependentSiblingGrandparent + result.deductions.dependentSiblingMinor, true],
      ["喪葬費扣除額", result.deductions.funeral, true],
      ["扣除額合計", result.deductionsTotal, true],
      ["免稅額", result.exemption, true],
      ["課稅遺產淨額", result.netEstate, true],
      ["適用級距", result.bracket.label, false],
      ["預估應納遺產稅額", result.estateTax, true],
    ];
  }

  function renderResult(result) {
    const m = E.money;
    setText("resultTitle", result.advancedReviewRequired ? "概念性遺產稅估算，需進階覆核" : "預估應納遺產稅額");
    setText("resultEstateTax", m(result.estateTax));
    setText("statNetEstate", m(result.netEstate));
    setText("statBracket", result.bracket.label);
    setText("statEffectiveRate", E.percent(result.effectiveRate));
    setText("statRule", result.ruleYearLabel);

    const messages = $("resultMessages");
    messages.innerHTML = "";
    if (result.errors.length) result.errors.forEach((message) => messages.appendChild(alertBox("error", message)));
    if (result.netEstate === 0) {
      messages.appendChild(alertBox("ok", "依目前輸入資料，課稅遺產淨額為 0，預估遺產稅為 0。"));
    }
    if (result.advancedReviewRequired) {
      messages.appendChild(alertBox("warn", "本頁未處理完整申報調整項目，例如債務、配偶剩餘財產差額分配、農地、保險給付與跨境財產等。"));
    }
    result.warnings.forEach((message) => messages.appendChild(alertBox("warn", message)));

    const tbody = $("resultTable");
    tbody.innerHTML = "";
    resultRows(result).forEach(([label, value, isMoney]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      const td = document.createElement("td");
      th.textContent = label;
      td.textContent = isMoney ? m(value) : value;
      tr.append(th, td);
      tbody.appendChild(tr);
    });
  }

  function buildCopyText(result) {
    const rows = resultRows(result)
      .map(([label, value, isMoney]) => `${label}：${isMoney ? E.money(value) : value}`)
      .join("\n");
    return [
      "台灣遺產稅試算摘要",
      `規則版本：${result.ruleVersion}`,
      `資料更新日期：${result.updatedAt}`,
      `案件狀態：${result.advancedReviewRequired ? "概念性估算，需進階覆核" : "核心公式概算"}`,
      rows,
      "本工具僅供教育與初步試算參考，不構成法律、稅務、會計或申報意見。",
    ].join("\n");
  }

  let lastResult = null;

  function update() {
    lastResult = E.calculate(readInput());
    renderAlerts(lastResult);
    renderSummary(lastResult);
    renderResult(lastResult);
  }

  function resetDefaults() {
    $("taxForm").reset();
    update();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function init() {
    document.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });
    document.querySelectorAll("[data-goto]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = $(button.dataset.goto);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    $("printResult").addEventListener("click", () => window.print());
    $("resetForm").addEventListener("click", resetDefaults);
    $("copySummary").addEventListener("click", async () => {
      if (!lastResult) update();
      try {
        await navigator.clipboard.writeText(buildCopyText(lastResult));
        $("copySummary").textContent = "已複製";
        window.setTimeout(() => { $("copySummary").textContent = "複製試算摘要"; }, 1400);
      } catch (error) {
        alert("瀏覽器未允許複製，請改用列印結果。");
      }
    });
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
