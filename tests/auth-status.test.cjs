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

test('logout confirmation cancellation keeps the session and confirmed logout runs once', async () => {
  let signedOut = 0, confirm;
  const canceled = AuthNavigation.createLogoutController(async () => false);
  assert.equal(await canceled({}, async () => { signedOut += 1; }), false);
  assert.equal(signedOut, 0, 'Cancel must not run the sign-out action');

  let resolveConfirmation;
  confirm = AuthNavigation.createLogoutController(() => new Promise(resolve => { resolveConfirmation = resolve; }));
  const first = confirm({}, async () => { signedOut += 1; });
  assert.equal(await confirm({}, async () => { signedOut += 1; }), false, 'a second request is ignored while confirmation is open');
  resolveConfirmation(true);
  assert.equal(await first, true);
  assert.equal(signedOut, 1, 'confirmed logout runs exactly once');
});

test('profile menu exposes accessible dismissal and uses the existing Supabase sign-out API', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth-status.js'), 'utf8');
  assert.match(source, /aria-haspopup", "true"/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown"/);
  assert.match(source, /href = "\/account\.html"/);
  assert.match(source, /client\.auth\.signOut\(\)/);
  assert.match(source, /Log out of CampusBridge AI\?/);
  assert.match(source, /Are you sure you want to log out of your account\?/);
  assert.match(source, /data-cancel-logout/);
  assert.match(source, /data-confirm-logout/);
  assert.match(source, /root\.location\.href = "\/account\.html#login-form"/);
});

test('account form links remain available after login and direct hashes are restored after auth checks', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'js', 'account-page.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'account.html'), 'utf8');
  for (const [label, id] of [['Create an account', 'signup-form'], ['Sign in', 'login-form'], ['Reset password', 'reset-request-form']]) {
    assert.ok(html.includes(`href="#${id}"`), `${label} should link to #${id}`);
    assert.ok(html.includes(`id="${id}"`), `${label} target should exist`);
  }
  assert.match(page, /authPanel\.hidden = false/);
  assert.match(page, /window\.addEventListener\("hashchange", scrollToAccountHash\)/);
  assert.match(page, /target\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(page, /If the email belongs to an account, Supabase will send a password-reset link\./, 'reset requests do not reveal whether an address is registered');
});
