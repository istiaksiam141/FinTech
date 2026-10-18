(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeCloudPlans = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const TABLE = "saved_plans";
  const MAX_NAME_CHARS = 80;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function createCloudPlans({ client, planState } = {}) {
    async function authenticatedUser() {
      if (!client?.auth?.getUser) return { error: "Supabase is not configured. Add the browser-safe publishable key first." };
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user?.id) return { error: "Sign in again to access your saved plans." };
      return { user: data.user };
    }
    function cleanName(value) {
      if (typeof value !== "string") return null;
      const name = value.trim();
      return name && name.length <= MAX_NAME_CHARS ? name : null;
    }
    function validatedProfile(profile) {
      const validated = planState?.validateProfile?.(profile);
      return validated || null;
    }
    async function listPlans() {
      const auth = await authenticatedUser();
      if (auth.error) return { ok: false, error: auth.error };
      const { data, error } = await client.from(TABLE)
        .select("id,user_id,plan_name,plan_data,created_at,updated_at")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false });
      if (error || !Array.isArray(data)) return { ok: false, error: "Could not load saved plans. Check your connection and try again." };
      const plans = [];
      for (const row of data) {
        if (!row || row.user_id !== auth.user.id || typeof row.id !== "string" || !UUID_PATTERN.test(row.id) || !cleanName(row.plan_name) || !validatedProfile(row.plan_data)) {
          return { ok: false, error: "A saved plan is invalid or no longer supported. It was not loaded." };
        }
        plans.push({ id: row.id, planName: row.plan_name, planData: row.plan_data, createdAt: row.created_at, updatedAt: row.updated_at });
      }
      return { ok: true, plans };
    }
    async function createPlan(name, profile) {
      const auth = await authenticatedUser();
      if (auth.error) return { ok: false, error: auth.error };
      const planName = cleanName(name), planData = validatedProfile(profile);
      if (!planName) return { ok: false, error: `Enter a plan name of 1–${MAX_NAME_CHARS} characters.` };
      if (!planData) return { ok: false, error: "Calculate a valid plan before saving it." };
      const { data, error } = await client.from(TABLE).insert({ user_id: auth.user.id, plan_name: planName, plan_data: planData }).select("id").single();
      return error || !data?.id ? { ok: false, error: "Could not save this plan. Check your connection and try again." } : { ok: true, id: data.id };
    }
    async function renamePlan(id, name) {
      const auth = await authenticatedUser();
      if (auth.error) return { ok: false, error: auth.error };
      const planName = cleanName(name);
      if (typeof id !== "string" || !UUID_PATTERN.test(id) || !planName) return { ok: false, error: `Enter a valid plan name of 1–${MAX_NAME_CHARS} characters.` };
      const { data, error } = await client.from(TABLE).update({ plan_name: planName }).eq("id", id).eq("user_id", auth.user.id).select("id").maybeSingle();
      return error || !data ? { ok: false, error: "Could not rename this plan. It may no longer be available." } : { ok: true };
    }
    async function deletePlan(id) {
      const auth = await authenticatedUser();
      if (auth.error) return { ok: false, error: auth.error };
      if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, error: "This saved plan could not be identified." };
      const { data, error } = await client.from(TABLE).delete().eq("id", id).eq("user_id", auth.user.id).select("id").maybeSingle();
      return error || !data ? { ok: false, error: "Could not delete this plan. It may no longer be available." } : { ok: true };
    }
    function restorePlan(plan) {
      const profile = validatedProfile(plan?.planData);
      if (!profile || !planState?.savePlan) return { ok: false, error: "This saved plan is invalid or no longer supported." };
      const result = planState.savePlan(profile);
      return result?.ok ? { ok: true } : { ok: false, error: "The plan was valid, but could not be restored in this browser tab." };
    }
    return Object.freeze({ listPlans, createPlan, renamePlan, deletePlan, restorePlan });
  }
  return Object.freeze({ TABLE, MAX_NAME_CHARS, createCloudPlans });
});
