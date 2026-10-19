"use strict";

const { fetchBangladeshBankRates } = require("../lib/bangladesh-bank-rates.js");

const CACHE_TTL_SECONDS = 24 * 60 * 60;
// Keep the last successful, publicly cached rate available during a temporary
// upstream outage. The client marks this response stale from its original dates.
const STALE_IF_ERROR_SECONDS = 7 * 24 * 60 * 60;

module.exports = async function handler(_request, response) {
  try {
    const data = await fetchBangladeshBankRates();
    // Vercel's shared CDN caches successful, identical GET responses; max-age=0
    // prevents browsers from keeping their own copy while s-maxage is server-side.
    response.setHeader("Cache-Control", `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-if-error=${STALE_IF_ERROR_SECONDS}`);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.status(200).json(data);
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    console.error("Official exchange-rate request failed", { name: typeof error?.name === "string" ? error.name : "Error" });
    response.status(502).json({ error: "Official exchange rates are temporarily unavailable or could not be validated." });
  }
};
