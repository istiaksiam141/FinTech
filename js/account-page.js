(function () {
  "use strict";
  const client = window.CampusBridgeSupabase?.client;
  const byId = id => document.getElementById(id);
  const status = byId("account-message"), authPanel = byId("auth-panel"), cloudPanel = byId("cloud-plans-panel");
  const authOptions = byId("account-auth-options"), challengePanel = byId("mfa-challenge-panel"), recoveryForm = byId("recovery-complete-form");
  const plansList = byId("cloud-plan-list"), saveForm = byId("cloud-save-form");
  const authForms = ["signup-form", "login-form", "reset-request-form", "recovery-complete-form", "cloud-save-form", "mfa-challenge-form", "mfa-enroll-form", "mfa-disable-form"].map(byId).filter(Boolean);
  const say = (message, kind = "info") => { status.textContent = message; status.dataset.kind = kind; };
  const setBusy = (form, busy) => { form.querySelectorAll("button[type=submit]").forEach(button => { button.disabled = busy; button.dataset.originalText ||= button.textContent; button.textContent = busy ? "Please wait…" : button.dataset.originalText; }); };
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
  let session = null, loadingPlans = false, security = { status: "checking" }, securityRevision = 0;
  let recoveryActive = new URLSearchParams(location.search).get("flow") === "recovery";

  function setAuthVisible() {
    const signedIn = Boolean(session?.user), verified = security.status === "ready";
    const requiringFactor = security.status === "challenge-required";
    const unavailable = security.status === "error" || security.status === "unsupported-factor";
    authPanel.hidden = signedIn && verified && !recoveryActive;
    cloudPanel.hidden = !signedIn || !verified;
    authOptions.hidden = signedIn && (requiringFactor || unavailable || security.status === "checking");
    challengePanel.hidden = !requiringFactor;
    recoveryForm.hidden = !recoveryActive;
    document.querySelectorAll("[data-auth-logout]").forEach(button => { button.hidden = !signedIn; });
    updateMfaSettings();
  }
  function updateMfaSettings() {
    const ready = security.status === "ready", factors = security.factors || [];
    const verifiedFactor = factors.find(factor => factor.status === "verified");
    byId("mfa-settings-status").textContent = !ready ? "Authenticator settings are unavailable until your session is verified." : verifiedFactor ? "An authenticator app is enabled for this account." : "No authenticator app is enabled. Setup is optional.";
    byId("mfa-enroll-start").hidden = !ready || Boolean(verifiedFactor);
    byId("mfa-disable-start").hidden = !ready || !verifiedFactor;
  }
  async function reconcileSession(nextSession = session) {
    session = nextSession || null;
    const revision = ++securityRevision;
    security = session?.user ? { status: "checking" } : { status: "signed-out" };
    setAuthVisible();
    if (!session?.user) {
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
    say("Scan the QR code, then enter a current code to complete setup.");
  }));
  byId("mfa-enroll-form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget;
    submit(form, async () => {
      await mfa.verifyEnrollment(codeValue("mfa-enroll-code"));
      byId("mfa-enroll-panel").hidden = true; byId("mfa-qr-code").removeAttribute("src");
      await reconcileSession(session); say("Authenticator app enabled and verified.", "success");
    });
  });
  byId("mfa-enroll-retry").addEventListener("click", () => submit(byId("mfa-enroll-form"), async () => {
    await mfa.retryEnrollmentChallenge();
    byId("mfa-enroll-code").value = "";
    say("A fresh authenticator challenge is ready. Enter a current six-digit code to finish setup.");
  }));
  byId("mfa-enroll-cancel").addEventListener("click", () => submit(byId("mfa-enroll-form"), async () => {
    await mfa.cancelEnrollment(); byId("mfa-enroll-panel").hidden = true; byId("mfa-qr-code").removeAttribute("src");
    say("Authenticator setup was canceled."); await reconcileSession(session);
  }));
  byId("mfa-disable-start").addEventListener("click", () => submit(byId("mfa-disable-form"), async () => {
    const factor = (security.factors || []).find(item => item.status === "verified");
    if (!factor) throw new Error("No verified authenticator was found.");
    await mfa.startChallenge(factor.id, { purpose: "disable" }); security.disableFactorId = factor.id; byId("mfa-disable-form").hidden = false;
    byId("mfa-disable-start").hidden = true; say("Enter a current authenticator code to confirm removal.");
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
    byId("mfa-disable-form").reset(); byId("mfa-disable-form").hidden = true; byId("mfa-disable-start").hidden = false;
  });
  document.querySelectorAll("[data-auth-logout]").forEach(button => button.addEventListener("click", async () => {
    if (!client) return;
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) say(errorText(error), "error"); else say("You are signed out. Your local plan remains in this tab; cloud plans are unchanged.", "success");
    } catch { say("Could not sign out because the connection failed.", "error"); }
    finally { button.disabled = false; }
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
