(function () {
  const currencyFormatter = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  });

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toPositiveInt(value, fallback = 0) {
    const number = Math.trunc(toFiniteNumber(value, fallback));
    return number > 0 ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeDivide(numerator, denominator, fallback = 0) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return fallback;
    }
    return numerator / denominator;
  }

  function annualizeAmount(amount, frequency) {
    const numericAmount = toFiniteNumber(amount, 0);
    if (frequency === "monthly") return numericAmount * 12;
    return numericAmount;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(toFiniteNumber(value, 0));
  }

  function formatPercent(value, digits = 1) {
    return `${(toFiniteNumber(value, 0) * 100).toFixed(digits)}%`;
  }

  function sumBy(items, iteratee) {
    return (items || []).reduce((sum, item) => sum + toFiniteNumber(iteratee(item), 0), 0);
  }

  window.SharedFinanceUtilsV1 = {
    annualizeAmount,
    clamp,
    formatCurrency,
    formatPercent,
    safeDivide,
    sumBy,
    toFiniteNumber,
    toPositiveInt
  };
})();
