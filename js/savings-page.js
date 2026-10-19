(function () {
  "use strict";
  const byId = id => document.getElementById(id), api = window.CampusBridgeSavingsTracker;
  if (!api) return;
  const service = api.createLocalSavings({ finance: window.CampusBridgeFinance, planState: window.CampusBridgePlanState });
  const today = new Date(), todayText = api.calendarDate(today);
  byId("deposit-date").max = todayText;
  let roadmaps = [], selected = null, deposits = [], loading = false, depositBusy = false;
  const say = (text, kind = "info") => { byId("savings-status").textContent = text; byId("savings-status").dataset.kind = kind; };
  const money = value => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} BDT`;
  function svgNode(tag, attrs = {}, text = "") { const node = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value)); if (text) node.textContent = text; return node; }
  function clearDepositForm() { byId("deposit-form").reset(); byId("deposit-id").value = ""; byId("deposit-submit").textContent = "Add deposit"; byId("deposit-cancel").hidden = true; byId("deposit-date").min = selected ? api.calendarDate(new Date(selected.snapshot.calculatedAt)) : ""; }
  function renderRoadmaps() {
    const list = byId("saved-roadmaps"); list.replaceChildren(); byId("no-roadmaps").hidden = roadmaps.length !== 0;
    for (const roadmap of roadmaps) {
      const card = document.createElement("article"); card.className = "savedRoadmapCard";
      const copy = document.createElement("div"), title = document.createElement("strong"), detail = document.createElement("small");
      title.textContent = roadmap.name; detail.textContent = `Saved ${new Date(roadmap.createdAt).toLocaleString()} · ${money(roadmap.snapshot.result.requiredFunds)} goal`;
      copy.append(title, detail); const actions = document.createElement("div"); actions.className = "inlineButtons";
      const open = document.createElement("button"); open.type = "button"; open.className = "button smallbtn"; open.textContent = selected?.id === roadmap.id ? "Selected" : "Open"; open.setAttribute("aria-pressed", String(selected?.id === roadmap.id)); open.addEventListener("click", () => chooseRoadmap(roadmap));
      actions.append(open); card.append(copy, actions); list.append(card);
    }
  }
  function setMetric(label, value, hint, className = "") { const card = document.createElement("article"); card.className = `savingsMetric ${className}`; const title = document.createElement("span"), amount = document.createElement("strong"), note = document.createElement("small"); title.textContent = label; amount.textContent = value; note.textContent = hint; card.append(title, amount, note); return card; }
  function renderComparison() {
    const snapshot = selected.snapshot, result = snapshot.result, comparison = api.compare(snapshot, deposits, new Date());
    byId("selected-name").textContent = selected.name;
    byId("snapshot-meta").textContent = `Calculated ${new Date(snapshot.calculatedAt).toLocaleString()} · Rate source: ${snapshot.rateSource} · Rate timestamp: ${snapshot.rateTimestamp}.`;
    byId("selected-description").textContent = "These are the saved calculation results and contribution dates. They are not recalculated when opened; use Recalculate revised plan to create a separate new snapshot.";
    const metrics = byId("savings-metrics"); metrics.replaceChildren();
    metrics.append(setMetric("Education funding goal", money(result.requiredFunds), "Saved historical snapshot"), setMetric("Savings at plan start", money(result.usable), "Usable savings after protected and committed funds"), setMetric("Deposits recorded", money(comparison.depositsBdt || 0), "Student-entered records since this roadmap was created"), setMetric("Actual savings total", money(comparison.savingsBdt ?? result.usable), "Starting usable savings plus recorded deposits"), setMetric("Remaining to goal", money(comparison.remainingBdt ?? result.gap), "Does not include unrecorded savings"), setMetric("Goal covered", `${comparison.coveredPercent ?? 0}%`, "Based on saved starting savings plus BDT deposits"));
    const progressCard = document.createElement("article"), progressLabel = document.createElement("span"), progress = document.createElement("progress"), progressNote = document.createElement("small");
    progressCard.className = "savingsMetric savingsProgressMetric"; progressLabel.textContent = "Progress toward funding goal"; progress.max = 100; progress.value = Number.isFinite(comparison.coveredPercent) ? comparison.coveredPercent : 0; progress.setAttribute("aria-label", `Funding goal progress: ${progress.value}%`); progressNote.textContent = `${progress.value}% covered by saved starting savings and recorded deposits`; progressCard.append(progressLabel, progress, progressNote); metrics.append(progressCard);
    if (result.gap === 0) metrics.append(setMetric("Planned contribution", "None required", "Saved plan reported the goal covered"));
    else if (Number.isFinite(result.monthlyTarget) && result.monthlyTarget > 0) metrics.append(setMetric("Planned contribution", `${money(result.monthlyTarget)} per month`, `${result.contributionCycles} complete 30-day contribution date(s)`));
    if (selected.snapshot.roadmap?.ok && selected.snapshot.roadmap.targetCanBeReachedByDeadline && selected.snapshot.roadmap.contributions.length) metrics.append(setMetric("Next contribution date", selected.snapshot.roadmap.contributions[0].dueDate, "From the saved, confirmed roadmap"));
    const summary = byId("comparison-summary"); summary.replaceChildren(); const status = document.createElement("strong"), explanation = document.createElement("p"), historyNote = document.createElement("p"); status.className = `trackerStatus ${comparison.status.toLowerCase().replaceAll(" ","-")}`; status.textContent = comparison.status; explanation.textContent = comparison.status === "Goal Covered" ? "The saved starting savings and recorded deposits cover the saved goal." : comparison.plannedDueBdt == null ? (comparison.reason || "A reliable planned-versus-actual comparison is unavailable.") : `${money(comparison.actualSincePlanBdt)} recorded in deposits vs ${money(comparison.plannedDueBdt)} in scheduled contributions due by today. ${comparison.reason}`; historyNote.className = "small muted"; historyNote.textContent = "Deposits are student-entered and editable. Editing or deleting a record recalculates this comparison and its charts; there is no separate edit history."; summary.append(status, explanation, historyNote);
    byId("planned-note").textContent = Number.isFinite(result.monthlyTarget) && result.monthlyTarget > 0 ? `Saved schedule: ${money(result.monthlyTarget)} monthly target; ${selected.snapshot.roadmap.contributions.length} dated contribution(s). The original schedule is kept as a historical snapshot.` : "No confirmed contribution schedule is stored for this roadmap.";
    renderDeposits(); renderCharts(); renderPlanActualChart(snapshot, deposits);
  }
  function renderPlanActualChart(snapshot, rows) {
    const target = byId("plan-actual-chart"); target.replaceChildren();
    const roadmap = snapshot.roadmap, asOf = todayText;
    if (!roadmap?.ok || roadmap.targetCanBeReachedByDeadline !== true || !Array.isArray(roadmap.contributions) || !roadmap.contributions.length) { const note = document.createElement("p"); note.className = "emptyNote"; note.textContent = "Plan-versus-actual chart unavailable because this saved plan has no confirmed contribution schedule."; target.append(note); return; }
    const history = api.monthlyHistory(rows, new Date()), plannedByDate = new Map(), actualByDate = new Map();
    roadmap.contributions.filter(item => item.dueDate <= asOf).forEach(item => plannedByDate.set(item.dueDate, (plannedByDate.get(item.dueDate) || 0) + Number(item.requiredContributionBdt)));
    history.deposits.filter(item => item.deposit_date >= api.calendarDate(new Date(snapshot.calculatedAt))).forEach(item => actualByDate.set(item.deposit_date, (actualByDate.get(item.deposit_date) || 0) + Number(item.amount_bdt)));
    const dates = [...new Set([api.calendarDate(new Date(snapshot.calculatedAt)), ...plannedByDate.keys(), ...actualByDate.keys(), asOf])].sort();
    let planTotal = 0, actualTotal = 0; const series = dates.map(date => { planTotal += plannedByDate.get(date) || 0; actualTotal += actualByDate.get(date) || 0; return { date, planTotal, actualTotal }; });
    const max = Math.max(1, ...series.map(item => Math.max(item.planTotal,item.actualTotal))), width = 480, height = 220, left = 44, right = 465, top = 18, bottom = 180;
    const x = index => left + (series.length === 1 ? 0 : index * (right-left)/(series.length-1)); const y = value => bottom - value/max*(bottom-top);
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Saved planned contribution cumulative total ${money(planTotal)}; actual recorded deposits ${money(actualTotal)} as of ${asOf}.` });
    svg.append(svgNode("line", { x1:left, y1:bottom, x2:right, y2:bottom, class:"chartBaseline" }));
    svg.append(svgNode("polyline", { points: series.map((item,index) => `${x(index)},${y(item.planTotal)}`).join(" "), class:"planCumulativeLine" }));
    svg.append(svgNode("polyline", { points: series.map((item,index) => `${x(index)},${y(item.actualTotal)}`).join(" "), class:"savingsCumulativeLine" }));
    series.forEach((item,index) => { svg.append(svgNode("circle", { cx:x(index), cy:y(item.planTotal), r:3, class:"planCumulativePoint" })); svg.append(svgNode("circle", { cx:x(index), cy:y(item.actualTotal), r:3, class:"savingsCumulativePoint" })); });
    svg.append(svgNode("text", { x:left, y:204, class:"chartAxisLabel" }, dates[0])); svg.append(svgNode("text", { x:right, y:204, "text-anchor":"end", class:"chartAxisLabel" }, asOf));
    const legend = document.createElement("ul"); legend.className="savingsLegend planActualLegend"; for (const label of [`Saved planned contributions: ${money(planTotal)}`, `Actual deposits: ${money(actualTotal)}`]) { const item=document.createElement("li"); item.textContent=label; legend.append(item); }
    const caption = document.createElement("p"); caption.className="small muted"; caption.textContent="Cumulative BDT amounts from the roadmap calculation date through today. Future planned contributions are excluded."; target.append(svg,legend,caption);
  }
  function renderDeposits() {
    const list = byId("deposit-history"); list.replaceChildren(); byId("no-deposits").hidden = deposits.length !== 0;
    const history = api.monthlyHistory(deposits, new Date());
    for (const row of history.deposits.slice().reverse()) {
      const item = document.createElement("article"); item.className = "depositItem"; const copy = document.createElement("div"), title = document.createElement("strong"), detail = document.createElement("small");
      title.textContent = money(row.amount_bdt); detail.textContent = `${row.deposit_date}${row.note ? ` · ${row.note}` : ""} · Running deposits total: ${money(row._runningTotal)}`; copy.append(title, detail);
      const actions = document.createElement("div"); actions.className = "inlineButtons"; const edit = document.createElement("button"); edit.type = "button"; edit.className = "button smallbtn"; edit.textContent = "Edit"; edit.addEventListener("click", () => { byId("deposit-id").value = row.id; byId("deposit-amount").value = row.amount_bdt; byId("deposit-date").value = row.deposit_date; byId("deposit-note").value = row.note || ""; byId("deposit-submit").textContent = "Save changes"; byId("deposit-cancel").hidden = false; byId("deposit-amount").focus(); });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button smallbtn cautionButton"; remove.textContent = "Delete"; remove.addEventListener("click", async () => { if (!window.confirm("Delete this student-entered deposit record?")) return; remove.disabled = true; const result = await service.deleteDeposit(row.id, selected.id); if (!result.ok) { say(result.error, "error"); remove.disabled = false; return; } await loadDeposits(); say("Deposit deleted.", "success"); }); actions.append(edit, remove); item.append(copy, actions); list.append(item);
    }
  }
  function renderCharts() {
    const history = api.monthlyHistory(deposits, new Date()), monthly = byId("monthly-chart"), cumulative = byId("cumulative-chart"), legend = byId("monthly-legend"); monthly.replaceChildren(); cumulative.replaceChildren(); legend.replaceChildren();
    if (!history.deposits.length) { const empty = document.createElement("p"); empty.className = "emptyNote"; empty.textContent = "Charts will appear after you record a deposit."; monthly.append(empty); cumulative.append(empty.cloneNode(true)); byId("cumulative-description").textContent = "No deposits to plot."; return; }
    const values = history.months.slice(-12), max = Math.max(...values.map(item => item.amountBdt), 1), chart = svgNode("svg", { viewBox: "0 0 480 230", role: "img", "aria-label": `Monthly BDT deposits: ${values.map(v => `${v.month} ${money(v.amountBdt)}`).join("; ")}` });
    chart.append(svgNode("line", { x1: 36, y1: 190, x2: 465, y2: 190, class: "chartBaseline" }));
    values.forEach((entry, index) => { const width = Math.min(30, 300 / values.length), gap = 429 / values.length, height = Math.max(2, entry.amountBdt / max * 140), x = 42 + gap * index; chart.append(svgNode("rect", { x, y: 190 - height, width, height, rx: 4, class: "savingsBar" })); chart.append(svgNode("text", { x: x + width / 2, y: 210, "text-anchor": "middle", class: "chartAxisLabel" }, entry.month.slice(5))); const li = document.createElement("li"); li.textContent = `${entry.month}: ${money(entry.amountBdt)}`; legend.append(li); }); monthly.append(chart);
    let cumulativeBdt = 0; const points = history.deposits.map((row,index) => { cumulativeBdt += Number(row.amount_bdt); return { row, index, value: cumulativeBdt }; }); const maxCum = Math.max(cumulativeBdt, 1), line = svgNode("svg", { viewBox: "0 0 480 230", role: "img", "aria-label": `Cumulative BDT deposits total ${money(cumulativeBdt)} across ${points.length} recorded deposits.` });
    line.append(svgNode("line", { x1: 36, y1: 190, x2: 465, y2: 190, class: "chartBaseline" })); const coords = points.map((p,i) => `${42 + (points.length === 1 ? 0 : i * 420 / (points.length - 1))},${190 - p.value / maxCum * 150}`).join(" "); line.append(svgNode("polyline", { points: coords, class: "savingsCumulativeLine" })); points.forEach((p,i) => line.append(svgNode("circle", { cx: 42 + (points.length === 1 ? 0 : i * 420 / (points.length - 1)), cy: 190 - p.value / maxCum * 150, r: 3, class: "savingsCumulativePoint" }))); line.append(svgNode("text", { x: 42, y: 212, class: "chartAxisLabel" }, points[0].row.deposit_date)); line.append(svgNode("text", { x: 465, y: 212, "text-anchor": "end", class: "chartAxisLabel" }, points.at(-1).row.deposit_date)); cumulative.append(line); byId("cumulative-description").textContent = `${points.length} deposit record(s); total ${money(cumulativeBdt)}. This is not a verified account balance.`;
  }
  async function loadDeposits() {
    if (!selected) return; const id = selected.id, result = await service.listDeposits(id);
    if (selected?.id !== id) return;
    if (!result.ok) { deposits = []; say(result.error, "error"); }
    else deposits = result.deposits;
    renderComparison();
  }
  function chooseRoadmap(roadmap) { selected = roadmap; deposits = []; byId("selected-roadmap").hidden = false; clearDepositForm(); renderRoadmaps(); renderComparison(); void loadDeposits(); }
  async function loadAll() {
    if (loading) return; loading = true; byId("refresh-savings").disabled = true;
    const previousId = selected?.id, result = service.listRoadmaps();
    loading = false; byId("refresh-savings").disabled = false;
    if (!result.ok) { roadmaps = []; selected = null; deposits = []; byId("selected-roadmap").hidden = true; byId("no-roadmaps").hidden = true; byId("saved-roadmaps").replaceChildren(); say(result.error, "error"); return; }
    roadmaps = result.roadmaps;
    const requested = new URLSearchParams(location.search).get("roadmap"); selected = roadmaps.find(item => item.id === requested) || roadmaps.find(item => item.id === previousId) || roadmaps[0] || null;
    byId("selected-roadmap").hidden = !selected; renderRoadmaps(); if (selected) { await loadDeposits(); } else { deposits = []; byId("no-deposits").hidden = true; }
    say(roadmaps.length ? "Savings tracker loaded in this browser. Deposits are student-entered and are not bank-verified." : "No saved roadmap yet. Save one from the Financial Planner.", "info");
  }
  byId("refresh-savings").addEventListener("click", () => { void loadAll(); });
  byId("rename-roadmap").addEventListener("click", () => { const name = window.prompt("Choose a name for this saved roadmap:", selected?.name || ""); if (name === null) return; const result = service.renameRoadmap(selected.id, name); if (!result.ok) { say(result.error, "error"); return; } say("Roadmap renamed in this browser.", "success"); void loadAll(); });
  byId("delete-roadmap").addEventListener("click", () => { if (!window.confirm("Delete this roadmap and its linked student-entered deposit records from this browser? This cannot be undone.")) return; const result = service.deleteRoadmap(selected.id); if (!result.ok) { say(result.error, "error"); return; } selected = null; say("Roadmap and its linked deposits deleted from this browser.", "success"); void loadAll(); });
  byId("revise-roadmap").addEventListener("click", () => { if (!window.confirm("Open this saved input in the planner? This replaces the current local planner inputs in this browser tab only. The saved roadmap and its historical results will remain unchanged.")) return; const restored = window.CampusBridgePlanState.savePlan(selected.profile); if (!restored?.ok) { say("This saved input could not be placed in the local planner. It may be expired or unsupported; the saved snapshot is unchanged.", "error"); return; } const params = new URLSearchParams({ revisedFrom: selected.id, name: selected.name }); location.href = `/planner.html?${params.toString()}#planner`; });
  byId("deposit-cancel").addEventListener("click", clearDepositForm);
  byId("deposit-form").addEventListener("submit", event => { event.preventDefault(); if (depositBusy || !selected) return; depositBusy = true; const requestRoadmap = selected.id, button = byId("deposit-submit"); button.disabled = true; const result = service.saveDeposit(requestRoadmap, { amount: byId("deposit-amount").value, currency: "BDT", depositDate: byId("deposit-date").value, note: byId("deposit-note").value }, byId("deposit-id").value || null); button.disabled = false; depositBusy = false; if (selected?.id !== requestRoadmap) return; if (!result.ok) { say(result.error, "error"); return; } clearDepositForm(); void loadDeposits(); say("Deposit record saved in this browser. This entry is not independently verified.", "success"); });
  byId("export-savings").addEventListener("click", () => {
    const result = service.exportBackup(); if (!result.ok) { say(result.error, "error"); return; }
    try {
      const blob = new Blob([result.json], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `campusbridge-savings-${api.calendarDate(new Date())}.json`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); say("JSON backup downloaded.", "success");
    } catch { say("The backup could not be downloaded. Try another browser or check download permissions.", "error"); }
  });
  byId("import-savings").addEventListener("click", () => byId("savings-backup-file").click());
  byId("savings-backup-file").addEventListener("change", async event => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > api.MAX_BACKUP_LENGTH) { say("Choose a CampusBridge backup smaller than 5 MB. Your current tracker data was not changed.", "error"); return; }
    if (!window.confirm("Importing this backup replaces all current Savings Tracker data in this browser. Export your current data first if you may need it. Continue?")) return;
    try {
      const result = service.importBackup(await file.text()); if (!result.ok) { say(result.error, "error"); return; }
      selected = null; say(`Backup restored: ${result.roadmapCount} roadmap(s) and ${result.depositCount} deposit(s).`, "success"); await loadAll();
    } catch { say("The backup file could not be read. Your current tracker data was not changed.", "error"); }
  });
  window.addEventListener("storage", event => { if (event.key === api.STORAGE_KEY) void loadAll(); });
  void loadAll();
})();
