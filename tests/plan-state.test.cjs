const test = require('node:test');
const assert = require('node:assert/strict');
const Finance = require('../lib/finance.js');
const PlanState = require('../lib/plan-state.js');

const now = new Date(2026, 9, 19, 12, 0, 0);
function memoryStorage(seed = null) {
  const values = new Map(seed ? [[PlanState.KEY, seed]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
function validProfile(overrides = {}) {
  return {
    homeCountry: 'Bangladesh', destinationCountry: 'United Kingdom', homeCur: 'BDT', tuitionCur: 'GBP',
    tuition: '8000', exchangeRate: '155', rateSource: 'User-provided bank reference', rateTimestamp: '2026-10-19T10:00',
    rateProvenance: 'User-provided manual rate; not independently verified', planningMode: Finance.PLANNING_MODES.ALL_COSTS,
    savings: '500000', otherSavings: '450000', accountBalances: [50000], emergency: '50000', committed: '10000', income: '60000', expenses: '35000', paymentFee: '0',
    visaCost: '', applicationCost: '', flightCost: '', insuranceCost: '', documentCost: '', accommodationDeposit: '',
    initialSetupCost: '', otherOneTimeCosts: '', initialLivingMonths: '', monthlyRent: '', monthlyFood: '', monthlyTransport: '',
    monthlyUtilities: '', monthlyOtherLiving: '', deadline: '2026-12-18', ...overrides
  };
}
const create = storage => PlanState.createPlanState({ storage, finance: Finance, now: () => new Date(now) });

test('plan state saves only whitelisted validated plan data and restores across pages', () => {
  const storage = memoryStorage(), state = create(storage), profile = validProfile();
  assert.deepEqual(state.savePlan(profile), { ok: true });
  const saved = JSON.parse(storage.getItem(PlanState.KEY));
  assert.equal(saved.schemaVersion, PlanState.SCHEMA_VERSION);
  assert.deepEqual(Object.keys(saved), ['schemaVersion', 'savedAt', 'profile']);
  assert.equal(saved.profile.tuitionCur, 'GBP');
  assert.deepEqual(saved.profile.accountBalances, [50000]);
  assert.equal(saved.profile.otherSavings, '450000');
  assert.equal(state.loadPlan().ok, true);
  assert.deepEqual(state.loadPlan().profile.accountBalances, [50000]);
  assert.equal(state.loadPlan().profile.planningMode, Finance.PLANNING_MODES.ALL_COSTS);
  assert.equal('GROQ_API_KEY' in saved, false);
  assert.equal('studentName' in saved.profile, false);
});

test('plan state safely rejects missing, corrupt, unsupported, incomplete and invalid plans', () => {
  assert.equal(create(memoryStorage()).loadPlan().reason, 'missing');
  const corrupt = memoryStorage('{');
  assert.equal(create(corrupt).loadPlan().reason, 'corrupt');
  const unsupported = memoryStorage(JSON.stringify({ schemaVersion: 99, savedAt: now.toISOString(), profile: validProfile() }));
  assert.equal(create(unsupported).loadPlan().ok, false);
  const incomplete = memoryStorage(JSON.stringify({ schemaVersion: 1, savedAt: now.toISOString(), profile: { tuition: '100' } }));
  assert.equal(create(incomplete).loadPlan().ok, false);
  assert.equal(create(memoryStorage()).savePlan(validProfile({ planningMode: 'unsupported' })).ok, false);
  assert.equal(create(memoryStorage()).savePlan(validProfile({ tuitionCur: 'CNY' })).ok, false);
  assert.equal(create(memoryStorage()).savePlan(validProfile({ tuition: '1e309' })).ok, false);
  assert.equal(create(memoryStorage()).savePlan(validProfile({ accountBalances: [100] })).ok, false, 'account balances must add up to the saved total savings');
});

test('clearing plan removes the current tab state and mode switching stays valid', () => {
  const storage = memoryStorage(), state = create(storage);
  storage.setItem('unrelated-record', 'preserve this data');
  assert.equal(state.savePlan(validProfile({ planningMode: Finance.PLANNING_MODES.TUITION_ONLY })).ok, true);
  assert.equal(state.loadPlan().profile.planningMode, Finance.PLANNING_MODES.TUITION_ONLY);
  assert.equal(state.clearPlan(), true);
  assert.equal(state.loadPlan().reason, 'missing');
  assert.equal(storage.getItem('unrelated-record'), 'preserve this data', 'clearing the planner preserves unrelated saved data');
});

test('saved stress inputs are validated and results are recalculated from the saved baseline', () => {
  const storage = memoryStorage(), state = create(storage), profile = validProfile();
  assert.equal(state.savePlan(profile).ok, true);
  assert.equal(state.saveStressOptions({ expenseIncrease: 5000, missedContributions: 1 }).ok, true);
  const saved = JSON.parse(storage.getItem(PlanState.KEY));
  assert.deepEqual(saved.stressOptions, { expenseIncrease: 5000, missedContributions: 1 });
  assert.equal('stressScenarios' in saved, false);
  const restored = state.loadPlan();
  assert.equal(restored.ok, true);
  assert.equal(restored.stressScenarios.length, 6);
  assert.equal(restored.stressScenarios.at(-1).expenseIncrease, 5000);
  assert.equal(state.saveStressOptions({ expenseIncrease: Infinity }).ok, false);
  assert.equal(state.saveStressOptions({ unexpected: 1 }).ok, false);
  assert.equal(state.savePlan(profile).ok, true);
  assert.deepEqual(state.loadPlan().stressScenarios, [], 'a baseline recalculation clears scenario inputs from the previous plan');
});

test('future save timestamps and unexpected top-level stored data are rejected', () => {
  const state = create(memoryStorage());
  const future = memoryStorage(JSON.stringify({ schemaVersion: 1, savedAt: '2027-01-01T00:00:00.000Z', profile: validProfile() }));
  assert.equal(create(future).loadPlan().ok, false);
  const extra = memoryStorage(JSON.stringify({ schemaVersion: 1, savedAt: now.toISOString(), profile: validProfile(), token: 'must not restore' }));
  assert.equal(create(extra).loadPlan().ok, false);
  assert.equal(state.savePlan(validProfile({ apiKey: 'secret' })).ok, false);
});
