(function () {
  "use strict";
  const groups = [
    { id: "planning", label: "Plan", icon: "chart", pages: [["planner", "Planner", "/planner.html", "calculator"], ["roadmap", "Savings roadmap", "/roadmap.html", "route"], ["savings", "Savings Tracker", "/savings.html", "chart"], ["stress", "Stress tests", "/stress-tests.html", "chart"]] },
    { id: "more", label: "More", icon: "more", pages: [["transfers", "Transfers", "/transfers.html", "arrowsLeftRight"], ["report", "Financial Report", "/report.html", "fileText"], ["privacy", "Privacy", "/privacy.html", "shieldCheck"]] }
  ];
  const createIcon = name => {
    const drawings = {
      home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
      sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z"/>',
      chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
      transfer: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="m7 21-4-4 4-4"/><path d="M21 17H3"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      calculator: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h2m4 0h2m-8 4h2m4 0h2"/>',
      route: '<circle cx="6" cy="19" r="2"/><path d="M8 19h4a4 4 0 0 0 4-4V9a4 4 0 0 1 4-4"/><circle cx="20" cy="5" r="2"/><path d="M6 17V7a2 2 0 0 1 2-2h3"/>',
      arrowsLeftRight: '<path d="M17 8H3m0 0 4-4M3 8l4 4"/><path d="M7 16h14m0 0-4-4m4 4-4 4"/>',
      messageCircle: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
      fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
      userRound: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
      shieldCheck: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>'
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    svg.classList.add("navIcon"); svg.innerHTML = drawings[name];
    return svg;
  };
  const createBrand = () => {
    const brand = document.createElement("a"); brand.className = "brand"; brand.href = "/";
    const logo = document.createElement("img"); logo.className = "brandLogo";
    logo.src = document.body.dataset.theme === "blue" ? "/assets/brand/logo-transparent.png" : "/assets/brand/logo-header.png";
    logo.alt = "CampusBridge AI"; logo.width = 68; logo.height = 68; logo.decoding = "async";
    const name = document.createElement("span"); name.textContent = "CampusBridge AI"; name.setAttribute("aria-hidden", "true");
    brand.append(logo, name);
    return brand;
  };
  if (!document.querySelector('link[rel~="icon"]')) {
    const favicon = document.createElement("link"); favicon.rel = "icon"; favicon.type = "image/png"; favicon.href = "/assets/brand/logo-favicon.png";
    document.head.append(favicon);
  }
  const page = document.body.dataset.page || "home";
  const themeStorageKey = "campusbridge-theme";
  let blueThemeEnabled = false;
  try {
    blueThemeEnabled = window.localStorage.getItem(themeStorageKey) === "blue";
  } catch (error) {
    console.error("CampusBridge could not load the saved theme preference.", error);
  }
  if (blueThemeEnabled) document.body.dataset.theme = "blue";
  const headerTarget = document.getElementById("site-header");
  if (headerTarget) {
    const header = document.createElement("header"); header.id = "topbar"; header.className = "topbar";
    const wrap = document.createElement("div"); wrap.className = "wrap nav";
    const brand = createBrand();
    const nav = document.createElement("nav"); nav.id = "navlinks"; nav.className = "navlinks"; nav.setAttribute("aria-label", "Main navigation");
    const home = document.createElement("a"); home.href = "/"; home.className = "navPill"; home.append(createIcon("home"), document.createElement("span")); home.lastChild.textContent = "Home";
    if (page === "home") home.setAttribute("aria-current", "page");
    const assistantLink = document.createElement("a"); assistantLink.href = "/assistant.html"; assistantLink.className = "navPill aiNavPill";
    assistantLink.append(createIcon("sparkle"), document.createElement("span")); assistantLink.lastChild.textContent = "AI Assistant";
    if (page === "assistant") assistantLink.setAttribute("aria-current", "page");
    nav.append(home);
    const groupControls = [];
    for (const group of groups) {
      const active = group.pages.some(([id]) => id === page);
      const container = document.createElement("div"); container.className = "navGroup";
      const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "navGroupToggle";
      toggle.id = `nav-${group.id}-toggle`; toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", `nav-${group.id}-links`); toggle.append(createIcon(group.icon));
      const label = document.createElement("span"); label.textContent = group.label; toggle.append(label);
      if (active) { toggle.dataset.active = "true"; toggle.setAttribute("aria-current", "location"); }
      const chevron = createIcon("chevron"); chevron.classList.add("navChevron"); toggle.append(chevron);
      const submenu = document.createElement("div"); submenu.id = `nav-${group.id}-links`; submenu.className = "navDropdown"; submenu.hidden = true;
      for (const [id, label, href, iconName] of group.pages) {
        const link = document.createElement("a"); link.href = href;
        const linkLabel = document.createElement("span"); linkLabel.textContent = label;
        link.append(createIcon(iconName), linkLabel);
        if (id === page) link.setAttribute("aria-current", "page");
        submenu.append(link);
      }
      if (group.id === "planning") {
        const clear = document.createElement("button"); clear.type = "button"; clear.className = "clearPlanButton"; clear.textContent = "Clear saved plan"; clear.dataset.clearPlan = "";
        submenu.append(clear);
      }
      container.append(toggle, submenu); groupControls.push({ id: group.id, container, toggle, submenu });
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        for (const item of groupControls) {
          const itemOpen = item.toggle === toggle ? open : false;
          item.toggle.setAttribute("aria-expanded", String(itemOpen)); item.submenu.hidden = !itemOpen;
        }
      });
      container.addEventListener("focusout", event => {
        if (document.getElementById("clear-plan-dialog")?.open) return;
        if (event.relatedTarget && !container.contains(event.relatedTarget)) {
          toggle.setAttribute("aria-expanded", "false"); submenu.hidden = true;
        }
      });
      submenu.addEventListener("click", event => {
        if (event.target.closest("a")) closeNavigation();
      });
    }
    const planningGroup = groupControls.find(item => item.id === "planning");
    const moreGroup = groupControls.find(item => item.id === "more");
    nav.append(planningGroup.container, assistantLink, moreGroup.container);
    const themeToggle = document.createElement("button"); themeToggle.type = "button"; themeToggle.className = "themeToggle";
    const updateThemeToggle = () => {
      const active = document.body.dataset.theme === "blue";
      themeToggle.textContent = active ? "Original theme" : "Light blue theme";
      themeToggle.setAttribute("aria-label", active ? "Switch to the original theme" : "Switch to the light blue theme");
      themeToggle.setAttribute("aria-pressed", String(active));
      document.querySelectorAll(".brandLogo").forEach(logo => {
        logo.src = active ? "/assets/brand/logo-transparent.png" : "/assets/brand/logo-header.png";
      });
    };
    updateThemeToggle();
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "blue" ? "default" : "blue";
      if (nextTheme === "blue") document.body.dataset.theme = "blue";
      else delete document.body.dataset.theme;
      updateThemeToggle();
      try {
        window.localStorage.setItem(themeStorageKey, nextTheme);
      } catch (error) {
        console.error("CampusBridge could not save the theme preference. The selected theme remains active on this page.", error);
      }
    });
    moreGroup.submenu.append(themeToggle);
    wrap.append(brand, nav);
    const accountStatus = document.createElement("div"); accountStatus.id = "nav-auth-slot"; accountStatus.className = "navAuthSlot"; accountStatus.hidden = true; accountStatus.setAttribute("aria-busy", "true");
    nav.append(accountStatus);
    const menu = document.createElement("button"); menu.type = "button"; menu.id = "menu"; menu.className = "burger"; menu.append(createIcon("menu"));
    menu.setAttribute("aria-label", "Open navigation menu"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-controls", "navlinks");
    wrap.append(menu); header.append(wrap); headerTarget.replaceWith(header);
    function closeGroups() {
      for (const item of groupControls) { item.toggle.setAttribute("aria-expanded", "false"); item.submenu.hidden = true; }
    }
    function closeNavigation() {
      closeGroups(); nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Open navigation menu"); menu.replaceChildren(createIcon("menu"));
    }
    menu.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      if (!open) closeGroups();
      nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); menu.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu"); menu.replaceChildren(createIcon(open ? "close" : "menu"));
    });
    document.addEventListener("pointerdown", event => {
      if (document.getElementById("clear-plan-dialog")?.open) return;
      if (!header.contains(event.target)) closeNavigation();
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const clearDialog = document.getElementById("clear-plan-dialog");
      if (clearDialog?.open) { event.preventDefault(); clearDialog.close("keep"); return; }
      const openGroup = groupControls.find(item => item.toggle.getAttribute("aria-expanded") === "true");
      if (openGroup) { closeGroups(); openGroup.toggle.focus(); event.preventDefault(); }
      else if (nav.classList.contains("open")) { closeNavigation(); menu.focus(); event.preventDefault(); }
    });
  }
  const footerTarget = document.getElementById("site-footer");
  if (footerTarget) {
    const footer = document.createElement("footer"); footer.className = "footer";
    footer.innerHTML = '<div class="wrap footerContent"><div class="footerMain"><div class="footerIdentity"><span class="footerBrandSlot"></span><p>Clearer money planning for your next study-abroad step.</p></div><nav class="footerNav" aria-label="Footer"><div class="footerNavGroup"><h2>Plan</h2><a href="/planner.html">Planner</a><a href="/roadmap.html">Savings roadmap</a><a href="/report.html">Financial report</a></div><div class="footerNavGroup"><h2>Explore</h2><a href="/assistant.html">AI assistant</a><a href="/transfers.html">Transfers</a><a href="/privacy.html">Privacy and limitations</a></div></nav></div><div class="footerNote"><span class="footerNoteMark" aria-hidden="true">i</span><p><strong>Planning note</strong> Estimates use your entries and are for guidance only; they are not guarantees.</p></div><div class="footerBottom"><span>© 2026 CampusBridge · Product prototype</span><span>Built for students planning what comes next</span></div></div>';
    footer.querySelector(".footerBrandSlot").replaceWith(createBrand());
    footerTarget.replaceWith(footer);
  }
  if (document.body.dataset.page) {
    const widget = document.createElement("aside"); widget.id = "campusbridge-assistant-widget"; widget.className = "assistantWidget";
    widget.innerHTML = '<section id="assistant-widget-panel" class="assistantWidgetPanel" role="dialog" aria-modal="false" aria-labelledby="assistant-widget-title" aria-describedby="assistant-widget-privacy" hidden><header class="assistantWidgetHeader"><span class="assistantWidgetAvatar" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><path class="assistantWidgetMark" d="M19 5h26a8 8 0 0 1 7 4l13 22a8 8 0 0 1 0 8L52 61a8 8 0 0 1-7 4H19a8 8 0 0 1-7-4L-1 39a8 8 0 0 1 0-8L12 9a8 8 0 0 1 7-4Z" transform="translate(1 -3) scale(.96)"/><rect class="assistantWidgetEye assistantWidgetEyeOne" x="22" y="26" width="6" height="14" rx="3"/><rect class="assistantWidgetEye assistantWidgetEyeTwo" x="36" y="26" width="6" height="14" rx="3"/></svg></span><div class="assistantWidgetHeaderCopy"><span class="assistantWidgetEyebrow">CampusBridge</span><h2 id="assistant-widget-title">AI assistant</h2></div><div class="assistantWidgetHeaderActions"><button class="assistantWidgetIconButton" type="button" data-assistant-widget-new aria-label="Start a new chat" title="Start a new chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button class="assistantWidgetIconButton" type="button" data-assistant-widget-close aria-label="Close assistant" title="Close assistant"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button></div></header><p id="assistant-widget-privacy" class="assistantWidgetPrivacy">Each question is sent with the current financial report when available. Account details, tracker notes, and quote references are excluded.</p><details class="assistantWidgetPrivacy"><summary>Inspect current report sent</summary><pre data-assistant-widget-report>Open the assistant to prepare the current report.</pre></details><div class="assistantWidgetMessages" data-assistant-widget-messages role="log" aria-live="polite" aria-relevant="additions text"><article class="assistantWidgetMessage assistantWidgetMessageBot"><p>Hi, I’m CampusBridge AI. Ask me about your current study-abroad financial plan.</p><span class="assistantWidgetMessageMeta">Calculations remain deterministic</span></article></div><p class="assistantWidgetStatus" data-assistant-widget-status role="status" aria-live="polite"></p><form class="assistantWidgetForm" data-assistant-widget-form><label class="visuallyHidden" for="assistant-widget-question">Your question</label><textarea id="assistant-widget-question" name="question" rows="1" maxlength="1000" placeholder="Ask a question…" required></textarea><button class="assistantWidgetSend" type="submit" aria-label="Send question" title="Send question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7"/></svg></button></form><a class="assistantWidgetFullLink" href="/assistant.html">Open full assistant <span aria-hidden="true">↗</span></a></section><button class="assistantWidgetLauncher" type="button" aria-label="Open CampusBridge AI assistant" aria-controls="assistant-widget-panel" aria-expanded="false"><span class="assistantWidgetLauncherMark" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><path class="assistantWidgetMark" d="M19 5h26a8 8 0 0 1 7 4l13 22a8 8 0 0 1 0 8L52 61a8 8 0 0 1-7 4H19a8 8 0 0 1-7-4L-1 39a8 8 0 0 1 0-8L12 9a8 8 0 0 1 7-4Z" transform="translate(1 -3) scale(.96)"/><rect class="assistantWidgetEye assistantWidgetEyeOne" x="22" y="26" width="6" height="14" rx="3"/><rect class="assistantWidgetEye assistantWidgetEyeTwo" x="36" y="26" width="6" height="14" rx="3"/></svg></span><span class="assistantWidgetLauncherLabel">Ask AI</span><span class="assistantWidgetLauncherPing" aria-hidden="true"></span></button>';
    document.body.append(widget);
    const assistantScript = document.createElement("script"); assistantScript.src = "/js/assistant-widget.js"; assistantScript.async = true;
    document.body.append(assistantScript);
  }
  if (page === "planner") {
    const plannerGrid = document.querySelector("#planner .plannerGrid");
    if (plannerGrid) {
      const disclosure = document.createElement("aside"); disclosure.className = "storageDisclosure"; disclosure.setAttribute("role", "note");
      disclosure.append(document.createTextNode("A valid plan is stored in this browser tab's session storage so your tools share the same inputs. It is not an account backup. "));
      const link = document.createElement("a"); link.href = "/privacy.html"; link.textContent = "Storage details"; disclosure.append(link);
      plannerGrid.before(disclosure);
    }
  }
  const updateHeader = () => document.getElementById("topbar")?.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", updateHeader, { passive: true }); updateHeader();
  let clearPlanTrigger = null;
  document.querySelectorAll("[data-clear-plan]").forEach(button => button.addEventListener("click", () => {
    const dialog = document.getElementById("clear-plan-dialog");
    if (!dialog || typeof dialog.showModal !== "function") return;
    dialog.returnValue = "";
    const error = dialog.querySelector("[data-clear-plan-error]");
    error.hidden = true; error.textContent = "";
    clearPlanTrigger = button;
    dialog.showModal();
    dialog.querySelector("[data-keep-plan]").focus();
  }));
  if (document.querySelector("[data-clear-plan]") && !document.getElementById("clear-plan-dialog")) {
    const dialog = document.createElement("dialog"); dialog.id = "clear-plan-dialog"; dialog.className = "clearPlanDialog";
    dialog.setAttribute("aria-labelledby", "clear-plan-title"); dialog.setAttribute("aria-describedby", "clear-plan-message");
    dialog.innerHTML = '<div class="clearPlanDialogContent"><h2 id="clear-plan-title">Clear your plan?</h2><p id="clear-plan-message">This will remove your current plan from the planner. Make sure you no longer need it before continuing.</p><p class="clearPlanDialogNote">This clears this browser tab’s current planner state only. Account-saved plans are not deleted.</p><p class="clearPlanDialogError" data-clear-plan-error role="status" aria-live="polite" hidden></p><div class="clearPlanDialogActions"><button type="button" class="button" data-keep-plan>Keep My Plan</button><button type="button" class="button clearPlanConfirm" data-confirm-clear-plan>Clear Plan</button></div></div>';
    document.body.append(dialog);
    const keep = dialog.querySelector("[data-keep-plan]"), confirmClear = dialog.querySelector("[data-confirm-clear-plan]"), error = dialog.querySelector("[data-clear-plan-error]");
    keep.addEventListener("click", () => dialog.close("keep"));
    dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close("keep"); });
    confirmClear.addEventListener("click", () => {
      const cleared = window.CampusBridgePlanState?.clearPlan();
      if (!cleared) { error.textContent = "The current plan could not be cleared in this browser tab. No saved account plan was changed."; error.hidden = false; keep.focus(); return; }
      dialog.close("clear");
      window.location.href = "/planner.html";
    });
    dialog.addEventListener("close", () => clearPlanTrigger?.focus({ preventScroll: true }));
  }
})();
