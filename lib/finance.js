(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CampusBridgeFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CURRENCIES = Object.freeze(['BDT', 'GBP', 'USD', 'CAD', 'EUR', 'CNY']);
  const MAX_AMOUNT = 1e12;
  // Keep calculated BDT values within the same supported range as monetary inputs.
  const MAX_CALCULATED_BDT = MAX_AMOUNT;
  const MAX_DELIVERY_DAYS = 365;
  const QUOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  function parseCalendarDate(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return { year, month, day, ordinal: date.getTime() / 86400000 };
  }
  function calendarDaysBetween(startDate, endDate) {
    const start = parseCalendarDate(startDate), end = parseCalendarDate(endDate);
    return start && end ? end.ordinal - start.ordinal : null;
  }

  function parseLocalTimestamp(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
    const calendar = match && parseCalendarDate(match[1]);
    if (!calendar) return null;
    const hour = Number(match[2]), minute = Number(match[3]);
    if (hour > 23 || minute > 59) return null;
    const date = new Date(calendar.year, calendar.month - 1, calendar.day, hour, minute);
    if (date.getFullYear() !== calendar.year || date.getMonth() !== calendar.month - 1 || date.getDate() !== calendar.day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
    return date;
  }

  function convert(amount, from, to, unitsPerReference) {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Amount must be a finite non-negative number.');
    if (!CURRENCIES.includes(from) || !CURRENCIES.includes(to)) throw new RangeError('Unsupported currency.');
    if (!unitsPerReference || !Number.isFinite(unitsPerReference[from]) || !Number.isFinite(unitsPerReference[to]) || unitsPerReference[from] <= 0 || unitsPerReference[to] <= 0) throw new RangeError('Provide a current, source-identified rate for both currencies.');
    const converted = amount * (unitsPerReference[to] / unitsPerReference[from]);
    if (!Number.isFinite(converted) || converted > MAX_CALCULATED_BDT) throw new RangeError(`Calculated amount exceeds the supported maximum of ${MAX_CALCULATED_BDT.toLocaleString('en-US')}.`);
    return converted;
  }
  function validateProfile(profile, today = new Date()) {
    const errors = [];
    for (const [key, label] of [['tuition', 'Tuition'], ['savings', 'Savings'], ['income', 'Monthly income'], ['expenses', 'Monthly expenses'], ['committed', 'Committed expenses'], ['emergency', 'Emergency fund'], ['paymentFee', 'Estimated payment fee'], ['exchangeRate', 'Exchange rate']]) {
      const optionalZero = ['committed', 'paymentFee'].includes(key) && (profile[key] === '' || profile[key] == null);
      const n = optionalZero ? 0 : profile[key] === '' || profile[key] == null ? NaN : Number(profile[key]);
      if (!Number.isFinite(n)) errors.push(`${label} is required and must be a number.`);
      else if (n < 0) errors.push(`${label} cannot be negative.`);
      else if (n > MAX_AMOUNT) errors.push(`${label} is unrealistically large (max 1,000,000,000,000).`);
    }
    if (Number(profile.tuition) === 0) errors.push('Tuition must be greater than zero.');
    if (!CURRENCIES.includes(profile.homeCur) || !CURRENCIES.includes(profile.tuitionCur)) errors.push('Choose a supported currency.');
    const corridorCurrency = { 'United Kingdom': 'GBP', 'United States': 'USD', Canada: 'CAD' }[profile.destinationCountry];
    if (profile.homeCur !== 'BDT' || corridorCurrency !== profile.tuitionCur) errors.push('Choose a supported Bangladesh corridor and matching destination currency.');
    if (Number(profile.exchangeRate) <= 0) errors.push('Exchange rate must be greater than zero.');
    if (!String(profile.rateSource || '').trim()) errors.push('Enter the bank or provider source for this exchange rate.');
    const rateTimestamp = parseLocalTimestamp(profile.rateTimestamp);
    if (!rateTimestamp) errors.push('Enter a valid exchange-rate timestamp in local YYYY-MM-DDTHH:mm format.');
    else if (rateTimestamp.getTime() > today.getTime()) errors.push('Exchange-rate timestamp cannot be in the future.');
    const countries = ['Bangladesh', 'United Kingdom', 'United States', 'Canada'];
    if (!countries.includes(profile.homeCountry) || !countries.includes(profile.destinationCountry)) errors.push('Choose a supported home and destination country.');
    const deadline = parseCalendarDate(profile.deadline);
    if (!deadline) errors.push('Choose a valid calendar deadline.');
    else {
      const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
      if (deadline.ordinal - start < 1) errors.push('Deadline must be at least 1 day from today.');
    }
    return errors;
  }
  function calculateTuition(profile, today = new Date()) {
    const errors = validateProfile(profile, today);
    if (errors.length) return { ok: false, errors };
    const tuition = Number(profile.tuition), savings = Number(profile.savings);
    const emergency = Number(profile.emergency), committed = Number(profile.committed || 0), paymentFee = Number(profile.paymentFee || 0);
    const homeCur = profile.homeCur, tuitionCur = profile.tuitionCur;
    const dailyRate = Number(profile.exchangeRate);
    const tuitionHome = tuition * dailyRate;
    const usable = Math.max(0, savings - emergency - committed);
    const requiredFunds = tuitionHome + paymentFee;
    const gap = Math.max(0, requiredFunds - usable);
    const deadline = parseCalendarDate(profile.deadline);
    const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
    const days = deadline.ordinal - start;
    const contributionCycles = Math.floor(days / 30);
    const monthsRemaining = contributionCycles;
    // Count only full 30-day contribution dates; do not assume savings before day 30.
    const monthlyTarget = gap === 0 ? 0 : contributionCycles > 0 ? gap / contributionCycles : null;
    const disposable = Number(profile.income) - Number(profile.expenses);
    const projectedFunds = usable + Math.max(0, disposable) * contributionCycles;
    const capacity = Math.max(0, disposable) * contributionCycles;
    const calculatedBdt = [tuitionHome, usable, requiredFunds, gap, capacity, projectedFunds, Math.max(0, gap - capacity)];
    if (calculatedBdt.some(value => !Number.isFinite(value) || value > MAX_CALCULATED_BDT)) {
      return { ok: false, errors: [`Calculated BDT amounts exceed the supported maximum of ${MAX_CALCULATED_BDT.toLocaleString('en-US')}. Reduce the tuition, rate, fees, savings, or projection period.`] };
    }
    return {
      ok: true, currency: homeCur, tuitionCurrency: tuitionCur, rate: dailyRate,
      tuition, tuitionHome, paymentFee, requiredFunds, savings, emergency, committed, usable, gap,
      daysRemaining: days, contributionCycles, monthsRemaining, monthlyTarget,
      disposable, projectedFunds, capacity, shortfall: Math.max(0, gap - capacity),
      fundedRatio: requiredFunds > 0 ? Math.min(1, usable / requiredFunds) : 0,
      projectedRatio: requiredFunds > 0 ? Math.min(1, projectedFunds / requiredFunds) : 0,
      emergencyIncluded: false,
      shortDeadline: contributionCycles === 0,
      status: gap === 0 ? 'covered' : disposable >= 0 && capacity >= gap ? 'ontrack' : 'short',
      assumptions: [
        `${profile.rateProvenance || 'User-provided manual rate; unverified'}: 1 ${tuitionCur} = ${dailyRate.toFixed(5)} ${homeCur}; source: ${String(profile.rateSource).trim()}; timestamp: ${profile.rateTimestamp}.`,
        'Emergency savings remain untouched; committed expenses are excluded from tuition funds.',
        `User-entered one-time payment fee estimate of ${paymentFee} ${homeCur} is added to required funds; comparison quotes are separate and not added again.`,
        `${contributionCycles} full 30-day monthly contribution cycle(s) remain; actual pay dates and tuition payment timing may differ.`,
        'No interest, future exchange-rate movement, income change, or expense change is modeled.'
      ]
    };
  }
  function summarizeStressScenario(name, profile, today, { expenseIncrease = 0, missedContributions = 0 } = {}) {
    const scenarioProfile = { ...profile };
    if (expenseIncrease) scenarioProfile.expenses = String(Number(profile.expenses) + expenseIncrease);
    const result = calculateTuition(scenarioProfile, today);
    if (!result.ok) return { name, ok: false, errors: result.errors };
    const contributionCycles = Math.max(0, result.contributionCycles - missedContributions);
    const capacity = Math.max(0, result.disposable) * contributionCycles;
    const projectedFunds = result.usable + capacity;
    const shortfall = Math.max(0, result.gap - capacity);
    if (![capacity, projectedFunds, shortfall].every(value => Number.isFinite(value) && value <= MAX_CALCULATED_BDT)) {
      return { name, ok: false, errors: [`Calculated BDT amounts exceed the supported maximum of ${MAX_CALCULATED_BDT.toLocaleString('en-US')}.`] };
    }
    const monthlyTarget = result.gap === 0 ? 0 : contributionCycles > 0 ? result.gap / contributionCycles : null;
    const schedule = result.gap > 0 && contributionCycles > 0
      ? { regularAmount: Math.floor(result.gap / contributionCycles), finalAmount: Math.ceil(result.gap - Math.floor(result.gap / contributionCycles) * (contributionCycles - 1)) }
      : null;
    return {
      name, ok: true, exchangeRate: Number(scenarioProfile.exchangeRate), expenseIncrease, missedContributions,
      requiredFunds: result.requiredFunds, usableSavings: result.usable, fundingGap: result.gap,
      monthlySurplus: result.disposable, scheduledCycles: result.contributionCycles, contributionCycles,
      monthlyTarget, contributionSchedule: schedule, projectedCapacity: capacity, projectedFunds, projectedShortfall: shortfall
    };
  }
  function calculateStressScenarios(profile, options = {}, today = new Date()) {
    const errors = [];
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { ok: false, errors: ['A valid baseline financial profile is required for stress testing.'] };
    if (!options || typeof options !== 'object' || Array.isArray(options)) return { ok: false, errors: ['Stress-test options must be provided as an object.'] };
    const expenseIncrease = options.expenseIncrease;
    const missedContributions = options.missedContributions;
    if (expenseIncrease !== undefined && (!Number.isFinite(Number(expenseIncrease)) || Number(expenseIncrease) < 0 || Number(expenseIncrease) > MAX_AMOUNT)) {
      errors.push('Expense increase must be a finite amount between 0 and 1,000,000,000,000 BDT.');
    }
    if (missedContributions !== undefined && missedContributions !== 0 && missedContributions !== 1) {
      errors.push('Missed contributions must be either 0 or 1.');
    }
    if (errors.length) return { ok: false, errors };
    const baseline = calculateTuition({ ...profile }, today);
    if (!baseline.ok) return { ok: false, errors: baseline.errors };
    const scenarios = [
      summarizeStressScenario('Baseline', profile, today),
      summarizeStressScenario('Exchange rate +5%', { ...profile, exchangeRate: String(Number(profile.exchangeRate) * 1.05) }, today),
      summarizeStressScenario('Exchange rate +10%', { ...profile, exchangeRate: String(Number(profile.exchangeRate) * 1.10) }, today)
    ];
    if (expenseIncrease !== undefined && Number(expenseIncrease) > 0) {
      scenarios.push(summarizeStressScenario('Increased monthly expenses', profile, today, { expenseIncrease: Number(expenseIncrease) }));
    }
    if (missedContributions === 1) {
      scenarios.push(summarizeStressScenario('One missed contribution', profile, today, { missedContributions: 1 }));
    }
    if (expenseIncrease !== undefined && Number(expenseIncrease) > 0 && missedContributions === 1) {
      scenarios.push(summarizeStressScenario('Increased expenses + one missed contribution', profile, today, { expenseIncrease: Number(expenseIncrease), missedContributions: 1 }));
    }
    const failed = scenarios.find(scenario => !scenario.ok);
    return failed ? { ok: false, errors: failed.errors, scenarios } : { ok: true, scenarios };
  }

  function buildFinancialReport(profile, result, options = {}) {
    const target = describeMonthlySavingsTarget(result);
    const contributionText = target.state === 'covered' ? target.message : target.state === 'unavailable' ? target.message : result.contributionCycles === 1
      ? `${target.finalAmount} BDT in the final cycle`
      : `${target.regularAmount} BDT for ${result.contributionCycles - 1} cycle(s), then ${target.finalAmount} BDT in the final cycle`;
    const lines = [
      'CampusBridge AI — Student finance report', `Generated: ${(options.generatedAt || new Date()).toLocaleString()}`,
      'All figures are user-entered planning inputs; results are estimates, not guarantees.',
      `Route: ${profile.homeCountry} to ${profile.destinationCountry} (${profile.homeCur} to ${profile.tuitionCur})`,
      `Inputs: tuition ${profile.tuition} ${profile.tuitionCur}; savings ${profile.savings} BDT; protected emergency fund ${profile.emergency} BDT; committed funds ${profile.committed} BDT; monthly income ${profile.income} BDT; monthly expenses ${profile.expenses} BDT; one-time fee estimate ${profile.paymentFee} BDT; deadline ${profile.deadline}.`,
      `Exchange rate: 1 ${profile.tuitionCur} = ${result.rate} BDT; source: ${profile.rateSource}; timestamp (local): ${profile.rateTimestamp}. ${profile.rateProvenance || 'User-provided manual rate; unverified'}.`,
      'Formulas: tuition in BDT = tuition × rate; required funds = tuition in BDT + entered one-time fees; usable savings = max(0, savings − emergency fund − committed funds); funding gap = max(0, required funds − usable savings); monthly surplus = income − expenses; scheduled contribution dates = floor(calendar days to deadline ÷ 30); projected capacity = max(0, monthly surplus) × complete contribution dates; projected shortfall = max(0, funding gap − projected capacity).',
      `Baseline: tuition estimate ${result.tuitionHome} BDT; required funds ${result.requiredFunds} BDT; usable savings ${result.usable} BDT; funding gap ${result.gap} BDT; monthly surplus ${result.disposable} BDT; ${result.contributionCycles} complete 30-day cycle(s); displayed contribution schedule: ${contributionText}; projected capacity ${result.capacity} BDT; projected shortfall ${result.shortfall} BDT.`,
      'The final contribution is adjusted in whole BDT to cover the gap; actual payment terms, rate movements, and changes in income or expenses may differ. This projection is not a guarantee.'
    ];
    if (Array.isArray(options.stressScenarios)) {
      lines.push('Stress-test scenarios (hypothetical; baseline inputs are not changed):');
      for (const scenario of options.stressScenarios) {
        if (!scenario.ok) { lines.push(`${scenario.name}: unavailable — ${scenario.errors.join(' ')}`); continue; }
        const schedule = scenario.contributionSchedule
          ? scenario.contributionCycles === 1 ? `${scenario.contributionSchedule.finalAmount} BDT in final cycle` : `${scenario.contributionSchedule.regularAmount} BDT for ${scenario.contributionCycles - 1} cycle(s), then ${scenario.contributionSchedule.finalAmount} BDT in final cycle`
          : scenario.monthlyTarget === 0 ? 'no additional contribution required' : 'unavailable (no remaining contribution date)';
        lines.push(`${scenario.name}: rate ${scenario.exchangeRate} BDT/${profile.tuitionCur}; expense increase ${scenario.expenseIncrease} BDT/month; missed contributions ${scenario.missedContributions}; required funds ${scenario.requiredFunds} BDT; usable savings ${scenario.usableSavings} BDT; funding gap ${scenario.fundingGap} BDT; monthly surplus ${scenario.monthlySurplus} BDT; remaining cycles ${scenario.contributionCycles} of ${scenario.scheduledCycles}; contribution schedule ${schedule}; projected capacity ${scenario.projectedCapacity} BDT; shortfall ${scenario.projectedShortfall} BDT.`);
      }
    }
    for (const error of options.stressErrors || []) lines.push(`Stress tests unavailable: ${error}`);
    for (const quote of options.quotes || []) lines.push(`Eligible quote: ${quote.quote.name}; sender cost ${quote.totalCost} BDT; recipient ${quote.recipientAmount} ${quote.currency}; reference ${quote.reference}; timestamp ${quote.timestamp}; manually entered and unverified.`);
    for (const quote of options.excludedQuotes || []) lines.push(`Excluded quote: ${quote.quote.name} — ${quote.reason}`);
    for (const error of options.quoteErrors || []) lines.push(`Quote comparison unavailable: ${error}`);
    return lines.join('\n');
  }
  function describeMonthlySavingsTarget(result) {
    if (result.gap === 0) return { state: 'covered', amount: 0, message: 'Your current usable savings cover the estimated tuition need. No additional monthly savings are needed for this target.' };
    if (result.monthlyTarget === null) return { state: 'unavailable', amount: null, message: 'No monthly contribution date before deadline.' };
    const regularAmount = Math.floor(result.gap / result.contributionCycles);
    const finalAmount = Math.ceil(result.gap - regularAmount * (result.contributionCycles - 1));
    return { state: 'available', amount: result.monthlyTarget, regularAmount, finalAmount, message: '' };
  }
  function parseQuoteTimestamp(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
    return date;
  }
  function validateEnteredQuote(input, quote, now = new Date()) {
    const source = quote && typeof quote === 'object' ? quote : {};
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    const displayName = name || 'Unnamed quote';
    const normalizedQuote = { ...source, name };
    const errors = [];
    if (!name) errors.push('Quote provider/name is required.');
    const amount = Number(input?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('Enter a positive payment principal no greater than 1,000,000,000,000 BDT.');
    if (!CURRENCIES.includes(input?.to) || input.to === 'BDT') errors.push('Choose a supported destination currency.');
    if (!CURRENCIES.includes(source.currency) || source.currency === 'BDT') errors.push(`${name}: enter the quote recipient currency.`);
    else if (source.currency !== input?.to) errors.push(`${name}: quote currency does not match the selected destination currency.`);

    const readNumber = (value, label, optional = false) => {
      if (optional && (value == null || String(value).trim() === '')) return null;
      if (value == null || String(value).trim() === '') {
        errors.push(`${name}: ${label} is required.`);
        return NaN;
      }
      const number = Number(value);
      if (!Number.isFinite(number) || Math.abs(number) > MAX_AMOUNT) errors.push(`${name}: ${label} must be finite and no greater than 1,000,000,000,000.`);
      return number;
    };
    const totalCost = readNumber(source.totalCost, 'total sender cost');
    const recipientAmount = readNumber(source.recipientAmount, 'recipient amount');
    const fee = readNumber(source.fee, 'provider fee', true) ?? 0;
    const quotedRate = readNumber(source.quotedRate, 'quoted exchange rate', true);
    const rawDays = source.days;
    let days = null;
    let deliveryIssue = '';
    if (rawDays != null && String(rawDays).trim() !== '') {
      const parsedDays = Number(rawDays);
      if (Number.isFinite(parsedDays) && parsedDays >= 0 && Number.isInteger(parsedDays) && parsedDays <= MAX_DELIVERY_DAYS) days = parsedDays;
      else deliveryIssue = `${displayName}: invalid delivery estimate will be treated as not provided.`;
    }
    if (Number.isFinite(totalCost) && totalCost < amount) errors.push(`${displayName}: total sender cost cannot be less than the payment principal.`);
    if (Number.isFinite(recipientAmount) && recipientAmount <= 0) errors.push(`${displayName}: recipient amount must be greater than zero.`);
    if (Number.isFinite(fee) && (fee < 0 || (Number.isFinite(totalCost) && fee > totalCost))) errors.push(`${displayName}: provider fee must be non-negative and no greater than total sender cost.`);
    if (quotedRate !== null && Number.isFinite(quotedRate) && quotedRate <= 0) errors.push(`${displayName}: quoted exchange rate must be greater than zero.`);

    const reference = typeof source.reference === 'string' ? source.reference.trim() : '';
    if (!reference) errors.push(`${displayName}: quote source/reference is required.`);
    else if (reference.length > 160) errors.push(`${displayName}: quote source/reference must be 160 characters or fewer.`);
    const timestamp = parseQuoteTimestamp(source.timestamp);
    if (!timestamp) errors.push(`${name}: timestamp must be a valid local date and time.`);
    else {
      const nowMs = now instanceof Date ? now.getTime() : Number(now);
      if (!Number.isFinite(nowMs)) errors.push('Current time is invalid; quote freshness cannot be checked.');
      else if (timestamp.getTime() > nowMs) errors.push(`${name}: future-dated quotes are not accepted.`);
      else if (nowMs - timestamp.getTime() > QUOTE_MAX_AGE_MS) errors.push(`${name}: quote is older than 24 hours; get a fresh quote.`);
    }
    if (input?.sort === 'time' && days === null) errors.push(`${displayName}: delivery time is required to rank by speed.`);
    if (errors.length) return { quote: normalizedQuote, available: false, reason: [errors.join(' '), deliveryIssue].filter(Boolean).join(' ') };
    return { quote: normalizedQuote, available: true, totalCost, recipientAmount, fee, days, quotedRate, timestamp: source.timestamp, reference, currency: source.currency, verified: false };
  }
  function compareEnteredQuotes(input, quotes, now = new Date()) {
    const errors = [];
    const amount = Number(input?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('Enter a positive payment principal no greater than 1,000,000,000,000 BDT.');
    if (!CURRENCIES.includes(input?.to) || input.to === 'BDT') errors.push('Choose a supported destination currency.');
    if (!['cost', 'recv', 'time'].includes(input?.sort)) errors.push('Choose a supported ranking objective.');
    if (!Array.isArray(quotes)) errors.push('Quote entries are unavailable.');
    if (errors.length) return { ok: false, errors };
    const all = quotes.map(quote => validateEnteredQuote(input, quote, now));
    const available = all.filter(option => option.available);
    available.sort(input.sort === 'cost' ? (a,b)=>a.totalCost-b.totalCost : input.sort === 'recv' ? (a,b)=>b.recipientAmount-a.recipientAmount : (a,b)=>a.days-b.days);
    if (available.length) {
      const bestCost=Math.min(...available.map(x=>x.totalCost)), bestRecipient=Math.max(...available.map(x=>x.recipientAmount));
      available.forEach(x=>{x.lowCost=x.totalCost===bestCost;x.topRecipient=x.recipientAmount===bestRecipient;});
    }
    return { ok: true, amount, available, unavailable: all.filter(option=>!option.available), all };
  }
  function assistantIntent(question) {
    const text = String(question || '').toLowerCase();
    if (/rate change|exchange rate|fluctuat|what happens/.test(text)) return 'calculate_tuition_gap';
    if (/calculate transfer cost|cost to send|transfer cost estimate/.test(text)) return 'calculate_transfer_cost';
    if (/hidden|fee|spread/.test(text)) return 'retrieve_finance_guidance';
    if (/compare|provider|transfer|send|cheapest|recipient/.test(text)) return 'compare_payment_options';
    if (/budget|income|expense|surplus/.test(text)) return 'create_monthly_budget';
    if (/save|monthly|per month|deadline/.test(text)) return 'create_monthly_budget';
    if (/afford|tuition|funding gap|funding/.test(text)) return 'calculate_tuition_gap';
    if (/rate change|exchange rate|fluctuat|what if/.test(text)) return 'calculate_tuition_gap';
    return 'retrieve_finance_guidance';
  }
  return Object.freeze({ CURRENCIES, MAX_DELIVERY_DAYS, QUOTE_MAX_AGE_MS, MAX_CALCULATED_BDT, convert, calendarDaysBetween, validateProfile, calculateTuition, describeMonthlySavingsTarget, calculateStressScenarios, buildFinancialReport, validateEnteredQuote, compareEnteredQuotes, assistantIntent });
});
