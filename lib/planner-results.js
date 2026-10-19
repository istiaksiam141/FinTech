(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CampusBridgePlannerResults = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function summarize(result, roadmap, deadline) {
    const covered = result.gap === 0;
    const contributionDates = Array.isArray(roadmap?.contributions)
      ? roadmap.contributions.map(item => ({ date: item.dueDate, amountBdt: item.requiredContributionBdt, cycle: item.cycle }))
      : [];
    let state;
    let message;

    if (covered) {
      state = "covered";
      message = "Your available savings cover the estimated goal. No additional contributions are required for these assumptions.";
    } else if (roadmap?.state === "no-contribution-dates") {
      state = "no-dates";
      message = "No complete 30-day contribution date remains before the deadline. The funding gap is still outstanding; review the costs, available savings, or target date.";
    } else if (roadmap?.targetCanBeReachedByDeadline === false) {
      state = "shortfall";
      message = "The goal is not projected to be fully funded by the deadline under the current savings-capacity assumptions. Review the costs, available savings, or target date.";
    } else if (roadmap?.targetCanBeReachedByDeadline === true) {
      state = "scheduled";
      message = "The goal is projected to be reachable by the deadline if the full entered monthly surplus is saved. This is an estimate, not a guarantee.";
    } else {
      state = "informational";
      message = "The current results do not confirm whether the goal can be reached by the deadline. Review the dated savings contribution roadmap and your assumptions.";
    }

    const scheduleAvailable = !covered && roadmap?.ok === true && roadmap.state !== "no-contribution-dates" && result.contributionCycles > 0;
    return {
      state,
      message,
      fundingGoalBdt: result.requiredFunds,
      availableSavingsBdt: result.usable,
      fundingGapBdt: result.gap,
      deadline,
      daysRemaining: result.daysRemaining,
      fundedRatio: result.fundedRatio,
      shortfallBdt: result.shortfall,
      contributionCycles: result.contributionCycles,
      scheduleAvailable,
      contributionDates: scheduleAvailable ? contributionDates : []
    };
  }

  function charts(result, roadmap) {
    const unavailable = reason => ({ ok: false, reason });
    if (!result || result.ok !== true) return unavailable("A validated financial result is not available.");
    if (!Number.isFinite(result.rate) || result.rate <= 0) return unavailable("A valid exchange rate is required before charting this plan.");
    const { requiredFunds: goal, usable: savings, gap, fundedRatio } = result;
    if (![goal, savings, gap, fundedRatio].every(Number.isFinite) || goal < 0 || savings < 0 || gap < 0 || fundedRatio < 0 || fundedRatio > 1 || gap > goal) {
      return unavailable("Some financial result values are missing or outside the supported range.");
    }
    if (goal === 0) return unavailable("A zero funding goal has no meaningful comparison or coverage split.");
    if ((gap === 0 && fundedRatio !== 1) || (gap > 0 && fundedRatio >= 1)) {
      return unavailable("The funding gap and coverage result do not agree, so charts are not shown.");
    }

    const maximum = Math.max(goal, savings, gap);
    const columns = [
      { key: "goal", label: "Education funding goal", amountBdt: goal },
      { key: "savings", label: "Available savings", amountBdt: savings },
      { key: "gap", label: "Remaining funding gap", amountBdt: gap }
    ].map(column => ({ ...column, heightPercent: maximum > 0 ? column.amountBdt / maximum * 100 : 0 }));
    let coveredPercent = gap === 0 ? 100 : Math.round(fundedRatio * 1000) / 10;
    if (gap > 0 && coveredPercent >= 100) coveredPercent = 99.9;
    const remainingPercent = 100 - coveredPercent;
    return {
      ok: true,
      goalBdt: goal,
      availableSavingsBdt: savings,
      fundingGapBdt: gap,
      columns,
      coveredPercent,
      remainingPercent,
      projectionConfirmed: roadmap?.ok === true && typeof roadmap.targetCanBeReachedByDeadline === "boolean"
    };
  }

  return Object.freeze({ summarize, charts });
});
