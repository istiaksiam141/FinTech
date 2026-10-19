(function () {
  "use strict";
  const dialog = document.getElementById("save-roadmap-dialog"), form = document.getElementById("save-roadmap-form");
  if (!dialog || !form || !window.CampusBridgeSavingsTracker) return;
  const savings = window.CampusBridgeSavingsTracker.createLocalSavings({ finance: window.CampusBridgeFinance, planState: window.CampusBridgePlanState });
  const message = document.getElementById("save-roadmap-message"), name = document.getElementById("save-roadmap-name"), submit = document.getElementById("save-roadmap-confirm");
  dialog.querySelector("[data-roadmap-cancel]").addEventListener("click", () => dialog.close("cancel"));
  dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close("cancel"); });
  dialog.addEventListener("close", () => { if (dialog.returnValue !== "saved") form.reset(); message.textContent = ""; });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close("cancel"); });
  dialog.addEventListener("close", () => { const trigger = document.querySelector("#plannerResults .resultsReportAction button:last-child"); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
  dialog.addEventListener("close", () => { if (dialog.returnValue === "saved") window.location.href = "/savings.html"; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (submit.disabled) return;
    const current = window.CampusBridgePlannerLatest?.();
    if (!current?.profile) { message.textContent = "Calculate a valid plan before saving a roadmap."; return; }
    submit.disabled = true; message.textContent = "Saving a historical snapshot in this browser…";
    const params = new URLSearchParams(location.search), parent = params.get("revisedFrom");
    const result = await savings.saveRoadmap(name.value, current.profile, parent || null);
    if (!result.ok) { message.textContent = result.error; submit.disabled = false; return; }
    dialog.returnValue = "saved"; dialog.close("saved");
  });
  const params = new URLSearchParams(location.search), revised = params.get("revisedFrom"), revisedName = params.get("name");
  if (revised) { name.value = revisedName ? `${revisedName} — revised` : "Revised roadmap"; }
})();
