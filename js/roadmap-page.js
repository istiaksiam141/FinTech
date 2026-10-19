(function () {
  "use strict";
  const { loadPlan, addText } = window.CampusBridgePageUtils;
  const summary = document.getElementById("roadmap-summary");
  const list = document.getElementById("roadmap-list");
  const plan = loadPlan();
  if (!plan.ok) { summary.textContent = plan.message; return; }
  const roadmap = plan.roadmap;
  const currency = plan.profile.tuitionCur, rate = Number(plan.profile.exchangeRate);
  const planMoney = value => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(window.CampusBridgeFinance.convert(value, "BDT", currency, { BDT: rate, [currency]: 1 }))} ${currency}`;
  summary.textContent = `${roadmap.summary.replace(/([\d,.]+) BDT/g, (_match, amount) => planMoney(Number(amount.replaceAll(",", ""))))} Planned contributions are estimates, not guaranteed future payments.`;
  if (!roadmap.contributions.length) {
    addText(document.getElementById("roadmap-content"), "p", roadmap.state === "covered" ? "Your current usable savings cover the estimated need; no contribution dates are needed." : "No complete 30-day contribution date falls before this deadline. Update the deadline or review other funding options.", "emptyNote");
  }
  for (const item of roadmap.contributions) {
    const row = document.createElement("li"); row.className = "surface roadmapPageItem";
    addText(row, "h2", `Cycle ${item.cycle} · ${item.dueDate}`);
    const details = document.createElement("dl");
    for (const [label, value] of [["Required planned contribution", planMoney(item.requiredContributionBdt)], ["Cumulative planned contributions", planMoney(item.cumulativePlannedContributionsBdt)], ["Projected savings balance", planMoney(item.projectedSavingsBalanceBdt)], ["Remaining funding gap at projected capacity", planMoney(item.remainingFundingGapBdt)]]) {
      const term = document.createElement("dt"), description = document.createElement("dd"); term.textContent = label; description.textContent = value; details.append(term, description);
    }
    row.append(details); list.append(row);
  }
  const capacity = document.getElementById("roadmap-capacity");
  capacity.textContent = `Projected savings capacity: ${planMoney(plan.result.capacity)}. Monthly surplus: ${planMoney(Math.max(0, plan.result.disposable))}.`;
})();
