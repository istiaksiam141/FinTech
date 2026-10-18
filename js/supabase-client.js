(function () {
  "use strict";
  const config = window.CAMPUSBRIDGE_SUPABASE_CONFIG;
  const usableKey = typeof config?.publishableKey === "string" && config.publishableKey.trim() && !config.publishableKey.includes("YOUR_SUPABASE_");
  const configured = Boolean(config?.url && usableKey);
  if (!window.supabase?.createClient || !configured) {
    window.CampusBridgeSupabase = Object.freeze({ client: null, configured, libraryAvailable: Boolean(window.supabase?.createClient) });
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey.trim(), {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: "pkce" }
  });
  window.CampusBridgeSupabase = Object.freeze({ client, configured: true, libraryAvailable: true });
})();
