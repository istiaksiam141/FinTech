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
  function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(value); }
  function addText(parent, tag, text, className = "") { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; parent.append(node); return node; }
  window.CampusBridgePageUtils = Object.freeze({ Finance, loadPlan, money, addText });
})();
