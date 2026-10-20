(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantPlanContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const finite = value => Number.isFinite(value) ? value : null;
  const text = (value, max = 160) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  function summarize(plan, { quoteComparison = null, quoteRanking = null, stressScenarios = null, finance = globalThis.CampusBridgeFinance, savingsTracker = globalThis.CampusBridgeSavingsTracker, planState = globalThis.CampusBridgePlanState, now = new Date() } = {}) {
    const profile = plan?.ok === true ? plan.profile : null;
    const result = plan?.ok === true ? plan.result : null;
    const roadmap = plan?.ok === true ? plan.roadmap : null;
    if (!profile || result?.ok !== true || roadmap?.ok !== true) {
      return { version: 1, status: "unavailable", asOfDate: localDate(now), reason: "No valid calculated plan is available in this browser." };
    }

    const target = finance?.describeMonthlySavingsTarget?.(result);
    const contributions = Array.isArray(roadmap.contributions)
      ? roadmap.contributions.map(item => [item.dueDate, item.requiredContributionBdt])
      : [];
    const matchedTracker = readTrackerSummary(profile, { savingsTracker, finance, planState, now });
    const quotes = summarizeQuotes(quoteComparison, quoteRanking);
    const storedPlan = planState?.loadPlan?.();
    const scenarios = Array.isArray(stressScenarios) ? stressScenarios : storedPlan?.ok ? storedPlan.stressScenarios : [];
    const report = buildFinancialReport(profile, result, roadmap, scenarios, matchedTracker, quotes, { finance, now });
    return {
      version: 1,
      status: "available",
      asOfDate: localDate(now),
      destinationCountry: text(profile.destinationCountry, 80),
      planningMode: profile.planningMode === "tuition-only" ? "tuition-only" : "all-costs",
      planningCurrency: text(result.tuitionCurrency || profile.tuitionCur, 3),
      tuition: { enteredAmount: finite(result.tuition), amountBdt: finite(result.tuitionHome), currency: text(result.tuitionCurrency || profile.tuitionCur, 3) },
      costs: {
        requiredFundsBdt: finite(result.requiredFunds),
        paymentFeesBdt: finite(result.paymentFee),
        otherStudyCostsBdt: finite(Math.max(0, result.estimatedOtherCosts - result.paymentFee)),
        initialLivingCostsBdt: finite(result.initialLivingCostsTotal)
      },
      funding: {
        availableSavingsBdt: finite(result.savings),
        protectedReserveBdt: finite(result.emergency),
        committedFundsBdt: finite(result.committed),
        usableSavingsBdt: finite(result.usable),
        fundingGapBdt: finite(result.gap),
        monthlySurplusBdt: finite(result.disposable),
        projectedCapacityBdt: finite(result.capacity),
        projectedShortfallBdt: finite(result.shortfall)
      },
      deadline: { date: text(profile.deadline, 10), daysRemaining: finite(result.daysRemaining), complete30DayCycles: finite(result.contributionCycles) },
      schedule: {
        requiredContributionBdtPerCycle: finite(target?.regularAmount),
        requiredFinalContributionBdt: finite(target?.finalAmount),
        monthlySavingsCapacityBdt: finite(roadmap.monthlySavingsCapacityBdt),
        roadmapState: text(roadmap.state, 32),
        targetCanBeReachedByDeadline: roadmap.targetCanBeReachedByDeadline === true,
        contributions: contributions.map((row, index) => [row[0], row[1], roadmap.contributions[index].exceedsMonthlyCapacityBdt > 0])
      },
      exchangeRate: {
        bdtPerPlanningCurrency: finite(result.rate),
        source: text(profile.rateSource),
        timestamp: text(profile.rateTimestamp, 64),
        provenance: text(profile.rateProvenance, 180)
      },
      savingsTracker: matchedTracker,
      paymentComparison: quotes,
      financialReport: report
    };
  }

  function buildFinancialReport(profile, result, roadmap, stressScenarios, tracker, quotes, { finance, now }) {
    const reportData = finance.buildReadinessReportData(profile, result, { roadmap, stressScenarios, reportDate: now });
    const costFields = [
      ["visaCost", "Visa"], ["applicationCost", "Application"], ["flightCost", "Flight"],
      ["insuranceCost", "Insurance"], ["documentCost", "Documents"], ["accommodationDeposit", "Accommodation deposit"],
      ["initialSetupCost", "Initial setup"], ["otherOneTimeCosts", "Other one-time costs"]
    ];
    const livingFields = [
      ["monthlyRent", "Rent"], ["monthlyFood", "Food"], ["monthlyTransport", "Transport"],
      ["monthlyUtilities", "Utilities"], ["monthlyOtherLiving", "Other monthly living costs"]
    ];
    const costItem = ([key, label]) => ({ label, amountBdt: finite(profile[key]), provided: profile[key] !== "" && profile[key] != null });
    const stress = stressScenarios.map(item => ({
      name: text(item.name, 80), ok: item.ok === true,
      exchangeRate: finite(item.exchangeRate), expenseIncreaseBdt: finite(item.expenseIncrease),
      missedContributions: finite(item.missedContributions), missedContributionAmountBdt: finite(item.missedContributionAmount),
      requiredFundsBdt: finite(item.requiredFunds), usableSavingsBdt: finite(item.usableSavings), fundingGapBdt: finite(item.fundingGap),
      monthlySurplusBdt: finite(item.monthlySurplus), scheduledCycles: finite(item.scheduledCycles), remainingCycles: finite(item.contributionCycles),
      contributionTargetBdt: finite(item.monthlyTarget), projectedCapacityBdt: finite(item.projectedCapacity), projectedShortfallBdt: finite(item.projectedShortfall)
    }));
    const missingInformation = [];
    if (!text(profile.rateSource)) missingInformation.push("Exchange-rate source not provided.");
    if (!text(profile.rateTimestamp)) missingInformation.push("Exchange-rate timestamp not provided.");
    if (!text(profile.rateProvenance)) missingInformation.push("Exchange-rate verification details not provided.");
    if (profile.planningMode === "tuition-only") missingInformation.push("Other one-time and living costs are excluded by Tuition Only mode.");
    else {
      for (const [key, label] of [...costFields, ...livingFields]) if (profile[key] === "" || profile[key] == null) missingInformation.push(`${label} estimate not provided; it is excluded from the total.`);
      if (profile.initialLivingMonths === "" || profile.initialLivingMonths == null) missingInformation.push("Initial living-cost planning period not provided.");
    }
    if (tracker.status !== "available") missingInformation.push("No linked savings-tracker deposit totals are available for this plan.");
    if (quotes.status !== "available") missingInformation.push("No eligible payment comparisons are available from the current page.");
    if (!stress.length) missingInformation.push("No saved stress-test results are available.");
    const contributions = roadmap.contributions.map(item => ({
      cycle: finite(item.cycle), dueDate: text(item.dueDate, 10), requiredTargetBdt: finite(item.requiredContributionBdt),
      cumulativeTargetBdt: finite(item.cumulativePlannedContributionsBdt), projectedSavingsBalanceBdt: finite(item.projectedSavingsBalanceBdt),
      remainingFundingGapBdt: finite(item.remainingFundingGapBdt), aboveMonthlyCapacityBdt: finite(item.exceedsMonthlyCapacityBdt)
    }));
    const limitations = [
      reportData.planningModeNote,
      "All monetary calculation results are BDT. Entered optional cost estimates are converted to BDT before deterministic calculation.",
      "Optional cost fields are normalized to zero when blank, so the saved plan cannot distinguish a blank field from an explicitly entered zero.",
      "Savings dates and projected totals are estimates based on the entered surplus and exchange-rate assumption; they are not guaranteed deposits.",
      "Tracker deposits and payment quotes are student-entered and are not bank or provider verified.",
      "Stress tests are hypothetical scenarios and do not modify the baseline plan."
    ];
    return {
      title: reportData.title,
      planningMode: reportData.planningMode,
      planningModeNote: reportData.planningModeNote,
      destinationCountry: reportData.destinationCountry,
      planningCurrency: reportData.tuitionCurrency,
      costs: {
        tuitionEntered: finite(reportData.tuitionAmount), tuitionCurrency: reportData.tuitionCurrency, tuitionBdt: finite(reportData.tuitionEstimateBdt),
        paymentFeesBdt: finite(reportData.paymentFeesBdt), oneTimeItems: costFields.map(costItem), oneTimeTotalBdt: finite(reportData.oneTimeCostsBdt),
        monthlyLivingItems: livingFields.map(costItem), initialLivingMonths: finite(reportData.initialLivingMonths), monthlyLivingTotalBdt: finite(reportData.monthlyLivingCostsBdt),
        initialLivingTotalBdt: finite(reportData.initialLivingCostsBdt), otherEnteredCostsBdt: finite(reportData.otherEnteredCostsBdt), totalRequiredFundsBdt: finite(reportData.totalRequiredFundsBdt)
      },
      funding: {
        availableSavingsBdt: finite(reportData.savingsBdt), protectedReserveBdt: finite(reportData.emergencyReserveBdt), committedFundsBdt: finite(reportData.committedFundsBdt),
        usableSavingsBdt: finite(reportData.usableFundsBdt), fundingGapBdt: finite(reportData.fundingGapBdt), monthlyIncomeBdt: finite(reportData.monthlyIncomeBdt),
        monthlyExpensesBdt: finite(reportData.monthlyExpensesBdt), monthlySurplusBdt: finite(reportData.monthlySurplusBdt), projectedCapacityBdt: finite(reportData.projectedSavingsCapacityBdt),
        projectedShortfallBdt: finite(reportData.projectedShortfallBdt)
      },
      deadline: { date: text(reportData.deadline, 10), daysRemaining: finite(result.daysRemaining), assumptions: "Complete 30-day contribution cycles before the entered deadline." },
      savingsSchedule: {
        frequencyDays: 30, completeCycles: finite(result.contributionCycles), state: text(roadmap.state, 32), targetCanBeReachedByDeadline: roadmap.targetCanBeReachedByDeadline === true,
        regularContributionTargetBdt: finite(reportData.contributionSchedule.regularAmountBdt), finalContributionTargetBdt: finite(reportData.contributionSchedule.finalAmountBdt),
        requiredContributionTotalBdt: finite(roadmap.requiredContributionTotalBdt), monthlySavingsCapacityBdt: finite(roadmap.monthlySavingsCapacityBdt),
        projectedSavingsCapacityBdt: finite(roadmap.projectedSavingsCapacityBdt), endingProjectedSavingsBalanceBdt: finite(roadmap.endingProjectedSavingsBalanceBdt),
        endingRemainingFundingGapBdt: finite(roadmap.endingRemainingFundingGapBdt), contributions
      },
      exchangeRate: { bdtPerPlanningCurrency: finite(reportData.exchangeRate), source: text(reportData.rateSource), timestamp: text(reportData.rateTimestamp), provenance: text(reportData.rateVerification) },
      savingsTracker: tracker,
      stressTests: { status: stress.length ? "available" : "not-run", scenarios: stress },
      paymentComparison: quotes,
      missingInformation: missingInformation.slice(0, 30),
      limitations,
      nextSteps: reportData.nextSteps.map(item => text(item, 240)).filter(Boolean).slice(0, 4),
      disclaimer: reportData.disclaimer
    };
  }

  function readTrackerSummary(profile, { savingsTracker, finance, planState, now }) {
    const unavailable = { status: "unavailable", totalDepositsBdt: null, recordCount: null, monthTotals: [], planStatus: null, remainingBdt: null, verifiedByBank: false };
    if (!savingsTracker?.createLocalSavings) return { ...unavailable, status: "not-loaded" };
    try {
      const tracker = savingsTracker.createLocalSavings({ finance, planState });
      const listed = tracker.listRoadmaps();
      if (!listed?.ok) return unavailable;
      const row = listed.roadmaps.find(item => JSON.stringify(canonical(item.profile)) === JSON.stringify(canonical(profile)));
      if (!row) return { status: "no-matching-roadmap", totalDepositsBdt: null, recordCount: null, monthTotals: [], planStatus: null, remainingBdt: null, verifiedByBank: false };
      const depositsResult = tracker.listDeposits(row.id);
      if (!depositsResult?.ok) return unavailable;
      const history = savingsTracker.monthlyHistory(depositsResult.deposits, now);
      const comparison = savingsTracker.compare(row.snapshot, depositsResult.deposits, now);
      return {
        status: "available",
        totalDepositsBdt: finite(history.totalBdt),
        recordCount: history.deposits.length,
        monthTotals: history.months.slice(-12).map(item => [item.month, finite(item.amountBdt)]),
        planStatus: text(comparison.status, 32),
        remainingBdt: finite(comparison.remainingBdt),
        verifiedByBank: false
      };
    } catch {
      return unavailable;
    }
  }

  function summarizeQuotes(comparison, ranking = null) {
    if (!comparison || comparison.ok !== true) return { status: "unavailable", principalBdt: null, recipientCurrency: null, ranking: null, options: [] };
    const options = Array.isArray(comparison.available) ? comparison.available.slice(0, 8).map(item => ({
      provider: text(item.quote?.name, 80),
      senderCostBdt: finite(item.totalCost),
      recipientAmount: finite(item.recipientAmount),
      recipientCurrency: text(item.currency, 3),
      feeBdt: finite(item.fee),
      quotedRateBdtPerUnit: finite(item.quotedRate),
      deliveryDays: finite(item.days),
      quoteTimestamp: text(item.timestamp, 40),
      verified: false
    })) : [];
    return {
      status: options.length ? "available" : "none-eligible",
      principalBdt: finite(comparison.amount),
      recipientCurrency: text(options[0]?.recipientCurrency, 3),
      ranking: ["cost", "recv", "time"].includes(ranking) ? ranking : null,
      options
    };
  }

  return Object.freeze({ summarize, summarizeQuotes, buildFinancialReport });
});
