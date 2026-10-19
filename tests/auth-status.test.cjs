const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AuthNavigation = require('../js/auth-status.js');

test('logged-out navigation state offers login without an avatar or logout state', () => {
  assert.deepEqual(AuthNavigation.getNavigationState(null), {
    authenticated: false, displayName: '', email: '', initial: ''
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth-status.js'), 'utf8');
  assert.match(source, /\/account\.html#login-form/);
  assert.match(source, /login\.hidden = view\.authenticated/);
  assert.match(source, /profile\.hidden = !view\.authenticated/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'account.html'), 'utf8'), /id="signup-form"/);
});

test('logged-in navigation prefers profile names and uses an uppercase initial', () => {
  assert.deepEqual(AuthNavigation.getNavigationState({
    email: 'student@example.com', user_metadata: { full_name: 'Amina Rahman' }
  }), {
    authenticated: true, displayName: 'Amina Rahman', email: 'student@example.com', initial: 'A'
  });
});

test('email fallback is readable and safely falls back to User', () => {
  assert.equal(AuthNavigation.getDisplayName({ email: 'amina.rahman+campus@example.com' }), 'Amina Rahman');
  assert.deepEqual(AuthNavigation.getNavigationState({}), {
    authenticated: true, displayName: 'User', email: '', initial: 'U'
  });
});

test('session restoration ignores stale results and registers only one auth listener', async () => {
  let listener, resolveRestore, listeners = 0;
  const restored = new Promise(resolve => { resolveRestore = resolve; });
  const client = { auth: {
    onAuthStateChange(callback) { listeners += 1; listener = callback; },
    getSession() { return restored; },
    signOut: async () => ({ error: null })
  } };
  const states = [];
  const controller = AuthNavigation.createSessionController(client, user => states.push(user?.id || null));
  controller.start(); controller.start();
  listener('SIGNED_IN', { user: { id: 'new-session-user' } });
  resolveRestore({ data: { session: { user: { id: 'stale-restored-user' } } }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(listeners, 1);
  assert.deepEqual(states, ['new-session-user']);
});

test('session restoration renders the existing signed-in account', async () => {
  const states = [];
  const controller = AuthNavigation.createSessionController({ auth: {
    onAuthStateChange() {},
    getSession: async () => ({ data: { session: { user: { id: 'restored-user' } } }, error: null })
  } }, user => states.push(user?.id || null));
  controller.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(states, ['restored-user']);
});

test('successful sign-out immediately returns navigation state to logged out', async () => {
  const states = [];
  const controller = AuthNavigation.createSessionController({ auth: { signOut: async () => ({ error: null }) } }, user => states.push(user));
  await controller.signOut();
  assert.deepEqual(states, [null]);
});

test('a pending session restore cannot undo a completed sign-out', async () => {
  let resolveRestore;
  const restored = new Promise(resolve => { resolveRestore = resolve; });
  const states = [];
  const controller = AuthNavigation.createSessionController({ auth: {
    onAuthStateChange() {},
    getSession: () => restored,
    signOut: async () => ({ error: null })
  } }, user => states.push(user?.id || null));
  controller.start();
  await controller.signOut();
  resolveRestore({ data: { session: { user: { id: 'stale-user' } } }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(states, [null]);
});

test('profile menu exposes accessible dismissal and uses the existing Supabase sign-out API', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth-status.js'), 'utf8');
  assert.match(source, /aria-haspopup", "true"/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown"/);
  assert.match(source, /href = "\/account\.html"/);
  assert.match(source, /client\.auth\.signOut\(\)/);
});
