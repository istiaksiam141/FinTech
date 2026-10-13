(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CampusBridgeFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CURRENCIES = Object.freeze(['BDT', 'GBP', 'USD', 'CAD', 'EUR', 'CNY']);
  const MAX_AMOUNT = 1e12;

  function convert(amount, from, to, unitsPerReference) {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Amount must be a finite non-negative number.');
    if (!CURRENCIES.includes(from) || !CURRENCIES.includes(to)) throw new RangeError('Unsupported currency.');
    if (!unitsPerReference || !Number.isFinite(unitsPerReference[from]) || !Number.isFinite(unitsPerReference[to]) || unitsPerReference[from] <= 0 || unitsPerReference[to] <= 0) throw new RangeError('Provide a current, source-identified rate for both currencies.');
    return amount * (unitsPerReference[to] / unitsPerReference[from]);
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
    if (!profile.rateTimestamp || Number.isNaN(new Date(profile.rateTimestamp).getTime())) errors.push('Enter the timestamp of the exchange rate.');
    const countries = ['Bangladesh', 'United Kingdom', 'United States', 'Canada'];
    if (!countries.includes(profile.homeCountry) || !countries.includes(profile.destinationCountry)) errors.push('Choose a supported home and destination country.');
    if (!profile.deadline) errors.push('Choose a valid deadline.');
    else {
      const deadline = new Date(`${profile.deadline}T00:00:00`);
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      if (Number.isNaN(deadline.getTime())) errors.push('Choose a valid deadline.');
      else if (Math.ceil((deadline - start) / 86400000) < 1) errors.push('Deadline must be at least 1 day from today.');
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
    const deadline = new Date(`${profile.deadline}T00:00:00`);
    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const days = Math.ceil((deadline - start) / 86400000);
    const contributionCycles = Math.floor(days / 30);
    const monthsRemaining = days / 30.4375;
    const monthlyTarget = gap / monthsRemaining;
    const disposable = Number(profile.income) - Number(profile.expenses);
    const projectedFunds = usable + Math.max(0, disposable) * contributionCycles;
    const capacity = Math.max(0, disposable) * contributionCycles;
    return {
      ok: true, currency: homeCur, tuitionCurrency: tuitionCur, rate: dailyRate,
      tuition, tuitionHome, paymentFee, requiredFunds, savings, emergency, committed, usable, gap,
      daysRemaining: days, contributionCycles, monthsRemaining, monthlyTarget,
      disposable, projectedFunds, capacity, shortfall: Math.max(0, gap - capacity),
      fundedRatio: requiredFunds > 0 ? Math.min(1, usable / requiredFunds) : 0,
      projectedRatio: requiredFunds > 0 ? Math.min(1, projectedFunds / requiredFunds) : 0,
      emergencyIncluded: false,
      shortDeadline: days < 30,
      status: gap === 0 ? 'covered' : disposable >= 0 && capacity >= gap ? 'ontrack' : 'short',
      assumptions: [
        `User-entered rate: 1 ${tuitionCur} = ${dailyRate.toFixed(5)} ${homeCur}; source: ${String(profile.rateSource).trim()}; timestamp: ${profile.rateTimestamp}. CampusBridge has not independently verified it.`,
        'Emergency savings remain untouched; committed expenses are excluded from tuition funds.',
        `User-entered one-time payment fee estimate of ${paymentFee} ${homeCur} is added to required funds; comparison quotes are separate and not added again.`,
        `${contributionCycles} full 30-day monthly contribution cycle(s) remain; actual pay dates and tuition payment timing may differ.`,
        'No interest, future exchange-rate movement, income change, or expense change is modeled.'
      ]
    };
  }
  function compareEnteredQuotes(input, quotes) {
    const errors = [];
    const amount = Number(input?.amount);
    if (!Number.isFinite(amount) || amount <= 0) errors.push('Enter a positive payment principal.');
    if (!CURRENCIES.includes(input?.to) || input.to === 'BDT') errors.push('Choose a supported destination currency.');
    if (!['cost', 'recv', 'time'].includes(input?.sort)) errors.push('Choose a supported ranking objective.');
    if (!Array.isArray(quotes)) errors.push('Quote entries are unavailable.');
    if (errors.length) return { ok: false, errors };
    const all = quotes.map(quote => {
      const totalCost = quote.totalCost === '' ? NaN : Number(quote.totalCost);
      const recipientAmount = quote.recipientAmount === '' ? NaN : Number(quote.recipientAmount);
      const fee = quote.fee === '' ? 0 : Number(quote.fee);
      const days = quote.days === '' ? null : Number(quote.days);
      const quotedRate = quote.quotedRate == null || quote.quotedRate === '' ? null : Number(quote.quotedRate);
      if (!Number.isFinite(totalCost) || !Number.isFinite(recipientAmount) || totalCost < amount || recipientAmount <= 0 || !Number.isFinite(fee) || fee < 0 || (days !== null && (!Number.isFinite(days) || days < 0)) || (quotedRate !== null && (!Number.isFinite(quotedRate) || quotedRate <= 0))) return { quote, available: false, reason: 'Enter a valid total cost, recipient amount, and any known fee/rate/delivery values.' };
      if (!quote.timestamp || !quote.reference) return { quote, available: false, reason: 'A quote timestamp and source/reference are required.' };
      if (input.sort === 'time' && days === null) return { quote, available: false, reason: 'Delivery time is missing, so this option cannot be ranked by speed.' };
      return { quote, available: true, totalCost, recipientAmount, fee, days, quotedRate, timestamp: quote.timestamp, reference: quote.reference };
    });
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
  return Object.freeze({ CURRENCIES, convert, validateProfile, calculateTuition, compareEnteredQuotes, assistantIntent });
});
