const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const routes = ['index.html', 'planner.html', 'roadmap.html', 'stress-tests.html', 'transfers.html', 'assistant.html', 'report.html', 'account.html', 'privacy.html'];

test('all static routes exist with useful titles, shared shell, and page-specific initialization', () => {
  for (const file of routes) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /<title>[^<]+<\/title>/, file);
    assert.match(html, /data-page="[a-z]+"/, file);
    assert.match(html, /\/js\/site\.js/, file);
    assert.match(html, /site-header/, file);
    assert.match(html, /site-footer/, file);
    if (file === 'planner.html') assert.match(html, /\/app\.js/, file);
    else if (file !== 'index.html' && file !== 'privacy.html') assert.match(html, /\/js\/[a-z-]+-page\.js/, file);
  }
});

test('each dependent page declares every static element its module initializes', () => {
  const modules = [
    ['roadmap.html', 'js/roadmap-page.js'], ['stress-tests.html', 'js/stress-tests-page.js'],
    ['transfers.html', 'js/transfers-page.js'], ['assistant.html', 'js/assistant-page.js'], ['report.html', 'js/report-page.js']
  ];
  for (const [page, script] of modules) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const source = fs.readFileSync(path.join(root, script), 'utf8');
    for (const match of source.matchAll(/getElementById\(["']([^"']+)["']\)/g)) {
      assert.ok(html.includes(`id="${match[1]}"`), `${page} is missing #${match[1]} used by ${script}`);
    }
  }
});

