(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const notice = document.getElementById("transfer-status"), form = document.getElementById("transfer-form"), output = document.getElementById("transfer-results");
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const localTime = date => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  function initializeTimestampPicker(input) {
    const label = input.closest("label"), picker = document.createElement("span");
    label.classList.add("quoteTimestampLabel");
    picker.className = "timestampPicker quoteTimestampPicker";
    picker.innerHTML = '<span class="timestampControl"><button class="deadlineTrigger timestampTrigger" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="deadlineTriggerText timestampTriggerText"><small>QUOTE DATE &amp; TIME</small><span data-role="display">Choose date and time</span></span><span class="deadlineTriggerIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span></button></span><div class="timestampCalendar" role="dialog" aria-label="Choose quote date and time" hidden><div class="calendarNav"><strong class="calendarMonth" data-role="month"></strong><div class="calendarNavButtons"><button type="button" data-action="previous" aria-label="Previous month">‹</button><button type="button" data-action="next" aria-label="Next month">›</button></div></div><div class="calendarWeekdays" aria-hidden="true"><span class="calendarWeekday">Su</span><span class="calendarWeekday">Mo</span><span class="calendarWeekday">Tu</span><span class="calendarWeekday">We</span><span class="calendarWeekday">Th</span><span class="calendarWeekday">Fr</span><span class="calendarWeekday">Sa</span></div><div class="calendarDays" data-role="days" role="grid"></div><div class="timestampTime"><div><span class="timestampTimeLabel">Local time</span><input data-role="time" type="time" step="60" aria-label="Quote time in your local time"></div><button class="timestampNow" type="button" data-action="now">Use now</button></div><div class="calendarFooter"><div class="calendarSelection" data-role="selection" aria-live="polite"></div><div class="calendarActions"><button class="calendarAction" type="button" data-action="clear">Clear</button><button class="calendarAction primary" type="button" data-action="today">Today</button></div></div></div>';
    input.classList.add("quoteTimestampInput");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.before(picker);
    picker.prepend(input);

    const trigger = picker.querySelector(".timestampTrigger"), calendar = picker.querySelector(".timestampCalendar");
    const monthLabel = picker.querySelector('[data-role="month"]'), dayGrid = picker.querySelector('[data-role="days"]');
    const timeInput = picker.querySelector('[data-role="time"]'), display = picker.querySelector('[data-role="display"]');
    const selection = picker.querySelector('[data-role="selection"]');
    let cursor = new Date(), focusedDate = null;
    const close = (restoreFocus = false) => {
      calendar.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
    };
    const sync = () => {
      const value = input.value;
      if (!value) { display.textContent = "Choose date and time"; return; }
      const [datePart, timePart] = value.split("T"), date = new Date(`${datePart}T00:00:00`);
      if (Number.isNaN(date.getTime()) || !timePart) { display.textContent = "Choose date and time"; return; }
      const datetime = new Date(`${datePart}T${timePart}`);
      const time = Number.isNaN(datetime.getTime()) ? timePart : new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(datetime);
      display.textContent = `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)} · ${time}`;
      if (!calendar.hidden) render(datePart);
    };
    const render = (focusDate = null) => {
      const year = cursor.getFullYear(), month = cursor.getMonth(), selected = input.value ? input.value.split("T")[0] : "";
      monthLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor);
      dayGrid.setAttribute("aria-label", monthLabel.textContent);
      const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
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
        const iso = localDate(date), outside = date.getMonth() !== month, button = document.createElement("button");
        button.type = "button"; button.className = "calendarDay"; button.textContent = String(date.getDate()); button.dataset.iso = iso;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date));
        button.setAttribute("aria-selected", String(iso === selected));
        if (outside) button.classList.add("isOutside");
        if (iso === localDate(new Date())) button.classList.add("isToday");
        if (iso === selected) button.classList.add("isSelected");
        if (iso === focusDate) button.tabIndex = 0;
        button.addEventListener("click", () => {
          const time = timeInput.value || localTime(new Date());
          input.value = `${iso}T${time}`;
          timeInput.value = time;
          sync();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          dayGrid.querySelector(`[data-iso="${iso}"]`)?.focus();
        });
        week.append(button);
      }
      dayGrid.replaceChildren(fragment);
      picker.querySelector('[data-action="previous"]').disabled = year <= 1 && month === 0;
      picker.querySelector('[data-action="next"]').disabled = year >= 9999 && month === 11;
      const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null, strong = document.createElement("strong");
      selection.replaceChildren(document.createTextNode(selected ? "Selected date and time" : "Select a quote date"));
      strong.textContent = selectedDate ? `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(selectedDate)} · ${input.value.split("T")[1] || ""}` : "Choose date and time";
      selection.append(strong);
    };
    trigger.addEventListener("click", () => {
      if (!calendar.hidden) { close(); return; }
      const value = input.value, datePart = value ? value.split("T")[0] : localDate(new Date());
      const date = new Date(`${datePart}T00:00:00`);
      cursor = new Date(date.getFullYear(), date.getMonth(), 1);
      timeInput.value = value ? value.split("T")[1] : localTime(new Date());
      focusedDate = datePart; render(datePart); calendar.hidden = false; trigger.setAttribute("aria-expanded", "true");
      dayGrid.querySelector(`[data-iso="${focusedDate}"]`)?.focus();
    });
    picker.querySelector('[data-action="previous"]').addEventListener("click", () => { cursor.setMonth(cursor.getMonth() - 1); render(focusedDate); });
    picker.querySelector('[data-action="next"]').addEventListener("click", () => { cursor.setMonth(cursor.getMonth() + 1); render(focusedDate); });
    timeInput.addEventListener("input", () => {
      const datePart = input.value ? input.value.split("T")[0] : localDate(new Date());
      input.value = `${datePart}T${timeInput.value}`; sync();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    picker.querySelector('[data-action="now"]').addEventListener("click", () => {
      const now = new Date(); input.value = `${localDate(now)}T${localTime(now)}`; timeInput.value = localTime(now);
      sync(); input.dispatchEvent(new Event("input", { bubbles: true })); close(true);
    });
    picker.querySelector('[data-action="today"]').addEventListener("click", () => {
      const time = timeInput.value || localTime(new Date());
      input.value = `${localDate(new Date())}T${time}`; sync(); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    picker.querySelector('[data-action="clear"]').addEventListener("click", () => {
      input.value = ""; timeInput.value = ""; sync(); input.dispatchEvent(new Event("input", { bubbles: true })); close(true);
    });
    dayGrid.addEventListener("keydown", event => {
      const current = event.target.closest("[data-iso]");
      if (!current) return;
      if (event.key === "Escape") { event.preventDefault(); close(true); return; }
      const date = new Date(`${current.dataset.iso}T00:00:00`);
      const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7, Home: -date.getDay(), End: 6 - date.getDay() };
      if (!(event.key in offsets)) return;
      event.preventDefault(); date.setDate(date.getDate() + offsets[event.key]); focusedDate = localDate(date);
      if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) cursor = new Date(date.getFullYear(), date.getMonth(), 1);
      render(focusedDate); dayGrid.querySelector(`[data-iso="${focusedDate}"]`)?.focus();
    });
    calendar.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); close(true); } });
    document.addEventListener("pointerdown", event => { if (!picker.contains(event.target)) close(); });
    document.addEventListener("focusin", event => { if (!picker.contains(event.target)) close(); });
    input.addEventListener("input", sync);
    sync();
  }
  const plan = loadPlan();
  const currency = plan.ok ? plan.profile.tuitionCur : "";
  const currencySelect = document.getElementById("quote-currency");
  for (const code of Finance.CURRENCIES.filter(value => value !== "BDT")) {
    const option = document.createElement("option"); option.value = code; option.textContent = `${Finance.CURRENCY_NAMES[code]} (${code})`; currencySelect.append(option);
  }
  if (currency) currencySelect.value = currency;
  currencySelect.disabled = true;
  document.getElementById("quote-currency-note").textContent = plan.ok ? `Quotes must match the saved plan currency (${currency}).` : "";
  form.querySelectorAll('[data-field="timestamp"]').forEach(initializeTimestampPicker);
  window.CampusBridgeTransferQuoteContext = () => {
    const amount = document.getElementById("transfer-principal").value;
    const sort = document.getElementById("quote-sort").value;
    const quotes = [...form.querySelectorAll("[data-quote]")].map(card => {
      const value = field => card.querySelector(`[data-field="${field}"]`).value;
      return { name: value("name"), currency, totalCost: value("total"), recipientAmount: value("recipient"), timestamp: value("timestamp"), fee: value("fee"), quotedRate: value("rate"), days: value("days") };
    });
    return { comparison: Finance.compareEnteredQuotes({ amount, to: currency, sort }, quotes), ranking: sort };
  };
  if (!plan.ok) { notice.textContent = plan.message; form.hidden = true; return; }
  let comparisonStarted = false;
  function compareQuotes() {
    output.replaceChildren();
    const amount = document.getElementById("transfer-principal").value;
    const sort = document.getElementById("quote-sort").value;
    const quotes = [...form.querySelectorAll("[data-quote]")].map(card => {
      const value = field => card.querySelector(`[data-field="${field}"]`).value;
      return { name: value("name"), currency, totalCost: value("total"), recipientAmount: value("recipient"), timestamp: value("timestamp"), reference: value("reference"), fee: value("fee"), quotedRate: value("rate"), days: value("days") };
    });
    const result = Finance.compareEnteredQuotes({ amount, to: currency, sort }, quotes);
    if (!result.ok) { notice.textContent = result.errors.join(" "); return; }
    notice.textContent = "These are student-entered quotes. CampusBridge does not authenticate providers or execute transfers.";
    for (const quote of result.available) {
      const card = document.createElement("article"); card.className = "surface quoteResult";
      const title = document.createElement("h2"); title.textContent = quote.quote.name; card.append(title);
      const details = document.createElement("p"); details.textContent = `Sender cost ${money(quote.totalCost, "BDT")} · recipient amount ${quote.recipientAmount} ${quote.currency} · source ${quote.reference} · timestamp ${quote.timestamp}.`; card.append(details); output.append(card);
    }
    for (const quote of result.unavailable) { const item = document.createElement("p"); item.className = "error"; item.textContent = `${quote.quote.name}: ${quote.reason}`; output.append(item); }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    comparisonStarted = true;
    compareQuotes();
  });
  form.querySelectorAll('[data-field="name"]').forEach(input => input.addEventListener("input", () => {
    if (comparisonStarted) compareQuotes();
  }));
})();
