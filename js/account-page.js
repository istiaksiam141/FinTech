(function () {
  "use strict";
  const client = window.CampusBridgeSupabase?.client;
  const byId = id => document.getElementById(id);
  const status = byId("account-message"), authPanel = byId("auth-panel"), cloudPanel = byId("cloud-plans-panel");
  const mfaStatusBadge = byId("mfa-settings-badge");
  const accountAccess = byId("account-access-layout");
  const authOptions = byId("account-auth-options"), challengePanel = byId("mfa-challenge-panel"), recoveryForm = byId("recovery-complete-form");
  const plansList = byId("cloud-plan-list"), saveForm = byId("cloud-save-form");
  const profileNameForm = byId("profile-name-form"), profileAvatarForm = byId("profile-avatar-form");
  const profileNameInput = byId("profile-display-name");
  const studyCountryPicker = byId("study-country-picker"), studyCountryToggle = byId("study-country-toggle");
  const studyCountryOptions = byId("study-country-options"), studyCountryFlag = byId("study-country-flag");
  const studyCountryValue = byId("study-country-value"), studyCountryStatus = byId("study-country-status");
  const studyCountrySave = byId("study-country-save");
  const studyCountryChoices = [...document.querySelectorAll("[data-study-country]")];
  const studyCountryFlagArtwork = (flag, code) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.classList.add("studyCountryFlagArtwork");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `/assets/study-country-flags.svg#flag-${code}`);
    svg.append(use);
    flag.replaceChildren(svg);
  };
  studyCountryChoices.forEach(option => studyCountryFlagArtwork(option.querySelector(".studyCountryFlag"), option.dataset.studyCountry));
  const profileAvatarStatus = byId("profile-avatar-status"), avatarImage = byId("account-avatar-image");
  const avatarInitial = byId("account-avatar-initial"), avatarRemoveButton = byId("profile-avatar-remove");
  const avatarSaveButton = byId("profile-avatar-save"), avatarChoices = [...document.querySelectorAll("[data-profile-avatar]")];
  const profileAvatars = window.CampusBridgeAuthNavigation;
  const profileSummaryName = byId("profile-summary-name"), profileSummaryEmail = byId("profile-summary-email");
  const authForms = ["signup-form", "login-form", "reset-request-form", "recovery-complete-form", "profile-name-form", "profile-avatar-form", "cloud-save-form", "mfa-challenge-form", "mfa-enroll-form", "mfa-disable-form"].map(byId).filter(Boolean);
  const say = (message, kind = "info") => { status.hidden = false; status.textContent = message; status.dataset.kind = kind; };
  const setBusy = (form, busy) => { form.querySelectorAll("button[type=submit]").forEach(button => { button.disabled = busy; button.dataset.originalText ||= button.textContent; button.textContent = busy ? "Please wait…" : button.dataset.originalText; }); };
  const accountFormHashes = new Set(["#signup-form", "#login-form", "#reset-request-form"]);
  const accountFormIds = [...accountFormHashes].map(hash => hash.slice(1));
  let activeAccountForm = accountFormIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : "login-form";
  const accountIntros = {
    "login-form": ["Welcome ", "back.", "Sign in to access your cloud-saved plans. You can keep planning without an account."],
    "signup-form": ["Create ", "your account.", "Save your plans and return to them whenever you need."],
    "reset-request-form": ["Reset ", "your password.", "We’ll email you a secure link to choose a new password."],
    recovery: ["Choose ", "a new password.", "Set a new password to finish recovering your account."]
  };
  function setAccountIntro(view) {
    const [prefix, emphasis, description] = accountIntros[view] || accountIntros["login-form"];
    const heading = document.querySelector(".accountHero h1");
    heading.firstChild.textContent = prefix;
    heading.querySelector("em").textContent = emphasis;
    document.querySelector(".accountHero .lead").textContent = description;
  }
  function showAccountForm(formId) {
    activeAccountForm = accountFormIds.includes(formId) ? formId : "login-form";
    for (const id of accountFormIds) byId(id).hidden = id !== activeAccountForm;
    setAccountIntro(activeAccountForm);
  }
  function scrollToAccountHash() {
    if (!accountFormHashes.has(location.hash)) {
      if (!recoveryActive) showAccountForm(activeAccountForm);
      return;
    }
    requestAnimationFrame(() => {
      const target = byId(location.hash.slice(1));
      showAccountForm(target?.id);
      if (target && !target.closest("[hidden]")) target.scrollIntoView({ block: "start" });
    });
  }
  window.addEventListener("hashchange", scrollToAccountHash);
  const errorText = error => {
    const message = typeof error?.message === "string" ? error.message : "The request could not be completed.";
    const lower = message.toLowerCase();
    if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) return "Google sign-in is not enabled in Supabase yet. Check Authentication → Providers → Google.";
    if (lower.includes("redirect") || lower.includes("not allowed")) return "This page URL is not allowed yet. Add it under Supabase Authentication → URL Configuration → Redirect URLs.";
    if (lower.includes("invalid login credentials")) return "Email or password is incorrect.";
    if (lower.includes("email not confirmed")) return "Confirm your email using the link we sent, then try signing in.";
    return message.length <= 240 ? message : "The request failed. Please try again or contact support.";
  };
  const cloudPlans = window.CampusBridgeCloudPlans?.createCloudPlans({ client, planState: window.CampusBridgePlanState });
  const mfa = window.CampusBridgeMfaFlow?.createMfaFlow({ client });
  let session = null, loadingPlans = false, security = { status: "checking" }, securityRevision = 0, avatarRevision = 0, selectedAvatarId = null, selectedAvatarUserId = null, studyCountryUserId = null;
  let recoveryActive = new URLSearchParams(location.search).get("flow") === "recovery";

  document.querySelectorAll("[data-password-toggle]").forEach(toggle => {
    const input = toggle.parentElement.querySelector("input");
    const resetVisibility = () => {
      input.type = "password";
      toggle.setAttribute("aria-label", "Show password");
      toggle.setAttribute("aria-pressed", "false");
    };
    toggle.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(visible));
    });
    input.form?.addEventListener("reset", resetVisibility);
  });

  function setAuthVisible() {
    const signedIn = Boolean(session?.user), verified = security.status === "ready";
    const requiringFactor = security.status === "challenge-required";
    const unavailable = security.status === "error" || security.status === "unsupported-factor";
    const showAccountPanel = signedIn && verified && !recoveryActive;
    authPanel.hidden = false;
    accountAccess.hidden = showAccountPanel;
    document.body.classList.toggle("account-panel-only", showAccountPanel);
    cloudPanel.hidden = !showAccountPanel;
    if (showAccountPanel) renderProfileSettings();
    authOptions.hidden = recoveryActive || (signedIn && (requiringFactor || unavailable || security.status === "checking"));
    challengePanel.hidden = !requiringFactor;
    recoveryForm.hidden = !recoveryActive;
    if (recoveryActive) setAccountIntro("recovery");
    else showAccountForm(activeAccountForm);
    document.querySelectorAll("[data-auth-logout]").forEach(button => { button.hidden = !signedIn; });
    updateMfaSettings();
    scrollToAccountHash();
  }
  function displayNameFor(user) {
    const metadata = user?.user_metadata || {};
    const name = metadata.display_name || metadata.full_name || metadata.name || metadata.preferred_name || metadata.preferred_username;
    if (typeof name === "string" && name.trim() && !name.includes("@")) return name.trim().replace(/\s+/g, " ");
    return user?.email?.split("@")[0]?.split("+")[0] || "User";
  }
  function userAvatarPath(user) {
    const path = user?.user_metadata?.avatar_path;
    if (typeof user?.id !== "string" || typeof path !== "string" || !path.startsWith(`${user.id}/`)) return "";
    return /^[a-zA-Z0-9-]+$/.test(path.slice(user.id.length + 1)) ? path : "";
  }
  function renderProfileSettings() {
    const user = session?.user;
    const displayName = displayNameFor(user);
    if (selectedAvatarUserId !== user?.id) {
      selectedAvatarUserId = user?.id || null;
      selectedAvatarId = null;
    }
    profileNameInput.value = displayName;
    profileSummaryName.textContent = displayName;
    profileSummaryEmail.textContent = user?.email || "Email unavailable";
    avatarInitial.textContent = Array.from(displayName)[0].toLocaleUpperCase();
    if (studyCountryUserId !== user?.id) {
      studyCountryUserId = user?.id || null;
      studyCountryToggle.dataset.country = user?.user_metadata?.study_country || "";
    }
    const studyCountry = studyCountryChoices.find(option => option.dataset.studyCountry === user?.user_metadata?.study_country);
    const selectedCountry = studyCountryChoices.find(option => option.dataset.studyCountry === studyCountryToggle.dataset.country);
    const activeCountry = selectedCountry || studyCountry;
    studyCountryToggle.dataset.country = activeCountry?.dataset.studyCountry || "";
    if (activeCountry) studyCountryFlagArtwork(studyCountryFlag, activeCountry.dataset.studyCountry);
    else studyCountryFlag.textContent = "◎";
    studyCountryValue.textContent = activeCountry?.lastElementChild.textContent || "Choose a country";
    studyCountryChoices.forEach(option => {
      const selected = option === activeCountry;
      option.setAttribute("aria-selected", String(selected));
      option.tabIndex = -1;
    });
    studyCountrySave.disabled = !client || !user || !activeCountry || activeCountry === studyCountry;
    studyCountryStatus.textContent = studyCountry
      ? `${studyCountry.lastElementChild.textContent} is saved as your study destination.`
      : "Choose a destination to personalize your profile.";
    const path = userAvatarPath(user), savedAvatarId = profileAvatars?.getAvatarId(user) || "";
    const displayedAvatarId = selectedAvatarId ?? savedAvatarId, revision = ++avatarRevision;
    avatarChoices.forEach(choice => choice.setAttribute("aria-pressed", String(choice.dataset.profileAvatar === displayedAvatarId)));
    avatarRemoveButton.hidden = !path && !savedAvatarId;
    avatarSaveButton.disabled = !client || !user || security.status !== "ready" || !selectedAvatarId || selectedAvatarId === savedAvatarId;
    const showInitial = () => {
      avatarImage.hidden = true;
      avatarImage.removeAttribute("src");
      avatarInitial.hidden = false;
    };
    if (displayedAvatarId) {
      avatarImage.onload = () => {
        if (revision !== avatarRevision) return;
        avatarImage.hidden = false;
        avatarInitial.hidden = true;
      };
      avatarImage.onerror = () => {
        if (revision !== avatarRevision) return;
        showInitial();
        profileAvatarStatus.textContent = "Could not display this avatar. Choose another one and try again.";
      };
      avatarImage.src = profileAvatars.getAvatarUrl(displayedAvatarId);
      avatarImage.hidden = false;
      avatarInitial.hidden = true;
      profileAvatarStatus.textContent = selectedAvatarId && selectedAvatarId !== savedAvatarId
        ? `${profileAvatars.PROFILE_AVATARS[selectedAvatarId]} selected. Save avatar to update your account.`
        : `${profileAvatars.PROFILE_AVATARS[displayedAvatarId]} avatar selected.`;
      return;
    }
    showInitial();
    profileAvatarStatus.textContent = path ? "Loading your current profile picture…" : "Choose an avatar to personalize your account.";
    if (!path) return;
    const storage = client?.storage?.from("profile-photos");
    if (typeof storage?.createSignedUrl !== "function") {
      profileAvatarStatus.textContent = "Could not load your current profile picture. Choose an avatar to replace it.";
      return;
    }
    storage.createSignedUrl(path, 86400).then(({ data, error } = {}) => {
      if (revision !== avatarRevision) return;
      if (error || !data?.signedUrl) {
        profileAvatarStatus.textContent = "Could not load your current profile picture. Choose an avatar to replace it.";
        return;
      }
      avatarImage.onload = () => {
        if (revision !== avatarRevision) return;
        avatarImage.hidden = false;
        avatarInitial.hidden = true;
        profileAvatarStatus.textContent = "Your existing profile picture is private to your account.";
      };
      avatarImage.onerror = () => {
        if (revision === avatarRevision) profileAvatarStatus.textContent = "Could not display your current picture. Choose an avatar to replace it.";
      };
      avatarImage.src = data.signedUrl;
    }).catch(() => {
      if (revision === avatarRevision) profileAvatarStatus.textContent = "Could not load your current profile picture. Choose an avatar to replace it.";
    });
  }
  function storageBucket() {
    const storage = client?.storage?.from("profile-photos");
    if (!storage) throw new Error("Existing profile-picture storage is unavailable. The profile change was saved, but its old image could not be deleted.");
    return storage;
  }
  function updateCurrentUser(user) {
    if (!user) throw new Error("Supabase did not return the updated account. Refresh and check your profile.");
    if (session) session.user = user;
    renderProfileSettings();
  }
  async function deleteOwnedAvatar(path) {
    if (!path) return null;
    const { error } = await storageBucket().remove([path]);
    return error || null;
  }
  function updateMfaSettings() {
    const ready = security.status === "ready", factors = security.factors || [];
    const verifiedFactor = factors.find(factor => factor.status === "verified");
    byId("mfa-settings-status").textContent = !ready ? "Authenticator settings are unavailable until your session is verified." : verifiedFactor ? "A second step is active when you sign in." : "Add a second step to help protect your account.";
    mfaStatusBadge.dataset.state = !ready ? "checking" : verifiedFactor ? "active" : "available";
    mfaStatusBadge.textContent = !ready ? "Checking" : verifiedFactor ? "Enabled" : "Not enabled";
    byId("mfa-enroll-start").hidden = !ready || Boolean(verifiedFactor);
    byId("mfa-disable-start").hidden = !ready || !verifiedFactor;
    byId("mfa-enroll-start").setAttribute("aria-expanded", String(!byId("mfa-enroll-panel").hidden));
    byId("mfa-disable-start").setAttribute("aria-expanded", String(!byId("mfa-disable-form").hidden));
  }
  async function reconcileSession(nextSession = session) {
    session = nextSession || null;
    const revision = ++securityRevision;
    security = session?.user ? { status: "checking" } : { status: "signed-out" };
    setAuthVisible();
    if (!session?.user) {
      studyCountryUserId = null;
      if (mfa?.inspect) void mfa.inspect(null);
      byId("mfa-qr-code").removeAttribute("src");
      byId("mfa-enroll-panel").hidden = true;
      byId("mfa-disable-form").hidden = true;
      ["mfa-challenge-code", "mfa-enroll-code", "mfa-disable-code"].forEach(id => { byId(id).value = ""; });
      return;
    }
    if (!mfa?.inspect) security = { status: "error", error: "MFA status checks are unavailable. Refresh before using cloud features." };
    else security = await mfa.inspect(session);
    if (revision !== securityRevision) return;
    if (security.status === "challenge-required") {
      try {
        if (!security.challengeId) security.challengeId = await mfa.startChallenge(security.factor.id, { reuse: true });
      } catch { security = { status: "error", error: "Could not start authenticator verification. Use the account page again or sign out." }; }
    }
    if (revision !== securityRevision) return;
    setAuthVisible();
    if (security.status === "ready") {
      if (!recoveryActive) say("Your account is verified.", "success");
      loadPlans();
    } else if (security.error) say(security.error, "error");
    else if (security.status === "challenge-required") say("Verify the authenticator code to finish signing in.");
  }
  async function loadPlans() {
    if (!session?.user || security.status !== "ready" || !cloudPlans || loadingPlans) return;
    const requestRevision = securityRevision, requestUserId = session.user.id;
    loadingPlans = true; plansList.replaceChildren(); byId("cloud-plan-loading").hidden = false;
    let result;
    try { result = await cloudPlans.listPlans(); }
    catch { result = { ok: false, error: "Could not load saved plans because the connection failed. Try again." }; }
    finally { byId("cloud-plan-loading").hidden = true; loadingPlans = false; }
    if (requestRevision !== securityRevision || requestUserId !== session?.user?.id || security.status !== "ready") {
      if (session?.user && security.status === "ready") loadPlans();
      return;
    }
    if (!result.ok) { say(result.error, "error"); return; }
    if (!result.plans.length) { const empty = document.createElement("p"); empty.className = "emptyNote"; empty.textContent = "You have no cloud-saved plans yet."; plansList.append(empty); return; }
    for (const plan of result.plans) {
      const item = document.createElement("article"); item.className = "surface cloudPlanItem";
      const title = document.createElement("h3"); title.textContent = plan.planName;
      const updated = document.createElement("p"); updated.className = "small muted"; updated.textContent = plan.updatedAt ? `Updated ${new Date(plan.updatedAt).toLocaleString()}` : "Saved plan";
      const actions = document.createElement("div"); actions.className = "inlineButtons";
      const load = document.createElement("button"); load.type = "button"; load.className = "button primary"; load.textContent = "Load into planner";
      load.addEventListener("click", () => {
        const restored = cloudPlans.restorePlan(plan);
        if (!restored.ok) { say(restored.error, "error"); return; }
        say("Plan validated and restored locally. Opening the planner to recalculate it.", "success"); location.href = "/planner.html";
      });
      const rename = document.createElement("button"); rename.type = "button"; rename.className = "button"; rename.textContent = "Rename";
      rename.addEventListener("click", async () => {
        const name = window.prompt("Enter a new name for this saved plan:", plan.planName); if (name === null) return;
        const result = await cloudPlans.renamePlan(plan.id, name);
        if (!result.ok) { say(result.error, "error"); return; }
        say("Saved plan renamed.", "success"); loadPlans();
      });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button"; remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete “${plan.planName}” from your cloud-saved plans? This cannot be undone.`)) return;
        const result = await cloudPlans.deletePlan(plan.id);
        if (!result.ok) { say(result.error, "error"); return; }
        say("Cloud-saved plan deleted. Your current local planner inputs were not changed.", "success"); loadPlans();
      });
      actions.append(load, rename, remove); item.append(title, updated, actions); plansList.append(item);
    }
  }
  async function submit(form, action) {
    setBusy(form, true);
    try { await action(); } catch (error) { say(errorText(error), "error"); }
    finally { setBusy(form, false); }
  }
  function codeValue(id) { const field = byId(id); const code = field.value.trim(); field.value = ""; return code; }
  if (!client) {
    say(window.CampusBridgeSupabase?.configured && !window.CampusBridgeSupabase.libraryAvailable ? "Supabase client could not load. Check your network connection and refresh." : "Cloud accounts are not configured yet. Add the project's browser-safe publishable key in js/supabase-config.js; never use a service-role key.", "error");
    authForms.forEach(form => form.querySelectorAll("button").forEach(button => { button.disabled = true; }));
  }
  profileNameForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!client || !session?.user || security.status !== "ready") return;
    submit(profileNameForm, async () => {
      const displayName = profileNameInput.value.trim();
      if (!displayName || displayName.length > 40) throw new Error("Enter a username between 1 and 40 characters.");
      const { data, error } = await client.auth.updateUser({ data: { display_name: displayName } });
      if (error) throw error;
      updateCurrentUser(data?.user);
      say("Your username has been updated.", "success");
    });
  });
  const closeStudyCountryOptions = (restoreFocus = false) => {
    studyCountryOptions.hidden = true;
    studyCountryToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) studyCountryToggle.focus();
  };
  const openStudyCountryOptions = () => {
    studyCountryOptions.hidden = false;
    studyCountryToggle.setAttribute("aria-expanded", "true");
    const active = studyCountryChoices.find(option => option.dataset.studyCountry === studyCountryToggle.dataset.country) || studyCountryChoices[0];
    active?.focus();
  };
  studyCountryToggle.addEventListener("click", () => {
    if (studyCountryOptions.hidden) openStudyCountryOptions();
    else closeStudyCountryOptions();
  });
  studyCountryToggle.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openStudyCountryOptions();
  });
  studyCountryOptions.addEventListener("click", event => {
    const option = event.target.closest("[data-study-country]");
    if (!option) return;
    studyCountryToggle.dataset.country = option.dataset.studyCountry;
    studyCountryFlagArtwork(studyCountryFlag, option.dataset.studyCountry);
    studyCountryValue.textContent = option.lastElementChild.textContent;
    studyCountryChoices.forEach(choice => choice.setAttribute("aria-selected", String(choice === option)));
    const savedCode = session?.user?.user_metadata?.study_country || "";
    studyCountrySave.disabled = !client || !session?.user || option.dataset.studyCountry === savedCode;
    studyCountryStatus.textContent = option.dataset.studyCountry === savedCode
      ? `${option.lastElementChild.textContent} is already saved as your study destination.`
      : `Selected ${option.lastElementChild.textContent}. Save to update your profile.`;
    closeStudyCountryOptions(true);
  });
  studyCountryOptions.addEventListener("keydown", event => {
    const currentIndex = studyCountryChoices.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % studyCountryChoices.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + studyCountryChoices.length) % studyCountryChoices.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = studyCountryChoices.length - 1;
    else if (event.key === "Escape") { event.preventDefault(); closeStudyCountryOptions(true); return; }
    else if (event.key === "Tab") { closeStudyCountryOptions(); return; }
    else return;
    event.preventDefault();
    studyCountryChoices[nextIndex]?.focus();
  });
  studyCountryPicker.addEventListener("focusout", event => {
    if (event.relatedTarget && !studyCountryPicker.contains(event.relatedTarget)) closeStudyCountryOptions();
  });
  document.addEventListener("pointerdown", event => {
    if (!studyCountryPicker.contains(event.target)) closeStudyCountryOptions();
  });
  studyCountrySave.addEventListener("click", async () => {
    if (!client || !session?.user || security.status !== "ready" || studyCountrySave.disabled) return;
    const countryCode = studyCountryToggle.dataset.country;
    studyCountrySave.disabled = true;
    studyCountrySave.textContent = "Saving…";
    try {
      const { data, error } = await client.auth.updateUser({ data: { study_country: countryCode } });
      if (error) throw error;
      updateCurrentUser(data?.user);
      studyCountryStatus.textContent = `${studyCountryValue.textContent} is saved as your study destination.`;
      say("Your study destination has been updated.", "success");
    } catch (error) {
      studyCountryStatus.textContent = errorText(error);
      studyCountrySave.disabled = false;
      say(errorText(error), "error");
    } finally {
      studyCountrySave.textContent = "Save country";
    }
  });
  avatarChoices.forEach(choice => choice.addEventListener("click", () => {
    selectedAvatarId = choice.dataset.profileAvatar;
    renderProfileSettings();
  }));
  profileAvatarForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!client || !session?.user || security.status !== "ready" || !selectedAvatarId) return;
    submit(profileAvatarForm, async () => {
      const oldPath = userAvatarPath(session.user);
      const { data, error } = await client.auth.updateUser({ data: { avatar_id: selectedAvatarId, avatar_path: null } });
      if (error) throw error;
      selectedAvatarId = null;
      updateCurrentUser(data?.user);
      if (oldPath) {
        try {
          const cleanupError = await deleteOwnedAvatar(oldPath);
          if (cleanupError) {
            say("Your avatar was saved, but your previous uploaded picture could not be removed from storage.", "error");
            return;
          }
        } catch (error) {
          say(`Your avatar was saved, but the previous uploaded picture could not be removed: ${errorText(error)}`, "error");
          return;
        }
      }
      say("Your profile avatar has been updated.", "success");
    }).finally(renderProfileSettings);
  });
  avatarRemoveButton.addEventListener("click", () => {
    if (!client || !session?.user || security.status !== "ready") return;
    avatarRemoveButton.disabled = true;
    submit(profileAvatarForm, async () => {
      const oldPath = userAvatarPath(session.user);
      const { data, error } = await client.auth.updateUser({ data: { avatar_id: null, avatar_path: null } });
      if (error) throw error;
      selectedAvatarId = null;
      updateCurrentUser(data?.user);
      if (oldPath) {
        try {
          const cleanupError = await deleteOwnedAvatar(oldPath);
          if (cleanupError) {
            say("Your profile now uses initials, but your previous uploaded picture could not be removed from storage.", "error");
            return;
          }
        } catch (cleanupError) {
          say(`Your profile now uses initials, but the previous uploaded picture could not be removed: ${errorText(cleanupError)}`, "error");
          return;
        }
      }
      say("Your profile now uses your initials.", "success");
    }).finally(() => {
      avatarRemoveButton.disabled = false;
      renderProfileSettings();
    });
  });
  byId("signup-form").addEventListener("submit", event => {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    submit(form, async () => {
      const email = byId("signup-email").value.trim(), password = byId("signup-password").value;
      if (password !== byId("signup-confirm-password").value) { say("The passwords do not match.", "error"); return; }
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/account.html?confirmed=1` } });
      if (error) throw error;
      if (data.session) await reconcileSession(data.session);
      else say("Check your email and follow the confirmation link before signing in.", "success");
      form.reset();
    });
  });
  byId("login-form").addEventListener("submit", event => {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    submit(form, async () => {
      const { data, error } = await client.auth.signInWithPassword({ email: byId("login-email").value.trim(), password: byId("login-password").value });
      if (error) throw error;
      form.reset(); if (data.session) await reconcileSession(data.session);
    });
  });
  byId("google-signin").addEventListener("click", () => {
    if (!client) return;
    submit(byId("login-form"), async () => {
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/account.html` } });
      if (error) throw error;
    });
  });
  byId("reset-request-form").addEventListener("submit", event => {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    submit(form, async () => {
      const { error } = await client.auth.resetPasswordForEmail(byId("reset-email").value.trim(), { redirectTo: `${location.origin}/account.html?flow=recovery` });
      if (error) throw error;
      say("If the email belongs to an account, Supabase will send a password-reset link.", "success"); form.reset();
    });
  });
  recoveryForm.addEventListener("submit", event => {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    submit(form, async () => {
      if (!session) { say("Open the password-reset link from your email again to continue.", "error"); return; }
      const password = byId("new-password").value;
      if (password !== byId("new-password-confirm").value) { say("The passwords do not match.", "error"); return; }
      const { error } = await client.auth.updateUser({ password }); if (error) throw error;
      recoveryActive = false; recoveryForm.hidden = true; say("Your password has been updated.", "success"); form.reset();
      await reconcileSession(session);
    });
  });
  byId("mfa-challenge-form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget;
    submit(form, async () => {
      await mfa.verifyCode(codeValue("mfa-challenge-code"));
      await reconcileSession(session);
    });
  });
  byId("mfa-challenge-retry").addEventListener("click", () => submit(byId("mfa-challenge-form"), async () => {
    const challengeId = await mfa.startChallenge(security.factor.id);
    security.challengeId = challengeId; say("A new authenticator challenge is ready. Enter its current six-digit code.");
  }));
  saveForm.addEventListener("submit", event => {
    event.preventDefault(); if (!client || !session || security.status !== "ready") return;
    const form = event.currentTarget;
    submit(form, async () => {
      const saved = window.CampusBridgePlanState?.loadPlan();
      if (!saved?.ok) { say("Calculate a valid plan on the planner before saving it to your account.", "error"); return; }
      const result = await cloudPlans.createPlan(byId("cloud-plan-name").value, saved.profile);
      if (!result.ok) throw new Error(result.error);
      form.reset(); say("A new cloud-saved copy was created. Existing saved plans were not overwritten.", "success"); loadPlans();
    });
  });
  byId("mfa-enroll-start").addEventListener("click", () => submit(byId("mfa-enroll-form"), async () => {
    const setup = await mfa.beginEnrollment();
    const image = byId("mfa-qr-code"); image.src = setup.qrCode; image.hidden = false;
    byId("mfa-enroll-panel").hidden = false; byId("mfa-enroll-start").hidden = true;
    byId("mfa-enroll-start").setAttribute("aria-expanded", "true");
    byId("mfa-enroll-code").focus();
    say("Scan the QR code, then enter a current code to complete setup.");
  }));
  byId("mfa-enroll-form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget;
    submit(form, async () => {
      await mfa.verifyEnrollment(codeValue("mfa-enroll-code"));
      byId("mfa-enroll-panel").hidden = true; byId("mfa-enroll-start").setAttribute("aria-expanded", "false"); byId("mfa-qr-code").removeAttribute("src");
      await reconcileSession(session); say("Authenticator app enabled and verified.", "success");
    });
  });
  byId("mfa-enroll-retry").addEventListener("click", () => submit(byId("mfa-enroll-form"), async () => {
    await mfa.retryEnrollmentChallenge();
    byId("mfa-enroll-code").value = "";
    say("A fresh authenticator challenge is ready. Enter a current six-digit code to finish setup.");
  }));
  byId("mfa-enroll-cancel").addEventListener("click", () => submit(byId("mfa-enroll-form"), async () => {
    await mfa.cancelEnrollment(); byId("mfa-enroll-panel").hidden = true; byId("mfa-enroll-start").setAttribute("aria-expanded", "false"); byId("mfa-qr-code").removeAttribute("src");
    say("Authenticator setup was canceled."); await reconcileSession(session); byId("mfa-enroll-start").focus();
  }));
  byId("mfa-disable-start").addEventListener("click", () => submit(byId("mfa-disable-form"), async () => {
    const factor = (security.factors || []).find(item => item.status === "verified");
    if (!factor) throw new Error("No verified authenticator was found.");
    await mfa.startChallenge(factor.id, { purpose: "disable" }); security.disableFactorId = factor.id; byId("mfa-disable-form").hidden = false; byId("mfa-disable-start").setAttribute("aria-expanded", "true");
    byId("mfa-disable-start").hidden = true; byId("mfa-disable-code").focus(); say("Enter a current authenticator code to confirm removal.");
  }));
  byId("mfa-disable-form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget;
    submit(form, async () => {
      await mfa.disable(security.disableFactorId, codeValue("mfa-disable-code"));
      form.hidden = true; await client.auth.refreshSession(); await reconcileSession(session);
      say("Authenticator app disabled after verification.", "success");
    });
  });
  byId("mfa-disable-cancel").addEventListener("click", () => {
    mfa.cancelDisable(security.disableFactorId);
    byId("mfa-disable-form").reset(); byId("mfa-disable-form").hidden = true; byId("mfa-disable-start").hidden = false; byId("mfa-disable-start").setAttribute("aria-expanded", "false"); byId("mfa-disable-start").focus();
  });
  document.querySelectorAll("[data-auth-logout]").forEach(button => button.addEventListener("click", async () => {
    if (!client) return;
    if (typeof window.CampusBridgeLogoutRequest !== "function") { say("Logout confirmation is unavailable. Refresh the page and try again.", "error"); return; }
    await window.CampusBridgeLogoutRequest(button, async () => {
      button.disabled = true;
      try {
        const { error } = await client.auth.signOut();
        if (error) say(errorText(error), "error");
        else { say("You are signed out. Your local plan remains in this tab; cloud plans are unchanged.", "success"); location.href = "/account.html#login-form"; }
      } catch { say("Could not sign out because the connection failed.", "error"); }
      finally { button.disabled = false; }
    });
  }));
  client?.auth.onAuthStateChange((event, nextSession) => {
    if (event === "PASSWORD_RECOVERY") recoveryActive = true;
    setTimeout(() => reconcileSession(nextSession), 0);
    if (event === "PASSWORD_RECOVERY") say("Choose a new password to finish resetting your account.");
  });
  if (client) client.auth.getSession().then(({ data, error }) => {
    if (error) { security = { status: "error", error: "Could not check your sign-in session. Refresh the page or sign in again." }; setAuthVisible(); say(security.error, "error"); return; }
    return reconcileSession(data?.session || null).then(() => {
      if (recoveryActive) say(session ? "Choose a new password to finish resetting your account." : "Open the password-reset link from your email again to continue.");
      else if (new URLSearchParams(location.search).has("confirmed")) say(session ? "Email confirmed. You are signed in." : "Email confirmation link received. Sign in to continue.", "success");
    });
  }).catch(() => { security = { status: "error", error: "Could not check your sign-in session. Refresh the page or sign in again." }; setAuthVisible(); say(security.error, "error"); });
  const oauthError = new URLSearchParams(location.search).get("error_description");
  if (oauthError) say(`Sign-in could not be completed: ${oauthError.slice(0, 180)}`, "error");
})();
