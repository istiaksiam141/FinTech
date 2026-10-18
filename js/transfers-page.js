(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const notice = document.getElementById("transfer-status"), form = document.getElementById("transfer-form"), output = document.getElementById("transfer-results");
  const plan = loadPlan();
  const currency = plan.ok ? plan.profile.tuitionCur : "";
  const currencySelect = document.getElementById("quote-currency");
  for (const code of Finance.CURRENCIES.filter(value => value !== "BDT")) {
    const option = document.createElement("option"); option.value = code; option.textContent = `${Finance.CURRENCY_NAMES[code]} (${code})`; currencySelect.append(option);
  }
  if (currency) currencySelect.value = currency;
  currencySelect.disabled = true;
  document.getElementById("quote-currency-note").textContent = plan.ok ? `Quotes must match the saved plan currency (${currency}).` : "";
  if (!plan.ok) { notice.textContent = plan.message; form.hidden = true; return; }
  const names = ["Provider A", "Provider B", "Authorized-dealer bank"];
  form.addEventListener("submit", event => {
    event.preventDefault(); output.replaceChildren();
    const amount = document.getElementById("transfer-principal").value;
    const sort = document.getElementById("quote-sort").value;
    const quotes = [...form.querySelectorAll("[data-quote]")].map((card, index) => {
      const value = field => card.querySelector(`[data-field="${field}"]`).value;
      return { name: names[index], currency, totalCost: value("total"), recipientAmount: value("recipient"), timestamp: value("timestamp"), reference: value("reference"), fee: value("fee"), quotedRate: value("rate"), days: value("days") };
    });
    const result = Finance.compareEnteredQuotes({ amount, to: currency, sort }, quotes);
    if (!result.ok) { notice.textContent = result.errors.join(" "); return; }
    notice.textContent = "These are student-entered quotes. CampusBridge does not authenticate providers or execute transfers.";
    for (const quote of result.available) {
      const card = document.createElement("article"); card.className = "surface quoteResult";
      const title = document.createElement("h2"); title.textContent = quote.quote.name; card.append(title);
      const details = document.createElement("p"); details.textContent = `Sender cost ${money(quote.totalCost)} · recipient amount ${quote.recipientAmount} ${quote.currency} · source ${quote.reference} · timestamp ${quote.timestamp}.`; card.append(details); output.append(card);
    }
    for (const quote of result.unavailable) { const item = document.createElement("p"); item.className = "error"; item.textContent = `${quote.quote.name}: ${quote.reason}`; output.append(item); }
  });
})();
