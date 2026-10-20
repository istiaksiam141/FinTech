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

  function summarize(plan, { quoteComparison = null, quoteRanking = null, finance = globalThis.CampusBridgeFinance, savingsTracker = globalThis.CampusBridgeSavingsTracker, planState = globalThis.CampusBridgePlanState, now = new Date() } = {}) {
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
      paymentComparison: quotes
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

  return Object.freeze({ summarize, summarizeQuotes });
});
