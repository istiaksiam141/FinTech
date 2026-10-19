(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeSavingsTracker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "campusbridge.savings-tracker.v1";
  const BACKUP_FORMAT = "campusbridge-savings-tracker";
  const BACKUP_VERSION = 1;
  const MAX_BDT = 1_000_000_000_000, MAX_NAME = 80, MAX_NOTE = 250;
  const MAX_BACKUP_LENGTH = 5_000_000, MAX_ROADMAPS = 500, MAX_DEPOSITS = 20_000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const cleanName = value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_NAME ? value.trim() : null;
  const canonicalDateTime = value => {
    if (typeof value !== "string") return false;
    try { return new Date(value).toISOString() === value; } catch { return false; }
  };
  const calendarDate = date => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    return `${parts.find(item => item.type === "year").value}-${parts.find(item => item.type === "month").value}-${parts.find(item => item.type === "day").value}`;
  };

  function validateDeposit(input, { today = new Date(), earliestDate = "" } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Enter a valid deposit." };
    const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BDT) return { ok: false, error: "Enter a deposit greater than 0 and no more than 1,000,000,000,000 BDT." };
    if (input.currency !== "BDT") return { ok: false, error: "Deposits are recorded in BDT. No currency conversion is applied." };
    if (typeof input.depositDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.depositDate) || !Number.isFinite(Date.parse(`${input.depositDate}T00:00:00Z`)) || new Date(`${input.depositDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.depositDate) return { ok: false, error: "Choose a valid deposit date." };
    const current = calendarDate(today);
    if (input.depositDate > current) return { ok: false, error: "A deposit date cannot be in the future." };
    if (earliestDate && input.depositDate < earliestDate) return { ok: false, error: "Choose a date on or after this saved roadmap was calculated." };
    if (input.note != null && (typeof input.note !== "string" || input.note.length > MAX_NOTE)) return { ok: false, error: `Notes can be at most ${MAX_NOTE} characters.` };
    return { ok: true, deposit: { amount_bdt: amount, currency: "BDT", deposit_date: input.depositDate, note: (input.note || "").trim() || null } };
  }

  function validateSnapshotShape(profile, snapshot) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile) || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
    const result = snapshot.result, roadmap = snapshot.roadmap;
    const snapshotKeys = ["version", "calculatedAt", "result", "roadmap", "rateSource", "rateTimestamp", "rateProvenance"];
    const resultKeys = ["requiredFunds", "usable", "gap", "monthlyTarget", "contributionCycles", "capacity", "shortfall", "rate", "tuitionCurrency"];
    return Object.keys(snapshot).every(key => snapshotKeys.includes(key)) && snapshotKeys.every(key => Object.hasOwn(snapshot, key)) &&
      result && typeof result === "object" && !Array.isArray(result) && Object.keys(result).every(key => resultKeys.includes(key)) && resultKeys.every(key => Object.hasOwn(result, key)) &&
      snapshot.version === 1 && canonicalDateTime(snapshot.calculatedAt) &&
      Number.isFinite(result?.requiredFunds) && result.requiredFunds >= 0 && result.requiredFunds <= MAX_BDT &&
      Number.isFinite(result?.usable) && result.usable >= 0 && result.usable <= MAX_BDT &&
      Number.isFinite(result?.gap) && result.gap >= 0 && result.gap <= MAX_BDT &&
      Number.isFinite(result?.monthlyTarget) && result.monthlyTarget >= 0 &&
      Number.isInteger(result?.contributionCycles) && result.contributionCycles >= 0 &&
      Number.isFinite(result?.rate) && result.rate > 0 &&
      typeof snapshot.rateSource === "string" && snapshot.rateSource === profile.rateSource &&
      typeof snapshot.rateTimestamp === "string" && snapshot.rateTimestamp === profile.rateTimestamp &&
      typeof snapshot.rateProvenance === "string" && snapshot.rateProvenance === (profile.rateProvenance || "Not provided") && roadmap && typeof roadmap.ok === "boolean" && Array.isArray(roadmap.contributions);
  }

  function monthlyHistory(deposits, asOf = new Date()) {
    const rows = Array.isArray(deposits) ? deposits.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.deposit_date) && Number.isFinite(Number(item.amount_bdt)) && Number(item.amount_bdt) > 0 && item.currency === "BDT" && item.deposit_date <= calendarDate(asOf)).slice().sort((a, b) => a.deposit_date.localeCompare(b.deposit_date)) : [];
    const months = new Map(); let cumulative = 0;
    for (const item of rows) {
      const month = item.deposit_date.slice(0, 7), amount = Number(item.amount_bdt);
      months.set(month, (months.get(month) || 0) + amount); cumulative += amount;
      item._runningTotal = cumulative;
    }
    return { deposits: rows, months: [...months].map(([month, amountBdt]) => ({ month, amountBdt })), totalBdt: cumulative };
  }

  function compare(snapshot, deposits, asOf = new Date()) {
    if (!validateSnapshotShape({ rateSource: snapshot?.rateSource, rateTimestamp: snapshot?.rateTimestamp, rateProvenance: snapshot?.rateProvenance === "Not provided" ? "" : snapshot?.rateProvenance }, snapshot)) return { status: "Plan Needs Review", reason: "Saved calculation details are unavailable." };
    const goal = snapshot.result.requiredFunds, initial = snapshot.result.usable, history = monthlyHistory(deposits, asOf);
    if (goal === 0) return { status: "Plan Needs Review", reason: "The saved plan has no positive funding goal to compare." };
    const total = initial + history.totalBdt, gap = Math.max(0, goal - total), coveredPercent = Math.min(100, Math.round(total / goal * 100));
    if (gap === 0) return { status: "Goal Covered", goalBdt: goal, savingsBdt: total, depositsBdt: history.totalBdt, remainingBdt: 0, coveredPercent, plannedDueBdt: null, actualSincePlanBdt: history.totalBdt };
    const roadmap = snapshot.roadmap;
    if (!roadmap.ok || roadmap.targetCanBeReachedByDeadline !== true || !roadmap.contributions.length) return { status: "Plan Needs Review", goalBdt: goal, savingsBdt: total, depositsBdt: history.totalBdt, remainingBdt: gap, coveredPercent, plannedDueBdt: null, actualSincePlanBdt: history.totalBdt, reason: "The saved roadmap does not contain a confirmed future contribution schedule." };
    const asOfDate = calendarDate(asOf);
    const planned = roadmap.contributions.filter(item => item.dueDate <= asOfDate).reduce((sum, item) => sum + item.requiredContributionBdt, 0);
    const status = history.totalBdt > planned ? "Ahead" : history.totalBdt === planned ? "On Track" : "Behind";
    return { status, goalBdt: goal, savingsBdt: total, depositsBdt: history.totalBdt, remainingBdt: gap, coveredPercent, plannedDueBdt: planned, actualSincePlanBdt: history.totalBdt, reason: "Comparison uses recorded BDT deposits and saved contribution dates through the same current date." };
  }

  function createLocalSavings({ storage, finance, planState, now = () => new Date(), idFactory } = {}) {
    function getStorage() {
      if (storage !== undefined) return storage;
      try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
    }
    function newId() {
      if (idFactory) return idFactory();
      try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* use the non-security identifier fallback */ }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, token => {
        const random = Math.floor(Math.random() * 16);
        return (token === "x" ? random : (random & 3) | 8).toString(16);
      });
    }
    function profileAt(profile, at) {
      const validator = planState?.createPlanState?.({ finance, now: () => at })?.validateProfile || planState?.validateProfile;
      return validator?.(profile) || null;
    }
    function validateHistoricalSnapshot(profile, snapshot) {
      if (!validateSnapshotShape(profile, snapshot)) return false;
      try {
      if (!profileAt(profile, new Date(snapshot.calculatedAt))) return false;
      const at = new Date(snapshot.calculatedAt), result = finance?.calculateTuition?.(profile, at);
      if (!result?.ok) return false;
      const expected = {
        requiredFunds: result.requiredFunds, usable: result.usable, gap: result.gap,
        monthlyTarget: result.monthlyTarget, contributionCycles: result.contributionCycles,
        capacity: result.capacity, shortfall: result.shortfall, rate: result.rate, tuitionCurrency: result.tuitionCurrency
      };
      if (Object.keys(expected).some(key => expected[key] !== snapshot.result[key])) return false;
      const roadmap = finance.buildContributionRoadmap(profile, result, at);
      return Boolean(roadmap?.ok) && JSON.stringify(canonical(roadmap)) === JSON.stringify(canonical(snapshot.roadmap));
      } catch { return false; }
    }
    function emptyData() { return { version: 1, roadmaps: [], deposits: [] }; }
    function validRecordKeys(record, expected) { return record && typeof record === "object" && !Array.isArray(record) && Object.keys(record).every(key => expected.includes(key)) && expected.every(key => Object.hasOwn(record, key)); }
    function validateData(value) {
      if (!validRecordKeys(value, ["version", "roadmaps", "deposits"]) || value.version !== 1 || !Array.isArray(value.roadmaps) || !Array.isArray(value.deposits) || value.roadmaps.length > MAX_ROADMAPS || value.deposits.length > MAX_DEPOSITS) return { ok: false, error: "Tracker data is malformed or uses an unsupported version." };
      const roadmapIds = new Set(), names = new Set();
      for (const row of value.roadmaps) {
        if (!validRecordKeys(row, ["id", "name", "profile", "snapshot", "createdAt", "updatedAt", "revisedFromId"]) || !UUID.test(row.id) || roadmapIds.has(row.id) || !cleanName(row.name) || !canonicalDateTime(row.createdAt) || !canonicalDateTime(row.updatedAt) || row.updatedAt < row.createdAt || (row.revisedFromId !== null && (typeof row.revisedFromId !== "string" || !UUID.test(row.revisedFromId))) || !validateHistoricalSnapshot(row.profile, row.snapshot)) return { ok: false, error: "Tracker data contains an invalid roadmap and was not loaded." };
        const key = row.name.toLocaleLowerCase();
        if (names.has(key)) return { ok: false, error: "Tracker data contains duplicate roadmap names and was not loaded." };
        names.add(key); roadmapIds.add(row.id);
      }
      for (const row of value.roadmaps) {
        if (row.revisedFromId && (!roadmapIds.has(row.revisedFromId) || row.revisedFromId === row.id)) return { ok: false, error: "Tracker data contains an invalid roadmap revision link." };
        const seen = new Set([row.id]); let parentId = row.revisedFromId;
        while (parentId) {
          if (seen.has(parentId)) return { ok: false, error: "Tracker data contains a circular roadmap revision link." };
          seen.add(parentId); parentId = value.roadmaps.find(item => item.id === parentId)?.revisedFromId || null;
        }
      }
      const depositIds = new Set();
      for (const row of value.deposits) {
        if (!validRecordKeys(row, ["id", "roadmapId", "amount_bdt", "currency", "deposit_date", "note", "createdAt", "updatedAt"]) || !UUID.test(row.id) || depositIds.has(row.id) || !roadmapIds.has(row.roadmapId) || !canonicalDateTime(row.createdAt) || !canonicalDateTime(row.updatedAt) || row.updatedAt < row.createdAt || typeof row.deposit_date !== "string" || typeof row.amount_bdt !== "number" || !Number.isFinite(row.amount_bdt) || typeof row.note !== "string" && row.note !== null) return { ok: false, error: "Tracker data contains an invalid deposit and was not loaded." };
        const roadmap = value.roadmaps.find(item => item.id === row.roadmapId);
        const checked = validateDeposit({ amount: row.amount_bdt, currency: row.currency, depositDate: row.deposit_date, note: row.note }, { today: now(), earliestDate: calendarDate(new Date(roadmap.snapshot.calculatedAt)) });
        if (!checked.ok || checked.deposit.amount_bdt !== row.amount_bdt || checked.deposit.note !== row.note) return { ok: false, error: "Tracker data contains an invalid deposit and was not loaded." };
        depositIds.add(row.id);
      }
      return { ok: true, data: { version: 1, roadmaps: value.roadmaps, deposits: value.deposits } };
    }
    function readData() {
      const target = getStorage();
      if (!target || typeof target.getItem !== "function") return { ok: false, error: "Browser storage is unavailable. Enable local storage or use a browser profile that allows it." };
      try {
        const raw = target.getItem(STORAGE_KEY);
        if (raw == null) return { ok: true, data: emptyData() };
        if (typeof raw !== "string" || raw.length > MAX_BACKUP_LENGTH) return { ok: false, error: "Saved tracker data is too large or unavailable. Export or clear browser storage before continuing." };
        let parsed;
        try { parsed = JSON.parse(raw); } catch { return { ok: false, error: "Saved tracker data is malformed. Import a valid backup to replace it." }; }
        return validateData(parsed);
      } catch { return { ok: false, error: "Browser storage could not be read. Check your browser settings and try again." }; }
    }
    function writeData(data) {
      const target = getStorage();
      if (!target || typeof target.setItem !== "function") return { ok: false, error: "Browser storage is unavailable. Your tracker was not saved." };
      const checked = validateData(data);
      if (!checked.ok) return checked;
      try {
        const serialized = JSON.stringify(checked.data);
        if (serialized.length > MAX_BACKUP_LENGTH) return { ok: false, error: "The tracker is too large for this browser's local storage. Export your backup and remove older records." };
        target.setItem(STORAGE_KEY, serialized);
        return { ok: true };
      } catch { return { ok: false, error: "Browser storage is full or unavailable. Export your backup and free browser storage before retrying." }; }
    }
    function makeSnapshot(profile) {
      const valid = profileAt(profile, now());
      if (!valid) return { error: "Calculate a valid plan before saving a roadmap." };
      const calculatedAt = now(), result = finance.calculateTuition(valid, calculatedAt);
      if (!result?.ok) return { error: "The plan is no longer valid. Review it in the planner and calculate again." };
      const roadmap = finance.buildContributionRoadmap(valid, result, calculatedAt);
      if (!roadmap?.ok) return { error: "The contribution roadmap could not be confirmed. Recalculate the plan before saving." };
      const snapshot = { version: 1, calculatedAt: calculatedAt.toISOString(), result: { requiredFunds: result.requiredFunds, usable: result.usable, gap: result.gap, monthlyTarget: result.monthlyTarget, contributionCycles: result.contributionCycles, capacity: result.capacity, shortfall: result.shortfall, rate: result.rate, tuitionCurrency: result.tuitionCurrency }, roadmap, rateSource: valid.rateSource, rateTimestamp: valid.rateTimestamp, rateProvenance: valid.rateProvenance || "Not provided" };
      return validateHistoricalSnapshot(valid, snapshot) ? { profile: valid, snapshot } : { error: "The calculated snapshot could not be validated." };
    }
    function saveRoadmap(name, profile, revisedFromId = null) {
      const dataResult = readData(); if (!dataResult.ok) return dataResult;
      const planName = cleanName(name), created = makeSnapshot(profile);
      if (!planName) return { ok: false, error: `Enter a roadmap name of 1–${MAX_NAME} characters.` };
      if (created.error) return { ok: false, error: created.error };
      if (revisedFromId !== null && (!UUID.test(revisedFromId) || !dataResult.data.roadmaps.some(row => row.id === revisedFromId))) return { ok: false, error: "The original saved roadmap could not be found. Open it again before saving a revision." };
      if (dataResult.data.roadmaps.some(row => row.name.toLocaleLowerCase() === planName.toLocaleLowerCase())) return { ok: false, error: "A roadmap with this name already exists. Choose a different name." };
      if (dataResult.data.roadmaps.length >= MAX_ROADMAPS) return { ok: false, error: "The tracker has reached its roadmap limit. Export a backup before removing old plans." };
      const timestamp = now().toISOString(), row = { id: newId(), name: planName, profile: created.profile, snapshot: created.snapshot, createdAt: timestamp, updatedAt: timestamp, revisedFromId };
      if (!UUID.test(row.id)) return { ok: false, error: "A local identifier could not be created; try again." };
      const next = { ...dataResult.data, roadmaps: [row, ...dataResult.data.roadmaps] }, saved = writeData(next);
      return saved.ok ? { ok: true, id: row.id } : saved;
    }
    function listRoadmaps() {
      const result = readData();
      return result.ok ? { ok: true, roadmaps: result.data.roadmaps.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } : result;
    }
    function renameRoadmap(id, name) {
      const result = readData(); if (!result.ok) return result;
      const planName = cleanName(name); if (!UUID.test(id || "") || !planName) return { ok: false, error: `Enter a valid roadmap name of 1–${MAX_NAME} characters.` };
      const row = result.data.roadmaps.find(item => item.id === id);
      if (!row) return { ok: false, error: "This roadmap could not be found." };
      if (result.data.roadmaps.some(item => item.id !== id && item.name.toLocaleLowerCase() === planName.toLocaleLowerCase())) return { ok: false, error: "A roadmap with this name already exists. Choose a different name." };
      const next = { ...result.data, roadmaps: result.data.roadmaps.map(item => item.id === id ? { ...item, name: planName, updatedAt: now().toISOString() } : item) };
      return writeData(next);
    }
    function deleteRoadmap(id) {
      const result = readData(); if (!result.ok) return result;
      if (!UUID.test(id || "")) return { ok: false, error: "This roadmap could not be identified." };
      if (!result.data.roadmaps.some(item => item.id === id)) return { ok: false, error: "This roadmap could not be found." };
      if (result.data.roadmaps.some(item => item.revisedFromId === id)) return { ok: false, error: "Delete its newer revised roadmap first to preserve the revision history." };
      return writeData({ ...result.data, roadmaps: result.data.roadmaps.filter(item => item.id !== id), deposits: result.data.deposits.filter(item => item.roadmapId !== id) });
    }
    function listDeposits(roadmapId) {
      const result = readData(); if (!result.ok) return result;
      if (!UUID.test(roadmapId || "") || !result.data.roadmaps.some(item => item.id === roadmapId)) return { ok: false, error: "Choose a saved roadmap first." };
      return { ok: true, deposits: result.data.deposits.filter(item => item.roadmapId === roadmapId).slice().sort((a, b) => a.deposit_date.localeCompare(b.deposit_date) || a.createdAt.localeCompare(b.createdAt)) };
    }
    function saveDeposit(roadmapId, input, existingId = null) {
      const result = readData(); if (!result.ok) return result;
      const roadmap = result.data.roadmaps.find(item => item.id === roadmapId);
      if (!UUID.test(roadmapId || "") || !roadmap || (existingId !== null && !UUID.test(existingId))) return { ok: false, error: "Choose a valid saved roadmap and deposit." };
      const checked = validateDeposit(input, { today: now(), earliestDate: calendarDate(new Date(roadmap.snapshot.calculatedAt)) });
      if (!checked.ok) return checked;
      if (existingId !== null && !result.data.deposits.some(item => item.id === existingId && item.roadmapId === roadmapId)) return { ok: false, error: "This deposit could not be found." };
      if (existingId === null && result.data.deposits.length >= MAX_DEPOSITS) return { ok: false, error: "The tracker has reached its deposit limit. Export a backup before removing old records." };
      const timestamp = now().toISOString();
      const row = { id: existingId || newId(), roadmapId, ...checked.deposit, createdAt: result.data.deposits.find(item => item.id === existingId)?.createdAt || timestamp, updatedAt: timestamp };
      if (!UUID.test(row.id)) return { ok: false, error: "A local identifier could not be created; try again." };
      const deposits = existingId === null ? [...result.data.deposits, row] : result.data.deposits.map(item => item.id === existingId ? row : item);
      const saved = writeData({ ...result.data, deposits });
      return saved.ok ? { ok: true, id: row.id } : saved;
    }
    function deleteDeposit(id, roadmapId) {
      const result = readData(); if (!result.ok) return result;
      if (!UUID.test(id || "") || !UUID.test(roadmapId || "")) return { ok: false, error: "This deposit could not be identified." };
      if (!result.data.deposits.some(item => item.id === id && item.roadmapId === roadmapId)) return { ok: false, error: "This deposit could not be found." };
      return writeData({ ...result.data, deposits: result.data.deposits.filter(item => !(item.id === id && item.roadmapId === roadmapId)) });
    }
    function exportBackup() {
      const result = readData(); if (!result.ok) return result;
      const backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now().toISOString(), data: result.data };
      const json = JSON.stringify(backup, null, 2);
      return json.length > MAX_BACKUP_LENGTH ? { ok: false, error: "The backup is too large to export from this browser." } : { ok: true, json };
    }
    function importBackup(source) {
      if (typeof source !== "string" || source.length > MAX_BACKUP_LENGTH) return { ok: false, error: "Choose a valid CampusBridge tracker backup under 5 MB." };
      let backup;
      try { backup = JSON.parse(source); } catch { return { ok: false, error: "That file is not valid JSON. Your current tracker data was not changed." }; }
      if (!validRecordKeys(backup, ["format", "version", "exportedAt", "data"]) || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !canonicalDateTime(backup.exportedAt)) return { ok: false, error: "This is not a supported CampusBridge Savings Tracker backup. Your current data was not changed." };
      const checked = validateData(backup.data); if (!checked.ok) return { ok: false, error: `Backup not imported: ${checked.error}` };
      const saved = writeData(checked.data);
      return saved.ok ? { ok: true, roadmapCount: checked.data.roadmaps.length, depositCount: checked.data.deposits.length } : saved;
    }
    return Object.freeze({ listRoadmaps, saveRoadmap, renameRoadmap, deleteRoadmap, listDeposits, saveDeposit, deleteDeposit, exportBackup, importBackup });
  }

  return Object.freeze({ STORAGE_KEY, BACKUP_FORMAT, BACKUP_VERSION, MAX_BDT, MAX_NAME, MAX_NOTE, MAX_BACKUP_LENGTH, UUID, cleanName, calendarDate, validateDeposit, validateSnapshot: validateSnapshotShape, monthlyHistory, compare, createLocalSavings });
});
