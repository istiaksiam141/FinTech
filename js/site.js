(function () {
  "use strict";
  const groups = [
    { id: "planning", label: "Financial Planning", icon: "chart", pages: [["planner", "Planner", "/planner.html"], ["roadmap", "Savings roadmap", "/roadmap.html"], ["stress", "Stress tests", "/stress-tests.html"]] },
    { id: "support", label: "Transfers & Support", icon: "transfer", pages: [["transfers", "Transfers", "/transfers.html"], ["assistant", "AI assistant", "/assistant.html"]] },
    { id: "account", label: "My Account", icon: "user", pages: [["report", "Financial report", "/report.html"], ["account", "Account", "/account.html"], ["privacy", "Privacy", "/privacy.html"]] }
  ];
  const createIcon = name => {
    const drawings = {
      home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
      chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
      transfer: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="m7 21-4-4 4-4"/><path d="M21 17H3"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
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
  const page = document.body.dataset.page || "home";
  const headerTarget = document.getElementById("site-header");
  if (headerTarget) {
    const header = document.createElement("header"); header.id = "topbar"; header.className = "topbar";
    const wrap = document.createElement("div"); wrap.className = "wrap nav";
    const brand = document.createElement("a"); brand.className = "brand"; brand.href = "/";
    const mark = document.createElement("span"); mark.className = "brandmark"; mark.setAttribute("aria-hidden", "true"); mark.textContent = "C";
    brand.append(mark, document.createTextNode("CampusBridge AI"));
    const nav = document.createElement("nav"); nav.id = "navlinks"; nav.className = "navlinks"; nav.setAttribute("aria-label", "Main navigation");
    const home = document.createElement("a"); home.href = "/"; home.className = "navPill"; home.append(createIcon("home"), document.createElement("span")); home.lastChild.textContent = "Home";
    if (page === "home") home.setAttribute("aria-current", "page");
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
      for (const [id, label, href] of group.pages) {
        const link = document.createElement("a"); link.href = href; link.textContent = label;
        if (id === page) link.setAttribute("aria-current", "page");
        submenu.append(link);
      }
      container.append(toggle, submenu); nav.append(container); groupControls.push({ container, toggle, submenu });
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        for (const item of groupControls) {
          const itemOpen = item.toggle === toggle ? open : false;
          item.toggle.setAttribute("aria-expanded", String(itemOpen)); item.submenu.hidden = !itemOpen;
        }
      });
      container.addEventListener("focusout", event => {
        if (event.relatedTarget && !container.contains(event.relatedTarget)) {
          toggle.setAttribute("aria-expanded", "false"); submenu.hidden = true;
        }
      });
      submenu.addEventListener("click", event => {
        if (event.target.closest("a")) closeNavigation();
      });
    }
    const accountStatus = document.createElement("span"); accountStatus.id = "account-status"; accountStatus.className = "accountStatus"; accountStatus.setAttribute("role", "status"); accountStatus.textContent = "Checking account…";
    const clear = document.createElement("button"); clear.type = "button"; clear.className = "button smallbtn clearPlanButton"; clear.textContent = "Clear plan"; clear.dataset.clearPlan = "";
    nav.append(accountStatus, clear);
    const menu = document.createElement("button"); menu.type = "button"; menu.id = "menu"; menu.className = "burger"; menu.append(createIcon("menu"));
    menu.setAttribute("aria-label", "Open navigation menu"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-controls", "navlinks");
    wrap.append(brand, nav, menu); header.append(wrap); headerTarget.replaceWith(header);
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
    document.addEventListener("pointerdown", event => { if (!header.contains(event.target)) closeNavigation(); });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const openGroup = groupControls.find(item => item.toggle.getAttribute("aria-expanded") === "true");
      if (openGroup) { closeGroups(); openGroup.toggle.focus(); event.preventDefault(); }
      else if (nav.classList.contains("open")) { closeNavigation(); menu.focus(); event.preventDefault(); }
    });
  }
  const footerTarget = document.getElementById("site-footer");
  if (footerTarget) {
    const footer = document.createElement("footer"); footer.className = "footer";
    footer.innerHTML = '<div class="wrap footerRow"><a class="brand" href="/"><span class="brandmark" aria-hidden="true">C</span>CampusBridge AI</a><span>Planning estimates use your entries and are not guarantees.</span><a href="/privacy.html">Privacy and limitations</a><span>© 2026 CampusBridge · Product prototype</span></div>';
    footerTarget.replaceWith(footer);
  }
  const main = document.getElementById("main-content") || document.querySelector("main");
  if (main) {
    const disclosure = document.createElement("aside"); disclosure.className = "storageDisclosure"; disclosure.setAttribute("role", "note");
    disclosure.append(document.createTextNode("A valid plan is stored in this browser tab's session storage so your tools share the same inputs. It is not an account backup. "));
    const link = document.createElement("a"); link.href = "/privacy.html"; link.textContent = "Storage details"; disclosure.append(link); main.prepend(disclosure);
  }
  const updateHeader = () => document.getElementById("topbar")?.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", updateHeader, { passive: true }); updateHeader();
  document.querySelectorAll("[data-clear-plan]").forEach(button => button.addEventListener("click", () => {
    if (!window.confirm("Clear the saved plan from this browser tab? This cannot be undone.")) return;
    const cleared = window.CampusBridgePlanState?.clearPlan();
    if (!cleared) { window.alert("The saved plan could not be cleared in this browser session."); return; }
    window.location.href = "/planner.html";
  }));
})();
