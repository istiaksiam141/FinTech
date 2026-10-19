const test = require('node:test');
const assert = require('node:assert/strict');
const { createMfaFlow } = require('../lib/mfa-flow.js');

function mockClient({ currentLevel = 'aal1', nextLevel = 'aal1', factors = [], assuranceOverride } = {}) {
  const calls = [];
  let assurance = assuranceOverride === undefined ? { currentLevel, nextLevel } : assuranceOverride;
  const totp = [...factors];
  const client = { auth: { mfa: {
    getAuthenticatorAssuranceLevel: async () => ({ data: assurance, error: null }),
    listFactors: async () => ({ data: { totp: [...totp], phone: [] }, error: null }),
    challenge: async ({ factorId }) => { calls.push(['challenge', factorId]); return { data: { id: `challenge-${calls.filter(call => call[0] === 'challenge').length}` }, error: null }; },
    verify: async ({ factorId, challengeId, code }) => {
      calls.push(['verify', factorId, challengeId, code]);
      if (code !== '123456') return { data: null, error: new Error('Invalid TOTP code') };
      assurance = { currentLevel: 'aal2', nextLevel: 'aal2' };
      const factor = totp.find(item => item.id === factorId);
      if (factor) factor.status = 'verified';
      return { data: {}, error: null };
    },
    enroll: async () => {
      calls.push(['enroll']);
      const factor = { id: 'factor-new', status: 'unverified' }; totp.push(factor);
      return { data: { id: factor.id, totp: { qr_code: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E', secret: 'in-memory-only-test-secret' } }, error: null };
    },
    unenroll: async ({ factorId }) => {
      calls.push(['unenroll', factorId]);
      const index = totp.findIndex(item => item.id === factorId);
      if (index >= 0) totp.splice(index, 1);
      return { data: {}, error: null };
    }
  } } };
  return { client, calls, factors: totp };
}

test('accounts without MFA remain optional and ready at AAL1', async () => {
  const mock = mockClient();
  const flow = createMfaFlow({ client: mock.client });
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready');
  assert.equal((await flow.inspect(null)).status, 'signed-out');
});

test('unknown or missing assurance levels fail closed', async () => {
  for (const assuranceOverride of [null, {}, { currentLevel: 'mystery', nextLevel: 'aal1' }, { currentLevel: 'aal1', nextLevel: 'mystery' }]) {
    const flow = createMfaFlow({ client: mockClient({ assuranceOverride }).client });
    const state = await flow.inspect({ user: { id: 'student' } });
    assert.equal(state.status, 'error');
    assert.match(state.error, /unknown sign-in assurance/);
  }
});

test('restored AAL1 sessions with verified TOTP require a challenge before readiness', async () => {
  const mock = mockClient({ nextLevel: 'aal2', factors: [{ id: 'factor-1', status: 'verified' }] });
  const flow = createMfaFlow({ client: mock.client });
  const state = await flow.inspect({ user: { id: 'student' } });
  assert.equal(state.status, 'challenge-required');
  const challengeId = await flow.startChallenge(state.factor.id, { reuse: true });
  assert.equal((await flow.inspect({ user: { id: 'student' } })).challengeId, challengeId);
  await assert.rejects(flow.verifyCode('000000'), /incorrect or expired/);
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'challenge-required');
  await flow.verifyCode('123456');
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready');
});

test('enrollment returns a QR code, and is incomplete until the first TOTP code verifies', async () => {
  const mock = mockClient();
  const flow = createMfaFlow({ client: mock.client });
  const setup = await flow.beginEnrollment();
  assert.equal(setup.factorId, 'factor-new');
  assert.match(setup.qrCode, /^data:image\/svg\+xml/);
  assert.equal('secret' in setup, false, 'enrollment secret is not returned for persistence');
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready', 'an unverified factor does not count as enrolled MFA');
  await assert.rejects(flow.verifyEnrollment('bad'), /six-digit code/);
  await flow.verifyEnrollment('123456');
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready');
  assert.equal(mock.factors.find(item => item.id === setup.factorId).status, 'verified');
});

test('failed enrollment code can request a fresh challenge and cannot reuse the stale challenge', async () => {
  const mock = mockClient(), flow = createMfaFlow({ client: mock.client });
  const setup = await flow.beginEnrollment();
  await assert.rejects(flow.verifyEnrollment('000000'), /incorrect or expired/);
  const [freshId, coalescedId] = await Promise.all([flow.retryEnrollmentChallenge(), flow.retryEnrollmentChallenge()]);
  assert.notEqual(freshId, setup.challengeId);
  assert.equal(coalescedId, freshId, 'overlapping retry requests share one fresh challenge');
  assert.equal(mock.calls.filter(call => call[0] === 'challenge').length, 2);
  await assert.rejects(flow.verifyCode('123456', { factorId: setup.factorId, challengeId: setup.challengeId, purpose: 'enrollment' }), /expired/);
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready', 'enrollment remains incomplete after a failed code');
  await flow.verifyEnrollment('123456');
  assert.equal(mock.factors.find(item => item.id === setup.factorId).status, 'verified');
});

test('disabling a verified factor requires a successful current TOTP challenge', async () => {
  const mock = mockClient({ currentLevel: 'aal1', nextLevel: 'aal2', factors: [{ id: 'factor-1', status: 'verified' }] });
  const flow = createMfaFlow({ client: mock.client });
  await flow.startChallenge('factor-1', { purpose: 'disable' });
  await assert.rejects(flow.disable('factor-1', '000000'), /incorrect or expired/);
  assert.equal(mock.calls.some(call => call[0] === 'unenroll'), false);
  await flow.startChallenge('factor-1', { purpose: 'disable' });
  await flow.disable('factor-1', '123456');
  assert.deepEqual(mock.calls.filter(call => call[0] === 'unenroll'), [['unenroll', 'factor-1']]);
});

test('session inspection does not clear a pending factor-removal challenge', async () => {
  const mock = mockClient({ currentLevel: 'aal2', nextLevel: 'aal2', factors: [{ id: 'factor-1', status: 'verified' }] });
  const flow = createMfaFlow({ client: mock.client });
  const challengeId = await flow.startChallenge('factor-1', { purpose: 'disable' });
  assert.equal((await flow.inspect({ user: { id: 'student' } })).status, 'ready');
  await flow.disable('factor-1', '123456');
  assert.ok(mock.calls.some(call => call[0] === 'verify' && call[2] === challengeId));
  assert.deepEqual(mock.calls.filter(call => call[0] === 'unenroll'), [['unenroll', 'factor-1']]);
});

test('sign-out clears pending enrollment and factor-removal challenges', async () => {
  const mock = mockClient({ factors: [{ id: 'factor-1', status: 'verified' }] });
  const flow = createMfaFlow({ client: mock.client });
  const setup = await flow.beginEnrollment();
  await flow.startChallenge('factor-1', { purpose: 'disable' });
  await flow.inspect(null);
  await assert.rejects(flow.retryEnrollmentChallenge(), /Start authenticator setup again/);
  await assert.rejects(flow.verifyCode('123456', { factorId: 'factor-1', purpose: 'disable' }), /challenge expired/);
  await assert.rejects(flow.verifyEnrollment('123456'), /Start authenticator setup again/);
  assert.ok(setup.factorId);
});

test('MFA flow never uses persistent browser storage for secrets or codes', () => {
  const source = require('node:fs').readFileSync(require.resolve('../lib/mfa-flow.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /totp\.secret/);
});
