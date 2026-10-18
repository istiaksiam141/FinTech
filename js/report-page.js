(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const status = document.getElementById("report-status"), page = document.getElementById("report-page");
  const plan = loadPlan();
  if (!plan.ok) { status.textContent = plan.message; document.getElementById("report-actions").hidden = true; return; }
  const roadmap = plan.roadmap;
  const savedState = window.CampusBridgePlanState.loadPlan();
  const data = Finance.buildReadinessReportData(plan.profile, plan.result, { reportDate: new Date(), roadmap, stressScenarios: savedState.stressScenarios || [] });
  if (!data.ok) { status.textContent = data.errors.join(" "); return; }
  const heading = document.createElement("h1"); heading.textContent = data.title; page.append(heading);
  const subtitle = document.createElement("p"); subtitle.className = "reportSubtitle"; subtitle.textContent = `${data.branding} · ${data.destinationCountry} · Prepared ${data.reportDate}`; page.append(subtitle);
  const costRows = [
    ...data.oneTimeCostItems.filter(item => item.amountBdt !== null).map(item => [item.label, money(item.amountBdt)]),
    ...data.monthlyLivingCostItems.filter(item => item.amountBdt !== null).map(item => [`${item.label} / month`, money(item.amountBdt)]),
    ["Initial living-cost planning period", data.initialLivingMonths == null ? "Not provided" : `${data.initialLivingMonths} month(s)`]
  ];
  const groups = [
    ["Plan and tuition", [["Planning mode", data.planningModeName], ["Destination", `${data.destinationCountry} (${data.tuitionCurrency})`], ["Tuition entered", `${data.tuitionAmount} ${data.tuitionCurrency}`], ["Deadline", data.deadline]]],
    ["Entered cost estimates", [["Estimated tuition in BDT", money(data.tuitionEstimateBdt)], ...costRows, ["Other costs included", money(data.otherEnteredCostsBdt)]]],
    ["Funding summary", [["Payment / transfer fees", money(data.paymentFeesBdt)], ["Available savings", money(data.savingsBdt)], ["Protected emergency reserve", money(data.emergencyReserveBdt)], ["Committed funds", money(data.committedFundsBdt)], ["Usable savings", money(data.usableFundsBdt)], ["Total required funds", money(data.totalRequiredFundsBdt)], ["Funding gap", money(data.fundingGapBdt)], ["Monthly contribution schedule", data.contributionSchedule.state === "available" ? `${money(data.contributionSchedule.regularAmountBdt)} regular · ${money(data.contributionSchedule.finalAmountBdt)} final cycle` : data.contributionSchedule.state === "covered" ? "No additional contribution required" : "No complete 30-day cycle before deadline"], ["Available complete 30-day cycles", String(data.contributionCycles)], ["Monthly income / expenses", `${money(data.monthlyIncomeBdt)} / ${money(data.monthlyExpensesBdt)}`], ["Monthly surplus", money(data.monthlySurplusBdt)], ["Projected savings capacity", money(data.projectedSavingsCapacityBdt)], ["Projected shortfall", money(data.projectedShortfallBdt)]]],
    ["Exchange-rate provenance", [["Reference rate", `${data.exchangeRate} BDT per ${data.tuitionCurrency}`], ["Source", data.rateSource || "Not provided"], ["Effective / entered timestamp", data.rateTimestamp || "Not provided"], ["Verification", data.rateVerification]]]
  ];
  for (const [label, rows] of groups) {
    const section = document.createElement("section"), title = document.createElement("h2"), list = document.createElement("dl"); title.textContent = label; section.append(title);
    for (const [key, value] of rows) { const term = document.createElement("dt"), desc = document.createElement("dd"); term.textContent = key; desc.textContent = value ?? "Not provided"; list.append(term, desc); }
    section.append(list); page.append(section);
  }
  const next = document.createElement("section"), nextTitle = document.createElement("h2"), list = document.createElement("ul"); nextTitle.textContent = "Suggested next steps";
  for (const item of data.nextSteps) { const row = document.createElement("li"); row.textContent = item; list.append(row); }
  next.append(nextTitle, list); page.append(next);
  if (data.stressScenarios.length) {
    const scenarios = document.createElement("section"), title = document.createElement("h2"), list = document.createElement("ul"); title.textContent = "Saved stress-test results";
    for (const scenario of data.stressScenarios) { const item = document.createElement("li"); const assumptions = []; if (scenario.exchangeRate != null) assumptions.push(`rate ${scenario.exchangeRate}`); if (scenario.expenseIncrease) assumptions.push(`monthly expenses +${money(scenario.expenseIncrease)}`); if (scenario.missedContributionAmount) assumptions.push(`missed contribution ${money(scenario.missedContributionAmount)}`); item.textContent = `${scenario.name}${assumptions.length ? ` (${assumptions.join(", ")})` : ""}: funding gap ${money(scenario.fundingGap)}, projected capacity ${money(scenario.projectedCapacity)}, projected shortfall ${money(scenario.projectedShortfall)}.`; list.append(item); }
    scenarios.append(title, list); page.append(scenarios);
  }
  const disclaimer = document.createElement("p"); disclaimer.className = "reportDisclaimer"; disclaimer.textContent = data.disclaimer; page.append(disclaimer);
  status.textContent = "Review this local report before printing. Student name is not stored.";
  document.getElementById("print-report").addEventListener("click", () => window.print());
  document.getElementById("report-download").addEventListener("click", () => {
    const scenarioLines = data.stressScenarios.flatMap(item => [`Scenario: ${item.name}`, `Funding gap: ${money(item.fundingGap)}`, `Projected shortfall: ${money(item.projectedShortfall)}`]);
    const lines = [data.branding, data.title, ...groups.flatMap(([label, rows]) => [label, ...rows.map(([key, value]) => `${key}: ${value}`)]), ...(scenarioLines.length ? ["Saved stress tests", ...scenarioLines] : []), "Next steps", ...data.nextSteps.map(value => `- ${value}`), data.disclaimer];
    const link = document.createElement("a"), url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    link.href = url; link.download = "campusbridge-financial-readiness-report.txt"; link.click(); URL.revokeObjectURL(url);
  });
})();
