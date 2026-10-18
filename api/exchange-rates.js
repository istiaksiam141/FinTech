"use strict";

const { fetchBangladeshBankRates } = require("../lib/bangladesh-bank-rates.js");

module.exports = async function handler(_request, response) {
  try {
    const data = await fetchBangladeshBankRates();
    response.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=1800");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.status(200).json(data);
  } catch (error) {
    response.setHeader("Cache-Control", "no-store");
    console.error("Official exchange-rate request failed", { name: typeof error?.name === "string" ? error.name : "Error" });
    response.status(502).json({ error: "Official exchange rates are temporarily unavailable or could not be validated." });
  }
};
