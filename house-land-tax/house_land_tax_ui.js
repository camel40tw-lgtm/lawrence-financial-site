(function () {
  "use strict";

  const E = window.HouseLandTaxEngine;
  const $ = (id) => document.getElementById(id);

  function radioBool(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value === "true" : false;
  }

  function checkboxValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function readInput() {
    return {
      isIndividual: radioBool("isIndividual"),
      isResident: radioBool("isResident"),
      assetType: $("assetType").value,
      acquisitionMethod: $("acquisitionMethod").value,
      specialScenarios: checkboxValues("specialScenarios"),
      acquisitionDate: $("acquisitionDate").value,
      transferDate: $("transferDate").value,
      datesAreRegistrationDates: $("datesAreRegistrationDates").checked,
      salePrice: $("salePrice").value,
      acquisitionCost: $("acquisitionCost").value,
      purchaseRelatedCosts: $("purchaseRelatedCosts").value,
      improvementCosts: $("improvementCosts").value,
      transferExpenses: $("transferExpenses").value,
      canProvideExpenseEvidence: radioBool("canProvideExpenseEvidence"),
      landValueIncrementTotal: $("landValueIncrementTotal").value,
      currentAssessedLandValue: $("currentAssessedLandValue").value,
      previousTransferValue: $("previousTransferValue").value,
      landValueIncrementTaxPaid: $("landValueIncrementTaxPaid").value,
      excessLandValueIncrementTaxPaid: $("excessLandValueIncrementTaxPaid").value,
      checkSelfUseBenefit: $("checkSelfUseBenefit").checked,
      selfUseRegistered: $("selfUseRegistered").checked,
      selfUseSixYears: $("selfUseSixYears").checked,
      selfUseNoRental: $("selfUseNoRental").checked,
      selfUseNoBusiness: $("selfUseNoBusiness").checked,
      selfUseNotUsedBefore: $("selfUseNotUsedBefore").checked,
    };
  }

  function alertBox(type, text) {
    const div = document.createElement("div");
    div.className = `hlt-alert ${type}`;
    div.textContent = text;
    return div;
  }

  function renderCaseAlerts(result) {
    const zone = $("caseAlerts");
    zone.innerHTML = "";
    if (result.advancedReviewRequired) {
      zone.appendChild(alertBox("warn", `此案件需要進階規則覆核：${result.advancedReasons.join("、")}。一般公式只能作概念性估算。`));
    } else {
      zone.appendChild(alertBox("ok", "目前符合 MVP 一般試算範圍：個人、境內居住者、一般買賣、一般房地標的。"));
    }
    result.errors.forEach((message) => zone.appendChild(alertBox("error", message)));
    result.warnings.slice(0, 3).forEach((message) => zone.appendChild(alertBox("warn", message)));
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function rateLabel(result) {
    if (result.selfUseEligible) return "自住優惠";
    return result.generalTaxRate == null ? "—" : E.percent(result.generalTaxRate);
  }

  function renderSummary(result) {
    const m = E.money;
    setText("ruleVersion", result.ruleVersion);
    setText("caseStatus", result.advancedReviewRequired ? "此案件包含進階情境，結果只能作概念性參考。" : "目前屬一般案件，可依本頁規則進行初步概算。");
    setText("liveHolding", result.holdingYearsLabel);
    setText("liveRate", result.generalTaxRate == null ? "—" : E.percent(result.generalTaxRate));
    setText("liveLandDeduction", m(result.recognizedLandDeduction));
    setText("liveTaxableIncome", m(result.taxableIncome));
    setText("liveEstimatedTax", m(result.estimatedTax));

    setText("sumHolding", result.holdingYearsLabel);
    setText("sumRate", result.generalTaxRateLabel);
    setText("sumFilingDate", result.filingDueDate);
    setText("sumBaseExpenses", m(result.baseExpenses));
    setText("sumStandardExpense", m(result.standardExpense));
    setText("sumRecognizedBaseExpenses", m(result.recognizedBaseExpenses));
    setText("sumLandCap", m(result.landDeductionCap));
    setText("sumRecognizedLand", m(result.recognizedLandDeduction));
    setText("sumExcessLand", m(result.excessLandValueIncrement));
    setText("sumSelfUse", result.selfUseEligible ? "可能符合" : "未套用");
    setText("sumSelfUseTax", result.selfUseEstimatedTax == null ? "—" : m(result.selfUseEstimatedTax));
  }

  function resultRows(result) {
    return [
      ["出售成交價額", readInput().salePrice, true],
      ["原始取得成本", readInput().acquisitionCost, true],
      ["可採認費用", result.recognizedExpenses, true],
      ["房地交易所得", result.realEstateTransactionIncome, true],
      ["土地漲價總數額", readInput().landValueIncrementTotal, true],
      ["法定減除上限", result.landDeductionCap, true],
      ["實際採用土地扣除額", result.recognizedLandDeduction, true],
      ["未減除土地漲價總數額", result.excessLandValueIncrement, true],
      ["超限部分對應之土地增值稅", readInput().excessLandValueIncrementTaxPaid, true],
      ["房地合一課稅所得", result.taxableIncome, true],
      ["一般稅率試算稅額", result.generalEstimatedTax, true],
      ["自住優惠試算稅額", result.selfUseEstimatedTax == null ? "—" : result.selfUseEstimatedTax, result.selfUseEstimatedTax != null],
      ["本頁顯示預估稅額", result.estimatedTax, true],
    ];
  }

  function renderResult(result) {
    const m = E.money;
    setText("resultTitle", result.advancedReviewRequired ? "概念性估算，需進階覆核" : "預估房地合一稅");
    setText("resultEstimatedTax", m(result.estimatedTax));
    setText("statTransactionIncome", m(result.realEstateTransactionIncome));
    setText("statTaxableIncome", m(result.taxableIncome));
    setText("statRate", rateLabel(result));
    setText("statHolding", result.holdingYearsLabel);
    setText("statFiling", result.filingDueDate);

    const messages = $("resultMessages");
    messages.innerHTML = "";
    if (result.errors.length) {
      result.errors.forEach((message) => messages.appendChild(alertBox("error", message)));
    }
    if (result.advancedReviewRequired) {
      messages.appendChild(alertBox("warn", "本案包含進階情境，一般試算結果只能作為概念性參考。實際申報前應由稽徵機關、會計師或稅務代理人確認。"));
    }
    if (result.taxableIncome === 0) {
      messages.appendChild(alertBox("ok", "依目前輸入資料，本次房地合一課稅所得為 0，預估稅額為 0。若有交易損失，未來扣抵仍需依規定與個案資料判斷。"));
    } else if (result.selfUseEligible && result.taxableIncome <= 4000000) {
      messages.appendChild(alertBox("ok", "依你的自住聲明，本案可能符合自住房地優惠，課稅所得 400 萬元以內部分預估免稅。"));
    } else if (result.selfUseEligible) {
      messages.appendChild(alertBox("ok", "依你的自住聲明，本案可能符合自住房地優惠，超過 400 萬元部分按 10% 試算。"));
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
      "房地合一 2.0 稅額試算摘要",
      `規則版本：${result.ruleVersion}`,
      `案件狀態：${result.advancedReviewRequired ? "概念性估算，需進階覆核" : "一般試算"}`,
      `持有期間：${result.holdingYearsLabel}`,
      `適用稅率：${rateLabel(result)}`,
      `申報提醒日：${result.filingDueDate}`,
      rows,
      "本工具僅供教育與初步試算參考，不構成稅務、法律、會計或申報意見。",
    ].join("\n");
  }

  let lastResult = null;

  function update() {
    lastResult = E.calculate(readInput());
    renderCaseAlerts(lastResult);
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

