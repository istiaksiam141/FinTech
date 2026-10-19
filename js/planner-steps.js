"use strict";

(() => {
  const form = document.getElementById("profileForm");
  if (!form) return;

  const planningDetails = form.querySelector(":scope > #planningDetails");
  const fieldsets = [...(planningDetails?.querySelectorAll(":scope > fieldset.formSection") || [])];
  const intro = form.querySelector(":scope > .formIntro");
  const outcomePreview = form.querySelector(":scope > .plannerOutcomePreview");
  const footer = planningDetails?.querySelector(":scope > .formFooter");
  const planningMode = planningDetails?.querySelector(":scope > .planningModeSelector");
  const requiredHint = planningDetails?.querySelector(":scope > .requiredHint");
  if (fieldsets.length !== 6 || !intro || !outcomePreview || !planningDetails || !footer || !planningMode || !requiredHint) {
    throw new Error("Planner step setup requires the complete planner form.");
  }

  const [costs, rate, funds, additionalCosts, livingCosts, budgetAndDeadline] = fieldsets;
  const createFieldset = (title, labels) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "formSection";
    const legend = document.createElement("legend");
    legend.textContent = title;
    const grid = document.createElement("div");
    grid.className = "fieldGrid";
    grid.append(...labels);
    fieldset.append(legend, grid);
    return fieldset;
  };
  const takeLabel = id => {
    const label = form.querySelector(`#${id}`)?.closest("label");
    if (!label) throw new Error(`Planner step setup could not find #${id}.`);
    return label;
  };

  const monthlyBudget = createFieldset("Monthly budget", [
    takeLabel("income"),
    takeLabel("expenses")
  ]);
  const transferFees = createFieldset("Transfer fees", [takeLabel("paymentFee")]);
  const createOptionalGroup = (title, description, content) => {
    const details = document.createElement("details");
    details.className = "plannerOptionalGroup";
    const summary = document.createElement("summary");
    summary.textContent = title;
    const note = document.createElement("p");
    note.className = "small muted";
    note.textContent = description;
    details.append(summary, note, ...content);
    return details;
  };
  const oneTimeCostsGroup = createOptionalGroup(
    "Add one-time study costs (optional)",
    "Leave any estimate blank if it does not apply. Enter each cost once.",
    [additionalCosts, transferFees]
  );
  const livingCostsGroup = createOptionalGroup(
    "Estimate initial living costs (optional)",
    "If you enter monthly amounts, include the number of months in your estimate.",
    [livingCosts]
  );
  costs.querySelector(".stepNumber")?.remove();
  rate.querySelector(".stepNumber")?.remove();
  funds.querySelector(".stepNumber")?.remove();
  additionalCosts.querySelector(".stepNumber")?.remove();
  livingCosts.querySelector(".stepNumber")?.remove();
  budgetAndDeadline.querySelector(".stepNumber")?.remove();
  budgetAndDeadline.querySelector("legend").textContent = "Tuition deadline";

  const steps = [
    {
      title: "Costs",
      description: "Choose your destination and tuition, then add any optional study and living costs.",
      content: [planningMode, requiredHint, costs, oneTimeCostsGroup, livingCostsGroup]
    },
    {
      title: "Exchange rate",
      description: "Enter a current rate, its source, and when it was recorded."
    },
    {
      title: "Funds",
      description: "Add your current savings and monthly income and living costs. Optional savings left blank count as zero.",
      content: [funds, monthlyBudget]
    },
    {
      title: "Deadline",
      description: "Choose when tuition is due. Your estimate will use this date."
    },
    {
      title: "Review",
      description: "Check the figures and assumptions before calculating."
    }
  ];

  const stepper = document.createElement("div");
  stepper.className = "plannerStepper";
  const progress = document.createElement("ol");
  progress.className = "plannerProgress";
  progress.setAttribute("aria-label", "Planner steps");
  const panels = [];
  steps.forEach((step, index) => {
    const panel = document.createElement("section");
    panel.className = "plannerStepPanel";
    panel.dataset.stepPanel = String(index);
    panel.hidden = index !== 0;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-labelledby", `planner-step-title-${index}`);

    const heading = document.createElement("div");
    heading.className = "plannerStepHeading";
    const title = document.createElement("h3");
    title.id = `planner-step-title-${index}`;
    title.tabIndex = -1;
    title.textContent = step.title;
    const description = document.createElement("p");
    description.textContent = step.description;
    heading.append(title, description);
    panel.append(heading);

    if (step.content) panel.append(...step.content);
    if (index === 1) panel.append(rate);
    if (index === 3) panel.append(budgetAndDeadline);
    if (index === 4) {
      const review = document.createElement("div");
      review.className = "plannerReview";
      review.setAttribute("aria-labelledby", "planner-review-title");
      const reviewTitle = document.createElement("h4");
      reviewTitle.id = "planner-review-title";
      reviewTitle.textContent = "Your plan assumptions";
      const reviewGrid = document.createElement("div");
      reviewGrid.className = "plannerReviewGrid";
      review.dataset.review = "";
      review.append(reviewTitle, reviewGrid);
      panel.append(review, footer);
    }

    const actions = document.createElement("div");
    actions.className = "plannerStepActions";
    const status = document.createElement("p");
    status.className = "plannerStepError";
    status.setAttribute("role", "alert");
    status.setAttribute("aria-live", "polite");
    const buttons = document.createElement("div");
    buttons.className = "plannerStepButtons";
    if (index > 0) {
      const back = document.createElement("button");
      back.className = "button";
      back.type = "button";
      back.textContent = "Back";
      back.addEventListener("click", () => showStep(index - 1));
      buttons.append(back);
    }
    if (index < steps.length - 1) {
      const next = document.createElement("button");
      next.className = "button primary";
      next.type = "button";
      next.textContent = index === 3 ? "Review assumptions" : "Continue";
      next.addEventListener("click", () => advanceFrom(index));
      buttons.append(next);
    }
    actions.append(status, buttons);
    panel.append(actions);
    panels.push(panel);

    const item = document.createElement("li");
    const stepButton = document.createElement("button");
    stepButton.type = "button";
    stepButton.disabled = index > 0;
    stepButton.setAttribute("aria-label", `Step ${index + 1}: ${step.title}`);
    stepButton.addEventListener("click", () => showStep(index));
    const number = document.createElement("span");
    number.className = "plannerProgressNumber";
    number.dataset.stepNumber = String(index + 1).padStart(2, "0");
    number.textContent = number.dataset.stepNumber;
    const label = document.createElement("span");
    label.className = "plannerProgressLabel";
    label.textContent = step.title;
    stepButton.append(number, label);
    item.append(stepButton);
    progress.append(item);
  });

  const progressStatus = document.createElement("p");
  progressStatus.className = "plannerProgressStatus";
  progressStatus.setAttribute("aria-live", "polite");
  stepper.append(progress, progressStatus, ...panels);
  planningDetails.append(stepper);
  const stageErrors = panels.map(panel => panel.querySelector(".plannerStepError"));
  const progressButtons = [...progress.querySelectorAll("button")];
  const requiredControls = [...planningDetails.querySelectorAll("[required]")].map(control => ({
    control,
    wasDisabled: control.disabled,
    panel: control.closest("[data-step-panel]")
  }));
  let currentStep = 0;
  let furthestStep = 0;

  function updateOptionalGroups() {
    const tuitionOnly = document.querySelector('input[name="planningMode"]:checked')?.value === "tuition-only";
    oneTimeCostsGroup.hidden = tuitionOnly;
    livingCostsGroup.hidden = tuitionOnly;
  }

  function formatAmount(value, currency = document.getElementById("planningCurrency")?.value || "BDT") {
    if (value === "" || !Number.isFinite(Number(value))) return "Not entered";
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value))} ${currency}`;
  }

  function updateReview() {
    const grid = panels[4].querySelector(".plannerReviewGrid");
    const rateLabel = document.getElementById("rateCurrencyLabel").textContent;
    const currency = rateLabel.match(/per\s+([A-Z]{3,4})/)?.[1] || "BDT";
    const modeInput = document.querySelector('input[name="planningMode"]:checked');
    const planningMode = modeInput
      ?.closest("label")
      ?.querySelector("strong")
      ?.textContent || "Planning mode not selected";
    const tuitionOnly = modeInput?.value === "tuition-only";
    const destination = document.getElementById("corridor").selectedOptions[0]?.textContent || "Not selected";
    const rateUnit = rateLabel.replace(/[()]/g, "");
    const rateTimestamp = document.getElementById("rateTimestampDisplay").textContent;
    const dateValue = document.getElementById("deadline").value;
    const deadline = dateValue
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(`${dateValue}T00:00:00`))
      : "Not selected";
    const accountBalances = document.getElementById("bankAccountTotal").textContent.match(/Added account balances:\s*([^.]+)/)?.[1] || "not available";
    const oneTimeIds = ["visaCost", "applicationCost", "flightCost", "insuranceCost", "documentCost", "accommodationDeposit", "initialSetupCost", "otherOneTimeCosts"];
    const monthlyIds = ["monthlyRent", "monthlyFood", "monthlyTransport", "monthlyUtilities", "monthlyOtherLiving"];
    const sumValues = ids => ids.reduce((sum, id) => sum + (Number(document.getElementById(id).value) || 0), 0);
    const oneTimeTotal = sumValues(oneTimeIds);
    const months = Number(document.getElementById("initialLivingMonths").value) || 0;
    const monthlyExtra = sumValues(monthlyIds);
    const optionalTotal = oneTimeTotal + monthlyExtra * months;
    const optionalDescription = tuitionOnly
      ? `${optionalTotal > 0 ? `${formatAmount(optionalTotal)} in optional estimates; ` : ""}optional estimates are excluded in Tuition Only mode`
      : optionalTotal > 0
        ? `${formatAmount(optionalTotal)} in additional estimates${months && monthlyExtra ? ` (including ${months} month(s) of living costs)` : ""}`
        : "No additional optional costs entered";
    const monthlyIncome = Number(document.getElementById("income").value) || 0;
    const monthlyExpenses = Number(document.getElementById("expenses").value) || 0;
    const monthlySurplus = monthlyIncome - monthlyExpenses;
    const entries = [
      ["Destination and tuition", `${planningMode} · ${destination} · ${formatAmount(document.getElementById("tuition").value, currency)}`],
      ["Exchange rate", `${formatAmount(document.getElementById("exchangeRate").value, rateUnit)} · ${document.getElementById("rateSource").value || "Source not entered"} · ${rateTimestamp}`],
      ["Savings and funds", `Other savings: ${formatAmount(document.getElementById("savings").value || "0")} · Emergency fund: ${formatAmount(document.getElementById("emergency").value)} · Committed: ${formatAmount(document.getElementById("committed").value || "0")} · Listed balances: ${accountBalances}`],
      ["Monthly budget", `Income: ${formatAmount(document.getElementById("income").value)} · Living costs: ${formatAmount(document.getElementById("expenses").value)} · Difference: ${formatAmount(monthlySurplus)}`],
      ["Deadline and extra costs", `${deadline} · Transfer fee: ${formatAmount(document.getElementById("paymentFee").value || "0")} · ${optionalDescription}`]
    ];
    grid.replaceChildren(...entries.map(([label, value]) => {
      const item = document.createElement("article");
      const heading = document.createElement("h5");
      heading.textContent = label;
      const detail = document.createElement("p");
      detail.textContent = value;
      item.append(heading, detail);
      return item;
    }));
  }

  function clearError(index) {
    stageErrors[index].textContent = "";
  }

  function validateStep(index) {
    clearError(index);
    const panel = panels[index];
    const invalid = requiredControls.find(({ control, panel: controlPanel }) =>
      controlPanel === panel && !control.disabled && !control.checkValidity()
    );
    if (invalid) {
      invalid.control.reportValidity();
      return false;
    }
    if (index === 1 && !document.getElementById("rateTimestamp").value) {
      stageErrors[index].textContent = "Choose the date and time for this exchange rate.";
      document.getElementById("rateTimestampTrigger").focus();
      return false;
    }
    if (index === 3 && !document.getElementById("deadline").value) {
      stageErrors[index].textContent = "Choose your tuition deadline to continue.";
      const trigger = document.getElementById("deadlineTrigger");
      trigger.setAttribute("aria-invalid", "true");
      trigger.focus();
      return false;
    }
    if (index === 3) document.getElementById("deadlineTrigger").removeAttribute("aria-invalid");
    return true;
  }

  function showStep(index, moveFocus = true) {
    if (!Number.isInteger(index) || index < 0 || index >= panels.length || index > furthestStep) return;
    currentStep = index;
    panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
    requiredControls.forEach(({ control, wasDisabled, panel }) => {
      control.disabled = wasDisabled || panel !== panels[index];
    });
    refreshProgress();
    progressStatus.textContent = `Step ${index + 1} of ${steps.length}: ${steps[index].title}`;
    stageErrors.forEach((_, errorIndex) => { if (errorIndex !== index) clearError(errorIndex); });
    if (index === 4) updateReview();
    if (moveFocus) {
      panels[index].querySelector("h3").focus({ preventScroll: true });
      panels[index].scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }
  }

  function refreshProgress() {
    progressButtons.forEach((button, buttonIndex) => {
      const state = buttonIndex === currentStep
        ? "current"
        : buttonIndex < furthestStep
          ? "complete"
          : "upcoming";
      button.dataset.state = state;
      button.disabled = state === "upcoming";
      button.setAttribute("aria-label", `Step ${buttonIndex + 1}: ${steps[buttonIndex].title}${state === "complete" ? ", completed; activate to revisit" : state === "current" ? ", current step" : ", not yet available"}`);
      if (state === "current") button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      const number = button.querySelector(".plannerProgressNumber");
      number.textContent = state === "complete" ? "✓" : number.dataset.stepNumber;
    });
  }

  function advanceFrom(index) {
    if (index !== currentStep || !validateStep(index)) return;
    furthestStep = Math.max(furthestStep, index + 1);
    showStep(index + 1);
  }

  form.addEventListener("input", () => {
    furthestStep = Math.min(furthestStep, currentStep);
    refreshProgress();
    updateOptionalGroups();
    updateReview();
  });
  form.addEventListener("change", () => {
    furthestStep = Math.min(furthestStep, currentStep);
    refreshProgress();
    updateOptionalGroups();
    updateReview();
  });
  form.addEventListener("reset", () => {
    setTimeout(() => {
      furthestStep = 0;
      oneTimeCostsGroup.open = false;
      livingCostsGroup.open = false;
      updateOptionalGroups();
      showStep(0);
      updateReview();
    }, 0);
  });
  form.addEventListener("submit", event => {
    if (currentStep === panels.length - 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    advanceFrom(currentStep);
  }, true);

  updateOptionalGroups();
  updateReview();
  showStep(0, false);
})();
