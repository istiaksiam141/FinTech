(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const form = document.getElementById("stress-form"), output = document.getElementById("stress-page-results"), notice = document.getElementById("stress-page-notice");
  const plan = loadPlan();
  if (!plan.ok) { notice.textContent = plan.message; form.hidden = true; return; }
  document.getElementById("stress-baseline").textContent = `Baseline funding gap: ${money(plan.result.gap)} · projected capacity: ${money(plan.result.capacity)} · shortfall: ${money(plan.result.shortfall)}.`;
  form.addEventListener("submit", event => {
    event.preventDefault(); output.replaceChildren();
    const raw = document.getElementById("expense-increase").value;
    const expenseIncrease = raw === "" ? undefined : Number(raw);
    if (raw !== "" && (!Number.isFinite(expenseIncrease) || expenseIncrease < 0 || expenseIncrease > Finance.MAX_CALCULATED_BDT)) { notice.textContent = "Enter a non-negative expense increase within the supported calculation limit."; return; }
    const options = { missedContributions: document.getElementById("missed-cycle").checked ? 1 : 0 };
    if (expenseIncrease !== undefined) options.expenseIncrease = expenseIncrease;
    const scenarios = Finance.calculateStressScenarios({ ...plan.profile }, options);
    if (!scenarios.ok) { notice.textContent = scenarios.errors.join(" "); return; }
    window.CampusBridgePlanState.saveStressOptions(options);
    notice.textContent = "Scenarios use independent copies of the saved plan. They do not change the baseline.";
    for (const scenario of scenarios.scenarios) {
      const card = document.createElement("article"); card.className = "surface scenarioResult";
      const title = document.createElement("h2"); title.textContent = scenario.name; card.append(title);
      const description = document.createElement("p"); description.textContent = `Funding gap ${money(scenario.fundingGap)} · contribution target ${scenario.monthlyTarget == null ? "not available" : money(scenario.monthlyTarget)} · projected capacity ${money(scenario.projectedCapacity)} · shortfall ${money(scenario.projectedShortfall)}.`; card.append(description);
      if (scenario.name.includes("missed")) { const assumption = document.createElement("p"); assumption.textContent = `Missed amount assumption: ${money(scenario.missedContributionAmount)} based on one scheduled whole-BDT contribution, capped at the current positive monthly surplus.`; card.append(assumption); }
      output.append(card);
    }
  });
})();
