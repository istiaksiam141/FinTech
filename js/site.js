(function () {
  "use strict";
  const groups = [
    { id: "planning", label: "Financial Planning", pages: [["planner", "Planner", "/planner.html"], ["roadmap", "Savings roadmap", "/roadmap.html"], ["stress", "Stress tests", "/stress-tests.html"]] },
    { id: "support", label: "Transfers & Support", pages: [["transfers", "Transfers", "/transfers.html"], ["assistant", "AI assistant", "/assistant.html"]] },
    { id: "account", label: "My Account", pages: [["report", "Financial report", "/report.html"], ["account", "Account", "/account.html"], ["privacy", "Privacy", "/privacy.html"]] }
  ];
  const page = document.body.dataset.page || "home";
  const headerTarget = document.getElementById("site-header");
  if (headerTarget) {
    const header = document.createElement("header"); header.id = "topbar"; header.className = "topbar";
    const wrap = document.createElement("div"); wrap.className = "wrap nav";
    const brand = document.createElement("a"); brand.className = "brand"; brand.href = "/";
    const mark = document.createElement("span"); mark.className = "brandmark"; mark.setAttribute("aria-hidden", "true"); mark.textContent = "C";
    brand.append(mark, document.createTextNode("CampusBridge AI"));
    const nav = document.createElement("nav"); nav.id = "navlinks"; nav.className = "navlinks"; nav.setAttribute("aria-label", "Main navigation");
    const home = document.createElement("a"); home.href = "/"; home.textContent = "Home";
    if (page === "home") home.setAttribute("aria-current", "page");
    nav.append(home);
    const groupControls = [];
    for (const group of groups) {
      const active = group.pages.some(([id]) => id === page);
      const container = document.createElement("div"); container.className = "navGroup";
      const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "navGroupToggle";
      toggle.id = `nav-${group.id}-toggle`; toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", `nav-${group.id}-links`); toggle.textContent = group.label;
      if (active) { toggle.dataset.active = "true"; toggle.setAttribute("aria-current", "location"); }
      const chevron = document.createElement("span"); chevron.className = "navChevron"; chevron.setAttribute("aria-hidden", "true"); chevron.textContent = "⌄"; toggle.append(chevron);
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
    const menu = document.createElement("button"); menu.type = "button"; menu.id = "menu"; menu.className = "burger"; menu.textContent = "☰";
    menu.setAttribute("aria-label", "Open navigation menu"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-controls", "navlinks");
    wrap.append(brand, nav, menu); header.append(wrap); headerTarget.replaceWith(header);
    function closeGroups() {
      for (const item of groupControls) { item.toggle.setAttribute("aria-expanded", "false"); item.submenu.hidden = true; }
    }
    function closeNavigation() {
      closeGroups(); nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Open navigation menu"); menu.textContent = "☰";
    }
    menu.addEventListener("click", () => {
      const open = !nav.classList.contains("open");
      if (!open) closeGroups();
      nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); menu.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu"); menu.textContent = open ? "×" : "☰";
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
