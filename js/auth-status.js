(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root?.document) api.initialize(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function readableName(value) {
    if (typeof value !== "string") return "";
    const clean = value.trim().replace(/\s+/g, " ");
    if (!clean || clean.includes("@")) return "";
    return clean;
  }

  function getDisplayName(user) {
    const metadata = user?.user_metadata || {};
    const metadataName = readableName(metadata.full_name || metadata.name || metadata.preferred_name || metadata.preferred_username);
    if (metadataName) return metadataName;
    const givenName = readableName(metadata.given_name), familyName = readableName(metadata.family_name);
    if (givenName || familyName) return [givenName, familyName].filter(Boolean).join(" ");
    const localPart = typeof user?.email === "string" ? user.email.split("@")[0].split("+")[0] : "";
    const words = localPart.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "User";
    return words.map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join(" ");
  }

  function getNavigationState(user) {
    if (!user) return { authenticated: false, displayName: "", email: "", initial: "" };
    const displayName = getDisplayName(user);
    const email = typeof user.email === "string" ? user.email.trim() : "";
    return { authenticated: true, displayName, email, initial: Array.from(displayName)[0].toLocaleUpperCase() };
  }

  function createSessionController(client, onSession, onUnavailable = () => {}) {
    let started = false, eventRevision = 0;
    return Object.freeze({
      start() {
        if (started) return;
        started = true;
        const restoreRevision = eventRevision;
        if (typeof client?.auth?.onAuthStateChange === "function") {
          client.auth.onAuthStateChange((_event, session) => {
            eventRevision += 1;
            onSession(session?.user || null);
          });
        }
        if (typeof client?.auth?.getSession !== "function") { onUnavailable(); return; }
        Promise.resolve(client.auth.getSession()).then(({ data, error } = {}) => {
          if (eventRevision !== restoreRevision) return;
          if (error) onUnavailable();
          else onSession(data?.session?.user || null);
        }).catch(() => { if (eventRevision === restoreRevision) onUnavailable(); });
      },
      async signOut() {
        if (typeof client?.auth?.signOut !== "function") throw new Error("Sign-out is unavailable.");
        const signOutRevision = ++eventRevision;
        const result = await client.auth.signOut();
        if (result?.error) throw result.error;
        if (eventRevision === signOutRevision) onSession(null);
        return result;
      }
    });
  }

  function initialize(root) {
    if (root.__campusBridgeAuthNavigationInitialized) return;
    const document = root.document, slot = document.getElementById("nav-auth-slot");
    if (!slot) return;
    root.__campusBridgeAuthNavigationInitialized = true;

    const neutral = document.createElement("span"); neutral.className = "authNeutral"; neutral.textContent = "Checking account…"; neutral.hidden = true;
    const login = document.createElement("a");
    login.className = "navPill authLoginLink"; login.href = "/account.html#login-form"; login.textContent = "Log in";

    const profile = document.createElement("div"); profile.className = "profileControl"; profile.hidden = true;
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "profileAvatar";
    toggle.setAttribute("aria-haspopup", "true"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-controls", "profile-dropdown");
    const dropdown = document.createElement("div"); dropdown.id = "profile-dropdown"; dropdown.className = "profileDropdown"; dropdown.hidden = true;
    const name = document.createElement("p"); name.className = "profileDisplayName";
    const email = document.createElement("p"); email.className = "profileEmail";
    const status = document.createElement("p"); status.id = "account-status"; status.className = "accountStatus"; status.setAttribute("role", "status"); status.textContent = "Checking sign-in…";
    const account = document.createElement("a"); account.href = "/account.html"; account.textContent = "My Account";
    if (document.body.dataset.page === "account") account.setAttribute("aria-current", "page");
    const logout = document.createElement("button"); logout.type = "button"; logout.className = "profileLogout"; logout.textContent = "Log out";
    dropdown.append(name, email, status, account, logout); profile.append(toggle, dropdown); slot.replaceChildren(neutral, login, profile);

    const closeMenu = (restoreFocus = false) => {
      dropdown.hidden = true; toggle.setAttribute("aria-expanded", "false");
      if (restoreFocus) toggle.focus();
    };
    toggle.addEventListener("click", () => {
      const open = dropdown.hidden;
      dropdown.hidden = !open; toggle.setAttribute("aria-expanded", String(open));
    });
    profile.addEventListener("focusout", event => {
      if (event.relatedTarget && !profile.contains(event.relatedTarget)) closeMenu();
    });
    document.addEventListener("pointerdown", event => { if (!profile.contains(event.target)) closeMenu(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !dropdown.hidden) { closeMenu(true); event.preventDefault(); }
    });

    let renderRevision = 0;
    function renderUser(user) {
      const revision = ++renderRevision, view = getNavigationState(user);
      closeMenu();
      neutral.hidden = true;
      login.hidden = view.authenticated;
      profile.hidden = !view.authenticated;
      slot.hidden = false; slot.setAttribute("aria-busy", "false");
      if (!view.authenticated) {
        status.textContent = root.CampusBridgeSupabase?.configured ? "Not signed in" : "Cloud account setup needed";
        return;
      }
      name.textContent = view.displayName; email.textContent = view.email || "Email unavailable";
      toggle.textContent = view.initial; toggle.setAttribute("aria-label", `Account menu for ${view.displayName}`);
      status.textContent = "Checking sign-in…";
      updateAssuranceStatus(user, revision);
    }

    async function updateAssuranceStatus(user, revision) {
      const mfa = root.CampusBridgeSupabase?.client?.auth?.mfa;
      if (typeof mfa?.getAuthenticatorAssuranceLevel !== "function") {
        if (revision === renderRevision) status.textContent = "Sign-in status unavailable";
        return;
      }
      try {
        const { data, error } = await mfa.getAuthenticatorAssuranceLevel();
        if (revision !== renderRevision) return;
        if (error || !["aal1", "aal2"].includes(data?.currentLevel)) { status.textContent = "Sign-in status unavailable"; return; }
        if (data.currentLevel === "aal2") { status.textContent = "Authenticator verified"; return; }
        const { data: factors, error: factorError } = await mfa.listFactors();
        if (revision !== renderRevision) return;
        if (factorError) { status.textContent = "Sign-in status unavailable"; return; }
        const verified = [...(factors?.totp || []), ...(factors?.phone || [])].some(factor => factor.status === "verified");
        status.textContent = data.nextLevel === "aal2" || verified ? "Authenticator verification required" : `Signed in as ${getDisplayName(user)}`;
      } catch {
        if (revision === renderRevision) status.textContent = "Sign-in status unavailable";
      }
    }

    const client = root.CampusBridgeSupabase?.client;
    const controller = createSessionController(client, renderUser, () => {
      renderRevision += 1; closeMenu(); slot.hidden = false; slot.setAttribute("aria-busy", "false");
      neutral.hidden = false; neutral.textContent = "Account unavailable";
      login.hidden = true; profile.hidden = true; status.textContent = "Sign-in status unavailable";
    });
    logout.addEventListener("click", async () => {
      logout.disabled = true; status.textContent = "Signing out…";
      try { await controller.signOut(); }
      catch { status.textContent = "Could not sign out. Please try again."; }
      finally { logout.disabled = false; }
    });
    if (client) controller.start();
    else renderUser(null);
  }

  return Object.freeze({ getDisplayName, getNavigationState, createSessionController, initialize });
});
