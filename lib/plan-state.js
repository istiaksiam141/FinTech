(function (root, factory) {
  const api = factory(root.CampusBridgeFinance || null);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgePlanState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Finance) {
  "use strict";

  const KEY = "campusbridge.plan.v1";
  const SCHEMA_VERSION = 1;
  const PROFILE_FIELDS = Object.freeze([
    "homeCountry", "destinationCountry", "homeCur", "tuitionCur", "tuition", "exchangeRate", "rateSource", "rateTimestamp", "rateProvenance", "planningMode",
    "savings", "otherSavings", "accountBalances", "emergency", "committed", "income", "expenses", "paymentFee", "visaCost", "applicationCost", "flightCost", "insuranceCost",
    "documentCost", "accommodationDeposit", "initialSetupCost", "otherOneTimeCosts", "initialLivingMonths", "monthlyRent", "monthlyFood",
    "monthlyTransport", "monthlyUtilities", "monthlyOtherLiving", "deadline"
  ]);

  function createPlanState({ storage, finance = Finance, now = () => new Date() } = {}) {
    const getStorage = () => {
      if (storage) return storage;
      try { return typeof sessionStorage !== "undefined" ? sessionStorage : null; } catch { return null; }
    };
    const validateProfile = source => {
      if (!finance?.calculateTuition || !Number.isFinite(finance.MAX_CALCULATED_BDT)) return null;
      if (!source || typeof source !== "object" || Array.isArray(source) || ![Object.prototype, null].includes(Object.getPrototypeOf(source))) return null;
      const keys = Object.keys(source);
      if (keys.some(key => !PROFILE_FIELDS.includes(key)) || PROFILE_FIELDS.some(key => !(key in source))) return null;
      const profile = {};
      for (const key of PROFILE_FIELDS) {
        const value = source[key];
        if (key === "accountBalances") {
          if (!Array.isArray(value) || value.length > 50 || value.some(balance => typeof balance !== "number" || !Number.isFinite(balance) || balance < 0 || balance > finance.MAX_CALCULATED_BDT)) return null;
          profile[key] = [...value];
          continue;
        }
        if (typeof value !== "string" && typeof value !== "number") return null;
        if (typeof value === "number" && !Number.isFinite(value)) return null;
        const text = String(value);
        if (text.length > (key === "rateSource" || key === "rateProvenance" ? 180 : 64)) return null;
        profile[key] = text;
      }
      const savingsTotal = Number(profile.otherSavings || 0) + profile.accountBalances.reduce((sum, balance) => sum + balance, 0);
      if (!Number.isFinite(savingsTotal) || savingsTotal > finance.MAX_CALCULATED_BDT || Math.abs(savingsTotal - Number(profile.savings)) > 0.01) return null;
      if (!finance.calculateTuition(profile, now()).ok) return null;
      return profile;
    };
    function savePlan(source) {
      const validProfile = validateProfile(source);
      const target = getStorage();
      if (!validProfile || !target) return { ok: false, reason: "invalid-or-unavailable" };
      try {
        target.setItem(KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: now().toISOString(), profile: validProfile }));
        return { ok: true };
      } catch { return { ok: false, reason: "storage-unavailable" }; }
    }
    function loadPlan() {
      const target = getStorage();
      if (!target) return { ok: false, reason: "storage-unavailable" };
      let value;
      try {
        const raw = target.getItem(KEY);
        if (!raw) return { ok: false, reason: "missing" };
        value = JSON.parse(raw);
      } catch {
        try { target.removeItem(KEY); } catch { /* storage may be read-only */ }
        return { ok: false, reason: "corrupt" };
      }
      const savedAtMs = typeof value?.savedAt === "string" ? Date.parse(value.savedAt) : NaN;
      const canonicalTimestamp = Number.isFinite(savedAtMs) && new Date(savedAtMs).toISOString() === value.savedAt;
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["schemaVersion", "savedAt", "profile", "stressOptions"].includes(key)) || value.schemaVersion !== SCHEMA_VERSION || !canonicalTimestamp || savedAtMs > now().getTime()) {
        try { target.removeItem(KEY); } catch { /* storage may be read-only */ }
        return { ok: false, reason: "unsupported-or-invalid" };
      }
      const profile = validateProfile(value.profile);
      if (!profile) {
        try { target.removeItem(KEY); } catch { /* storage may be read-only */ }
        return { ok: false, reason: "invalid-plan" };
      }
      let stressOptions = null, stressScenarios = [];
      if (value.stressOptions !== undefined) {
        const options = value.stressOptions;
        if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !["expenseIncrease", "missedContributions"].includes(key)) || (options.expenseIncrease !== undefined && (typeof options.expenseIncrease !== "number" || !Number.isFinite(options.expenseIncrease) || options.expenseIncrease < 0 || options.expenseIncrease > finance.MAX_CALCULATED_BDT)) || (options.missedContributions !== undefined && ![0, 1].includes(options.missedContributions))) { try { target.removeItem(KEY); } catch {} return { ok: false, reason: "invalid-plan" }; }
        stressOptions = { ...options };
        const stress = finance.calculateStressScenarios(profile, stressOptions, now());
        if (!stress.ok) { try { target.removeItem(KEY); } catch {} return { ok: false, reason: "invalid-plan" }; }
        stressScenarios = stress.scenarios;
      }
      return { ok: true, profile, savedAt: value.savedAt, stressScenarios };
    }
    function saveStressOptions(options) {
      const current = loadPlan();
      const target = getStorage();
      if (!current.ok || !target || !options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !["expenseIncrease", "missedContributions"].includes(key))) return { ok: false, reason: "invalid-or-unavailable" };
      if ((options.expenseIncrease !== undefined && (typeof options.expenseIncrease !== "number" || !Number.isFinite(options.expenseIncrease) || options.expenseIncrease < 0 || options.expenseIncrease > finance.MAX_CALCULATED_BDT)) || (options.missedContributions !== undefined && ![0, 1].includes(options.missedContributions))) return { ok: false, reason: "invalid-scenarios" };
      if (!finance.calculateStressScenarios(current.profile, options, now()).ok) return { ok: false, reason: "invalid-scenarios" };
      try {
        target.setItem(KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: now().toISOString(), profile: current.profile, stressOptions: { ...options } }));
        return { ok: true };
      } catch { return { ok: false, reason: "storage-unavailable" }; }
    }
    function clearPlan() {
      const target = getStorage();
      if (!target) return false;
      try { target.removeItem(KEY); return true; } catch { return false; }
    }
    return Object.freeze({ savePlan, loadPlan, clearPlan, saveStressOptions, validateProfile });
  }

  const defaultState = createPlanState();
  return Object.freeze({ KEY, SCHEMA_VERSION, PROFILE_FIELDS, createPlanState, savePlan: defaultState.savePlan, loadPlan: defaultState.loadPlan, clearPlan: defaultState.clearPlan, saveStressOptions: defaultState.saveStressOptions, validateProfile: defaultState.validateProfile });
});
