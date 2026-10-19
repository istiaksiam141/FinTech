(function () {
  "use strict";
  const Finance = window.CampusBridgeFinance;
  function loadPlan() {
    const stored = window.CampusBridgePlanState?.loadPlan();
    if (!stored?.ok) return { ok: false, message: "No valid plan is saved for this browser tab. Start on the planner page to create one." };
    const result = Finance.calculateTuition({ ...stored.profile });
    if (!result.ok) return { ok: false, message: "The saved plan is no longer valid. Return to the planner, review your inputs, and calculate again." };
    return { ok: true, profile: stored.profile, result, roadmap: Finance.buildContributionRoadmap(stored.profile, result) };
  }
  function money(value, currency) {
    const stored = window.CampusBridgePlanState?.loadPlan();
    const planCurrency = stored?.ok ? stored.profile.tuitionCur : "BDT";
    const targetCurrency = currency || planCurrency;
    let displayValue = Number(value);
    if (targetCurrency !== "BDT") {
      const rate = Number(stored?.ok ? stored.profile.exchangeRate : NaN);
      if (!Number.isFinite(rate) || rate <= 0) return `Not available ${targetCurrency}`;
      try { displayValue = Finance.convert(displayValue, "BDT", targetCurrency, { BDT: rate, [targetCurrency]: 1 }); }
      catch { return `Not available ${targetCurrency}`; }
    }
    if (!Number.isFinite(displayValue)) return `Not available ${targetCurrency}`;
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: targetCurrency === "BDT" ? 0 : 2 }).format(displayValue)} ${targetCurrency}`;
  }
  function addText(parent, tag, text, className = "") { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; parent.append(node); return node; }
  window.CampusBridgePageUtils = Object.freeze({ Finance, loadPlan, money, addText });
})();
