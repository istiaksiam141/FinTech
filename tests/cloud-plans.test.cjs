const test = require('node:test');
const assert = require('node:assert/strict');
const Finance = require('../lib/finance.js');
const PlanState = require('../lib/plan-state.js');
const { createCloudPlans } = require('../lib/cloud-plans.js');

const today = new Date(2026, 9, 19, 12);
function profile(overrides = {}) {
  return {
    homeCountry: 'Bangladesh', destinationCountry: 'United Kingdom', homeCur: 'BDT', tuitionCur: 'GBP', tuition: '8000', exchangeRate: '155',
    rateSource: 'User-provided bank reference', rateTimestamp: '2026-10-19T10:00', rateProvenance: 'User-provided manual rate; not independently verified',
    planningMode: Finance.PLANNING_MODES.ALL_COSTS, savings: '500000', otherSavings: '450000', accountBalances: [50000], emergency: '50000',
    committed: '10000', income: '60000', expenses: '35000', paymentFee: '0', visaCost: '', applicationCost: '', flightCost: '', insuranceCost: '',
    documentCost: '', accommodationDeposit: '', initialSetupCost: '', otherOneTimeCosts: '', initialLivingMonths: '', monthlyRent: '', monthlyFood: '',
    monthlyTransport: '', monthlyUtilities: '', monthlyOtherLiving: '', deadline: '2026-12-18', ...overrides
  };
}
function makeClient({ userId = 'authenticated-student-1', rows = [], authError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: authError ? null : { id: userId } }, error: authError }) },
    from(table) {
      const call = { table, filters: [], operation: 'select' }; calls.push(call);
      const builder = {
        select(value) { call.columns = value; return this; },
        eq(field, value) { call.filters.push([field, value]); return this; },
        order() { return this; },
        insert(value) { call.operation = 'insert'; call.value = value; return this; },
        update(value) { call.operation = 'update'; call.value = value; return this; },
        delete() { call.operation = 'delete'; return this; },
        single() { return Promise.resolve(run(true)); },
        maybeSingle() { return Promise.resolve(run(true)); },
        then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject); }
      };
      function run(single) {
        if (call.operation === 'insert') { const row = { id: '00000000-0000-4000-8000-000000000001', ...call.value }; rows.push(row); return { data: single ? { id: row.id } : row, error: null }; }
        const matches = rows.filter(row => call.filters.every(([key, value]) => row[key] === value));
        if (call.operation === 'update') matches.forEach(row => Object.assign(row, call.value));
        if (call.operation === 'delete') for (const row of matches) rows.splice(rows.indexOf(row), 1);
        return { data: single ? matches[0] || null : matches, error: null };
      }
      return builder;
    }
  };
  return { client, calls, rows };
}
function state() { return PlanState.createPlanState({ storage: { getItem: () => null, setItem() {}, removeItem() {} }, finance: Finance, now: () => new Date(today) }); }

test('cloud save uses the verified authenticated user and stores only validated inputs', async () => {
  const mock = makeClient(), plans = createCloudPlans({ client: mock.client, planState: state() });
  const saved = await plans.createPlan('Autumn plan', profile({ internalToken: 'must not persist' }));
  assert.equal(saved.ok, false, 'unknown plan properties are rejected');
  const valid = await plans.createPlan(' Autumn plan ', profile());
  assert.deepEqual(valid, { ok: true, id: '00000000-0000-4000-8000-000000000001' });
  assert.equal(mock.calls[0].table, 'saved_plans');
  assert.equal(mock.calls[0].value.user_id, 'authenticated-student-1');
  assert.equal(mock.calls[0].value.plan_name, 'Autumn plan');
  assert.equal(mock.calls[0].value.plan_data.accountBalances[0], 50000);
  assert.equal('internalToken' in mock.calls[0].value.plan_data, false);
});

test('cloud plan list is scoped to the authenticated ID and rejects invalid persisted data', async () => {
  const mock = makeClient({ rows: [
    { id: '00000000-0000-4000-8000-000000000002', user_id: 'authenticated-student-1', plan_name: 'My plan', plan_data: profile(), updated_at: '2026-10-19T00:00:00Z' },
    { id: '00000000-0000-4000-8000-000000000003', user_id: 'someone-else', plan_name: 'Other plan', plan_data: profile() }
  ] });
  const result = await createCloudPlans({ client: mock.client, planState: state() }).listPlans();
  assert.equal(result.ok, true);
  assert.deepEqual(result.plans.map(item => item.id), ['00000000-0000-4000-8000-000000000002']);
  assert.deepEqual(mock.calls[0].filters, [['user_id', 'authenticated-student-1']]);

  const invalid = makeClient({ rows: [{ id: '00000000-0000-4000-8000-000000000004', user_id: 'authenticated-student-1', plan_name: 'Bad plan', plan_data: { ...profile(), gap: 999 } }] });
  assert.equal((await createCloudPlans({ client: invalid.client, planState: state() }).listPlans()).ok, false);
});

test('rename and delete constrain updates by both row ID and authenticated user ID', async () => {
  const id = '00000000-0000-4000-8000-000000000005';
  const mock = makeClient({ rows: [{ id, user_id: 'authenticated-student-1', plan_name: 'Old', plan_data: profile() }] });
  const plans = createCloudPlans({ client: mock.client, planState: state() });
  assert.deepEqual(await plans.renamePlan(id, 'New name'), { ok: true });
  assert.deepEqual(mock.calls[0].filters, [['id', id], ['user_id', 'authenticated-student-1']]);
  assert.deepEqual(await plans.deletePlan(id), { ok: true });
  assert.deepEqual(mock.calls[1].filters, [['id', id], ['user_id', 'authenticated-student-1']]);
  assert.equal(mock.rows.length, 0);
});

test('cloud load validates then saves only the profile for local recomputation', () => {
  const stored = new Map(), planState = {
    validateProfile: value => value?.tuition ? value : null,
    savePlan: value => { stored.set('profile', value); return { ok: true }; }
  };
  const plans = createCloudPlans({ client: makeClient().client, planState });
  assert.deepEqual(plans.restorePlan({ planData: profile(), calculatedGap: 999 }), { ok: true });
  assert.equal(stored.get('profile').tuition, '8000');
  assert.equal('calculatedGap' in stored.get('profile'), false);
  assert.equal(plans.restorePlan({ planData: { invalid: true } }).ok, false);
});

test('unauthenticated or expired sessions cannot read or write cloud plans', async () => {
  const mock = makeClient({ authError: new Error('expired') });
  const plans = createCloudPlans({ client: mock.client, planState: state() });
  assert.equal((await plans.listPlans()).ok, false);
  assert.equal((await plans.createPlan('Plan', profile())).ok, false);
  assert.equal(mock.calls.length, 0);
});
