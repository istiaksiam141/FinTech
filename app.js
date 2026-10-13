"use strict";

const topbar = document.querySelector("#topbar");
const menu = document.querySelector("#menu");
const navlinks = document.querySelector("#navlinks");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function updateHeader() {
  topbar.classList.toggle("scrolled", window.scrollY > 12);
  const sections = [...document.querySelectorAll("main section[id]")];
  const current = sections.filter(section => section.getBoundingClientRect().top < innerHeight * .38).at(-1);
  navlinks.querySelectorAll("a").forEach(link => link.toggleAttribute("aria-current", link.hash === `#${current?.id}`));
}
menu.addEventListener("click", () => {
  const isOpen = navlinks.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(isOpen)); menu.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation"); menu.textContent = isOpen ? "×" : "☰";
});
navlinks.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { navlinks.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.textContent = "☰"; }));
window.addEventListener("scroll", updateHeader, { passive: true }); window.addEventListener("resize", updateHeader, { passive: true }); updateHeader();

const Finance = window.CampusBridgeFinance;
const guidance = window.CampusBridgeGuidance || [];
const ExchangeRates = window.CampusBridgeExchangeRates;
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const corridorMap = { UK: { country: "United Kingdom", currency: "GBP", label: "United Kingdom" }, US: { country: "United States", currency: "USD", label: "United States" }, CA: { country: "Canada", currency: "CAD", label: "Canada" } };
const providerDefs=[{id:"convera",name:"Convera GlobalPay for Students",note:"Institution participation and Bangladesh-origin route must be confirmed."},{id:"flywire",name:"Flywire",note:"Use the payment link supplied by your university; origin options vary."},{id:"bank",name:"Authorized-dealer bank wire",note:"Get current written terms directly from your bank."}];
const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
let latest = null; let activity = [];
const exchangeRateState = { lastResponse: null, nextRequestAt: 0, pending: false, mode: "manual", appliedCurrency: null, appliedUpdatedAtMs: null, appliedNextUpdateAtMs: null, selectedCurrency: "GBP", staleTimer: null };
const FX_MIN_REQUEST_INTERVAL = 30 * 60 * 1000;
const money = (n, cur = "BDT") => `${new Intl.NumberFormat("en", { maximumFractionDigits: cur === "BDT" ? 0 : 2 }).format(n)} ${cur}`;
function localDateTimeForInput(timestamp) { const d = new Date(timestamp); return `${localDate(d)}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function setExchangeRateStatus(message, state = "") { const status = byId("exchangeRateStatus"); status.textContent = message; status.dataset.state = state; }
function renderFetchedRateStatus(prefix = "") {
  const data = exchangeRateState.lastResponse;
  const currency = corridorMap[byId("corridor").value].currency;
  const useButton = byId("useExchangeRate");
  if (!data) { useButton.hidden = true; useButton.disabled = true; setExchangeRateStatus(prefix || "No official rate loaded. Manual rate entry is available; use Refresh to retrieve Bangladesh Bank data."); return; }
  const appliedIsStale = exchangeRateState.mode === "api" && exchangeRateState.appliedNextUpdateAtMs && Date.now() >= exchangeRateState.appliedNextUpdateAtMs;
  if (appliedIsStale) {
    latest = null;
    const message = "The Bangladesh Bank rate currently in use is stale. Refresh the official sheet or enter a current rate manually before calculating.";
    byId("formError").textContent = message;
    byId("plannerResults").innerHTML = `<p class="error">${message}</p>`;
  }
  const stale = Date.now() >= data.nextUpdateAtMs;
  const rate = data.rates[currency];
  const applied = exchangeRateState.mode === "api" && exchangeRateState.appliedCurrency === currency && exchangeRateState.appliedUpdatedAtMs === data.updatedAtMs;
  useButton.hidden = stale;
  useButton.disabled = stale;
  useButton.textContent = applied ? "Official rate in use" : `Use Bangladesh Bank ${currency} ask`;
  if (stale) {
    setExchangeRateStatus(`${prefix ? `${prefix} ` : ""}The Bangladesh Bank data is stale${data.cacheStatus.toUpperCase()==="STALE"?" in Vercel's cache":""}. Sheet date: ${data.publicationDate}; retrieved: ${data.retrievedAt} (UTC). Data is also treated as stale after ${data.staleAfterDays} days without a newer sheet or ${data.retrievalStaleAfterHours} hours without a successful retrieval. It cannot be applied as current; use a manual rate or refresh.`, "stale");
  } else {
    const selection = appliedIsStale ? "A newer response is available but has not been applied; current planner results are cleared." : applied ? "This Bangladesh Bank rate is selected." : "Review it, then choose the button to apply it.";
    const detail = data.rateDetails[currency];
    const war = currency === "USD" && detail.weightedAverage !== null ? ` USD weighted average: ${detail.weightedAverage.toFixed(4)} BDT.` : "";
    setExchangeRateStatus(`${prefix ? `${prefix} ` : ""}${data.source} (${data.sourceUrl}). Publication date: ${data.publicationDate}. Retrieved: ${data.retrievedAt} (UTC). ${currency}/BDT bid ${detail.bid.toFixed(4)}, ask ${detail.ask.toFixed(4)}.${war} Planner uses the ask as an estimate: 1 ${currency} = ${rate.toFixed(5)} BDT. This is not a bank/provider payment quote. ${selection}`, "success");
  }
  if (exchangeRateState.staleTimer) clearTimeout(exchangeRateState.staleTimer);
  const appliedExpiry = exchangeRateState.mode === "api" ? exchangeRateState.appliedNextUpdateAtMs : null;
  const futureExpiries = [data.nextUpdateAtMs, appliedExpiry].filter(timestamp => timestamp && timestamp > Date.now());
  if (futureExpiries.length) exchangeRateState.staleTimer = setTimeout(() => { if (!exchangeRateState.pending) renderFetchedRateStatus(); }, Math.min(...futureExpiries) - Date.now());
}
async function refreshExchangeRate() {
  if (exchangeRateState.pending) return;
  const now = Date.now();
  if (now < exchangeRateState.nextRequestAt) {
    setExchangeRateStatus(`Refresh is limited to once every 30 minutes; try again after ${new Date(exchangeRateState.nextRequestAt).toLocaleTimeString()}. Your manual rate remains available.`, "stale");
    return;
  }
  exchangeRateState.pending = true;
  exchangeRateState.nextRequestAt = now + FX_MIN_REQUEST_INTERVAL;
  const refreshButton = byId("refreshExchangeRate");
  refreshButton.disabled = true;
  setExchangeRateStatus("Loading Bangladesh Bank's official published rate sheet…");
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 15000);
  try {
    const data = await ExchangeRates.fetchLatestRates({ signal: controller?.signal });
    exchangeRateState.lastResponse = data;
    renderFetchedRateStatus();
  } catch (error) {
    const detail = error?.name === "AbortError" ? "The request timed out." : error?.message || "The exchange-rate request failed.";
    if (exchangeRateState.lastResponse) renderFetchedRateStatus(`Refresh failed (${detail})`);
    else setExchangeRateStatus(`${detail} Your entered/manual rate has not been changed. You can enter or keep a manual rate.`, "error");
  } finally {
    clearTimeout(timeout);
    exchangeRateState.pending = false;
    refreshButton.disabled = false;
  }
}
function useFetchedExchangeRate() {
  const data = exchangeRateState.lastResponse;
  const currency = corridorMap[byId("corridor").value].currency;
  if (!data || Date.now() >= data.nextUpdateAtMs) { renderFetchedRateStatus(); return; }
  const rate = data.rates[currency];
  byId("exchangeRate").value = String(rate);
  byId("rateSource").value = `${data.source}; publication ${data.publicationDate}; ASK`;
  byId("rateTimestamp").value = localDateTimeForInput(data.updatedAtMs);
  exchangeRateState.mode = "api";
  exchangeRateState.appliedCurrency = currency;
  exchangeRateState.appliedUpdatedAtMs = data.updatedAtMs;
  exchangeRateState.appliedNextUpdateAtMs = data.nextUpdateAtMs;
  latest = null;
  byId("formError").textContent = "";
  if (["tuition", "savings", "emergency", "income", "expenses", "deadline"].every(id => byId(id).value !== "")) compute();
  else byId("plannerResults").innerHTML = '<p class="muted">Bangladesh Bank ask rate selected as an estimate. Complete the other planner inputs, then calculate your plan.</p>';
  renderFetchedRateStatus();
}
function handleManualRateEdit(event) {
  const field = event.currentTarget.id;
  if (exchangeRateState.mode === "api") {
    if (field === "exchangeRate") { byId("rateSource").value = ""; byId("rateTimestamp").value = ""; }
    else if (field === "rateSource") byId("rateTimestamp").value = "";
    else byId("rateSource").value = "";
  }
  exchangeRateState.mode = "manual";
  exchangeRateState.appliedCurrency = null;
  exchangeRateState.appliedUpdatedAtMs = null;
  exchangeRateState.appliedNextUpdateAtMs = null;
  latest = null;
  byId("plannerResults").innerHTML = '<p class="muted">Rate details changed. Review the source and timestamp, then recalculate your plan.</p>';
  setExchangeRateStatus("Manual rate entry selected. Use your rate for 1 destination-currency unit = BDT, and provide its source and local timestamp.", "");
}
function profile() {
  const c = corridorMap[byId("corridor").value];
  return { homeCountry: "Bangladesh", destinationCountry: c.country, homeCur: "BDT", tuitionCur: c.currency, tuition: byId("tuition").value, exchangeRate: byId("exchangeRate").value, rateSource: byId("rateSource").value, rateTimestamp: byId("rateTimestamp").value, savings: byId("savings").value, emergency: byId("emergency").value, committed: byId("committed").value || 0, income: byId("income").value, expenses: byId("expenses").value, paymentFee: byId("paymentFee").value || 0, deadline: byId("deadline").value };
}
function refreshRate() { const c = corridorMap[byId("corridor").value]; byId("tuitionCurrencyLabel").textContent = `(${c.currency})`; byId("rateCurrencyLabel").textContent = `(BDT per ${c.currency})`; }
function logEvent(tool, status, summary) {
  activity.unshift({ at: new Date().toLocaleString(), tool, status, summary }); activity = activity.slice(0, 20); renderLog();
}
function renderLog() { const list = byId("activityLog"); list.replaceChildren(...activity.map(e => { const li=document.createElement("li"); li.textContent=`${e.at} · ${e.tool} · ${e.status} · ${e.summary}`; return li; })); }
function compute() {
  refreshRate();
  const activeCurrency = corridorMap[byId("corridor").value].currency;
  if (exchangeRateState.mode === "api" && (exchangeRateState.appliedCurrency !== activeCurrency || !exchangeRateState.appliedNextUpdateAtMs || Date.now() >= exchangeRateState.appliedNextUpdateAtMs)) {
    latest = null;
    const message = "The Bangladesh Bank rate currently in use is stale or for a different corridor. Refresh the official sheet or enter one manually before calculating.";
    byId("formError").textContent = message;
    byId("plannerResults").innerHTML = `<p class="error">${message}</p>`;
    renderFetchedRateStatus();
    return;
  }
  const input = profile(); const result = Finance.calculateTuition(input);
  if (!result.ok) { latest = null; byId("formError").textContent = result.errors.join(" "); byId("plannerResults").innerHTML = '<p class="muted">Enter your figures and a current, source-identified exchange rate to calculate.</p>'; return; }
  byId("formError").textContent = ""; latest = { input, result }; const statusText = { covered:"Tuition covered by usable savings", ontrack:"On track at current monthly surplus", short:"Current plan leaves a shortfall" }[result.status];
  const priorities = result.gap === 0 ? ["Keep the emergency reserve protected.","Confirm the university payment deadline and instructions.","Refresh assumptions before paying."] : [result.shortfall > 0 ? "Close the projected shortfall: current savings capacity is not enough." : "Set aside the monthly target before the tuition deadline.", "Verify the payment route and any institution-specific fees.", "Keep emergency savings and committed funds separate from tuition."];
  const savingsTarget = Finance.describeMonthlySavingsTarget(result);
  const monthlyTargetText = savingsTarget.state === "unavailable" ? savingsTarget.message : money(savingsTarget.amount);
  byId("plannerResults").innerHTML = `<span class="statusPill">${statusText}</span><div class="metricGrid"><div class="metric"><span>Tuition + known payment fees</span><strong>${money(result.requiredFunds)}</strong></div><div class="metric"><span>Usable savings</span><strong>${money(result.usable)}</strong></div><div class="metric"><span>Funding gap</span><strong>${money(result.gap)}</strong></div><div class="metric"><span>Save each month</span><strong>${monthlyTargetText}</strong></div><div class="metric"><span>Monthly surplus</span><strong>${money(result.disposable)}</strong></div><div class="metric"><span>Deadline</span><strong>${result.daysRemaining} days</strong></div></div><div class="progressTrack" aria-label="Current tuition funding progress"><i style="width:${Math.round(result.fundedRatio*100)}%"></i></div><p class="small muted">${Math.round(result.fundedRatio*100)}% of estimated need covered from usable savings. Protected emergency fund: ${money(result.emergency)}. Committed savings excluded: ${money(result.committed)}.</p><p class="assumptionNote">Formula: tuition × your entered rate (${result.rate.toFixed(4)} BDT per ${result.tuitionCurrency}) + known payment fees. Usable funds = savings − emergency fund − committed savings; gap = max(0, required funds − usable funds). At ${result.contributionCycles} complete 30-day savings cycle(s), projected shortfall is ${money(result.shortfall)}. Rate source: ${escapeHtml(input.rateSource)}; timestamp (local time): ${escapeHtml(input.rateTimestamp)}. CampusBridge does not independently verify the rate.</p><h3>Top priorities</h3><ol class="small muted"><li>${priorities[0]}</li><li>${priorities[1]}</li><li>${priorities[2]}</li></ol>`;
  logEvent("calculate_tuition_gap", "success", "Tuition affordability calculation completed; financial values omitted");
  renderTransfers();
}
function renderQuoteForms(){const cur=corridorMap[byId("corridor").value].currency;byId("providerQuoteForms").innerHTML=providerDefs.map(p=>`<article class="quote" data-provider="${p.id}"><span class="tag">Enter your current quote</span><h3>${p.name}</h3><p>${p.note}</p><label>Quote recipient currency<select data-field="currency">${['GBP','USD','CAD'].map(code=>`<option value="${code}"${code===cur?' selected':''}>${code}</option>`).join('')}</select></label><label>Total sender cost (BDT)<input data-field="total" type="number" min="0" step="any"></label><label>Provider fees included in total (BDT)<input data-field="fee" type="number" min="0" step="any"></label><label>Quoted rate (BDT per 1 quote currency)<input data-field="rate" type="number" min="0" step="any"></label><label>Recipient amount (quote currency)<input data-field="recipient" type="number" min="0" step="any"></label><label>Estimated delivery (business days)<input data-field="days" type="number" min="0" step="1"></label><label>Quote timestamp<input data-field="timestamp" type="datetime-local"></label><label>Quote reference or source<input data-field="reference" type="text" maxlength="160"></label></article>`).join("");}
function enteredQuotes(){return providerDefs.map(p=>{const card=document.querySelector(`[data-provider="${p.id}"]`);const get=f=>card.querySelector(`[data-field="${f}"]`).value;return {id:p.id,name:p.name,currency:get("currency"),totalCost:get("total"),fee:get("fee"),quotedRate:get("rate"),recipientAmount:get("recipient"),days:get("days"),timestamp:get("timestamp"),reference:get("reference")};});}
function currentQuoteComparison(){const cur=corridorMap[byId("corridor").value].currency;return Finance.compareEnteredQuotes({amount:byId("transferAmount").value,to:cur,sort:byId("sortBy").value},enteredQuotes());}
function renderTransfers(){const amount=byId("transferAmount").value,cur=corridorMap[byId("corridor").value].currency;const root=byId("transferResults");if(!amount||Number(amount)<=0){root.innerHTML='<p class="muted">Enter the same positive BDT principal used for all quotes.</p>';return;}const entered=enteredQuotes();if(entered.every(q=>q.totalCost===""&&q.recipientAmount===""&&q.reference==="")){root.innerHTML='<p class="muted">No provider quotes entered. Get current terms from your institution-approved provider or bank; nothing is estimated here.</p>';return;}const cmp=currentQuoteComparison();if(!cmp.ok){root.innerHTML=`<p class="error">${cmp.errors.join(" ")}</p>`;return;}const usable=cmp.available;if(!usable.length){root.innerHTML=`<p class="muted">No complete quotes can be ranked. ${cmp.unavailable.map(x=>`${escapeHtml(x.quote.name)}: ${escapeHtml(x.reason)}`).join(" ")}</p>`;return;}root.innerHTML=`<div class="quoteGrid">${usable.map((q,i)=>`<article class="quote"><span class="tag">${i===0?"Ranks first by selected objective · student-entered":"Student-entered quote"} · not provider-verified</span><h3>${escapeHtml(q.quote.name)}</h3><dl><dt>Total sender cost</dt><dd><strong>${money(q.totalCost)}</strong></dd><dt>Principal</dt><dd>${money(Number(amount))}</dd><dt>Stated provider fee</dt><dd>${q.fee?money(q.fee):"Not separately stated"}</dd><dt>Recipient amount</dt><dd><strong>${money(q.recipientAmount,cur)}</strong></dd><dt>Quoted rate</dt><dd>${q.quotedRate===null?"Not stated":`1 ${cur} = ${q.quotedRate.toFixed(5)} BDT`}</dd><dt>Delivery estimate</dt><dd>${q.days===null?"Not provided":`${q.days} business days`}</dd></dl><p>Source/reference: ${escapeHtml(q.reference)}. Quote timestamp: ${escapeHtml(q.timestamp)}. Validation does not authenticate this manually entered quote. Verify expiry and all terms on the provider’s official page before paying.</p></article>`).join("")}</div><p class="assumptionNote">${cmp.unavailable.map(x=>`${escapeHtml(x.quote.name)}: ${escapeHtml(x.reason)}`).join(" ")}</p>`;logEvent("compare_payment_options","success",`${usable.length} entered quotes ranked by ${byId("sortBy").selectedOptions[0].text.toLowerCase()}`);}
byId("profileForm").addEventListener("submit", e=>{e.preventDefault();compute();});
byId("corridor").addEventListener("change",()=>{const currency=corridorMap[byId("corridor").value].currency;const changed=currency!==exchangeRateState.selectedCurrency;exchangeRateState.selectedCurrency=currency;if(changed&&["exchangeRate","rateSource","rateTimestamp"].some(id=>byId(id).value!=="")){for(const id of ["exchangeRate","rateSource","rateTimestamp"])byId(id).value="";exchangeRateState.mode="manual";exchangeRateState.appliedCurrency=null;exchangeRateState.appliedUpdatedAtMs=null;exchangeRateState.appliedNextUpdateAtMs=null;latest=null;if(exchangeRateState.lastResponse)renderFetchedRateStatus("Destination currency changed; the previous rate and its source/time were cleared.");else setExchangeRateStatus("Destination currency changed. The previous rate, source, and timestamp were cleared to avoid using the wrong currency. Enter or fetch a rate for the new currency.");}else renderFetchedRateStatus();refreshRate();renderQuoteForms();renderTransfers();if(byId("tuition").value||byId("exchangeRate").value)compute();});
byId("transferAmount").addEventListener("input",renderTransfers); byId("sortBy").addEventListener("change",renderTransfers);
byId("providerQuoteForms").addEventListener("input",renderTransfers);
byId("resetProfile").addEventListener("click",()=>{byId("profileForm").reset();byId("corridor").value="UK";exchangeRateState.mode="manual";exchangeRateState.appliedCurrency=null;exchangeRateState.appliedUpdatedAtMs=null;exchangeRateState.appliedNextUpdateAtMs=null;exchangeRateState.selectedCurrency="GBP";byId("transferAmount").value="";renderFetchedRateStatus();refreshRate();renderQuoteForms();byId("plannerResults").innerHTML='<p class="muted">Enter your figures and a current, source-identified exchange rate to calculate.</p>';byId("formError").textContent="";latest=null;resetScenario();renderTransfers();});
byId("refreshExchangeRate").addEventListener("click",refreshExchangeRate);
byId("useExchangeRate").addEventListener("click",useFetchedExchangeRate);
for(const id of ["exchangeRate","rateSource","rateTimestamp"])byId(id).addEventListener("input",handleManualRateEdit);
function getLocalAssistantGuidance(q) {
  const item=guidance.find(x=>/fraud|password|code/.test(q)?x.topic.includes("fraud"):/fee|spread/.test(q)?x.topic.includes("fee"):/rate|exchange/.test(q)?x.topic.includes("rate"):/emergency/.test(q)?x.topic.includes("emergency"):x.topic.includes("tuition"))||guidance[0];
  return `${item?.text||"Review your payment terms directly with the university."}\nSource: ${item?.source||"CampusBridge guidance"}`;
}
async function answerQuestion() {
 const rawQuestion=byId("question").value.trim(),q=rawQuestion.toLowerCase();if(!q){byId("answer").textContent="Enter a question about your tuition plan or payment comparison.";return;}
 compute();const transferQuestion=/transfer|provider|send|fee|cost|compare/.test(q);
 if(transferQuestion){renderTransfers();const count=enteredQuotes().filter(x=>x.totalCost!==""&&x.recipientAmount!==""&&x.reference&&x.timestamp).length;byId("answer").textContent=count?`You entered ${count} provider quote(s). Review the comparison above. CampusBridge cannot verify quote authenticity, eligibility, or expiry.`:"No complete current provider quotes have been entered. Get a quote from your university's official payment portal.";logEvent("compare_payment_options","success","Answered using entered quote status; profile not required");return;}
 const planQuestion=/exchange rate|rate change|what happens to the rate|budget|income|expense|surplus|save|month|deadline|afford|tuition|gap|fund/.test(q);
 if(!latest&&planQuestion){byId("answer").textContent="Complete the required planner fields and calculate your plan first. Your entered rate needs its source and timestamp.";return;}
 if(latest){const {result:r}=latest;
  if(/exchange rate|rate change|what happens to the rate/.test(q)){const response=`Your entered planning rate is 1 ${latest.input.tuitionCur} = ${r.rate.toFixed(5)} BDT, from ${latest.input.rateSource} at ${latest.input.rateTimestamp}. CampusBridge does not forecast rate changes. Update the source, timestamp, and rate to see how your plan changes.`;byId("answer").textContent=`Tool used: calculate_tuition_gap\n${response}`;logEvent("calculate_tuition_gap","success","Answered using existing local calculation; question omitted");return;}
  if(/budget|income|expense|surplus/.test(q)){const response=`Your entered monthly surplus is ${money(r.disposable)} (income minus living costs). The plan assumes the full surplus can be saved, which may not fit real life.`;byId("answer").textContent=`Tool used: create_monthly_budget\n${response}`;logEvent("create_monthly_budget","success","Answered using existing local calculation; question omitted");return;}
  if(/save|month|deadline|afford|tuition|gap|fund/.test(q)){const target=Finance.describeMonthlySavingsTarget(r);const targetText=target.state==="covered"?target.message:target.state==="unavailable"?target.message:`Scheduled monthly target: ${money(target.amount)} over ${r.contributionCycles} contribution date(s).`;const response=`Estimated tuition need is ${money(r.tuitionHome)}. After protecting emergency savings and committed funds, your gap is ${money(r.gap)}. ${targetText} ${r.shortfall>0?`Current full-cycle savings capacity leaves ${money(r.shortfall)} uncovered.`:r.gap===0?"":"The entered monthly budget can cover the gap by the deadline."} Uses your rate/source entry (${latest.input.rateSource}, timestamp ${latest.input.rateTimestamp} local time); no rate forecast is made.`;byId("answer").textContent=`Tool used: calculate_tuition_gap\n${response}`;logEvent("calculate_tuition_gap","success","Answered using existing local calculation; question omitted");return;}
 }
 const button=byId("askButton"),answer=byId("answer");button.disabled=true;answer.setAttribute("aria-busy","true");answer.textContent="CampusBridge AI is preparing an explanation…";
 try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({question:rawQuestion})});const payload=await response.json();if(!response.ok||typeof payload.answer!=="string"||!payload.answer.trim())throw new Error("Assistant unavailable");answer.textContent=`AI explanation (general guidance only):\n${payload.answer}`;logEvent("retrieve_ai_guidance","success","General explanation returned; prompt and response omitted");}
 catch{answer.textContent=`AI assistant unavailable. Here is local guidance instead:\n${getLocalAssistantGuidance(q)}`;logEvent("retrieve_ai_guidance","fallback","Used local guidance; prompt, response, and error details omitted");}
 finally{button.disabled=false;answer.setAttribute("aria-busy","false");}
}
byId("askButton").addEventListener("click",answerQuestion);byId("question").addEventListener("keydown",e=>{if(e.key==="Enter")answerQuestion();});
byId("clearLog").addEventListener("click",()=>{activity=[];renderLog();});
function resetScenario(){byId("scenarioSavings").value=byId("savings").value;byId("scenarioMonthly").value=byId("income").value&&byId("expenses").value?Math.max(0,Number(byId("income").value)-Number(byId("expenses").value)):"";byId("scenarioPreview").textContent="Scenario reset to your current plan.";}
function previewScenario(){if(!latest)return;const savings=Number(byId("scenarioSavings").value),monthly=Number(byId("scenarioMonthly").value),income=Number(byId("income").value);if(!Number.isFinite(savings)||savings<0||!Number.isFinite(monthly)||monthly<0||monthly>income){byId("scenarioPreview").textContent="Enter non-negative savings and monthly savings no greater than monthly income.";return;}const scenario={...latest.input,savings:String(savings),expenses:String(income-monthly)};const r=Finance.calculateTuition(scenario);const target=Finance.describeMonthlySavingsTarget(r);byId("scenarioPreview").textContent=r.ok?`Preview: gap ${money(r.gap)}; monthly target ${target.state==="covered"?target.message:target.state==="unavailable"?"unavailable (no 30-day contribution date before deadline)":money(target.amount)}; projected shortfall ${money(r.shortfall)}. Compared with current gap ${money(latest.result.gap)}. Scenario assumes monthly savings are sustained through the deadline.`:"This scenario has invalid inputs.";}
byId("scenarioSavings").addEventListener("input",previewScenario);byId("scenarioMonthly").addEventListener("input",previewScenario);
byId("resetScenario").addEventListener("click",resetScenario);
byId("applyScenario").addEventListener("click",()=>{const savings=Number(byId("scenarioSavings").value),monthly=Number(byId("scenarioMonthly").value),income=Number(byId("income").value);if(!latest){byId("scenarioPreview").textContent="Calculate your current tuition plan before applying a scenario.";return;}if(byId("scenarioSavings").value===""||byId("scenarioMonthly").value===""||!Number.isFinite(savings)||savings<0||!Number.isFinite(monthly)||monthly<0||monthly>income){previewScenario();return;}byId("savings").value=String(savings);byId("expenses").value=String(income-monthly);compute();byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});});
byId("exportReport").addEventListener("click",()=>{compute();if(!latest){byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});return;}const {input:p,result:r}=latest;const cmp=currentQuoteComparison();const target=Finance.describeMonthlySavingsTarget(r);const monthlyTargetText=target.state==="covered"?target.message:target.state==="unavailable"?target.message:money(target.amount);const comparison=cmp.ok?cmp.available:[];const excluded=cmp.ok?cmp.unavailable:[];const lines=["CampusBridge AI — Student finance report",`Generated: ${new Date().toLocaleString()}`,"All financial figures were entered by the student and have not been independently verified.","Quote validation checks entered fields and freshness; it cannot authenticate or verify a provider quote.",`Corridor: Bangladesh to ${p.destinationCountry} (${p.homeCur} to ${p.tuitionCur})`,`Tuition: ${money(Number(p.tuition),p.tuitionCur)} (BDT estimate ${money(r.tuitionHome)})`,`Savings: ${money(r.savings)} | Protected emergency fund: ${money(r.emergency)} | Committed funds: ${money(r.committed)}`,`Usable savings: ${money(r.usable)} | Funding gap: ${money(r.gap)}`,`Known fees: ${money(r.paymentFee)} | Monthly surplus: ${money(r.disposable)} | Monthly savings target: ${monthlyTargetText}`,`Deadline: ${p.deadline} (${r.daysRemaining} days remaining)`,`Rate: 1 ${p.tuitionCur} = ${r.rate.toFixed(5)} BDT | Source/reference: ${p.rateSource} | Timestamp (local): ${p.rateTimestamp}`,"Eligible entered quote comparisons:",...comparison.map(q=>`${q.quote.name}: sender cost ${money(q.totalCost)}, recipient ${money(q.recipientAmount,q.currency)}, quoted rate ${q.quotedRate===null?"not stated":`${q.quotedRate} BDT per ${q.currency}`}, fee ${q.fee?money(q.fee):"not stated"}, delivery ${q.days===null?"not provided":`${q.days} business days`}, reference ${q.reference}, timestamp ${q.timestamp}, currency ${q.currency}. This is manually entered and not provider-verified.`),...(excluded.length?[`Excluded from comparison: ${excluded.map(x=>`${x.quote.name} — ${x.reason}`).join(" | ")}`]:[]),...(!cmp.ok?[`No quote comparison included: ${cmp.errors.join(" ")}`]:[]),"CampusBridge does not authenticate quotes or execute transfers."];const blob=new Blob([lines.join("\n")],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="campusbridge-financial-report.txt";a.click();URL.revokeObjectURL(a.href);logEvent("export_financial_report","success","Local report generated from entered data");});

// Pointer-responsive 3D treatment is decorative and disabled for touch/reduced motion.
const visual=document.querySelector(".heroVisual"),orb=document.querySelector(".orb3d");
if(visual&&!reducedMotion.matches&&matchMedia("(pointer:fine)").matches){visual.addEventListener("pointermove",e=>{const b=visual.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;orb.style.animationPlayState="paused";orb.style.transform=`translate3d(${x*9}px,${y*8}px,0) rotateX(${-y*9}deg) rotateY(${x*13-10}deg)`;});visual.addEventListener("pointerleave",()=>{orb.style.animationPlayState="running";orb.style.transform="";});}
renderQuoteForms();refreshRate();renderTransfers();byId("plannerResults").innerHTML='<p class="muted">Your plan will appear here after you enter your figures and calculate.</p>';resetScenario();previewScenario();refreshExchangeRate();
