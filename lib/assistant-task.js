(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantTask = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function run({ question, Finance, plan, quotes = [], quoteInput, money = value => `${value} BDT`, today = new Date() } = {}) {
    const intent = Finance?.assistantIntent?.(question);
    if (!intent || intent === "general") return { handled: false };
    const formatMoney = (value, currency = "BDT") => currency === "BDT"
      ? money(value)
      : new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

    if (intent === "compare_payment_options") {
      if (!quoteInput || !Array.isArray(quotes)) {
        return { handled: true, answer: "To compare transfer quotes, enter the same BDT payment amount and current provider quote details on the Transfers section of the planner. I can compare only quotes entered there; I cannot retrieve or verify provider offers." };
      }
      const comparison = Finance.compareEnteredQuotes(quoteInput, quotes, today);
      if (!comparison.ok) {
        return { handled: true, answer: `I need valid quote comparison inputs first: ${comparison.errors.join(" ")}` };
      }
      if (!comparison.available.length) {
        const excluded = comparison.unavailable.length
          ? ` Entered quotes were excluded: ${comparison.unavailable.map(item => `${item.quote.name || "Quote"}: ${item.reason}`).join(" ")}`
          : " No provider quotes have been entered yet.";
        return { handled: true, answer: `There are no eligible quotes to compare.${excluded} Enter current details from each provider and verify its terms directly. User-entered quotes are not provider-verified.` };
      }
      const currency = comparison.available[0].currency;
      const ranked = comparison.available.map((item, index) => {
        const time = item.days === null ? "delivery time not provided" : `${item.days} business days`;
        return `${index + 1}. ${item.quote.name}: sender cost ${formatMoney(item.totalCost)}, recipient amount ${formatMoney(item.recipientAmount, currency)}, ${time}; source/reference ${item.reference}; timestamp ${item.timestamp}.`;
      }).join(" ");
      return { handled: true, answer: `Comparison of ${comparison.available.length} eligible student-entered quote(s), ranked by ${quoteInput.sort === "recv" ? "recipient amount" : quoteInput.sort === "time" ? "delivery time" : "total sender cost"}: ${ranked} These quotes are not provider-verified. Confirm current availability, expiry, fees, and payment terms directly with each provider before acting.` };
    }

    if (!plan?.ok || !plan.profile || !plan.result?.ok) {
      const action = intent === "explain_rate_provenance"
        ? "Open the planner and calculate a plan with a rate source and timestamp to review the rate currently used."
        : intent === "explain_monthly_budget"
          ? "Open the planner and enter monthly income and expenses, then calculate your plan to review its surplus."
          : "Open the planner, enter the required tuition, currency, sourced rate, available savings, and deadline, then calculate your plan.";
      return { handled: true, answer: `${action} I cannot calculate a personal result without valid planner inputs.` };
    }

    const { profile, result } = plan;
    if (intent === "explain_rate_provenance") {
      const source = typeof profile.rateSource === "string" ? profile.rateSource.trim() : "";
      const timestamp = typeof profile.rateTimestamp === "string" ? profile.rateTimestamp.trim() : "";
      const provenance = typeof profile.rateProvenance === "string" ? profile.rateProvenance.trim() : "";
      if (!source || !timestamp || !provenance) {
        return { handled: true, answer: "The saved plan does not contain complete rate source, timestamp, and verification details. Return to the planner and enter a sourced rate or fetch the available Bangladesh Bank reference rate. I cannot label this rate verified or current." };
      }
      return { handled: true, answer: `The saved plan uses ${result.rate} BDT per ${profile.tuitionCur}. Source: ${source}. Timestamp: ${timestamp} (local time). Rate status: ${provenance}. This saved plan does not refresh the rate or establish that it is still current; check the planner's rate status before relying on it. CampusBridge does not forecast future rates; update the planner rate to recalculate a what-if scenario. A Bangladesh Bank reference rate is not a provider payment quote.` };
    }

    if (intent === "explain_monthly_budget") {
      if (!Number.isFinite(result.disposable)) return { handled: true, answer: "The saved plan has no valid monthly income and expense result. Enter valid monthly income and expenses on the planner and recalculate; I will not estimate a surplus." };
      return { handled: true, answer: `Based on the saved plan, entered monthly income minus entered monthly expenses is ${money(result.disposable)}. This is the planner's estimate of monthly surplus, not a guarantee that the full amount can be saved.` };
    }

    if (intent === "explain_funding_gap") {
      if (![result.requiredFunds, result.usable, result.gap, result.shortfall].every(Number.isFinite)) return { handled: true, answer: "The saved plan does not contain a valid funding calculation. Review required planner inputs and recalculate; I will not fill in missing financial values." };
      const mode = profile.planningMode === Finance.PLANNING_MODES.TUITION_ONLY ? "tuition-only estimate (not a complete study-abroad budget)" : "entered study-abroad cost estimate";
      const source = typeof profile.rateSource === "string" && profile.rateSource.trim() ? profile.rateSource : "source not recorded";
      const timestamp = typeof profile.rateTimestamp === "string" && profile.rateTimestamp.trim() ? profile.rateTimestamp : "timestamp not recorded";
      const provenance = typeof profile.rateProvenance === "string" && profile.rateProvenance.trim() ? profile.rateProvenance : "verification status not recorded";
      return { handled: true, answer: `The saved plan's ${mode} is ${money(result.requiredFunds)}. Usable funds after protected emergency savings and committed funds are ${money(result.usable)}, leaving an estimated funding gap of ${money(result.gap)}. The calculation uses rate source “${source}”, timestamp “${timestamp}” (local time), and provenance “${provenance}”. The saved plan does not refresh the rate or establish that it is still current, and the rate is not a provider payment quote. The estimate includes only the costs entered in the selected planning mode.` };
    }

    if (intent === "explain_savings_schedule") {
      if (!Number.isFinite(result.gap) || !Number.isInteger(result.contributionCycles)) return { handled: true, answer: "The saved plan does not contain a valid funding gap and deadline calculation. Review the required planner inputs and recalculate before requesting a savings schedule." };
      const target = Finance.describeMonthlySavingsTarget(result);
      const roadmap = Finance.buildContributionRoadmap(profile, result, today);
      if (!roadmap.ok) return { handled: true, answer: "The finance engine could not build a schedule from the saved plan. Review the plan's deadline and recalculate; no schedule has been estimated." };
      if (target.state === "covered") return { handled: true, answer: `${target.message} This is based on the saved plan and is not a guarantee of future costs or funding.` };
      if (target.state === "unavailable") return { handled: true, answer: "No complete 30-day contribution date falls before the saved deadline, so the finance engine cannot provide a monthly target. Review the deadline in the planner." };
      if (roadmap.state === "too-many-cycles") return { handled: true, answer: `The finance engine calculates an adjusted target of ${formatMoney(target.regularAmount)} for regular cycles and ${formatMoney(target.finalAmount)} for the final cycle across ${roadmap.contributionCycles} complete 30-day cycle(s). It does not display each date because this horizon is too long for a detailed roadmap. Projected capacity is ${formatMoney(result.capacity)} and projected remaining shortfall is ${formatMoney(result.shortfall)}. The projection assumes the full entered surplus is saved on schedule and is not a guarantee.` };
      const schedule = roadmap.contributions.map(item => `${item.dueDate}: ${money(item.requiredContributionBdt)}`).join("; ");
      return { handled: true, answer: `The finance engine's adjusted schedule is ${money(target.regularAmount)} for each regular contribution cycle and ${money(target.finalAmount)} in the final cycle, across ${roadmap.contributionCycles} complete 30-day cycle(s). Dates and amounts: ${schedule}. Projected capacity from the entered monthly surplus is ${money(result.capacity)}; projected remaining shortfall is ${money(result.shortfall)}. The projection assumes the full entered surplus is saved on schedule and is not a guarantee.` };
    }

    return { handled: false };
  }

  return Object.freeze({ run });
});
