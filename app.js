"use strict";

const topbar = document.querySelector("#topbar");
const menu = document.querySelector("#menu");
const navlinks = document.querySelector("#navlinks");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function updateHeader() {
  topbar.classList.toggle("scrolled", window.scrollY > 12);
  const sections = [...document.querySelectorAll("main section[id]")];
  const current = sections.filter(section => section.getBoundingClientRect().top < innerHeight * .38).at(-1);
  if (current) navlinks.querySelectorAll('a[href^="#"]').forEach(link => link.toggleAttribute("aria-current", link.hash === `#${current.id}`));
}
navlinks.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { navlinks.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.textContent = "☰"; }));
window.addEventListener("scroll", updateHeader, { passive: true }); window.addEventListener("resize", updateHeader, { passive: true }); updateHeader();

const Finance = window.CampusBridgeFinance;
const BankAccounts = window.CampusBridgeBankAccounts;
const guidance = window.CampusBridgeGuidance || [];
const ExchangeRates = window.CampusBridgeExchangeRates;
const AssistantRenderer = window.CampusBridgeAssistantRenderer;
const PlanState = window.CampusBridgePlanState;
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const corridorMap = { US: { country: "United States", currency: "USD", label: "United States" }, EU: { country: "Euro area", currency: "EUR", label: "Euro area" }, UK: { country: "United Kingdom", currency: "GBP", label: "United Kingdom" }, AU: { country: "Australia", currency: "AUD", label: "Australia" }, JP: { country: "Japan", currency: "JPY", label: "Japan" }, CA: { country: "Canada", currency: "CAD", label: "Canada" }, SE: { country: "Sweden", currency: "SEK", label: "Sweden" }, SG: { country: "Singapore", currency: "SGD", label: "Singapore" }, CN: { country: "China", currency: "CNH", label: "China · offshore yuan" }, IN: { country: "India", currency: "INR", label: "India" }, LK: { country: "Sri Lanka", currency: "LKR", label: "Sri Lanka" }, DK: { country: "Denmark", currency: "DKK", label: "Denmark" }, FI: { country: "Finland", currency: "EUR", label: "Finland" }, FR: { country: "France", currency: "EUR", label: "France" }, DE: { country: "Germany", currency: "EUR", label: "Germany" }, IE: { country: "Ireland", currency: "EUR", label: "Ireland" }, NL: { country: "Netherlands", currency: "EUR", label: "Netherlands" }, ES: { country: "Spain", currency: "EUR", label: "Spain" }, NZ: { country: "New Zealand", currency: "NZD", label: "New Zealand" }, NO: { country: "Norway", currency: "NOK", label: "Norway" }, KR: { country: "South Korea", currency: "KRW", label: "South Korea" }, CH: { country: "Switzerland", currency: "CHF", label: "Switzerland" }, AE: { country: "United Arab Emirates", currency: "AED", label: "United Arab Emirates" } };
const studyDestinationCorridors = { AU: "AU", CA: "CA", CN: "CN", DK: "DK", FI: "FI", FR: "FR", DE: "DE", IN: "IN", IE: "IE", JP: "JP", NL: "NL", NZ: "NZ", NO: "NO", SG: "SG", KR: "KR", ES: "ES", SE: "SE", CH: "CH", AE: "AE", GB: "UK", US: "US" };
const providerDefs=[{id:"convera",name:"Convera GlobalPay for Students",note:"Institution participation and Bangladesh-origin route must be confirmed."},{id:"flywire",name:"Flywire",note:"Use the payment link supplied by your university; origin options vary."},{id:"bank",name:"Authorized-dealer bank wire",note:"Get current written terms directly from your bank."}];
const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
function contributionScheduleText(result) {
  const target = Finance.describeMonthlySavingsTarget(result);
  if (target.state === "covered" || target.state === "unavailable") return target.message;
  return result.contributionCycles === 1 ? planMoney(target.finalAmount) : `${planMoney(target.regularAmount)} for first ${result.contributionCycles - 1} cycle(s), then ${planMoney(target.finalAmount)} in the final cycle`;
}
function renderContributionRoadmap(roadmap,planningMode) {
  const section=byId("roadmap"),summary=byId("roadmapSummary"),capacityNote=byId("roadmapCapacityNote"),timeline=byId("roadmapTimeline");
  timeline.replaceChildren();
  if(!roadmap?.ok){section.hidden=false;summary.textContent="Calculate a valid plan to see dated contribution estimates.";capacityNote.textContent="";return;}
  const readableSummary=roadmap.summary.replace(/([\d]+(?:\.\d+)?) BDT/g,(_match,amount)=>planMoney(Number(amount)));
  summary.textContent=`${planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Tuition-only plan: ":"All study-abroad costs plan: "}${readableSummary}`;
  const reach=document.createElement("span");reach.className=`roadmapReachability${roadmap.targetCanBeReachedByDeadline?"":" isShort"}`;
  reach.textContent=roadmap.targetCanBeReachedByDeadline?"Projected target: reachable by deadline":"Projected target: not reachable with current savings capacity";
  summary.append(document.createTextNode(" "),reach);
  capacityNote.textContent=`Required contribution schedule: ${planMoney(roadmap.requiredContributionTotalBdt)} across ${roadmap.contributionCycles} complete 30-day cycle(s). Projected savings capacity: ${planMoney(roadmap.projectedSavingsCapacityBdt)}. Current monthly savings capacity: ${planMoney(roadmap.monthlySavingsCapacityBdt)}. Planned contributions are targets, not guaranteed future payments.`;
  for(const item of roadmap.contributions){
    const row=document.createElement("li"),heading=document.createElement("div"),cycle=document.createElement("span"),due=document.createElement("time"),details=document.createElement("dl");
    heading.className="roadmapCycleTitle";cycle.textContent=`Cycle ${item.cycle}`;due.dateTime=item.dueDate;due.textContent=`Due ${item.dueDate}`;heading.append(cycle,due);
    details.className="roadmapCycleDetails";
    const rows=[
      ["Required planned contribution",planMoney(item.requiredContributionBdt)],
      ["Cumulative planned contributions",planMoney(item.cumulativePlannedContributionsBdt)],
      ["Projected savings balance after saving current surplus",planMoney(item.projectedSavingsBalanceBdt)],
      ["Remaining funding gap at projected capacity",planMoney(item.remainingFundingGapBdt)],
      ["Current monthly savings capacity",planMoney(item.monthlySavingsCapacityBdt)],
      ["Capacity check",item.exceedsMonthlyCapacityBdt>0?`Planned amount is ${planMoney(item.exceedsMonthlyCapacityBdt)} above current monthly capacity`:"Within current monthly capacity"]
    ];
    for(const [label,value] of rows){const term=document.createElement("dt"),description=document.createElement("dd"),entry=document.createElement("div");term.textContent=label;description.textContent=value;entry.append(term,description);details.append(entry);}
    row.append(heading,details);timeline.append(row);
  }
}
let planRequested = false;
let restoredRateProvenance = "";
let calendarCursor = new Date();
let calendarFocusDate = null;
function deadlineMinimum() {
  const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}