test('shared navigation points to every migrated page and preserves real static destinations', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  for (const href of ['/', '/planner.html', '/roadmap.html', '/stress-tests.html', '/transfers.html', '/assistant.html', '/report.html', '/privacy.html']) {
    assert.ok(site.includes(`"${href}"`), `navigation should include ${href}`);
    const target = href === '/' ? 'index.html' : href.slice(1);
    assert.ok(fs.existsSync(path.join(root, target)), `route target ${target} should exist`);
  }
  assert.match(site, /aria-current", "page"/);
  assert.match(site, /assistantLink\.href = "\/assistant\.html"/);
  assert.match(site, /assistantLink\.append\(createIcon\("sparkle"\)/);
  assert.match(site, /transfersLink\.href = "\/transfers\.html"/);
  assert.match(site, /transfersLink\.lastChild\.textContent = "Transfers"/);
  assert.match(site, /find\(item => item\.id === "planning"\)[\s\S]*find\(item => item\.id === "more"\)[\s\S]*nav\.append\(planningGroup\.container, assistantLink, transfersLink, moreGroup\.container\)/, 'the top-level order is Home, Financial Planning, AI Assistant, Transfers, More');
  assert.match(site, /id: "more", label: "More"/);
  assert.match(site, /pages: \[\["report", "Financial Report", "\/report\.html", "fileText"\], \["privacy", "Privacy", "\/privacy\.html", "shieldCheck"\]\]/, 'More contains only the report and privacy destinations');
  assert.doesNotMatch(site, /label: "Transfers & Support"|label: "Transfer and Supports?"|label: "Transfer & Supports?"/);
  assert.doesNotMatch(site, /\[\["assistant", "AI assistant", "\/assistant\.html"/, 'AI Assistant is no longer buried in a dropdown');
  const authStatus = fs.readFileSync(path.join(root, 'js/auth-status.js'), 'utf8');
  assert.match(authStatus, /account\.href = "\/account\.html"/);
  assert.match(authStatus, /account\.textContent = "My Account"/, 'Account remains available from the profile menu');
  assert.match(authStatus, /document\.body\.dataset\.page === "account"\) account\.setAttribute\("aria-current", "page"\)/, 'Account keeps its active-page indicator inside the profile menu');
  assert.match(site, /confirm\(/);
});

test('every shared dropdown option receives its own decorative outline icon', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  const expected = [
    ['Planner', '/planner.html', 'calculator'], ['Savings roadmap', '/roadmap.html', 'route'],
    ['Stress tests', '/stress-tests.html', 'chart'],
    ['Financial Report', '/report.html', 'fileText'], ['Privacy', '/privacy.html', 'shieldCheck']
  ];
  for (const [label, href, icon] of expected) {
    assert.ok(site.includes(`"${label}", "${href}", "${icon}"`), `${label} should retain its route and use its matching icon`);
    assert.ok(site.includes(`${icon}: '`), `${icon} should have an inline SVG drawing`);
  }
  assert.match(site, /for \(const \[id, label, href, iconName\] of group\.pages\)/);
  assert.match(site, /pages: \[\["report", "Financial Report", "\/report\.html", "fileText"\]/);
  assert.match(site, /link\.append\(createIcon\(iconName\), linkLabel\)/);
  assert.match(site, /setAttribute\("aria-hidden", "true"\)/, 'SVG icons stay decorative while labels remain text');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.navlinks \.navDropdown \.navIcon\{width:16px;height:16px;flex:0 0 16px/);
  assert.match(css, /\.navlinks \.navDropdown a\{display:flex;align-items:center;gap:10px/);
});

test('all pages load one shared Supabase client after its official CDN and config', () => {
  for (const file of routes) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const cdn = html.indexOf('cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    const config = html.indexOf('/js/supabase-config.js');
    const client = html.indexOf('/js/supabase-client.js');
    const authStatus = html.indexOf('/js/auth-status.js');
    assert.ok(cdn >= 0 && cdn < config && config < client && client < authStatus, `${file} must load Supabase once in dependency order`);
    for (const local of ['/lib/cloud-plans.js', '/js/supabase-config.js', '/js/supabase-client.js', '/js/auth-status.js']) assert.ok(fs.existsSync(path.join(root, local.slice(1))), `${file}: missing ${local}`);
  }
  const config = fs.readFileSync(path.join(root, 'js/supabase-config.js'), 'utf8');
  const supabaseUrl = config.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1];
  const publishableKey = config.match(/\bpublishableKey\s*:\s*["']([^"']+)["']/)?.[1];
  assert.ok(supabaseUrl && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl), 'Supabase URL must be configured');
  assert.ok(publishableKey && publishableKey !== 'YOUR_SUPABASE_PUBLISHABLE_KEY', 'Supabase publishable key must be configured');
  assert.match(publishableKey, /^sb_publishable_[A-Za-z0-9_-]+$/, 'key must use the configured publishable-key format');
  assert.doesNotMatch(config, /service_role|secret/i);
});

test('account route exposes email, OAuth, recovery, and explicit cloud-plan actions', () => {
  const html = fs.readFileSync(path.join(root, 'account.html'), 'utf8');
  for (const id of ['signup-form', 'login-form', 'google-signin', 'reset-request-form', 'recovery-complete-form', 'cloud-save-form', 'cloud-plan-list', 'mfa-challenge-form', 'mfa-enroll-form', 'mfa-disable-form', 'mfa-qr-code']) assert.ok(html.includes(`id="${id}"`), `account page is missing #${id}`);
  assert.match(html, /\/lib\/mfa-flow\.js/);
  const account = fs.readFileSync(path.join(root, 'js/account-page.js'), 'utf8');
  for (const method of ['signUp(', 'signInWithPassword(', 'signInWithOAuth(', 'resetPasswordForEmail(', 'updateUser({ password']) assert.ok(account.includes(method), `account module is missing ${method}`);
  assert.match(account, /emailRedirectTo:.*location\.origin/);
  assert.match(account, /flow=recovery/);
  assert.match(account, /This cannot be undone/);
  assert.match(account, /security\.status !== "ready"/);
  assert.match(account, /mfa\.verifyEnrollment/);
  assert.match(account, /mfa\.disable/);
});

test('feature pages reuse the finance engine and assistant remote request contains only question', () => {
  for (const file of ['js/roadmap-page.js', 'js/stress-tests-page.js', 'js/report-page.js', 'js/transfers-page.js', 'js/assistant-page.js']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /CampusBridgePageUtils/);
  }
  const assistant = fs.readFileSync(path.join(root, 'js/assistant-page.js'), 'utf8');
  assert.match(assistant, /JSON\.stringify\(\{ question: text \}\)/);
  assert.doesNotMatch(assistant, /JSON\.stringify\(\{[^}]*profile/);
  assert.ok(fs.existsSync(path.join(root, 'api/assistant.js')));
  assert.ok(fs.existsSync(path.join(root, 'api/exchange-rates.js')));
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /\/api\/assistant/);
  assert.match(fs.readFileSync(path.join(root, 'lib/exchange-rates.js'), 'utf8'), /\/api\/exchange-rates/);
});

test('transfer quotes use editable provider names and refresh comparison labels after renaming', () => {
  const html = fs.readFileSync(path.join(root, 'transfers.html'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'js/transfers-page.js'), 'utf8');
  const nameFields = [...html.matchAll(/data-field="name"/g)];
  assert.equal(nameFields.length, 3, 'each existing quote card has an editable provider name');
  assert.equal((html.match(/data-field="name"[^>]*maxlength="80"[^>]*required/g) || []).length, 3, 'provider names are required and capped at 80 characters');
  assert.match(page, /return \{ name: value\("name"\), currency, totalCost: value\("total"\)/, 'names come from the form while existing quote fields remain independently mapped');
  assert.match(page, /if\s*\(comparisonStarted\)\s*compareQuotes\(\)/, 'editing a name refreshes existing comparison results');
  assert.match(page, /title\.textContent = quote\.quote\.name/, 'custom names are rendered as text in result cards');
});

test('homepage keeps its planning actions and tool cards without an Earth animation', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  for (const text of ['Plan your next step', 'Organize study-abroad costs', 'Start planning', 'How your data is handled', 'Savings roadmap', 'Stress tests', 'Transfer quotes', 'AI assistant', 'Meet your AI financial assistant', 'Ask CampusBridge AI', 'Print or save your financial plan', 'Build a plan to print', 'Financial report', 'Privacy and limits', 'Bring your own estimates']) assert.ok(html.includes(text), `homepage should retain ${text}`);
  assert.match(html, /href="\/assistant\.html">Ask CampusBridge AI/);
  assert.match(html, /href="\/planner\.html#profileForm">Build a plan to print/);
  assert.doesNotMatch(html, /home-earth|earthFallback|<canvas|WebGL/i);
  assert.doesNotMatch(html, /home-earth\.js/);
  assert.match(css, /body\[data-page="home"\] \.hero/);
  assert.match(css, /body\[data-page="home"\] \.hero \.homeCard/);
});

