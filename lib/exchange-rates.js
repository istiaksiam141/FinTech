(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CampusBridgeExchangeRates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const API_URL = '/api/exchange-rates';
  const OFFICIAL_SOURCE_URL = 'https://www.bb.org.bd/en/index.php/econdata/exchangerate';
  const DESTINATION_CURRENCIES = Object.freeze(['GBP', 'USD', 'CAD']);
  const MAX_RATE = 1e12;
  const STALE_AFTER_MS = 5 * 24 * 60 * 60 * 1000;
  // Match the shared Vercel response-cache lifetime so cached official rates
  // remain usable only for the same 24-hour window from successful retrieval.
  const RETRIEVAL_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

  function positiveFiniteRate(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_RATE; }

  function parseOfficialResponse(payload, nowMs = Date.now(), cacheStatus = '') {
    if (!payload || typeof payload !== 'object' || payload.source !== 'Bangladesh Bank FX Rate Sheet' || payload.sourceUrl !== OFFICIAL_SOURCE_URL) throw new Error('The official rate response has an unexpected source.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.publicationDate || '')) throw new Error('The Bangladesh Bank publication date is missing or malformed.');
    const publicationMs = Date.parse(`${payload.publicationDate}T00:00:00Z`);
    const retrievedMs = Date.parse(payload.retrievedAt || '');
    if (!Number.isFinite(publicationMs) || new Date(publicationMs).toISOString().slice(0, 10) !== payload.publicationDate || !Number.isFinite(retrievedMs) || retrievedMs > nowMs || publicationMs > nowMs + 24 * 60 * 60 * 1000) throw new Error('The official rate response has invalid or future dates.');
    if (!payload.rates || typeof payload.rates !== 'object') throw new Error('The official rate response is missing rates.');
    const rates = {}; const rateDetails = {};
    for (const currency of DESTINATION_CURRENCIES) {
      const row = payload.rates[currency];
      if (!row || row.baseCurrency !== currency || row.quoteCurrency !== 'BDT' || !positiveFiniteRate(row.bid) || !positiveFiniteRate(row.ask) || row.ask < row.bid) throw new Error(`The official ${currency}/BDT bid or ask is invalid.`);
      if (currency === 'USD' && row.weightedAverage !== null && !positiveFiniteRate(row.weightedAverage)) throw new Error('The official USD weighted-average rate is invalid.');
      rates[currency] = row.ask;
      rateDetails[currency] = { bid: row.bid, ask: row.ask, weightedAverage: row.weightedAverage };
    }
    const nextUpdateAtMs = Math.min(publicationMs + STALE_AFTER_MS, retrievedMs + RETRIEVAL_STALE_AFTER_MS);
    const stale = nowMs >= nextUpdateAtMs || String(cacheStatus).toUpperCase() === 'STALE';
    return { source: payload.source, sourceUrl: payload.sourceUrl, rates, rateDetails, publicationDate: payload.publicationDate,
      retrievedAt: new Date(retrievedMs).toISOString(), updatedAtMs: retrievedMs, updatedAtUtc: new Date(retrievedMs).toISOString(),
      nextUpdateAtMs, stale, cacheStatus: String(cacheStatus || ''), staleAfterDays: 5, retrievalStaleAfterHours: 24 };
  }

  async function fetchLatestRates(options = {}) {
    const fetchImpl = options.fetchImpl || (typeof globalThis !== 'undefined' && globalThis.fetch);
    if (typeof fetchImpl !== 'function') throw new Error('This browser does not support API requests. Enter a rate manually.');
    const response = await fetchImpl(options.url || API_URL, { headers: { Accept: 'application/json' }, signal: options.signal });
    if (!response || !response.ok) {
      let detail = '';
      try { detail = (await response.json()).error || ''; } catch {}
      if (response?.status === 404) throw new Error('Official rates are unavailable on this preview. Open the deployed version with the rate service, or enter a rate from your bank/provider with its source and timestamp. No rate was applied.');
      throw new Error(detail || `The Bangladesh Bank request failed${response && Number.isFinite(response.status) ? ` (HTTP ${response.status})` : ''}. Enter a rate manually or try again later.`);
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('The Bangladesh Bank endpoint returned unreadable data. Enter a rate manually or try again later.'); }
    const cacheStatus = response.headers?.get?.('x-vercel-cache') || '';
    return parseOfficialResponse(payload, options.nowMs ?? Date.now(), cacheStatus);
  }

  return Object.freeze({ API_URL, OFFICIAL_SOURCE_URL, DESTINATION_CURRENCIES, STALE_AFTER_MS, RETRIEVAL_STALE_AFTER_MS, parseOfficialResponse, fetchLatestRates });
});
