(function () {
  "use strict";
  const client = window.CampusBridgeSupabase?.client;
  const byId = id => document.getElementById(id);
  const status = byId("account-message");
  const authPanel = byId("auth-panel");
  const cloudPanel = byId("cloud-plans-panel");
  const plansList = byId("cloud-plan-list");
  const saveForm = byId("cloud-save-form");
  const recoveryForm = byId("recovery-complete-form");
  const authForms = ["signup-form", "login-form", "reset-request-form", "recovery-complete-form", "cloud-save-form"]
    .map(byId).filter(Boolean);
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
  let session = null, loadingPlans = false, recoveryActive = new URLSearchParams(location.search).get("flow") === "recovery";
  function setAuthVisible(signedIn) {
    authPanel.hidden = signedIn && !recoveryActive;
    cloudPanel.hidden = !signedIn;
    recoveryForm.hidden = !recoveryActive;
    document.querySelectorAll("[data-auth-logout]").forEach(button => { button.hidden = !signedIn; });
  }
  async function loadPlans() {
    if (!session?.user || !cloudPlans || loadingPlans) return;
    loadingPlans = true; plansList.replaceChildren();
    byId("cloud-plan-loading").hidden = false;
    let result;
    try { result = await cloudPlans.listPlans(); }
    catch { result = { ok: false, error: "Could not load saved plans because the connection failed. Try again." }; }
    finally { byId("cloud-plan-loading").hidden = true; loadingPlans = false; }
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
        say("Plan validated and restored locally. Opening the planner to recalculate it.", "success");
        location.href = "/planner.html";
      });
      const rename = document.createElement("button"); rename.type = "button"; rename.className = "button"; rename.textContent = "Rename";
      rename.addEventListener("click", async () => {
        const name = window.prompt("Enter a new name for this saved plan:", plan.planName);
        if (name === null) return;
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
      say(data.session ? "Your account is ready and you are signed in." : "Check your email and follow the confirmation link before signing in.", "success");
      form.reset();
    });
  });
  byId("login-form").addEventListener("submit", event => {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    submit(form, async () => {
      const { error } = await client.auth.signInWithPassword({ email: byId("login-email").value.trim(), password: byId("login-password").value });
      if (error) throw error;
      say("You are signed in.", "success"); form.reset();
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
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryActive = false; recoveryForm.hidden = true; say("Your password has been updated.", "success"); form.reset();
    });
  });
  saveForm.addEventListener("submit", event => {
    event.preventDefault(); if (!client || !session) return;
    const form = event.currentTarget;
    submit(form, async () => {
      const saved = window.CampusBridgePlanState?.loadPlan();
      if (!saved?.ok) { say("Calculate a valid plan on the planner before saving it to your account.", "error"); return; }
      const result = await cloudPlans.createPlan(byId("cloud-plan-name").value, saved.profile);
      if (!result.ok) throw new Error(result.error);
      form.reset(); say("A new cloud-saved copy was created. Existing saved plans were not overwritten.", "success"); loadPlans();
    });
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
    session = nextSession;
    if (event === "PASSWORD_RECOVERY") recoveryActive = true;
    setAuthVisible(Boolean(session?.user));
    if (session?.user) setTimeout(loadPlans, 0);
    if (event === "PASSWORD_RECOVERY") say("Choose a new password to finish resetting your account.");
    if (session?.user?.email_confirmed_at && new URLSearchParams(location.search).has("confirmed")) say("Email confirmed. You are signed in.", "success");
  });
  if (client) client.auth.getSession().then(({ data, error }) => {
    if (error) { say("Could not check your sign-in session. Refresh the page or sign in again.", "error"); return; }
    session = data?.session || null; setAuthVisible(Boolean(session?.user));
    if (session?.user) loadPlans();
    if (recoveryActive) { recoveryForm.hidden = false; say(session ? "Choose a new password to finish resetting your account." : "Open the password-reset link from your email again to continue."); }
    else if (new URLSearchParams(location.search).has("confirmed")) say(session ? "Email confirmed. You are signed in." : "Email confirmation link received. Sign in to continue.", "success");
  }).catch(() => say("Could not check your sign-in session. Refresh the page or sign in again.", "error"));
  const oauthError = new URLSearchParams(location.search).get("error_description");
  if (oauthError) say(`Sign-in could not be completed: ${oauthError.slice(0, 180)}`, "error");
})();
