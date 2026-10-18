"use strict";

const SOURCE_URL = "https://www.bb.org.bd/en/index.php/econdata/exchangerate";
const SOURCE_NAME = "Bangladesh Bank FX Rate Sheet";
// The current official sheet has direct USD and cross-rate rows for GBP, CAD,
// JPY, SGD, and CNH. It does not publish onshore CNY, KRW, or MYR rows.
const CURRENCIES = ["GBP", "USD", "CAD", "JPY", "SGD", "CNH"];
const STALE_AFTER_MS = 5 * 24 * 60 * 60 * 1000;
const RETRIEVAL_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function cellText(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function parseRate(value, label) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`Bangladesh Bank ${label} is malformed`);
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Bangladesh Bank ${label} is invalid`);
  return number;
}

function parseBangladeshBankPage(html, retrievedAt = new Date()) {
  if (typeof html !== "string" || html.length < 100) throw new Error("Bangladesh Bank page is empty or malformed");
  const dateMatch = html.match(/FX\s+Rate\s+Sheet\s+effective\s+for\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!dateMatch) throw new Error("Bangladesh Bank publication date was not found");
  const [, day, month, year] = dateMatch;
  const publicationDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsedDate = new Date(`${publicationDate}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== publicationDate) throw new Error("Bangladesh Bank publication date is invalid");

  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(match =>
    [...match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
      [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell => cellText(cell[1]))
    ).filter(row => row.length)
  );
  const tablesWithRates = tables.map(rows => {
    const headerIndex = rows.findIndex(row => row[0]?.toLowerCase() === "currency" && row.some(cell => /bid\s*rate/i.test(cell)) && row.some(cell => /ask\s*rate/i.test(cell)));
    if (headerIndex < 0) return null;
    const header = rows[headerIndex].map(cell => cell.toLowerCase());
    return { data: rows.slice(headerIndex + 1), currencyIndex: header.indexOf("currency"), bidIndex: header.findIndex(cell => /bid\s*rate/.test(cell)), askIndex: header.findIndex(cell => /ask\s*rate/.test(cell)), warIndex: header.findIndex(cell => /^(war|weighted average(?: exchange)? rate)$/.test(cell)) };
  }).filter(Boolean);
  if (!tablesWithRates.length) throw new Error("Bangladesh Bank rate table layout was not recognized");

  const rates = {};
  for (const currency of CURRENCIES) {
    const match = tablesWithRates.map(table => ({ table, row: table.data.find(candidate => candidate[table.currencyIndex] === currency) })).find(item => item.row);
    if (!match) throw new Error(`Bangladesh Bank did not publish a ${currency} rate`);
    const { table, row } = match;
    rates[currency] = {
      bid: parseRate(row[table.bidIndex], `${currency} bid`),
      ask: parseRate(row[table.askIndex], `${currency} ask`),
      weightedAverage: currency === "USD" && table.warIndex >= 0 && row[table.warIndex] ? parseRate(row[table.warIndex], "USD weighted average") : null,
      baseCurrency: currency,
      quoteCurrency: "BDT",
      rateType: currency === "USD" ? "USD/BDT interbank rate" : "Bangladesh Bank cross rate"
    };
  }
  const retrieved = retrievedAt instanceof Date ? retrievedAt : new Date(retrievedAt);
  if (!Number.isFinite(retrieved.getTime())) throw new Error("Retrieval time is invalid");
  const ageMs = retrieved.getTime() - parsedDate.getTime();
  if (ageMs < -24 * 60 * 60 * 1000) throw new Error("Bangladesh Bank publication date is in the future");
  const staleByPublication = ageMs >= STALE_AFTER_MS;
  return {
    source: SOURCE_NAME, sourceUrl: SOURCE_URL, publicationDate,
    retrievedAt: retrieved.toISOString(), rates,
    stale: staleByPublication, staleAfterDays: 5, retrievalStaleAfterHours: 24
  };
}

async function fetchBangladeshBankRates({ fetchImpl = globalThis.fetch, now = () => new Date(), timeoutMs = 10000 } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable in this runtime");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(SOURCE_URL, { headers: { Accept: "text/html" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Bangladesh Bank returned HTTP ${response.status}`);
    const contentType = response.headers?.get?.("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) throw new Error("Bangladesh Bank returned an unexpected content type");
    return parseBangladeshBankPage(await response.text(), now());
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Bangladesh Bank request timed out");
    throw error;
  } finally { clearTimeout(timeout); }
}

module.exports = { SOURCE_URL, SOURCE_NAME, CURRENCIES, STALE_AFTER_MS, RETRIEVAL_STALE_AFTER_MS, parseBangladeshBankPage, fetchBangladeshBankRates };
