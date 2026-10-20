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
    const metadataName = readableName(metadata.display_name || metadata.full_name || metadata.name || metadata.preferred_name || metadata.preferred_username);
    if (metadataName) return metadataName;
    const givenName = readableName(metadata.given_name), familyName = readableName(metadata.family_name);
    if (givenName || familyName) return [givenName, familyName].filter(Boolean).join(" ");
    const localPart = typeof user?.email === "string" ? user.email.split("@")[0].split("+")[0] : "";
    const words = localPart.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "User";
    return words.map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join(" ");
  }

  function getAvatarPath(user) {
    const userId = user?.id, path = user?.user_metadata?.avatar_path;
    if (typeof userId !== "string" || typeof path !== "string") return "";
    const parts = path.split("/");
    return parts.length === 2 && parts[0] === userId && /^[a-zA-Z0-9-]+$/.test(parts[1]) ? path : "";
  }

  function getNavigationState(user) {
    if (!user) return { authenticated: false, displayName: "", email: "", initial: "", avatarPath: "", studyCountry: "" };
    const displayName = getDisplayName(user);
    const email = typeof user.email === "string" ? user.email.trim() : "";
    const studyCountry = typeof user.user_metadata?.study_country === "string" ? user.user_metadata.study_country : "";
    return { authenticated: true, displayName, email, initial: Array.from(displayName)[0].toLocaleUpperCase(), avatarPath: getAvatarPath(user), studyCountry };
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

  function createLogoutController(confirmLogout) {
    let busy = false;
    return async function requestLogout(trigger, action) {
      if (busy) return false;
      busy = true;
      try {
        if (!(await confirmLogout(trigger))) return false;
        await action();
        return true;
      } finally { busy = false; }
    };
  }

  function createLogoutConfirmation(root) {
    const document = root.document;
    const dialog = document.createElement("dialog"); dialog.id = "logout-confirm-dialog"; dialog.className = "clearPlanDialog logoutConfirmDialog";
    dialog.setAttribute("aria-labelledby", "logout-confirm-title"); dialog.setAttribute("aria-describedby", "logout-confirm-message");
    dialog.innerHTML = '<div class="clearPlanDialogContent"><h2 id="logout-confirm-title">Log out of CampusBridge AI?</h2><p id="logout-confirm-message">Are you sure you want to log out of your account?</p><div class="clearPlanDialogActions"><button type="button" class="button" data-cancel-logout>Cancel</button><button type="button" class="button clearPlanConfirm" data-confirm-logout>Yes, log out</button></div></div>';
    document.body.append(dialog);
    const cancel = dialog.querySelector("[data-cancel-logout]"), confirm = dialog.querySelector("[data-confirm-logout]");
    let resolveDecision = null, invoker = null;
    cancel.addEventListener("click", () => dialog.close("cancel"));
    confirm.addEventListener("click", () => dialog.close("logout"));
    dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close("cancel"); });
    dialog.addEventListener("close", () => {
      const resolve = resolveDecision; resolveDecision = null;
      if (resolve) resolve(dialog.returnValue === "logout");
      const returnTo = invoker; invoker = null;
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    });
    return trigger => {
      if (dialog.open || resolveDecision) return Promise.resolve(false);
      return new Promise(resolve => {
        resolveDecision = resolve; invoker = trigger || document.activeElement;
        try { dialog.returnValue = ""; dialog.showModal(); cancel.focus(); }
        catch { resolveDecision = null; invoker = null; resolve(false); }
      });
    };
  }

  function initialize(root) {
    if (root.__campusBridgeAuthNavigationInitialized) return;
    const document = root.document, slot = document.getElementById("nav-auth-slot");
    if (!slot) return;
    root.__campusBridgeAuthNavigationInitialized = true;
    root.CampusBridgeLogoutRequest = createLogoutController(createLogoutConfirmation(root));

    const neutral = document.createElement("span"); neutral.className = "authNeutral"; neutral.textContent = "Checking account…"; neutral.hidden = true;
    const login = document.createElement("a");
    login.className = "navPill authLoginLink"; login.href = "/account.html#login-form"; login.textContent = "Log in";

    const profile = document.createElement("div"); profile.className = "profileControl"; profile.hidden = true;
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "profileAvatar";
    const initial = document.createElement("span"); initial.className = "profileAvatarInitial";
    const image = document.createElement("img"); image.className = "profileAvatarImage"; image.alt = ""; image.hidden = true;
    image.referrerPolicy = "no-referrer";
    toggle.append(initial, image);
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
      root.dispatchEvent(new root.CustomEvent("campusbridge:study-destination", { detail: { studyCountry: view.studyCountry } }));
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
      initial.textContent = view.initial; initial.hidden = false; image.hidden = true; image.removeAttribute("src");
      toggle.setAttribute("aria-label", `Account menu for ${view.displayName}`);
      if (view.avatarPath) {
        const storage = root.CampusBridgeSupabase?.client?.storage?.from("profile-photos");
        if (typeof storage?.createSignedUrl === "function") {
          storage.createSignedUrl(view.avatarPath, 86400).then(({ data, error } = {}) => {
            if (revision !== renderRevision || error || !data?.signedUrl) return;
            image.onload = () => {
              if (revision !== renderRevision) return;
              image.hidden = false;
              initial.hidden = true;
            };
            image.onerror = () => { if (revision === renderRevision) image.hidden = true; };
            image.src = data.signedUrl;
          }).catch(() => { if (revision === renderRevision) image.hidden = true; });
        }
      }
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
      await root.CampusBridgeLogoutRequest(logout, async () => {
        logout.disabled = true; status.textContent = "Signing out…";
        try {
          await controller.signOut();
          root.location.href = "/account.html#login-form";
        } catch { status.textContent = "Could not sign out. Please try again."; }
        finally { logout.disabled = false; }
      });
    });
    if (client) controller.start();
    else renderUser(null);
  }

  return Object.freeze({ getDisplayName, getAvatarPath, getNavigationState, createSessionController, createLogoutController, initialize });
});