function closeDeadlineCalendar(restoreFocus = false) {
  byId("deadlineCalendar").hidden = true;
  byId("deadlineTrigger").setAttribute("aria-expanded", "false");
  if (restoreFocus) byId("deadlineTrigger").focus();
}
function renderDeadlineCalendar(focusDate = null) {
  const minimum = deadlineMinimum();
  const month = calendarCursor.getMonth();
  const year = calendarCursor.getFullYear();
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarCursor);
  byId("calendarMonth").textContent = monthLabel;
  const previousMonth = new Date(year, month - 1, 1);
  byId("calendarPrevious").disabled = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0) < minimum;
  byId("calendarDays").setAttribute("aria-label", monthLabel);
  const firstDay = new Date(year, month, 1).getDay();
  const firstCell = new Date(year, month, 1 - firstDay);
  const days = document.createDocumentFragment();
  const selected = byId("deadline").value;
  let week;
  for (let index = 0; index < 42; index += 1) {
    if (index % 7 === 0) {
      week = document.createElement("div");
      week.className = "calendarWeek";
      week.setAttribute("role", "row");
      days.append(week);
    }
    const date = new Date(firstCell); date.setDate(firstCell.getDate() + index);
    const iso = localDate(date);
    const outsideMonth = date.getMonth() !== month;
    const button = document.createElement("button");
    button.type = "button"; button.className = "calendarDay"; button.textContent = String(date.getDate());
    button.dataset.iso = iso; button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date));
    button.setAttribute("aria-selected", String(iso === selected));
    button.disabled = outsideMonth || date < minimum;
    if (outsideMonth) button.classList.add("isOutside");
    if (iso === localDate(new Date())) button.classList.add("isToday");
    if (iso === selected) button.classList.add("isSelected");
    if (iso === focusDate) button.tabIndex = 0;
    button.addEventListener("click", () => {
      byId("deadline").value = iso;
      byId("deadline").dispatchEvent(new Event("change", { bubbles: true }));
      closeDeadlineCalendar(true);
    });
    week.append(button);
  }
  byId("calendarDays").replaceChildren(days);
  byId("calendarNext").disabled = year >= new Date().getFullYear() + 100 && month === 11;
  const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null;
  const daysRemaining = selectedDate ? Finance.calendarDaysBetween(localDate(new Date()), selected) : 0;
  const selection = byId("calendarSelection");
  const selectedText = document.createElement("strong");
  selection.replaceChildren(document.createTextNode(selectedDate ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining` : "No deadline selected"));
  selectedText.textContent = selectedDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selectedDate) : "Choose a day";
  selection.append(selectedText);
}
function showDeadlineCalendar() {
  const selected = byId("deadline").value;
  const start = selected ? new Date(`${selected}T00:00:00`) : deadlineMinimum();
  calendarCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  calendarFocusDate = selected || localDate(deadlineMinimum());
  renderDeadlineCalendar(calendarFocusDate);
  byId("deadlineCalendar").hidden = false;
  byId("deadlineTrigger").setAttribute("aria-expanded", "true");
  byId("calendarDays").querySelector(`[data-iso="${calendarFocusDate}"]`)?.focus();
}
function updateDeadlineHint() {
  const input = byId("deadline");
  input.min = localDate(deadlineMinimum());
  const hint = byId("deadlineHint");
  if (!input.value) {
    byId("deadlineDisplay").textContent = "Choose your deadline";
    byId("deadlineTrigger").setAttribute("aria-invalid", "false");
    hint.textContent = "Choose a date at least 1 day from today. Your estimate updates automatically after you calculate.";
    return;
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${input.value}T00:00:00`);
  const days = Finance.calendarDaysBetween(localDate(today), input.value);
  if (Number.isNaN(deadline.getTime()) || !Number.isFinite(days) || days < 1) {
    byId("deadlineTrigger").setAttribute("aria-invalid", "true");
    hint.textContent = "Choose a deadline at least 1 day from today.";
    return;
  }
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(deadline);
  byId("deadlineDisplay").textContent = formatted;
  byId("deadlineTrigger").setAttribute("aria-invalid", "false");
  hint.textContent = `${formatted} · ${days} ${days === 1 ? "day" : "days"} from today. ${planRequested ? "Your plan updates automatically when you change this date." : "Calculate your plan to see the updated savings target."}`;
  if (!byId("deadlineCalendar").hidden) renderDeadlineCalendar(input.value);
}
updateDeadlineHint();
byId("deadlineTrigger").addEventListener("click", () => {
  if (byId("deadlineCalendar").hidden) showDeadlineCalendar();
  else closeDeadlineCalendar();
});
byId("calendarPrevious").addEventListener("click", () => { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderDeadlineCalendar(calendarFocusDate); });
byId("calendarNext").addEventListener("click", () => { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderDeadlineCalendar(calendarFocusDate); });
byId("calendarClear").addEventListener("click", () => {
  byId("deadline").value = "";
  byId("deadline").dispatchEvent(new Event("change", { bubbles: true }));
  closeDeadlineCalendar(true);
});
byId("calendarTomorrow").addEventListener("click", () => {
  byId("deadline").value = localDate(deadlineMinimum());
  byId("deadline").dispatchEvent(new Event("change", { bubbles: true }));
  closeDeadlineCalendar(true);
});
byId("calendarDays").addEventListener("keydown", event => {
  const current = event.target.closest("[data-iso]");
  if (!current) return;
  const date = new Date(`${current.dataset.iso}T00:00:00`);
  let offset = 0;
  if (event.key === "ArrowRight") offset = 1;
  else if (event.key === "ArrowLeft") offset = -1;
  else if (event.key === "ArrowDown") offset = 7;
  else if (event.key === "ArrowUp") offset = -7;
  else if (event.key === "Home") offset = -date.getDay();
  else if (event.key === "End") offset = 6 - date.getDay();
  else if (event.key === "PageDown" || event.key === "PageUp") {
    event.preventDefault();
    date.setMonth(date.getMonth() + (event.key === "PageDown" ? 1 : -1));
    calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
    calendarFocusDate = localDate(date < deadlineMinimum() ? deadlineMinimum() : date);
    renderDeadlineCalendar(calendarFocusDate);
    byId("calendarDays").querySelector(`[data-iso="${calendarFocusDate}"]`)?.focus();
    return;
  } else if (event.key === "Escape") {
    event.preventDefault(); closeDeadlineCalendar(true); return;
  } else return;
  event.preventDefault();
  date.setDate(date.getDate() + offset);
  if (date < deadlineMinimum()) date.setTime(deadlineMinimum().getTime());
  calendarFocusDate = localDate(date);
  if (date.getMonth() !== calendarCursor.getMonth() || date.getFullYear() !== calendarCursor.getFullYear()) calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
  renderDeadlineCalendar(calendarFocusDate);
  byId("calendarDays").querySelector(`[data-iso="${calendarFocusDate}"]`)?.focus();
});
byId("deadlineCalendar").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault(); closeDeadlineCalendar(true);
  }
});
document.addEventListener("pointerdown", event => {
  if (!event.target.closest(".deadlinePicker")) closeDeadlineCalendar();
});
document.addEventListener("focusin", event => {
  if (!event.target.closest(".deadlinePicker")) closeDeadlineCalendar();
});
let rateCalendarCursor = new Date();
let rateCalendarFocusDate = null;
function syncRateTimestampPicker() {
  const value = byId("rateTimestamp").value;
  const trigger = byId("rateTimestampTrigger");
  const time = byId("rateTimestampTime");
  if (!value) {
    byId("rateTimestampDisplay").textContent = "Choose date and time";
    trigger.setAttribute("aria-invalid", "false");
    if (time) time.value = "";
    return;
  }
  const [datePart, timePart] = value.split("T");
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime()) || !timePart) {
    trigger.setAttribute("aria-invalid", "true");
    return;
  }
  time.value = timePart;
  const dateTime = new Date(`${datePart}T${timePart}`);
  const displayTime = Number.isNaN(dateTime.getTime()) ? timePart : new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(dateTime);
  byId("rateTimestampDisplay").textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) + ` · ${displayTime}`;
  trigger.setAttribute("aria-invalid", "false");
  if (!byId("rateTimestampCalendar").hidden) renderRateTimestampCalendar(datePart);
}
function syncCustomSelect(select) {
  const root = select.closest(".customSelect");
  if (!root) return;
  const selected = select.selectedOptions[0];
  root.querySelector(".customSelectValue").textContent = selected?.textContent ?? "";
  root.querySelectorAll(".customSelectOption").forEach(option => {
    option.setAttribute("aria-selected", String(option.dataset.value === select.value));
  });
}
let customSelectId = 0;
function initializeCustomSelect(select) {
  if (select.closest(".customSelect")) return;
  const label = select.labels?.[0] || select.closest("label");
  const labelText = select.getAttribute("aria-label") || label?.querySelector(".fieldLabel, .quoteLabelText")?.textContent.trim() || [...(label?.childNodes ?? [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim()).filter(Boolean).join(" ") || label?.textContent.trim() || "Choose an option";
  const root = document.createElement("span");
  root.className = "customSelect";
  select.before(root);
  root.append(select);
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "customSelectTrigger";
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (select.required) trigger.setAttribute("aria-required", "true");
  trigger.setAttribute("aria-label", labelText);
  trigger.innerHTML = '<span class="customSelectValue"></span><span class="customSelectChevron" aria-hidden="true"></span>';
  const menu = document.createElement("div");
  menu.className = "customSelectMenu";
  menu.id = `customSelectMenu-${++customSelectId}`;
  trigger.setAttribute("aria-controls", menu.id);
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", labelText);
  menu.hidden = true;
  root.append(trigger, menu);
  const close = (restoreFocus = false) => {
    menu.hidden = true;
    root.classList.remove("isOpen");
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };
  const open = () => {
    menu.hidden = false;
    root.classList.add("isOpen");
    trigger.setAttribute("aria-expanded", "true");
    (menu.querySelector(`[data-value="${CSS.escape(select.value)}"]`) || menu.querySelector('[role="option"]'))?.focus();
  };
  const options = [...select.options].filter(option => !option.disabled).map(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "customSelectOption";
    button.setAttribute("role", "option");
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.addEventListener("click", () => {
      select.value = option.value;
      syncCustomSelect(select);
      close(true);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.append(button);
    return button;
  });
  trigger.addEventListener("click", () => menu.hidden ? open() : close());
  trigger.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (menu.hidden) open();
      else close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (menu.hidden) open();
      else menu.querySelector(`[data-value="${CSS.escape(select.value)}"]`)?.focus();
    } else if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault(); close(true);
    }
  });
  menu.addEventListener("keydown", event => {
    const index = options.indexOf(event.target);
    if (index < 0) return;
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Tab") { close(); return; }
    else return;
    event.preventDefault();
    options[nextIndex].focus();
  });
  select.addEventListener("change", () => {
    syncCustomSelect(select);
    trigger.removeAttribute("aria-invalid");
  });
  select.addEventListener("invalid", event => {
    event.preventDefault();
    trigger.setAttribute("aria-invalid", "true");
    trigger.focus();
  });
  syncCustomSelect(select);
}
function closeRateTimestampCalendar(restoreFocus = false) {
  byId("rateTimestampCalendar").hidden = true;
  byId("rateTimestampTrigger").setAttribute("aria-expanded", "false");
  if (restoreFocus) byId("rateTimestampTrigger").focus();
}
function renderRateTimestampCalendar(focusDate = null) {
  const year = rateCalendarCursor.getFullYear();
  const month = rateCalendarCursor.getMonth();
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(rateCalendarCursor);
  byId("rateCalendarMonth").textContent = monthLabel;
  byId("rateCalendarDays").setAttribute("aria-label", monthLabel);
  const value = byId("rateTimestamp").value;
  const selected = value ? value.split("T")[0] : "";
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const fragment = document.createDocumentFragment();
  let week;
  for (let index = 0; index < 42; index += 1) {
    if (index % 7 === 0) {
      week = document.createElement("div");
      week.className = "calendarWeek";
      week.setAttribute("role", "row");
      fragment.append(week);
    }
    const date = new Date(start); date.setDate(start.getDate() + index);
    const iso = localDate(date);
    const outsideMonth = date.getMonth() !== month;
    const button = document.createElement("button");
    button.type = "button"; button.className = "calendarDay"; button.textContent = String(date.getDate());
    button.dataset.iso = iso; button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date));
    button.setAttribute("aria-selected", String(iso === selected));
    if (outsideMonth) button.classList.add("isOutside");
    if (iso === localDate(new Date())) button.classList.add("isToday");
    if (iso === selected) button.classList.add("isSelected");
    if (iso === focusDate) button.tabIndex = 0;
    button.addEventListener("click", () => {
      const time = byId("rateTimestampTime").value || "12:00";
      byId("rateTimestamp").value = `${iso}T${time}`;
      syncRateTimestampPicker();
      byId("rateCalendarSelection").textContent = `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)} · ${time}`;
      byId("rateCalendarDays").querySelector(`[data-iso="${iso}"]`)?.focus();
      byId("rateTimestamp").dispatchEvent(new Event("input", { bubbles: true }));
    });
    week.append(button);
  }
  byId("rateCalendarDays").replaceChildren(fragment);
  const previous = new Date(year, month - 1, 1);
  byId("rateCalendarPrevious").disabled = previous.getFullYear() < 1;
  byId("rateCalendarNext").disabled = year >= 9999 && month === 11;
  const selection = byId("rateCalendarSelection");
  const strong = document.createElement("strong");
  selection.replaceChildren(document.createTextNode(selected ? "Selected date and time" : "Select a rate date"));
  const selectedTime = value.split("T")[1] || byId("rateTimestampTime").value;
  const dateText = selected ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${selected}T00:00:00`)) : "Choose a day";
  strong.textContent = selected ? `${dateText}${selectedTime ? ` · ${selectedTime}` : ""}` : "Choose date and time";
  selection.append(strong);
}
function showRateTimestampCalendar() {
  const value = byId("rateTimestamp").value;
  const datePart = value ? value.split("T")[0] : localDate(new Date());
  const timePart = value ? value.split("T")[1] : localDateTimeForInput(Date.now()).split("T")[1];
  byId("rateTimestampTime").value = timePart;
  const selectedDate = new Date(`${datePart}T00:00:00`);
  rateCalendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  rateCalendarFocusDate = datePart;
  renderRateTimestampCalendar(datePart);
  byId("rateTimestampCalendar").hidden = false;
  byId("rateTimestampTrigger").setAttribute("aria-expanded", "true");
  byId("rateCalendarDays").querySelector(`[data-iso="${datePart}"]`)?.focus();
}
syncRateTimestampPicker();
byId("rateTimestampTrigger").addEventListener("click", () => {
  if (byId("rateTimestampCalendar").hidden) showRateTimestampCalendar();
  else closeRateTimestampCalendar();
});
byId("rateCalendarPrevious").addEventListener("click", () => { rateCalendarCursor.setMonth(rateCalendarCursor.getMonth() - 1); renderRateTimestampCalendar(rateCalendarFocusDate); });
byId("rateCalendarNext").addEventListener("click", () => { rateCalendarCursor.setMonth(rateCalendarCursor.getMonth() + 1); renderRateTimestampCalendar(rateCalendarFocusDate); });
byId("rateTimestampTime").addEventListener("input", () => {
  const datePart = byId("rateTimestamp").value ? byId("rateTimestamp").value.split("T")[0] : localDate(new Date());
  byId("rateTimestamp").value = `${datePart}T${byId("rateTimestampTime").value}`;
  syncRateTimestampPicker();
  byId("rateTimestamp").dispatchEvent(new Event("input", { bubbles: true }));
});
byId("useCurrentRateTimestamp").addEventListener("click", () => {
  byId("rateTimestamp").value = localDateTimeForInput(Date.now());
  syncRateTimestampPicker();
  byId("rateTimestamp").dispatchEvent(new Event("input", { bubbles: true }));
  closeRateTimestampCalendar(true);
});
byId("todayRateTimestamp").addEventListener("click", () => {
  const time = byId("rateTimestampTime").value || localDateTimeForInput(Date.now()).split("T")[1];
  byId("rateTimestamp").value = `${localDate(new Date())}T${time}`;
  syncRateTimestampPicker();
  byId("rateTimestamp").dispatchEvent(new Event("input", { bubbles: true }));
});
byId("clearRateTimestamp").addEventListener("click", () => {
  byId("rateTimestamp").value = "";
  syncRateTimestampPicker();
  byId("rateTimestamp").dispatchEvent(new Event("input", { bubbles: true }));
  closeRateTimestampCalendar(true);
});
byId("rateCalendarDays").addEventListener("keydown", event => {
  const current = event.target.closest("[data-iso]");
  if (!current) return;
  const date = new Date(`${current.dataset.iso}T00:00:00`);
  let offset;
  if (event.key === "ArrowRight") offset = 1;
  else if (event.key === "ArrowLeft") offset = -1;
  else if (event.key === "ArrowDown") offset = 7;
  else if (event.key === "ArrowUp") offset = -7;
  else if (event.key === "Home") offset = -date.getDay();
  else if (event.key === "End") offset = 6 - date.getDay();
  else if (event.key === "Escape") { event.preventDefault(); closeRateTimestampCalendar(true); return; }
  else return;
  event.preventDefault();
  date.setDate(date.getDate() + offset);
  rateCalendarFocusDate = localDate(date);
  if (date.getMonth() !== rateCalendarCursor.getMonth() || date.getFullYear() !== rateCalendarCursor.getFullYear()) rateCalendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
  renderRateTimestampCalendar(rateCalendarFocusDate);
  byId("rateCalendarDays").querySelector(`[data-iso="${rateCalendarFocusDate}"]`)?.focus();
});
byId("rateTimestampCalendar").addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); closeRateTimestampCalendar(true); }
});
byId("rateTimestampCalendar").addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); closeRateTimestampCalendar(true); }
});
document.addEventListener("pointerdown", event => {
  if (!event.target.closest(".deadlinePicker")) closeDeadlineCalendar();
  if (!event.target.closest(".timestampPicker")) closeRateTimestampCalendar();
  document.querySelectorAll(".customSelect.isOpen").forEach(root => {
    if (!root.contains(event.target)) {
      root.querySelector(".customSelectMenu").hidden = true;
      root.classList.remove("isOpen");
      root.querySelector(".customSelectTrigger").setAttribute("aria-expanded", "false");
    }
  });
});
document.addEventListener("focusin", event => {
  if (!event.target.closest(".deadlinePicker")) closeDeadlineCalendar();
  if (!event.target.closest(".timestampPicker")) closeRateTimestampCalendar();
  document.querySelectorAll(".customSelect.isOpen").forEach(root => {
    if (!root.contains(event.target)) {
      root.querySelector(".customSelectMenu").hidden = true;
      root.classList.remove("isOpen");
      root.querySelector(".customSelectTrigger").setAttribute("aria-expanded", "false");
    }
  });
  document.querySelectorAll(".quoteTimestampPicker").forEach(picker => {
    if (!picker.contains(event.target)) {
      picker.querySelector(".timestampCalendar").hidden = true;
      picker.querySelector(".timestampTrigger").setAttribute("aria-expanded", "false");
    }
  });
});
document.addEventListener("pointerdown", event => {
  document.querySelectorAll(".quoteTimestampPicker").forEach(picker => {
    if (!picker.contains(event.target)) {
      picker.querySelector(".timestampCalendar").hidden = true;
      picker.querySelector(".timestampTrigger").setAttribute("aria-expanded", "false");
    }
  });
});
let latest = null; let latestStressTest = null; let latestReadinessReportProfile = null; let activity = []; let bankAccounts = []; let nextBankAccountId = 1;
let visibleProviderCount = 1;
const quoteDrafts = new Map();
const exchangeRateState = { lastResponse: null, nextRequestAt: 0, pending: false, mode: "manual", appliedCurrency: null, appliedUpdatedAtMs: null, appliedNextUpdateAtMs: null, selectedCurrency: "", staleTimer: null };
const FX_MIN_REQUEST_INTERVAL = 30 * 60 * 1000;
const FX_FAILED_RETRY_DELAY = 30 * 1000;
const money = (n, cur) => { const currency=cur||planCurrency()||"BDT",value=cur||currency==="BDT"?n:Finance.convert(n,"BDT",currency,{BDT:planRate(),[currency]:1}); return `${new Intl.NumberFormat("en", { maximumFractionDigits: currency === "BDT" ? 0 : 2 }).format(value)} ${currency}`; };
function planCurrency() { return byId("planningCurrency")?.value || ""; }
function planRate() { const rate=Number(byId("exchangeRate")?.value); return Number.isFinite(rate)&&rate>0?rate:NaN; }
function planMoney(amountBdt) { const currency=planCurrency(),rate=planRate(); if(!currency||!Number.isFinite(rate)||!Number.isFinite(amountBdt))return "Not available"; return `${new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(Finance.convert(amountBdt,"BDT",currency,{BDT:rate,[currency]:1}))} ${currency}`; }
function toBdtAmount(value, rate=planRate()) { if(value===""||value==null)return ""; const amount=Number(value),currency=planCurrency(); if(!Number.isFinite(amount)||!Number.isFinite(rate)||!currency)return value; try{return String(Finance.convert(amount,currency,"BDT",{BDT:rate,[currency]:1}));}catch{return amount<0?value:"Infinity";} }
function updatePlanCurrencyLabels() { const currency=planCurrency(); const full=currency?`${Finance.CURRENCY_SYMBOLS[currency]||""} ${Finance.CURRENCY_NAMES[currency]} · ${currency}`.trim():"selected currency"; document.querySelectorAll("[data-plan-currency]").forEach(node=>{node.textContent=full;}); byId("rateCurrencyLabel").textContent=currency?`(BDT per ${currency})`:"(BDT per selected currency)"; }
function localDateTimeForInput(timestamp) { const d = new Date(timestamp); return `${localDate(d)}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function setExchangeRateStatus(message, state = "") { const status = byId("exchangeRateStatus"); status.textContent = message; status.dataset.state = state; }
function isFetchedExchangeRateStale(data, nowMs = Date.now()) { return !data || data.stale === true || !Number.isFinite(data.nextUpdateAtMs) || nowMs >= data.nextUpdateAtMs; }
function renderFetchedRateStatus(prefix = "") {
  const data = exchangeRateState.lastResponse;
  const currency = planCurrency();
  const useButton = byId("useExchangeRate");
  if (currency === "BDT") { useButton.hidden=true; useButton.disabled=true; useButton.textContent="No conversion needed"; setExchangeRateStatus("This plan is in BDT. No currency conversion is needed.","success"); return; }
  if (!currency) { useButton.hidden=true; useButton.disabled=true; setExchangeRateStatus("Choose a planning currency before entering financial information."); return; }
  if (!data) { useButton.hidden = true; useButton.disabled = true; setExchangeRateStatus(prefix || "No official rate loaded. Manual rate entry is available; use Refresh to retrieve Bangladesh Bank data."); return; }
  const appliedIsStale = exchangeRateState.mode === "api" && (isFetchedExchangeRateStale(data) || exchangeRateState.appliedNextUpdateAtMs && Date.now() >= exchangeRateState.appliedNextUpdateAtMs);
  if (appliedIsStale) {
    latest = null;
    renderContributionRoadmap(null);
    const message = "The Bangladesh Bank rate currently in use is stale. Refresh the official sheet or enter a current rate manually before calculating.";
    byId("formError").textContent = message;
    byId("plannerResults").innerHTML = `<p class="error">${message}</p>`;
  }
  const stale = isFetchedExchangeRateStale(data);
  const rate = data.rates[currency];
  const applied = exchangeRateState.mode === "api" && exchangeRateState.appliedCurrency === currency && exchangeRateState.appliedUpdatedAtMs === data.updatedAtMs;
  useButton.hidden = stale;
  useButton.disabled = stale;
  useButton.textContent = stale ? "Bangladesh Bank rate is stale" : applied ? "Official rate in use" : `Use Bangladesh Bank ${currency} ask`;
  if (stale) {
    setExchangeRateStatus(`${prefix ? `${prefix} ` : ""}The Bangladesh Bank data is stale${String(data.cacheStatus || "").toUpperCase()==="STALE"?" in Vercel's cache":""}. Sheet date: ${data.publicationDate}; retrieved: ${data.retrievedAt} (UTC). Data is also treated as stale after ${data.staleAfterDays} days without a newer sheet or ${data.retrievalStaleAfterHours} hours without a successful retrieval. It cannot be applied as current; use a manual rate or refresh.`, "stale");
  } else if (!Number.isFinite(rate) || !data.rateDetails[currency]) {
    const note = `Bangladesh Bank does not publish a ${Finance.CURRENCY_NAMES[currency] || currency} (${currency}) rate in this feed. Enter a rate manually with its source and timestamp. No rate was invented.`;
    setExchangeRateStatus(`${prefix ? `${prefix} ` : ""}${note}`, "unavailable");
  } else {
    const selection = appliedIsStale ? "A newer response is available but has not been applied; current planner results are cleared." : applied ? "This Bangladesh Bank rate is selected." : "Review it, then choose the button to apply it.";
    const detail = data.rateDetails[currency];
    const war = currency === "USD" && detail.weightedAverage !== null ? ` USD weighted average: ${detail.weightedAverage.toFixed(4)} BDT.` : "";
    setExchangeRateStatus(`${prefix ? `${prefix} ` : ""}${data.source} (${data.sourceUrl}). Publication date: ${data.publicationDate}. Retrieved: ${data.retrievedAt} (UTC). ${detail.currencyCode}/BDT ${detail.rateType}; bid ${detail.bid.toFixed(4)}, ask ${detail.ask.toFixed(4)}.${war} Planner uses the ask as an estimate: 1 ${detail.currencyCode} = ${rate.toFixed(5)} BDT. This is not a bank/provider payment quote. ${selection}`, "success");
  }
  if (exchangeRateState.staleTimer) clearTimeout(exchangeRateState.staleTimer);
  const appliedExpiry = exchangeRateState.mode === "api" ? exchangeRateState.appliedNextUpdateAtMs : null;
  const futureExpiries = [data.nextUpdateAtMs, appliedExpiry].filter(timestamp => timestamp && timestamp > Date.now());
  if (futureExpiries.length) exchangeRateState.staleTimer = setTimeout(() => { if (!exchangeRateState.pending) renderFetchedRateStatus(); }, Math.min(...futureExpiries) - Date.now());
}
async function refreshExchangeRate() {
  if (exchangeRateState.pending) return;
  if (!planCurrency() || planCurrency() === "BDT") return;
  const now = Date.now();
  if (ExchangeRates.isWithinCacheWindow(exchangeRateState.lastResponse, now) && !isFetchedExchangeRateStale(exchangeRateState.lastResponse, now)) {
    renderFetchedRateStatus("Using the last successful Bangladesh Bank response; its 24-hour cache window has not expired, so no new request was sent.");
    return;
  }
  if (now < exchangeRateState.nextRequestAt) {
    setExchangeRateStatus(`Refresh is temporarily limited; try again after ${new Date(exchangeRateState.nextRequestAt).toLocaleTimeString()}. Your last valid rate remains available.`, "stale");
    return;
  }
  exchangeRateState.pending = true;
  const refreshButton = byId("refreshExchangeRate");
  refreshButton.disabled = true;
  setExchangeRateStatus("Loading Bangladesh Bank's official published rate sheet…");
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 15000);
  try {
    const data = await ExchangeRates.fetchLatestRates({ signal: controller?.signal });
    exchangeRateState.lastResponse = data;
    const completedAt = Date.now();
    const responseIsStale = isFetchedExchangeRateStale(data, completedAt);
    exchangeRateState.nextRequestAt = completedAt + (responseIsStale ? FX_FAILED_RETRY_DELAY : FX_MIN_REQUEST_INTERVAL);
    renderFetchedRateStatus(responseIsStale ? `The response is stale. Retry after ${new Date(exchangeRateState.nextRequestAt).toLocaleTimeString()}.` : "");
  } catch (error) {
    exchangeRateState.nextRequestAt = Date.now() + FX_FAILED_RETRY_DELAY;
    const detail = error?.name === "AbortError" ? "The request timed out." : error?.message || "The exchange-rate request failed.";
    const retryNotice = `Retry after ${new Date(exchangeRateState.nextRequestAt).toLocaleTimeString()}.`;
    if (exchangeRateState.lastResponse) renderFetchedRateStatus(`Refresh failed (${detail}). ${retryNotice}`);
    else setExchangeRateStatus(`${detail} ${retryNotice} Your entered/manual rate has not been changed. You can enter or keep a manual rate.`, "error");
  } finally {
    clearTimeout(timeout);
    exchangeRateState.pending = false;
    refreshButton.disabled = false;
  }
}
function useFetchedExchangeRate() {
  const data = exchangeRateState.lastResponse;
  const currency = planCurrency();
  if (isFetchedExchangeRateStale(data)) { renderFetchedRateStatus(); return; }
  const rate = data.rates[currency];
  if (!Number.isFinite(rate) || !data.rateDetails[currency]) { renderFetchedRateStatus(); return; }
  byId("exchangeRate").value = String(rate);
  byId("rateSource").value = `${data.source}; ${data.rateDetails[currency].rateType}; publication ${data.publicationDate}; ASK`;
  byId("rateTimestamp").value = localDateTimeForInput(data.updatedAtMs);
  syncRateTimestampPicker();
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
  restoredRateProvenance = "";
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
  syncRateTimestampPicker();
  setExchangeRateStatus(`Manual rate entry selected. Use your rate for 1 ${planCurrency() || "selected currency"} = BDT, and provide its source and local timestamp.`, "");
}
function profile() {
  const c = corridorMap[byId("corridor").value];
  const manualSavings = byId("savings").value;
  const rate=planRate(),selectedCurrency=planCurrency(),otherSavingsBdt=toBdtAmount(manualSavings,rate);
  const accountBalancesBdt=bankAccounts.map(account=>Number(toBdtAmount(account.balance,rate)));
  const savings = manualSavings === "" && bankAccounts.length === 0 ? "" : String((Number(otherSavingsBdt)||0)+accountBalancesBdt.reduce((sum,balance)=>sum+balance,0));
  const costFields = ["visaCost", "applicationCost", "flightCost", "insuranceCost", "documentCost", "accommodationDeposit", "initialSetupCost", "otherOneTimeCosts", "initialLivingMonths", "monthlyRent", "monthlyFood", "monthlyTransport", "monthlyUtilities", "monthlyOtherLiving"];
  const normalizedFields=Object.fromEntries(costFields.filter(id=>id!=="initialLivingMonths").map(id=>[id,toBdtAmount(byId(id).value,rate)]));
  return { homeCountry: "Bangladesh", destinationCountry: c.country, homeCur: "BDT", tuitionCur: selectedCurrency, tuition: byId("tuition").value, exchangeRate: byId("exchangeRate").value, rateSource: byId("rateSource").value, rateTimestamp: byId("rateTimestamp").value, rateProvenance: exchangeRateState.mode === "api" ? "Bangladesh Bank official reference rate; not a tuition-payment quote" : restoredRateProvenance || (selectedCurrency==="BDT"?"Same-currency conversion; fixed at 1 BDT per BDT":"User-provided manual rate; not independently verified"), planningMode: document.querySelector('input[name="planningMode"]:checked')?.value || Finance.PLANNING_MODES.ALL_COSTS, savings, otherSavings: otherSavingsBdt, accountBalances: accountBalancesBdt, emergency: toBdtAmount(byId("emergency").value,rate), committed: toBdtAmount(byId("committed").value||0,rate), income: toBdtAmount(byId("income").value,rate), expenses: toBdtAmount(byId("expenses").value,rate), paymentFee: toBdtAmount(byId("paymentFee").value||0,rate), ...normalizedFields, initialLivingMonths: byId("initialLivingMonths").value, deadline: byId("deadline").value };
}
function updatePlanningModeUI() {
  const mode = document.querySelector('input[name="planningMode"]:checked')?.value || Finance.PLANNING_MODES.ALL_COSTS;
  document.querySelectorAll('input[name="planningMode"]').forEach(input => input.closest(".planningModeCard")?.classList.toggle("isSelected", input.checked));
  const excluded = mode === Finance.PLANNING_MODES.TUITION_ONLY;
  for (const id of ["visaCost", "applicationCost", "flightCost", "insuranceCost", "documentCost", "accommodationDeposit", "initialSetupCost", "otherOneTimeCosts", "initialLivingMonths", "monthlyRent", "monthlyFood", "monthlyTransport", "monthlyUtilities", "monthlyOtherLiving"]) byId(id).closest("fieldset").hidden = excluded;
  byId("planningModeNote").textContent = excluded
    ? "Tuition Only includes tuition and entered payment/transfer fees. Other one-time and living costs are excluded; this is not a complete study-abroad budget."
    : "Optional cost estimates left blank are not included in the total.";
}
function renderBankAccounts() {
  const list = byId("bankAccountList");
  list.replaceChildren(...bankAccounts.map(account => {
    const item = document.createElement("li");
    const text = document.createElement("span"); text.textContent = `${account.label} — ${money(account.balance)}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "button smallbtn"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${account.label}`);
    remove.addEventListener("click", () => { bankAccounts = bankAccounts.filter(entry => entry.id !== account.id); renderBankAccounts(); if (latest) compute(); });
    item.append(text, document.createTextNode(" "), remove);
    return item;
  }));
  byId("bankAccountTotal").textContent = `Added account balances: ${planCurrency()?`${new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(BankAccounts.totalBalance(bankAccounts))} ${planCurrency()}`:"0"}. The planner adds listed balances to other savings.`;
}
byId("addBankAccount").addEventListener("click", () => {
  if (bankAccounts.length >= 50) { byId("bankAccountError").textContent = "You can add up to 50 manual savings balances."; return; }
  const validated = BankAccounts.validateAccount({ label: byId("bankAccountLabel").value, balance: byId("bankAccountBalance").value });
  byId("bankAccountError").textContent = validated.ok ? "" : validated.error;
  if (!validated.ok) return;
  bankAccounts.push({ id: nextBankAccountId++, ...validated.account });
  byId("bankAccountLabel").value = ""; byId("bankAccountBalance").value = "";
  renderBankAccounts(); if (latest) compute();
});
renderBankAccounts();
function refreshRate() { updatePlanCurrencyLabels(); if(planCurrency()==="BDT"){if(byId("exchangeRate").value!=="1")byId("exchangeRate").value="1";if(byId("rateSource").value!=="Same-currency conversion: 1 BDT = 1 BDT")byId("rateSource").value="Same-currency conversion: 1 BDT = 1 BDT";if(!byId("rateTimestamp").value)byId("rateTimestamp").value=localDateTimeForInput(Date.now());exchangeRateState.mode="manual";exchangeRateState.appliedCurrency=null;exchangeRateState.appliedUpdatedAtMs=null;exchangeRateState.appliedNextUpdateAtMs=null;renderFetchedRateStatus();} }
function logEvent(tool, status, summary) {
  activity.unshift({ at: new Date().toLocaleString(), tool, status, summary }); activity = activity.slice(0, 20); renderLog();
}
function renderLog() { const list = byId("activityLog"); list.replaceChildren(...activity.map(e => { const li=document.createElement("li"); li.textContent=`${e.at} · ${e.tool} · ${e.status} · ${e.summary}`; return li; })); }
function renderPlannerResultsSummary(input, result, roadmap, options) {
  const summary = window.CampusBridgePlannerResults.summarize(result, roadmap, input.deadline);
  const deadline = new Date(`${summary.deadline}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const goalCurrency = "";
  const schedule = summary.state === "covered"
    ? `<p class="small">No additional contribution is required for the entered cost estimate.</p>`
    : summary.state === "no-dates"
      ? `<p class="small">No contribution schedule is available because no complete 30-day contribution date remains.</p>`
      : summary.state === "informational"
        ? `<p class="small">A contribution schedule is unavailable until the dated roadmap can confirm it. Review the roadmap section below.</p>`
      : `<p class="small">Required contribution schedule:<br><strong>${options.monthlyTargetText}</strong><br>${summary.contributionCycles} complete 30-day contribution cycle(s)</p>${summary.contributionDates.length ? `<ul class="resultContributionDates">${summary.contributionDates.map(item => `<li><time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time><span>Cycle ${item.cycle}: ${money(item.amountBdt)}</span></li>`).join("")}</ul>` : summary.scheduleAvailable ? `<p class="small muted">The roadmap contains too many dates to list here. See the dated savings contribution roadmap below.</p>` : ""}`;
  const statusLabel = summary.state === "covered" ? "Goal covered" : summary.state === "shortfall" || summary.state === "no-dates" ? "Funding gap remains" : summary.state === "informational" ? "Projection needs review" : "Projected under current assumptions";
  const details = `<details class="resultDetails"><summary>Calculation details and assumptions</summary><div class="metricGrid"><div class="metric"><span>${options.tuitionOnly ? "Other study costs" : "Additional cost estimates"}</span><strong>${options.tuitionOnly ? "Excluded in Tuition Only mode" : `${money(result.estimatedOtherCosts)}`}</strong></div><div class="metric"><span>Total savings entered</span><strong>${money(result.savings)}</strong></div><div class="metric"><span>Monthly surplus</span><strong>${money(result.disposable)}</strong></div><div class="metric"><span>Projected savings capacity</span><strong>${money(result.capacity)}</strong></div><div class="metric"><span>Projected shortfall</span><strong>${money(result.shortfall)}</strong></div></div><p class="small muted">Protected emergency fund: ${money(result.emergency)}. Committed savings excluded: ${money(result.committed)}. Usable funds are savings minus those amounts.</p><div class="resultAssumptions"><h3>What this estimate uses</h3><p>Tuition × your entered rate (${result.rate.toFixed(4)} BDT per ${result.tuitionCurrency})${options.tuitionOnly ? ", plus entered payment/transfer fees only. Other one-time and initial living costs are excluded." : ", payment/transfer fees, entered one-time costs, and entered initial living costs. All plan inputs are entered in the selected planning currency and normalized to BDT for calculation. The Bangladesh Bank rate is an official reference, not a payment quote. Do not count an expense in more than one field."} It assumes your full current monthly surplus is available to save; actual costs and payment terms may differ.</p><dl><dt>Rate source</dt><dd>${escapeHtml(input.rateSource)}</dd><dt>Rate timestamp (local time)</dt><dd>${escapeHtml(input.rateTimestamp)}</dd><dt>Rate verification</dt><dd>${escapeHtml(input.rateProvenance)}</dd><dt>Projected shortfall</dt><dd>${money(result.shortfall)} over ${result.contributionCycles} complete 30-day savings cycle(s)</dd></dl><p class="small muted">This is a planning estimate, not an invoice or guaranteed payment amount. CampusBridge does not independently verify your rate and excludes costs you did not enter.</p></div></details>`;
  byId("plannerResults").innerHTML = `<section class="plannerResultSummary" aria-label="Financial plan summary"><p class="assumptionNote">${options.tuitionOnly ? "Tuition Only includes tuition and entered payment/transfer fees; it excludes other study-abroad costs and is not a full readiness result." : "All Study-Abroad Costs includes only additional estimates entered. Blank estimates are not included."}</p><div class="resultGoal"><span class="resultEyebrow">Education Funding Goal</span><strong>${money(summary.fundingGoalBdt)}</strong>${goalCurrency}<div class="progressTrack" role="img" aria-label="${Math.round(summary.fundedRatio * 100)} percent of estimated need covered by available savings"><i style="width:${Math.round(summary.fundedRatio * 100)}%"></i></div><p class="small muted">${Math.round(summary.fundedRatio * 100)}% covered by available savings</p></div><span class="statusPill resultStatus ${summary.state}">${statusLabel}</span><p class="resultRealism ${summary.state}" role="status">${summary.message}</p><div class="metricGrid resultKeyMetrics"><div class="metric"><span>Available Savings</span><strong>${money(summary.availableSavingsBdt)}</strong><small>After emergency reserve and committed savings</small></div><div class="metric ${summary.fundingGapBdt === 0 ? "covered" : "hasGap"}"><span>${options.tuitionOnly ? "Tuition Funding Gap" : "Funding Gap"}</span><strong>${money(summary.fundingGapBdt)}</strong></div></div><div class="resultDeadline"><span>Deadline</span><strong>${escapeHtml(deadline)}</strong><small>${summary.daysRemaining} ${summary.daysRemaining === 1 ? "day" : "days"} remaining</small></div><section class="resultSavingsPlan" aria-labelledby="resultSavingsPlanTitle"><h3 id="resultSavingsPlanTitle">Savings Plan</h3>${schedule}</section>${details}<h3>Suggested next steps</h3><ol class="small muted"><li>${options.priorities[0]}</li><li>${options.priorities[1]}</li><li>${options.priorities[2]}</li></ol></section>`;
  byId("plannerResults").append(renderFinancialCharts(window.CampusBridgePlannerResults.charts(result, roadmap), "planner-results"));
}
function renderFinancialCharts(chartData, idPrefix) {
  const section=document.createElement("section");section.className="financialCharts";section.setAttribute("aria-label","Funding charts");
  const title=document.createElement("h3");title.className="financialChartsTitle";title.textContent="Funding at a glance";section.append(title);
  if(!chartData?.ok){const note=document.createElement("p");note.className="financialChartUnavailable";note.textContent=`Charts unavailable: ${chartData?.reason||"validated financial figures are not available."}`;section.append(note);return section;}
  const svgNS="http://www.w3.org/2000/svg";
  const svgEl=(name,attrs={},text="")=>{const el=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text)el.textContent=text;return el;};
  const grid=document.createElement("div");grid.className="financialChartsGrid";
  const columnsFigure=document.createElement("figure");columnsFigure.className="financialChart financialColumnChart";
  const columnsCaption=document.createElement("figcaption");columnsCaption.textContent="Funding comparison";columnsFigure.append(columnsCaption);
  const columnsSvg=svgEl("svg",{viewBox:"0 0 360 205",role:"img","aria-labelledby":`${idPrefix}-columns-title ${idPrefix}-columns-desc`});
  columnsSvg.append(svgEl("title",{id:`${idPrefix}-columns-title`},`Education funding amounts in ${planCurrency()||"BDT"}`));
  columnsSvg.append(svgEl("desc",{id:`${idPrefix}-columns-desc`},chartData.columns.map(item=>`${item.label}: ${money(item.amountBdt)}`).join(". ")));
  columnsSvg.append(svgEl("line",{x1:20,y1:160,x2:340,y2:160,class:"chartBaseline"}));
  const barX=[49,154,259];
  chartData.columns.forEach((column,index)=>{
    const barHeight=column.heightPercent*1.3,x=barX[index],y=160-barHeight;
    columnsSvg.append(svgEl("rect",{x,y,width:52,height:barHeight,rx:6,class:`financialBar ${column.key}`}));
    columnsSvg.append(svgEl("text",{x:x+26,y:181,"text-anchor":"middle",class:"chartAxisLabel"},["Goal","Savings","Gap"][index]));
  });
  columnsFigure.append(columnsSvg);
  const columnLegend=document.createElement("ul");columnLegend.className="financialChartLegend";
  chartData.columns.forEach(column=>{const item=document.createElement("li"),swatch=document.createElement("span"),label=document.createElement("span"),amount=document.createElement("strong");swatch.className=`chartSwatch ${column.key}`;swatch.setAttribute("aria-hidden","true");label.textContent=column.label;amount.textContent=money(column.amountBdt);item.append(swatch,label,amount);columnLegend.append(item);});
  columnsFigure.append(columnLegend);

  const coverageFigure=document.createElement("figure");coverageFigure.className="financialChart financialCoverageChart";
  const coverageCaption=document.createElement("figcaption");coverageCaption.textContent="Goal coverage";coverageFigure.append(coverageCaption);
  const coverageSvg=svgEl("svg",{viewBox:"0 0 200 200",role:"img","aria-labelledby":`${idPrefix}-coverage-title ${idPrefix}-coverage-desc`});
  coverageSvg.append(svgEl("title",{id:`${idPrefix}-coverage-title`},"Covered portion and remaining funding gap"));
  coverageSvg.append(svgEl("desc",{id:`${idPrefix}-coverage-desc`},`${chartData.coveredPercent}% covered. ${chartData.remainingPercent}% remains as a funding gap of ${money(chartData.fundingGapBdt)}.`));
  const ring=svgEl("g",{transform:"rotate(-90 100 100)"});
  ring.append(svgEl("circle",{cx:100,cy:100,r:67,pathLength:100,class:"coverageRingRemaining"}));
  ring.append(svgEl("circle",{cx:100,cy:100,r:67,pathLength:100,"stroke-dasharray":`${chartData.coveredPercent} ${chartData.remainingPercent}`,class:"coverageRingCovered"}));coverageSvg.append(ring);
  coverageSvg.append(svgEl("text",{x:100,y:96,"text-anchor":"middle",class:"coveragePercent"},`${chartData.coveredPercent}%`));
  coverageSvg.append(svgEl("text",{x:100,y:116,"text-anchor":"middle",class:"coverageCenterLabel"},"covered"));coverageFigure.append(coverageSvg);
  const coverageLegend=document.createElement("ul");coverageLegend.className="financialChartLegend";
  [["covered","Covered portion",`${chartData.coveredPercent}% of goal`],["gap","Remaining funding gap",`${chartData.remainingPercent}% · ${money(chartData.fundingGapBdt)}`]].forEach(([key,label,value])=>{const item=document.createElement("li"),swatch=document.createElement("span"),name=document.createElement("span"),amount=document.createElement("strong");swatch.className=`chartSwatch ${key}`;swatch.setAttribute("aria-hidden","true");name.textContent=label;amount.textContent=value;item.append(swatch,name,amount);coverageLegend.append(item);});
  coverageFigure.append(coverageLegend);grid.append(columnsFigure,coverageFigure);section.append(grid);
  const note=document.createElement("p");note.className="financialChartNote";note.textContent=chartData.projectionConfirmed?"Charts show current validated values only; future contributions are not included.":"Roadmap reachability is unconfirmed. Charts show current validated values only; no future savings are projected.";section.append(note);
  return section;
}
function compute() {
  if(!planCurrency()){byId("formError").textContent="Choose a planning currency before entering financial information.";byId("plannerResults").innerHTML='<p class="muted">Choose a planning currency to begin your plan.</p>';return;}
  refreshRate();
  const activeCurrency = planCurrency();
  if (exchangeRateState.mode === "api" && (exchangeRateState.appliedCurrency !== activeCurrency || !exchangeRateState.appliedNextUpdateAtMs || Date.now() >= exchangeRateState.appliedNextUpdateAtMs || isFetchedExchangeRateStale(exchangeRateState.lastResponse))) {
    PlanState?.clearPlan();
    latest = null;
    renderContributionRoadmap(null);
    clearStressTestResults(); byId("readinessReportPreview").hidden = true; latestReadinessReportProfile = null;
    const message = "The Bangladesh Bank rate currently in use is stale or for a different corridor. Refresh the official sheet or enter one manually before calculating.";
    byId("formError").textContent = message;
    byId("plannerResults").innerHTML = `<p class="error">${message}</p>`;
    renderFetchedRateStatus();
    return;
  }
  const enteredProfile = profile();
  const input = Finance.profileForPlanningMode(enteredProfile, enteredProfile.planningMode);
  if (latestStressTest && JSON.stringify(latestStressTest.profile) !== JSON.stringify(input)) clearStressTestResults();
  if (latestReadinessReportProfile && JSON.stringify(latestReadinessReportProfile) !== JSON.stringify(input)) { byId("readinessReportPreview").hidden = true; latestReadinessReportProfile = null; }
  const calculationDate = new Date();
  const result = Finance.calculateTuition(input, calculationDate);
  if (!result.ok) { PlanState?.clearPlan(); latest = null; renderContributionRoadmap(null); clearStressTestResults(); byId("readinessReportPreview").hidden = true; latestReadinessReportProfile = null; byId("deadlineTrigger").setAttribute("aria-invalid", String(!input.deadline)); byId("formError").textContent = result.errors.join(" "); byId("plannerResults").innerHTML = '<p class="muted">Enter your figures and a current, source-identified exchange rate to calculate.</p>'; return; }
  const roadmap = Finance.buildContributionRoadmap(input, result, calculationDate);
  const savedPlan = PlanState?.savePlan(enteredProfile);
  byId("formError").textContent = savedPlan?.ok === false ? "The calculation is ready, but this browser could not save the plan for the other pages. Check browser session-storage settings and try again." : ""; latest = { input, result, roadmap, profile: enteredProfile }; renderContributionRoadmap(roadmap,input.planningMode); const tuitionOnly = input.planningMode === Finance.PLANNING_MODES.TUITION_ONLY;
  const priorities = result.gap === 0 ? ["Keep the emergency reserve protected.","Confirm the university payment deadline and instructions.","Refresh assumptions before paying."] : [result.shortfall > 0 ? "Close the projected shortfall: current savings capacity is not enough." : "Set aside the monthly target before the tuition deadline.", "Verify the payment route and any institution-specific fees.", "Keep emergency savings and committed funds separate from tuition."];
  const monthlyTargetText = result.gap === 0 ? Finance.describeMonthlySavingsTarget(result).message : contributionScheduleText(result);
  const destinationCosts = Number.isFinite(result.estimatedOtherCosts / result.rate) ? money(result.estimatedOtherCosts / result.rate, result.tuitionCurrency) : "Not available";
  const destinationTotal = Number.isFinite(result.requiredFunds / result.rate) ? money(result.requiredFunds / result.rate, result.tuitionCurrency) : "Not available";
  renderPlannerResultsSummary(input, result, roadmap, { tuitionOnly, destinationCosts, destinationTotal, monthlyTargetText, priorities });
  const reportAction = document.createElement("div"); reportAction.className = "resultsReportAction";
  const reportCopy = document.createElement("div"), reportHeading = document.createElement("strong"), reportHint = document.createElement("p");
  reportHeading.textContent = "Take this plan with you"; reportHint.textContent = "Review an A4 report, then print it or save it as a PDF."; reportCopy.append(reportHeading, reportHint);
  const reportButton = document.createElement("button"); reportButton.className = "button primary"; reportButton.type = "button"; reportButton.textContent = "Create print-ready report"; reportButton.addEventListener("click", generateReadinessReport);
  const saveRoadmapButton = document.createElement("button"); saveRoadmapButton.className = "button"; saveRoadmapButton.type = "button"; saveRoadmapButton.textContent = "Save Roadmap";
  saveRoadmapButton.addEventListener("click", () => { const dialog = byId("save-roadmap-dialog"); if (dialog?.showModal) { dialog.showModal(); byId("save-roadmap-name").focus(); } else byId("formError").textContent = "Roadmap saving is unavailable in this browser."; });
  reportAction.append(reportCopy, reportButton, saveRoadmapButton); byId("plannerResults").append(reportAction);
  window.CampusBridgePlannerLatest = () => latest ? { profile: latest.profile || latest.input } : null;
  logEvent("calculate_tuition_gap", "success", "Tuition affordability calculation completed; financial values omitted");
  renderTransfers();
}
function initializeQuoteTimestampPicker(input) {
  const label = input.closest("label");
  label.classList.add("quoteTimestampLabel");
  const required = label.querySelector(".quoteRequired");
  const picker = document.createElement("span");
  picker.className = "timestampPicker quoteTimestampPicker";
  picker.innerHTML = '<span class="timestampControl"><button class="deadlineTrigger timestampTrigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-required="true"><span class="deadlineTriggerText timestampTriggerText"><small>QUOTE DATE &amp; TIME</small><span data-role="display">Choose date and time</span></span><span class="deadlineTriggerIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span></button></span><div class="timestampCalendar" role="dialog" aria-label="Choose quote date and time" hidden><div class="calendarNav"><strong class="calendarMonth" data-role="month"></strong><div class="calendarNavButtons"><button type="button" data-action="previous" aria-label="Previous month">‹</button><button type="button" data-action="next" aria-label="Next month">›</button></div></div><div class="calendarWeekdays" aria-hidden="true"><span class="calendarWeekday">Su</span><span class="calendarWeekday">Mo</span><span class="calendarWeekday">Tu</span><span class="calendarWeekday">We</span><span class="calendarWeekday">Th</span><span class="calendarWeekday">Fr</span><span class="calendarWeekday">Sa</span></div><div class="calendarDays" data-role="days" role="grid"></div><div class="timestampTime"><div><span class="timestampTimeLabel">Local time</span><input data-role="time" type="time" step="60" aria-label="Quote time in your local time"></div><button class="timestampNow" type="button" data-action="now">Use now</button></div><div class="calendarFooter"><div class="calendarSelection" data-role="selection" aria-live="polite"></div><div class="calendarActions"><button class="calendarAction" type="button" data-action="clear">Clear</button><button class="calendarAction primary" type="button" data-action="today">Today</button></div></div></div>';
  input.classList.add("quoteTimestampInput");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.before(picker);
  picker.prepend(input);
  if (required) {
    required.id = `${input.closest("[data-provider]").dataset.provider}-quote-timestamp-required`;
    picker.querySelector(".timestampTrigger").setAttribute("aria-describedby", required.id);
  }
  const trigger = picker.querySelector(".timestampTrigger");
  const calendar = picker.querySelector(".timestampCalendar");
  const monthLabel = picker.querySelector('[data-role="month"]');
  const dayGrid = picker.querySelector('[data-role="days"]');
  const timeInput = picker.querySelector('[data-role="time"]');
  const display = picker.querySelector('[data-role="display"]');
  const selection = picker.querySelector('[data-role="selection"]');
  let cursor = new Date();
  let focusedDate = null;
  const close = (restoreFocus = false) => {
    calendar.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };
  const sync = () => {
    const value = input.value;
    if (!value) { display.textContent = "Choose date and time"; trigger.setAttribute("aria-invalid", "false"); return; }
    const [datePart, timePart] = value.split("T");
    const date = new Date(`${datePart}T00:00:00`);
    if (Number.isNaN(date.getTime()) || !timePart) { trigger.setAttribute("aria-invalid", "true"); return; }
    const datetime = new Date(`${datePart}T${timePart}`);
    const time = Number.isNaN(datetime.getTime()) ? timePart : new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(datetime);
    display.textContent = `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)} · ${time}`;
    trigger.setAttribute("aria-invalid", "false");
    if (!calendar.hidden) render(datePart);
  };
  const render = (focusDate = null) => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const selected = input.value ? input.value.split("T")[0] : "";
    monthLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor);
    dayGrid.setAttribute("aria-label", monthLabel.textContent);
    const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
    const fragment = document.createDocumentFragment();
    let week;
    for (let index = 0; index < 42; index += 1) {
      if (index % 7 === 0) { week = document.createElement("div"); week.className = "calendarWeek"; week.setAttribute("role", "row"); fragment.append(week); }
      const date = new Date(start); date.setDate(start.getDate() + index);
      const iso = localDate(date), outside = date.getMonth() !== month, button = document.createElement("button");
      button.type = "button"; button.className = "calendarDay"; button.textContent = String(date.getDate()); button.dataset.iso = iso;
      button.setAttribute("role", "gridcell"); button.setAttribute("aria-label", new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date)); button.setAttribute("aria-selected", String(iso === selected));
      if (outside) button.classList.add("isOutside");
      if (iso === localDate(new Date())) button.classList.add("isToday");
      if (iso === selected) button.classList.add("isSelected");
      if (iso === focusDate) button.tabIndex = 0;
      button.addEventListener("click", () => {
        const time = timeInput.value || localDateTimeForInput(Date.now()).split("T")[1];
        input.value = `${iso}T${time}`; sync();
        const strong = document.createElement("strong"); strong.textContent = `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)} · ${time}`;
        selection.replaceChildren(document.createTextNode("Selected date and time"), strong);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        dayGrid.querySelector(`[data-iso="${iso}"]`)?.focus();
      });
      week.append(button);
    }
    dayGrid.replaceChildren(fragment);
    picker.querySelector('[data-action="previous"]').disabled = year <= 1 && month === 0;
    picker.querySelector('[data-action="next"]').disabled = year >= 9999 && month === 11;
    const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null;
    const strong = document.createElement("strong");
    selection.replaceChildren(document.createTextNode(selected ? "Selected date and time" : "Select a quote date"));
    strong.textContent = selectedDate ? `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selectedDate)}${input.value.split("T")[1] ? ` · ${input.value.split("T")[1]}` : ""}` : "Choose date and time";
    selection.append(strong);
  };
  trigger.addEventListener("click", () => {
    if (!calendar.hidden) { close(); return; }
    const value = input.value, datePart = value ? value.split("T")[0] : localDate(new Date());
    const date = new Date(`${datePart}T00:00:00`);
    cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    timeInput.value = value ? value.split("T")[1] : localDateTimeForInput(Date.now()).split("T")[1];
    focusedDate = datePart; render(datePart); calendar.hidden = false; trigger.setAttribute("aria-expanded", "true");
    dayGrid.querySelector(`[data-iso="${focusedDate}"]`)?.focus();
  });
  picker.querySelector('[data-action="previous"]').addEventListener("click", () => { cursor.setMonth(cursor.getMonth() - 1); render(focusedDate); });
  picker.querySelector('[data-action="next"]').addEventListener("click", () => { cursor.setMonth(cursor.getMonth() + 1); render(focusedDate); });
  timeInput.addEventListener("input", () => {
    const datePart = input.value ? input.value.split("T")[0] : localDate(new Date());
    input.value = `${datePart}T${timeInput.value}`; sync(); input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  picker.querySelector('[data-action="now"]').addEventListener("click", () => {
    input.value = localDateTimeForInput(Date.now()); sync(); input.dispatchEvent(new Event("input", { bubbles: true })); close(true);
  });
  picker.querySelector('[data-action="today"]').addEventListener("click", () => {
    const time = timeInput.value || localDateTimeForInput(Date.now()).split("T")[1];
    input.value = `${localDate(new Date())}T${time}`; sync(); input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  picker.querySelector('[data-action="clear"]').addEventListener("click", () => {
    input.value = ""; timeInput.value = ""; sync(); input.dispatchEvent(new Event("input", { bubbles: true })); close(true);
  });
  dayGrid.addEventListener("keydown", event => {
    const current = event.target.closest("[data-iso]");
    if (!current) return;
    const date = new Date(`${current.dataset.iso}T00:00:00`);
    const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7, Home: -date.getDay(), End: 6 - date.getDay() };
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (!(event.key in offsets)) return;
    event.preventDefault(); date.setDate(date.getDate() + offsets[event.key]); focusedDate = localDate(date);
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    render(focusedDate); dayGrid.querySelector(`[data-iso="${focusedDate}"]`)?.focus();
  });
  calendar.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); close(true); } });
  input.addEventListener("input", sync);
  sync();
}
function renderQuoteForms() {
  const root = byId("providerQuoteForms");
  for (const card of root.querySelectorAll("[data-provider]")) {
    const draft = {};
    for (const field of card.querySelectorAll("[data-field]")) draft[field.dataset.field] = field.value;
    quoteDrafts.set(card.dataset.provider, draft);
  }
  const currency = corridorMap[byId("corridor").value].currency;
  const visibleProviders = providerDefs.slice(0, visibleProviderCount);
  root.innerHTML = visibleProviders.map(provider => `<article class="quote" data-provider="${provider.id}"><span class="tag">Student-entered quote · not verified</span><h3>${provider.name}</h3><p>${provider.note}</p><label><span class="quoteLabelText">Quote recipient currency</span><select data-field="currency">${Finance.CURRENCIES.filter(code => code !== "BDT").map(code => `<option value="${code}">${Finance.CURRENCY_NAMES[code]} (${code})</option>`).join('')}</select></label><label><span class="quoteLabelText">Total sender cost (BDT) <span class="quoteRequired">Required</span></span><input data-field="total" type="number" min="0" step="any"></label><label><span class="quoteLabelText">Recipient amount <span class="quoteCurrency">(quote currency)</span> <span class="quoteRequired">Required</span></span><input data-field="recipient" type="number" min="0" step="any"></label><label><span class="quoteLabelText">Quote source or reference <span class="quoteRequired">Required</span></span><input data-field="reference" type="text" maxlength="160"></label><label><span class="quoteLabelText">Quote timestamp <span class="quoteRequired">Required · within 24 hours</span></span><input data-field="timestamp" type="datetime-local"></label><details class="quoteOptional"><summary>Optional quote details</summary><label><span class="quoteLabelText">Provider fees included in total (BDT)</span><input data-field="fee" type="number" min="0" step="any"></label><label><span class="quoteLabelText">Quoted rate (BDT per quote currency)</span><input data-field="rate" type="number" min="0" step="any"></label><label><span class="quoteLabelText">Estimated delivery (business days; needed to rank by speed)</span><input data-field="days" type="number" min="0" step="1"></label></details></article>`).join("");
  for (const card of root.querySelectorAll("[data-provider]")) {
    const draft = quoteDrafts.get(card.dataset.provider);
    const hasQuoteDetails = draft && Object.entries(draft).some(([field, value]) => field !== "currency" && value !== "");
    for (const field of card.querySelectorAll("[data-field]")) {
      if (draft?.[field.dataset.field] !== undefined && (field.dataset.field !== "currency" || hasQuoteDetails)) field.value = draft[field.dataset.field];
      else if (field.dataset.field === "currency") field.value = currency;
    }
    initializeCustomSelect(card.querySelector('[data-field="currency"]'));
    initializeQuoteTimestampPicker(card.querySelector('[data-field="timestamp"]'));
  }
  byId("quoteProgress").textContent = `${visibleProviders.length} of ${providerDefs.length} provider quote${providerDefs.length === 1 ? "" : "s"} shown`;
  byId("addQuoteProvider").hidden = visibleProviderCount >= providerDefs.length;
}
function enteredQuotes() {
  return providerDefs.slice(0, visibleProviderCount).map(provider => {
    const card = byId("providerQuoteForms").querySelector(`[data-provider="${provider.id}"]`);
    const get = field => card.querySelector(`[data-field="${field}"]`).value;
    return { id: provider.id, name: provider.name, currency: get("currency"), totalCost: get("total"), fee: get("fee"), quotedRate: get("rate"), recipientAmount: get("recipient"), days: get("days"), timestamp: get("timestamp"), reference: get("reference") };
  });
}
function currentQuoteComparison(){const cur=corridorMap[byId("corridor").value].currency;return Finance.compareEnteredQuotes({amount:byId("transferAmount").value,to:cur,sort:byId("sortBy").value},enteredQuotes());}
function renderTransfers(){const amount=byId("transferAmount").value,cur=corridorMap[byId("corridor").value].currency;const root=byId("transferResults");if(!amount||Number(amount)<=0){root.innerHTML='<p class="muted">Enter the same positive BDT principal used for all quotes.</p>';return;}const entered=enteredQuotes();if(entered.every(q=>q.totalCost===""&&q.recipientAmount===""&&q.reference==="")){root.innerHTML='<p class="muted">No provider quotes entered. Get current terms from your institution-approved provider or bank; nothing is estimated here.</p>';return;}const cmp=currentQuoteComparison();if(!cmp.ok){root.innerHTML=`<p class="error">${cmp.errors.join(" ")}</p>`;return;}const usable=cmp.available;if(!usable.length){root.innerHTML=`<p class="muted">No complete quotes can be ranked. ${cmp.unavailable.map(x=>`${escapeHtml(x.quote.name)}: ${escapeHtml(x.reason)}`).join(" ")}</p>`;return;}root.innerHTML=`<div class="quoteGrid">${usable.map((q,i)=>`<article class="quote"><span class="tag">${i===0?"Ranks first by selected objective · student-entered":"Student-entered quote"} · not provider-verified</span><h3>${escapeHtml(q.quote.name)}</h3><dl><dt>Total sender cost</dt><dd><strong>${money(q.totalCost,"BDT")}</strong></dd><dt>Principal</dt><dd>${money(Number(amount),"BDT")}</dd><dt>Stated provider fee</dt><dd>${q.fee?money(q.fee,"BDT"):"Not separately stated"}</dd><dt>Recipient amount</dt><dd><strong>${money(q.recipientAmount,cur)}</strong></dd><dt>Quoted rate</dt><dd>${q.quotedRate===null?"Not stated":`1 ${cur} = ${q.quotedRate.toFixed(5)} BDT`}</dd><dt>Delivery estimate</dt><dd>${q.days===null?"Not provided":`${q.days} business days`}</dd></dl><p>Source/reference: ${escapeHtml(q.reference)}. Quote timestamp: ${escapeHtml(q.timestamp)}. Validation does not authenticate this manually entered quote. Verify expiry and all terms on the provider’s official page before paying.</p></article>`).join("")}</div><p class="assumptionNote">${cmp.unavailable.map(x=>`${escapeHtml(x.quote.name)}: ${escapeHtml(x.reason)}`).join(" ")}</p>`;logEvent("compare_payment_options","success",`${usable.length} entered quotes ranked by ${byId("sortBy").selectedOptions[0].text.toLowerCase()}`);}
byId("profileForm").addEventListener("submit", e=>{e.preventDefault();planRequested=true;updateDeadlineHint();compute();});
function hasPlanEntries(){return ["tuition","savings","emergency","committed","income","expenses","paymentFee","visaCost","applicationCost","flightCost","insuranceCost","documentCost","accommodationDeposit","initialSetupCost","otherOneTimeCosts","initialLivingMonths","monthlyRent","monthlyFood","monthlyTransport","monthlyUtilities","monthlyOtherLiving","deadline"].some(id=>byId(id).value!=="")||bankAccounts.length>0||exchangeRateState.mode==="api"||planCurrency()!=="BDT"&&byId("rateSource").value!=="";}
function activatePlanningCurrency(currency){exchangeRateState.selectedCurrency=currency;byId("planningDetails").disabled=!currency;byId("planningDetails").hidden=!currency;updatePlanCurrencyLabels();if(currency==="BDT"){byId("planningCurrencyStatus").textContent="Financial entries will be in BDT. No conversion is needed.";refreshRate();}else{for(const id of ["exchangeRate","rateSource","rateTimestamp"])byId(id).value="";exchangeRateState.mode="manual";exchangeRateState.appliedCurrency=null;exchangeRateState.appliedUpdatedAtMs=null;exchangeRateState.appliedNextUpdateAtMs=null;byId("planningCurrencyStatus").textContent=`Financial entries will be in ${currency}. The exchange rate converts them to the BDT calculation base.`;renderFetchedRateStatus();refreshExchangeRate();}}
function handlePlanningCurrencyChange(){const selector=byId("planningCurrency"),next=selector.value,previous=exchangeRateState.selectedCurrency;if(!next||next===previous)return;if(previous&&hasPlanEntries()){const confirmed=window.confirm(`Changing the planning currency starts a new plan and clears the current plan inputs. Historical browser-saved roadmaps and account-saved plans remain unchanged in their original currencies. Continue?`);if(!confirmed){selector.value=previous;syncCustomSelect(selector);return;}PlanState?.clearPlan();byId("profileForm").reset();selector.value=next;syncCustomSelect(selector);byId("planningDetails").disabled=true;byId("planningDetails").hidden=true;planRequested=false;bankAccounts=[];nextBankAccountId=1;latest=null;clearStressTestResults();renderContributionRoadmap(null);byId("plannerResults").innerHTML='<p class="muted">Choose a planning currency, then enter your financial figures.</p>';byId("formError").textContent="";}activatePlanningCurrency(next);}
byId("planningCurrency").addEventListener("change",handlePlanningCurrencyChange);
byId("deadline").addEventListener("change",()=>{updateDeadlineHint();if(planRequested)compute();});
initializeCustomSelect(byId("corridor"));
initializeCustomSelect(byId("sortBy"));
initializeCustomSelect(byId("planningCurrency"));
byId("corridor").addEventListener("change",()=>{renderQuoteForms();renderTransfers();});
function applyStudyDestinationPreference(countryCode){
  const corridorCode=studyDestinationCorridors[countryCode],destination=corridorMap[corridorCode];
  if(!destination)return;
  const currencySelector=byId("planningCurrency"),corridorSelector=byId("corridor"),currentCurrency=planCurrency(),populated=hasPlanEntries();
  if(populated&&destination.currency!==currentCurrency){
    byId("planningCurrencyStatus").textContent=`Your saved destination is ${destination.country} (${destination.currency}), but your current ${currentCurrency} plan was kept unchanged. Clear or finish this plan before applying the destination currency.`;
    return;
  }
  corridorSelector.value=corridorCode;
  corridorSelector.dispatchEvent(new Event("change"));
  syncCustomSelect(corridorSelector);
  if(destination.currency!==currentCurrency){
    currencySelector.value=destination.currency;
    syncCustomSelect(currencySelector);
    activatePlanningCurrency(destination.currency);
  }else if(populated){
    byId("planningCurrencyStatus").textContent=`${destination.country} is selected as your study destination. Your existing ${currentCurrency} plan was preserved.`;
    if(planRequested)compute();
  }else{
    byId("planningCurrencyStatus").textContent=`${destination.country} is selected as your study destination. Planning currency set to ${currentCurrency}.`;
  }
}
window.addEventListener("campusbridge:study-destination",event=>applyStudyDestinationPreference(event.detail?.studyCountry));
byId("transferAmount").addEventListener("input",renderTransfers); byId("sortBy").addEventListener("change",renderTransfers);
byId("providerQuoteForms").addEventListener("input",renderTransfers);
byId("addQuoteProvider").addEventListener("click", () => {
  if (visibleProviderCount >= providerDefs.length) return;
  visibleProviderCount += 1;
  renderQuoteForms();
  renderTransfers();
  byId("providerQuoteForms").querySelector(`[data-provider="${providerDefs[visibleProviderCount - 1].id}"] .customSelectTrigger`).focus();
});
byId("resetProfile").addEventListener("click",()=>{PlanState?.clearPlan();restoredRateProvenance="";byId("profileForm").reset();byId("planningDetails").disabled=true;byId("planningDetails").hidden=true;exchangeRateState.selectedCurrency="";syncCustomSelect(byId("planningCurrency"));syncCustomSelect(byId("corridor"));planRequested=false;updateDeadlineHint();syncRateTimestampPicker();closeRateTimestampCalendar();bankAccounts=[];nextBankAccountId=1;quoteDrafts.clear();visibleProviderCount=1;byId("bankAccountError").textContent="";renderBankAccounts();byId("corridor").value="CN";syncCustomSelect(byId("corridor"));exchangeRateState.mode="manual";exchangeRateState.appliedCurrency=null;exchangeRateState.appliedUpdatedAtMs=null;exchangeRateState.appliedNextUpdateAtMs=null;byId("transferAmount").value="";renderFetchedRateStatus();refreshRate();renderQuoteForms();renderContributionRoadmap(null);byId("plannerResults").innerHTML='<p class="muted">Choose a planning currency, then enter your financial figures.</p>';byId("formError").textContent="";latest=null;resetScenario();renderTransfers();});
byId("refreshExchangeRate").addEventListener("click",refreshExchangeRate);
byId("useExchangeRate").addEventListener("click",useFetchedExchangeRate);
byId("rateTimestamp").addEventListener("input",syncRateTimestampPicker);
for(const id of ["exchangeRate","rateSource","rateTimestamp"])byId(id).addEventListener("input",handleManualRateEdit);
function getLocalAssistantGuidance(q) {
  const item=guidance.find(x=>/fraud|password|code/.test(q)?x.topic.includes("fraud"):/fee|spread/.test(q)?x.topic.includes("fee"):/rate|exchange/.test(q)?x.topic.includes("rate"):/emergency/.test(q)?x.topic.includes("emergency"):x.topic.includes("tuition"))||guidance[0];
  return `${item?.text||"Review your payment terms directly with the university."}\nSource: ${item?.source||"CampusBridge guidance"}`;
}
let assistantRequestPending=false;
async function answerQuestion() {
 const button=byId("askButton"),answer=byId("answer"),question=byId("question"),status=byId("assistant-inline-status");
 if(assistantRequestPending)return;
 const rawQuestion=question.value.trim(),q=rawQuestion.toLowerCase();if(!q){status.textContent="Enter a question about your tuition plan or payment comparison.";question.focus();return;}
 assistantRequestPending=true;button.disabled=true;answer.setAttribute("aria-busy","true");status.textContent="Preparing an explanation…";
 const turn=CampusBridgeAssistantConversation.createTurn(answer,rawQuestion),reply=turn.response;reply.textContent="CampusBridge AI is preparing an explanation…";CampusBridgeAssistantConversation.scrollToLatest(turn.element);
 try{
  compute();
  const task=CampusBridgeAssistantTask.run({question:rawQuestion,Finance,plan:latest?{ok:true,profile:latest.input,result:latest.result,roadmap:latest.roadmap}:null,quotes:enteredQuotes(),quoteInput:{amount:byId("transferAmount").value,to:corridorMap[byId("corridor").value].currency,sort:byId("sortBy").value},money:value=>money(value,"BDT")});
  const planContext=CampusBridgeAssistantPlanContext.summarize(latest?{ok:true,profile:latest.profile||latest.input,result:latest.result,roadmap:latest.roadmap}:null,{quoteComparison:currentQuoteComparison(),quoteRanking:byId("sortBy").value});
  status.textContent="Sending your question with a compact current plan summary to CampusBridge AI…";
  let safeFailure="Could not reach the assistant endpoint. Check that the deployed CampusBridge site is available.";
  try{const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({question:rawQuestion,planContext})});let payload={};try{payload=await response.json();}catch{}if(!response.ok){safeFailure=response.status===404?"The assistant API is unavailable on this preview. Open the deployed site to use it.":typeof payload.error==="string"?payload.error:`Assistant request failed (HTTP ${response.status}).`;if(payload.requestId)safeFailure+=` Reference: ${payload.requestId}.`;throw new Error("safe assistant error");}if(typeof payload.answer!=="string"||!payload.answer.trim()){safeFailure="The assistant endpoint returned an invalid answer.";throw new Error("invalid assistant response");}AssistantRenderer.render(reply,`AI plan explanation:\n\n${payload.answer}`);if(payload.incomplete===true){const notice=document.createElement("p");notice.className="answerNotice";notice.textContent="This answer may be incomplete because it reached the response limit. Try asking a narrower question.";reply.appendChild(notice);}logEvent("retrieve_ai_guidance",payload.incomplete===true?"partial":"success",payload.incomplete===true?"Partial explanation returned; prompt and response omitted":"Plan explanation returned; prompt and response omitted");status.textContent=planContext.status==="available"?"The answer uses a compact current plan summary; full form fields, account details, tracker notes, and quote references are not sent.":"No valid plan is available; the question and unavailable-plan status were sent.";}
  catch{reply.textContent=task.handled?task.answer:`AI assistant unavailable. ${safeFailure}\nHere is local guidance instead:\n${getLocalAssistantGuidance(q)}`;status.textContent=task.handled?"AI unavailable; showing deterministic guidance from the current planner results.":"The AI assistant was unavailable; local guidance is shown.";logEvent("retrieve_ai_guidance","fallback","Used local guidance; prompt, response, and error details omitted");}
 }finally{assistantRequestPending=false;button.disabled=false;answer.setAttribute("aria-busy","false");CampusBridgeAssistantConversation.scrollToLatest(turn.element,{onlyIfVisible:true});}
}
byId("askButton").addEventListener("click",answerQuestion);byId("question").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();answerQuestion();}});
byId("clearLog").addEventListener("click",()=>{activity=[];renderLog();});
function resetScenario(){byId("scenarioSavings").value=byId("savings").value;byId("scenarioMonthly").value=byId("income").value&&byId("expenses").value?Math.max(0,Number(byId("income").value)-Number(byId("expenses").value)):"";byId("scenarioPreview").textContent="Scenario reset to your current plan.";}
function previewScenario(){if(!latest)return;const savings=Number(byId("scenarioSavings").value),monthly=Number(byId("scenarioMonthly").value),income=Number(byId("income").value);if(!Number.isFinite(savings)||savings<0||!Number.isFinite(monthly)||monthly<0||monthly>income){byId("scenarioPreview").textContent="Enter non-negative savings and monthly savings no greater than monthly income.";return;}const scenario={...latest.input,savings:toBdtAmount(savings),expenses:toBdtAmount(income-monthly)};const r=Finance.calculateTuition(scenario);const target=Finance.describeMonthlySavingsTarget(r);byId("scenarioPreview").textContent=r.ok?`Preview: gap ${money(r.gap)}; monthly target ${target.state==="covered"?target.message:target.state==="unavailable"?"unavailable (no 30-day contribution date before deadline)":money(target.amount)}; projected shortfall ${money(r.shortfall)}. Compared with current gap ${money(latest.result.gap)}. Scenario assumes monthly savings are sustained through the deadline.`:"This scenario has invalid inputs.";}
byId("scenarioSavings").addEventListener("input",previewScenario);byId("scenarioMonthly").addEventListener("input",previewScenario);
byId("resetScenario").addEventListener("click",resetScenario);
byId("applyScenario").addEventListener("click",()=>{const savings=Number(byId("scenarioSavings").value),monthly=Number(byId("scenarioMonthly").value),income=Number(byId("income").value);if(!latest){byId("scenarioPreview").textContent="Calculate your current tuition plan before applying a scenario.";return;}if(byId("scenarioSavings").value===""||byId("scenarioMonthly").value===""||!Number.isFinite(savings)||savings<0||!Number.isFinite(monthly)||monthly<0||monthly>income){previewScenario();return;}byId("savings").value=String(savings);byId("expenses").value=String(income-monthly);compute();byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});});
function clearStressTestResults(){const output=byId("stressResults");output.replaceChildren();output.hidden=true;latestStressTest=null;}
function stressContributionText(scenario){
  if(scenario.fundingGap===0)return "No additional contribution needed";
  if(scenario.monthlyTarget===null)return "Unavailable: no remaining 30-day contribution date";
  if(!scenario.contributionSchedule)return `${money(scenario.monthlyTarget)} per contribution cycle`;
  if(scenario.contributionCycles===1)return `${money(scenario.contributionSchedule.finalAmount)} in the final cycle`;
  return `${money(scenario.contributionSchedule.regularAmount)} for ${scenario.contributionCycles-1} cycle(s), then ${money(scenario.contributionSchedule.finalAmount)} in the final cycle`;
}
function renderStressTestResults(stress,tuitionCurrency,planningMode=Finance.PLANNING_MODES.ALL_COSTS){
  const output=byId("stressResults");output.replaceChildren();
  if(!stress.ok){const error=document.createElement("p");error.className="error";error.setAttribute("role","alert");error.textContent=stress.errors.join(" ");output.append(error);output.hidden=false;return;}
  const intro=document.createElement("p");intro.className="assumptionNote";intro.textContent=`These hypothetical ${planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"tuition-only":"study-abroad cost"} results use the current form values. One missed contribution uses the scheduled amount in ${tuitionCurrency}, capped at the positive monthly surplus; with no cycles or surplus, it is zero. Your original plan is unchanged.`;output.append(intro);
  for(const scenario of stress.scenarios){
    const card=document.createElement("section");card.className="resultAssumptions";card.setAttribute("aria-label",`${scenario.name} results`);
    const title=document.createElement("h3");title.textContent=scenario.name;card.append(title);
    const details=document.createElement("dl");
    const rows=[
      ["Exchange rate",`${scenario.exchangeRate.toFixed(4)} BDT per ${tuitionCurrency}`],
      [planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Required tuition funding":"Required study-abroad funds",money(scenario.requiredFunds)],
      ["Usable savings",money(scenario.usableSavings)],
      [planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Tuition funding gap":"Funding gap",money(scenario.fundingGap)],
      ["Monthly surplus",money(scenario.monthlySurplus)],
      ["Contribution target",stressContributionText(scenario)],
      ["Projected capacity",money(scenario.projectedCapacity)],
      ["Projected shortfall",money(scenario.projectedShortfall)]
    ];
    if(scenario.expenseIncrease>0)rows.splice(1,0,["Monthly expense increase",money(scenario.expenseIncrease)]);
    if(scenario.missedContributions>0)rows.splice(1,0,["Assumed missed contribution",money(scenario.missedContributionAmount)]);
    for(const [label,value] of rows){const term=document.createElement("dt"),description=document.createElement("dd");term.textContent=label;description.textContent=value;details.append(term,description);}
    card.append(details);output.append(card);
  }
  output.hidden=false;
}
function runStressTest(){
  latestStressTest=null;
  const expenseInput=byId("stressExpenseIncrease"),rawExpense=expenseInput.value;
  expenseInput.removeAttribute("aria-invalid");
  const options={missedContributions:1};
  if(expenseInput.validity.badInput||(rawExpense!==""&&(!Number.isFinite(expenseInput.valueAsNumber)||expenseInput.valueAsNumber<0||expenseInput.valueAsNumber>Finance.MAX_CALCULATED_BDT))){
    expenseInput.setAttribute("aria-invalid","true");renderStressTestResults({ok:false,errors:[`Enter a finite monthly expense increase in ${planCurrency()} from 0 to 1,000,000,000,000.`]});return;
  }
  if(rawExpense!=="")options.expenseIncrease=Number(toBdtAmount(rawExpense));
  const enteredProfile=profile();
  const input=Finance.profileForPlanningMode(enteredProfile,enteredProfile.planningMode);
  const stress=Finance.calculateStressScenarios({...input},options);
  if(stress.ok){latestStressTest={profile:{...input},scenarios:stress.scenarios};PlanState?.saveStressOptions(options);}
  renderStressTestResults(stress,input.tuitionCur,input.planningMode);
}
function reportAmount(value,currency){if(value===null||value===undefined)return "Not provided";if(currency==="")return new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(value);return currency?money(value,currency):money(value);}
function appendReadinessBlock(parent,title,entries){
  const block=document.createElement("section");block.className="readinessReportBlock";
  const heading=document.createElement("h3");heading.textContent=title;block.append(heading);
  const list=document.createElement("dl");
  for(const [label,value] of entries){const term=document.createElement("dt"),description=document.createElement("dd");term.textContent=label;description.textContent=value;list.append(term,description);}
  block.append(list);parent.append(block);
}
function renderReadinessReport(data, chartData){
  const page=byId("readinessReportPage");page.replaceChildren();
  const header=document.createElement("header");header.className="readinessReportHeader";
  const brand=document.createElement("div"),brandLabel=document.createElement("p"),title=document.createElement("h2");
  brandLabel.className="eyebrow";brandLabel.textContent=data.branding;title.id="readinessReportTitle";title.tabIndex=-1;title.textContent=data.title;brand.append(brandLabel,title);
  const identity=document.createElement("p");identity.className="readinessReportIdentity";
  const student=document.createElement("strong");student.textContent=data.studentName||"Not provided";
  const reportDate=document.createElement("span");reportDate.textContent=`Report date: ${data.reportDate||"Not provided"}`;
  identity.append(student,reportDate);header.append(brand,identity);page.append(header);
  const summary=document.createElement("section");summary.className="readinessReportSection readinessReportGrid";
  const enteredOneTime=(data.oneTimeCostItems||[]).filter(item=>item.amountBdt!==null).map(item=>`${item.label}: ${reportAmount(item.amountBdt)}`).join("; ");
  const enteredMonthlyLiving=(data.monthlyLivingCostItems||[]).filter(item=>item.amountBdt!==null).map(item=>`${item.label}: ${reportAmount(item.amountBdt)} / month`).join("; ");
  appendReadinessBlock(summary,"Study costs",[
    ["Planning mode",data.planningModeName],
    ["Destination",data.destinationCountry||"Not provided"],
    ["Tuition",reportAmount(data.tuitionAmount,data.tuitionCurrency?`${data.tuitionCurrencyName} (${data.tuitionCurrency})`:"")],
    ["Tuition value in the planning currency",reportAmount(data.tuitionEstimateBdt)],
    ["Payment / transfer fees",reportAmount(data.paymentFeesBdt)],
    ["One-time cost details (student estimates)",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Excluded in Tuition Only mode":enteredOneTime||"Not provided"],
    ["Monthly living details (student estimates)",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Excluded in Tuition Only mode":enteredMonthlyLiving||"Not provided"],
    ["Initial living-cost period",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Excluded in Tuition Only mode":data.initialLivingMonths===null?"Not provided":`${reportAmount(data.initialLivingMonths,"")} month(s)`],
    ["Initial living-cost total",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Excluded in Tuition Only mode":reportAmount(data.initialLivingCostsBdt)],
    [data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Other study costs":"Additional costs included",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Excluded in Tuition Only mode":reportAmount(data.otherEnteredCostsBdt)],
    ["Additional costs in planning currency",reportAmount(data.destinationCurrencyCostEquivalent,data.destinationCurrencyCostEquivalent===null?"":data.tuitionCurrency)],
    ["Total required funding",reportAmount(data.totalRequiredFundsBdt)],
    ["Total in planning currency",reportAmount(data.destinationCurrencyTotalEquivalent,data.destinationCurrencyTotalEquivalent===null?"":data.tuitionCurrency)],
    ["Planned deadline / intake",data.deadline||"Not provided"]
  ]);
  appendReadinessBlock(summary,"Savings and monthly plan",[
    ["Available savings",reportAmount(data.savingsBdt)],
    ["Emergency reserve",reportAmount(data.emergencyReserveBdt)],
    ["Committed funds",reportAmount(data.committedFundsBdt)],
    ["Usable funds",reportAmount(data.usableFundsBdt)],
    ["Funding gap",reportAmount(data.fundingGapBdt)],
    ["Income / expenses",`${reportAmount(data.monthlyIncomeBdt)} / ${reportAmount(data.monthlyExpensesBdt)} per month`],
    ["Disposable income",`${reportAmount(data.monthlySurplusBdt)} per month`],
    ["Contribution target",data.fundingGapBdt===0?"No additional contribution needed":data.monthlyContributionTargetBdt===null?"No contribution dates available":data.contributionCycles===1?`${reportAmount(data.contributionSchedule.finalAmountBdt)} in the final cycle`:`${reportAmount(data.contributionSchedule.regularAmountBdt)} for ${data.contributionCycles-1} cycle(s), then ${reportAmount(data.contributionSchedule.finalAmountBdt)} in the final cycle`],
    ["Available contribution cycles",reportAmount(data.contributionCycles,"")],
    ["Projected savings capacity",reportAmount(data.projectedSavingsCapacityBdt)],
    ["Projected shortfall",reportAmount(data.projectedShortfallBdt)]
  ]);
  if(data.contributionRoadmap){
    const roadmap=data.contributionRoadmap;
    const reachability=roadmap.targetCanBeReachedByDeadline?"Projected reachable by deadline":"Not projected to be reached by deadline";
    appendReadinessBlock(summary,"Dated contribution roadmap",[
      ["Projection",reachability],
      ["Complete 30-day contribution dates",reportAmount(roadmap.contributionCycles)],
      ["First / last due date",roadmap.firstDueDate?`${roadmap.firstDueDate} / ${roadmap.lastDueDate}`:"No contribution dates"],
      ["Required contribution schedule total",reportAmount(roadmap.requiredContributionTotalBdt)],
      ["Monthly / total projected capacity",`${reportAmount(roadmap.monthlySavingsCapacityBdt)} / ${reportAmount(roadmap.projectedSavingsCapacityBdt)}`],
      ["Ending projected savings / remaining gap",`${reportAmount(roadmap.endingProjectedSavingsBalanceBdt)} / ${reportAmount(roadmap.endingRemainingFundingGapBdt)}`],
      ["Assumption",(roadmap.summary||"Not provided").replace(/([\d,.]+) BDT/g,(_match,amount)=>money(Number(amount.replaceAll(",",""))))]
    ]);
  }
  page.append(summary,renderFinancialCharts(chartData,"readiness-report"));
  const rateSection=document.createElement("section");rateSection.className="readinessReportSection";
  appendReadinessBlock(rateSection,"Exchange-rate information",[
    ["Rate",data.exchangeRate===null||!data.tuitionCurrency?"Not provided":`1 ${data.tuitionCurrencyName} (${data.tuitionCurrency}) = ${data.exchangeRate.toFixed(5)} BDT`],
    ["Source",data.rateSource||"Not provided"],
    ["Effective date / timestamp",data.rateTimestamp||"Not provided"],
    ["Verification",data.rateVerification||"Not provided"]
  ]);page.append(rateSection);
  if(data.stressScenarios.length){
    const stressSection=document.createElement("section");stressSection.className="readinessReportSection";
    const stressTitle=document.createElement("h3");stressTitle.textContent="Financial stress tests (hypothetical)";stressSection.append(stressTitle);
    const table=document.createElement("table");table.className="readinessStressTable";
    const head=document.createElement("thead"),headingRow=document.createElement("tr");
    for(const label of ["Scenario","Assumption",data.planningMode===Finance.PLANNING_MODES.TUITION_ONLY?"Tuition gap":"Funding gap","Capacity","Shortfall"]){const cell=document.createElement("th");cell.scope="col";cell.textContent=label;headingRow.append(cell);}head.append(headingRow);table.append(head);
    const body=document.createElement("tbody");
    for(const scenario of data.stressScenarios){
      const row=document.createElement("tr"),name=document.createElement("th");name.scope="row";name.textContent=scenario.name;row.append(name);
      const assumptions=[scenario.exchangeRate===null?"Rate not provided":`${scenario.exchangeRate.toFixed(4)} BDT/${data.tuitionCurrency||"currency"}`];
      if(scenario.expenseIncrease>0)assumptions.push(`expenses +${money(scenario.expenseIncrease)}/mo`);
      if(scenario.missedContributionAmount>0||/missed contribution/i.test(scenario.name))assumptions.push(`missed ${money(scenario.missedContributionAmount)}`);
      if(scenario.contributionCycles!==null)assumptions.push(`${scenario.contributionCycles} cycle(s)`);
      const values=[assumptions.join("; "),reportAmount(scenario.fundingGap),reportAmount(scenario.projectedCapacity),reportAmount(scenario.projectedShortfall)];
      for(const value of values){const cell=document.createElement("td");cell.textContent=value;row.append(cell);}body.append(row);
    }
    table.append(body);stressSection.append(table);page.append(stressSection);
  }
  const nextSection=document.createElement("section");nextSection.className="readinessReportSection";
  const nextTitle=document.createElement("h3");nextTitle.textContent="Suggested next steps";const steps=document.createElement("ol");steps.className="readinessNextSteps";
  for(const text of data.nextSteps){const item=document.createElement("li");item.textContent=text.replace(/([\d,.]+) BDT/g,(_match,amount)=>money(Number(amount.replaceAll(",",""))));steps.append(item);}nextSection.append(nextTitle,steps);page.append(nextSection);
  const modeNote=document.createElement("p");modeNote.className="readinessDisclaimer";modeNote.textContent=data.planningModeNote;page.append(modeNote);
  const disclaimer=document.createElement("p");disclaimer.className="readinessDisclaimer";disclaimer.textContent=data.disclaimer;page.append(disclaimer);
}
function generateReadinessReport(){
  compute();
  if(!latest){byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});return;}
  const {input,result}=latest;
  const stressMatches=latestStressTest&&JSON.stringify(latestStressTest.profile)===JSON.stringify(input);
  const data=Finance.buildReadinessReportData({...input},{...result},{studentName:byId("readinessStudentName").value,reportDate:new Date(),stressScenarios:stressMatches?latestStressTest.scenarios:[],roadmap:latest.roadmap});
  if(!data.ok){byId("formError").textContent=data.errors.join(" ");byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});return;}
  renderReadinessReport(data,window.CampusBridgePlannerResults.charts(result,latest.roadmap));latestReadinessReportProfile={...input};const preview=byId("readinessReportPreview");preview.hidden=false;preview.scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});byId("readinessReportTitle").focus({preventScroll:true});
}
byId("runStressTest").addEventListener("click",runStressTest);
byId("clearStressTest").addEventListener("click",clearStressTestResults);
function handleProfileEdit(event){if(event?.target?.name==="planningMode")updatePlanningModeUI();clearStressTestResults();byId("readinessReportPreview").hidden=true;latestReadinessReportProfile=null;if(planRequested)compute();}
byId("profileForm").addEventListener("input",handleProfileEdit);
byId("profileForm").addEventListener("change",handleProfileEdit);
byId("profileForm").addEventListener("reset",()=>setTimeout(updatePlanningModeUI,0));
updatePlanningModeUI();
byId("stressExpenseIncrease").addEventListener("input",()=>{clearStressTestResults();byId("readinessReportPreview").hidden=true;latestReadinessReportProfile=null;});
byId("readinessStudentName").addEventListener("input",()=>{byId("readinessReportPreview").hidden=true;latestReadinessReportProfile=null;});
byId("resetProfile").addEventListener("click",()=>{byId("stressExpenseIncrease").value="";byId("readinessStudentName").value="";clearStressTestResults();});
byId("generateReadinessReport").addEventListener("click",generateReadinessReport);
byId("printReadinessReport").addEventListener("click",()=>window.print());
byId("closeReadinessReport").addEventListener("click",()=>{byId("readinessReportPreview").hidden=true;byId("generateReadinessReport").focus();});
byId("exportReport").addEventListener("click",()=>{compute();if(!latest){byId("planner").scrollIntoView({behavior:reducedMotion.matches?"auto":"smooth"});return;}const {input:p,result:r}=latest;const cmp=currentQuoteComparison();const comparison=cmp.ok?cmp.available:[];const excluded=cmp.ok?cmp.unavailable:[];const scenarioValue=byId("scenarioMonthly").value;const scenarioMonthly=Number(toBdtAmount(scenarioValue));const scenarioIncome=Number(p.income);const scenarioExpenses=scenarioIncome-scenarioMonthly;const expenseIncrease=scenarioValue!==""&&Number.isFinite(scenarioExpenses)&&scenarioMonthly>=0&&scenarioMonthly<=scenarioIncome?Math.max(0,scenarioExpenses-Number(p.expenses)):0;const stressOptions={missedContributions:1};if(expenseIncrease>0)stressOptions.expenseIncrease=expenseIncrease;const stress=Finance.calculateStressScenarios(p,stressOptions);const report=Finance.buildFinancialReport(p,r,{quotes:comparison,excludedQuotes:excluded,quoteErrors:cmp.ok?[]:cmp.errors,stressScenarios:stress.scenarios||[],stressErrors:stress.ok?[]:stress.errors||[]});const blob=new Blob([report],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="campusbridge-financial-report.txt";a.click();URL.revokeObjectURL(a.href);logEvent("export_financial_report","success","Local report generated from entered data");});

// Pointer-responsive 3D treatment is decorative and disabled for touch/reduced motion.
const visual=document.querySelector(".heroVisual"),orb=document.querySelector(".orb3d");
if(visual&&!reducedMotion.matches&&matchMedia("(pointer:fine)").matches){visual.addEventListener("pointermove",e=>{const b=visual.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;orb.style.animationPlayState="paused";orb.style.transform=`translate3d(${x*9}px,${y*8}px,0) rotateX(${-y*9}deg) rotateY(${x*13-10}deg)`;});visual.addEventListener("pointerleave",()=>{orb.style.animationPlayState="running";orb.style.transform="";});}
function restoreSavedPlan() {
  const saved = PlanState?.loadPlan();
  if (!saved?.ok) return false;
  const p = saved.profile;
  const corridor = Object.entries(corridorMap).find(([, value]) => value.country === p.destinationCountry)?.[0] || Object.entries(corridorMap).find(([, value]) => value.currency === p.tuitionCur)?.[0];
  if (!corridor || !Finance.CURRENCIES.includes(p.tuitionCur)) { PlanState.clearPlan(); return false; }
  byId("corridor").value = corridor; syncCustomSelect(byId("corridor"));
  byId("planningCurrency").value=p.tuitionCur; syncCustomSelect(byId("planningCurrency")); byId("planningDetails").disabled=false; byId("planningDetails").hidden=false; exchangeRateState.selectedCurrency=p.tuitionCur; updatePlanCurrencyLabels();
  const fields = ["tuition", "exchangeRate", "rateSource", "rateTimestamp", "savings", "emergency", "committed", "income", "expenses", "paymentFee", "visaCost", "applicationCost", "flightCost", "insuranceCost", "documentCost", "accommodationDeposit", "initialSetupCost", "otherOneTimeCosts", "initialLivingMonths", "monthlyRent", "monthlyFood", "monthlyTransport", "monthlyUtilities", "monthlyOtherLiving", "deadline"];
  const rate=Number(p.exchangeRate),fromBdt=value=>value===""||value==null?"":String(Number(value)/rate);
  for (const id of fields) byId(id).value = ["tuition","exchangeRate","rateSource","rateTimestamp","initialLivingMonths","deadline"].includes(id)?p[id]??"":fromBdt(p[id]);
  byId("savings").value = fromBdt(p.otherSavings);
  bankAccounts = p.accountBalances.map((balance, index) => ({ id: nextBankAccountId++, label: `Saved balance ${index + 1}`, balance: balance/rate }));
  renderBankAccounts();
  document.querySelectorAll('input[name="planningMode"]').forEach(input => { input.checked = input.value === p.planningMode; });
  restoredRateProvenance = p.rateProvenance.includes("Bangladesh Bank") ? "Previously selected Bangladesh Bank reference; saved timestamp shown, not refreshed on this page" : "Saved user-provided rate; not independently verified";
  exchangeRateState.mode = "manual";
  updatePlanningModeUI(); syncRateTimestampPicker(); updateDeadlineHint(); planRequested = true;
  return true;
}
const restoredPlan = restoreSavedPlan();
renderQuoteForms();refreshRate();renderTransfers();renderContributionRoadmap(null);byId("plannerResults").innerHTML='<p class="muted">Enter the required fields and calculate to see your estimate. This is not a provider quote or guaranteed payable amount.</p>';resetScenario();previewScenario();if(restoredPlan)compute();else refreshExchangeRate();
