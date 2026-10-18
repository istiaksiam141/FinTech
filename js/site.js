(function () {
  "use strict";
  const groups = [
    { id: "planning", label: "Financial Planning", icon: "chart", pages: [["planner", "Planner", "/planner.html", "calculator"], ["roadmap", "Savings roadmap", "/roadmap.html", "route"], ["stress", "Stress tests", "/stress-tests.html", "chart"]] },
    { id: "support", label: "Transfers & Support", icon: "transfer", pages: [["transfers", "Transfers", "/transfers.html", "arrowsLeftRight"], ["assistant", "AI assistant", "/assistant.html", "messageCircle"]] },
    { id: "account", label: "My Account", icon: "user", pages: [["report", "Financial report", "/report.html", "fileText"], ["account", "Account", "/account.html", "userRound"], ["privacy", "Privacy", "/privacy.html", "shieldCheck"]] }
  ];
  const createIcon = name => {
    const drawings = {
      home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
      chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
      transfer: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="m7 21-4-4 4-4"/><path d="M21 17H3"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
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
    const logo = document.createElement("img"); logo.className = "brandLogo"; logo.src = "/assets/brand/logo-header.png";
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
  const headerTarget = document.getElementById("site-header");
  if (headerTarget) {
    const header = document.createElement("header"); header.id = "topbar"; header.className = "topbar";
    const wrap = document.createElement("div"); wrap.className = "wrap nav";
    const brand = createBrand();
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
      for (const [id, label, href, iconName] of group.pages) {
        const link = document.createElement("a"); link.href = href;
        const linkLabel = document.createElement("span"); linkLabel.textContent = label;
        link.append(createIcon(iconName), linkLabel);
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
    footer.innerHTML = '<div class="wrap footerRow"><span class="footerBrandSlot"></span><span>Planning estimates use your entries and are not guarantees.</span><a href="/privacy.html">Privacy and limitations</a><span>© 2026 CampusBridge · Product prototype</span></div>';
    footer.querySelector(".footerBrandSlot").replaceWith(createBrand());
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
