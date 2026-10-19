const test = require('node:test');
const assert = require('node:assert/strict');
const Finance = require('../lib/finance.js');
const PlanState = require('../lib/plan-state.js');
const Savings = require('../lib/savings-tracker.js');

const date = new Date('2026-10-19T12:00:00.000Z');
const profile = {
  homeCountry: 'Bangladesh', destinationCountry: 'United Kingdom', homeCur: 'BDT', tuitionCur: 'GBP', tuition: '8000', exchangeRate: '155',
  rateSource: 'Student supplied bank reference', rateTimestamp: '2026-10-19T10:00', rateProvenance: 'Unverified student supplied rate', planningMode: Finance.PLANNING_MODES.ALL_COSTS,
  savings: '500000', otherSavings: '450000', accountBalances: [50000], emergency: '50000', committed: '10000', income: '60000', expenses: '35000', paymentFee: '0',
  visaCost: '', applicationCost: '', flightCost: '', insuranceCost: '', documentCost: '', accommodationDeposit: '', initialSetupCost: '', otherOneTimeCosts: '', initialLivingMonths: '', monthlyRent: '', monthlyFood: '', monthlyTransport: '', monthlyUtilities: '', monthlyOtherLiving: '', deadline: '2026-12-18'
};
function memoryStorage(seed = null) {
  const values = new Map(seed === null ? [] : [[Savings.STORAGE_KEY, seed]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
function setup({ storage = memoryStorage(), idFactory } = {}) {
  let nextId = 1;
  const ids = idFactory || (() => `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`);
  const planState = PlanState.createPlanState({ storage: memoryStorage(), finance: Finance, now: () => date });
  return { storage, service: Savings.createLocalSavings({ storage, finance: Finance, planState, now: () => date, idFactory: ids }) };
}

test('local storage saves, lists, opens, renames, and deletes historical roadmaps', () => {
  const { storage, service } = setup();
  const saved = service.saveRoadmap('Autumn plan', profile);
  assert.equal(saved.ok, true);
  assert.equal(storage.values.has(Savings.STORAGE_KEY), true);
  const listed = service.listRoadmaps();
  assert.equal(listed.ok, true);
  assert.equal(listed.roadmaps.length, 1);
  assert.equal(listed.roadmaps[0].name, 'Autumn plan');
  assert.deepEqual(listed.roadmaps[0].profile, profile);
  assert.equal(listed.roadmaps[0].snapshot.result.requiredFunds, Finance.calculateTuition(profile, date).requiredFunds);
  const reopened = Savings.createLocalSavings({ storage, finance: Finance, planState: PlanState, now: () => date });
  assert.equal(reopened.listRoadmaps().roadmaps[0].id, saved.id, 'a fresh service instance sees data after a page reload');
  assert.equal(service.renameRoadmap(saved.id, 'Autumn revised label').ok, true);
  assert.equal(service.listRoadmaps().roadmaps[0].snapshot.calculatedAt, date.toISOString(), 'renaming keeps the saved calculation snapshot');
  assert.equal(service.deleteRoadmap(saved.id).ok, true);
  assert.deepEqual(service.listRoadmaps().roadmaps, []);
});

test('local deposit create, edit, delete, and progress use recorded BDT values', () => {
  const { service } = setup();
  const roadmap = service.saveRoadmap('Autumn plan', profile);
  const fields = { amount: '125.50', currency: 'BDT', depositDate: '2026-10-19', note: 'First transfer to savings' };
  const created = service.saveDeposit(roadmap.id, fields);
  assert.equal(created.ok, true);
  const listed = service.listDeposits(roadmap.id);
  assert.equal(listed.deposits[0].amount_bdt, 125.5);
  assert.equal(listed.deposits[0].note, fields.note);
  const changed = service.saveDeposit(roadmap.id, { ...fields, amount: '225.50' }, created.id);
  assert.equal(changed.ok, true);
  const snapshot = service.listRoadmaps().roadmaps[0].snapshot;
  const progress = Savings.compare(snapshot, service.listDeposits(roadmap.id).deposits, date);
  assert.equal(progress.depositsBdt, 225.5);
  assert.equal(progress.savingsBdt, snapshot.result.usable + 225.5);
  assert.equal(progress.remainingBdt, Math.max(0, snapshot.result.requiredFunds - snapshot.result.usable - 225.5));
  assert.equal(progress.coveredPercent, Math.min(100, Math.round((snapshot.result.usable + 225.5) / snapshot.result.requiredFunds * 100)));
  assert.equal(service.deleteDeposit(created.id, roadmap.id).ok, true);
  assert.deepEqual(service.listDeposits(roadmap.id).deposits, []);
});

test('deposit validation rejects invalid amounts, currencies, dates, and notes', () => {
  const valid = { amount: '125.50', currency: 'BDT', depositDate: '2026-10-19', note: 'Transport savings' };
  assert.deepEqual(Savings.validateDeposit(valid, { today: date }), { ok: true, deposit: { amount_bdt: 125.5, currency: 'BDT', deposit_date: '2026-10-19', note: 'Transport savings' } });
  for (const amount of ['', 0, -1, Infinity, 1_000_000_000_001]) assert.equal(Savings.validateDeposit({ ...valid, amount }, { today: date }).ok, false);
  assert.equal(Savings.validateDeposit({ ...valid, currency: 'USD' }, { today: date }).ok, false);
  assert.equal(Savings.validateDeposit({ ...valid, depositDate: '2026-02-31' }, { today: date }).ok, false);
  assert.equal(Savings.validateDeposit({ ...valid, depositDate: '2026-10-20' }, { today: date }).ok, false);
  assert.equal(Savings.validateDeposit({ ...valid, depositDate: '2026-10-18' }, { today: date, earliestDate: '2026-10-19' }).ok, false);
  assert.equal(Savings.validateDeposit({ ...valid, note: 'x'.repeat(251) }, { today: date }).ok, false);
});

test('revised plans remain separate historical snapshots and keep revision links', () => {
  const { service } = setup();
  const original = service.saveRoadmap('Original plan', profile);
  const revised = service.saveRoadmap('Revised plan', profile, original.id);
  assert.equal(revised.ok, true);
  assert.equal(service.deleteRoadmap(original.id).ok, false, 'a source roadmap with a revision is preserved');
  const plans = service.listRoadmaps().roadmaps;
  assert.equal(plans.length, 2);
  assert.equal(plans.find(item => item.id === revised.id).revisedFromId, original.id);
  assert.equal(service.deleteRoadmap(revised.id).ok, true);
  assert.equal(service.deleteRoadmap(original.id).ok, true);
});

test('exported backups have a recognized version and restore data after explicit confirmation by the page', () => {
  const first = setup();
  const roadmap = first.service.saveRoadmap('Backup plan', profile);
  first.service.saveDeposit(roadmap.id, { amount: '80', currency: 'BDT', depositDate: '2026-10-19', note: '' });
  const exported = first.service.exportBackup();
  assert.equal(exported.ok, true);
  const backup = JSON.parse(exported.json);
  assert.equal(backup.format, Savings.BACKUP_FORMAT);
  assert.equal(backup.version, Savings.BACKUP_VERSION);
  assert.equal(backup.data.roadmaps.length, 1);
  assert.equal(backup.data.deposits.length, 1);

  const second = setup();
  second.service.saveRoadmap('Replace me', profile);
  const imported = second.service.importBackup(exported.json);
  assert.equal(imported.ok, true);
  assert.equal(imported.roadmapCount, 1);
  assert.equal(imported.depositCount, 1);
  assert.equal(second.service.listRoadmaps().roadmaps[0].name, 'Backup plan');
  assert.equal(second.service.listDeposits(roadmap.id).deposits[0].amount_bdt, 80);
});

test('malformed, unrecognized, unsupported, and calculation-tampered backups are rejected without changing local data', () => {
  const { service } = setup();
  service.saveRoadmap('Keep this plan', profile);
  const original = service.exportBackup().json;
  for (const source of ['{no json', JSON.stringify({ format: 'other', version: 1 }), JSON.stringify({ format: Savings.BACKUP_FORMAT, version: 99 })]) assert.equal(service.importBackup(source).ok, false);
  const tampered = JSON.parse(original);
  tampered.data.roadmaps[0].snapshot.result.requiredFunds += 1;
  assert.equal(service.importBackup(JSON.stringify(tampered)).ok, false);
  const cyclic = JSON.parse(original), parent = cyclic.data.roadmaps[0];
  cyclic.data.roadmaps.push({ ...parent, id: '00000000-0000-4000-8000-000000000099', name: 'Second plan', revisedFromId: parent.id });
  parent.revisedFromId = '00000000-0000-4000-8000-000000000099';
  assert.equal(service.importBackup(JSON.stringify(cyclic)).ok, false, 'backup cannot create circular revision history');
  assert.equal(service.importBackup('x'.repeat(Savings.MAX_BACKUP_LENGTH + 1)).ok, false);
  assert.equal(service.listRoadmaps().roadmaps[0].name, 'Keep this plan');
});

test('stored malformed JSON and unsupported shapes fail safely without crashing or silently overwriting', () => {
  const corrupt = setup({ storage: memoryStorage('{') });
  assert.equal(corrupt.service.listRoadmaps().ok, false);
  assert.equal(corrupt.service.saveRoadmap('Plan', profile).ok, false);
  const unsupported = setup({ storage: memoryStorage(JSON.stringify({ version: 2, roadmaps: [], deposits: [] })) });
  assert.equal(unsupported.service.listRoadmaps().ok, false);
});

test('unavailable, blocked, and full browser storage return safe errors', () => {
  const unavailable = setup({ storage: null });
  assert.equal(unavailable.service.listRoadmaps().ok, false);
  assert.equal(unavailable.service.saveRoadmap('Plan', profile).ok, false);
  const throwingRead = setup({ storage: { getItem() { throw new Error('blocked'); }, setItem() {} } });
  assert.equal(throwingRead.service.listRoadmaps().ok, false);
  const throwingWrite = setup({ storage: { getItem() { return null; }, setItem() { throw new Error('quota'); } } });
  const failed = throwingWrite.service.saveRoadmap('Plan', profile);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /storage is full or unavailable/i);
});
