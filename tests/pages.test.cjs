const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const routes = ['index.html', 'planner.html', 'roadmap.html', 'savings.html', 'stress-tests.html', 'transfers.html', 'assistant.html', 'report.html', 'account.html', 'privacy.html'];

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

test('planner loads its validated guided steps and review stage', () => {
  const html = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  const steps = fs.readFileSync(path.join(root, 'js/planner-steps.js'), 'utf8');
  assert.match(html, /<script src="\/js\/planner-steps\.js"><\/script>/);
  assert.match(html, /Other savings outside listed accounts \(BDT, optional\)/);
  for (const title of ['Costs', 'Exchange rate', 'Funds', 'Deadline', 'Review']) {
    assert.ok(steps.includes(`title: "${title}"`), `planner should include the ${title} step`);
  }
  assert.match(steps, /function validateStep\(index\)/);
  assert.match(steps, /Choose the date and time for this exchange rate/);
  assert.match(steps, /Choose your tuition deadline to continue/);
  assert.match(steps, /function updateReview\(\)/);
  assert.match(steps, /Add one-time study costs \(optional\)/);
  assert.match(steps, /Estimate initial living costs \(optional\)/);
  assert.match(steps, /button\.dataset\.state = state/);
  assert.match(steps, /number\.textContent = state === "complete" \? "✓"/);
  assert.match(steps, /activate to revisit/);
  new vm.Script(steps, { filename: 'js/planner-steps.js' });
});

test('planner form uses project fonts without changing its large page headings', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] #profileForm,[\s\S]*?#profileForm button\{font-family:'DM Sans',sans-serif\}/);
  assert.match(css, /#profileForm h3,[\s\S]*?#profileForm \.planningModeCard strong\{font-family:Manrope,sans-serif\}/);
  assert.doesNotMatch(css, /body\[data-page="planner"\] #planner(?: h1| h2)/, 'large planner page headings remain outside the form typography override');
  assert.match(css, /body\[data-page\]\{font-family:'DM Sans',sans-serif\}/, 'every page uses DM Sans for body text');
  assert.match(css, /body\[data-page\] :is\(button,input,select,textarea\)\{font-family:'DM Sans',sans-serif\}/, 'interactive controls use DM Sans on every page');
  assert.match(css, /body\[data-page\] :is\(h3,h4,h5,legend,summary,\.calendarMonth\)\{font-family:Manrope,sans-serif\}/, 'secondary headings use Manrope without changing large h1/h2 display rules');
  assert.doesNotMatch(css, /Plus Jakarta Sans/, 'the unused font no longer overrides the shared type system');
  for (const file of routes) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /family=Plus\+Jakarta\+Sans/, `${file} does not download an unused font`);
    assert.match(html, /family=DM\+Sans/, `${file} loads the shared body font`);
    assert.match(html, /family=Manrope/, `${file} loads the shared heading font`);
  }
});

test('each dependent page declares every static element its module initializes', () => {
  const modules = [
    ['roadmap.html', 'js/roadmap-page.js'], ['stress-tests.html', 'js/stress-tests-page.js'],
    ['transfers.html', 'js/transfers-page.js'], ['assistant.html', 'js/assistant-page.js'], ['report.html', 'js/report-page.js'], ['savings.html', 'js/savings-page.js']
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
  for (const href of ['/', '/planner.html', '/roadmap.html', '/savings.html', '/stress-tests.html', '/transfers.html', '/assistant.html', '/report.html', '/privacy.html']) {
    assert.ok(site.includes(`"${href}"`), `navigation should include ${href}`);
    const target = href === '/' ? 'index.html' : href.slice(1);
    assert.ok(fs.existsSync(path.join(root, target)), `route target ${target} should exist`);
  }
  assert.match(site, /aria-current", "page"/);
  assert.match(site, /id: "planning", label: "Plan"/);
  assert.doesNotMatch(site, /id: "support", label: "Support"/, 'Support and More share a single menu');
  assert.match(site, /assistantLink\.href = "\/assistant\.html"/, 'AI Assistant is a direct top-level destination');
  assert.match(site, /assistantLink\.append\(createIcon\("sparkle"\)/);
  assert.match(site, /if \(page === "assistant"\) assistantLink\.setAttribute\("aria-current", "page"\)/, 'AI Assistant receives the active-page state');
  assert.match(site, /nav\.append\(planningGroup\.container, assistantLink, moreGroup\.container\)/, 'AI Assistant appears beside Plan and the combined More menu');
  assert.match(site, /id: "more", label: "More"/);
  assert.match(site, /pages: \[\["transfers", "Transfers", "\/transfers\.html", "arrowsLeftRight"\], \["report", "Financial Report", "\/report\.html", "fileText"\], \["privacy", "Privacy", "\/privacy\.html", "shieldCheck"\]\]/, 'More combines Transfers, Financial Report, and Privacy');
  const authStatus = fs.readFileSync(path.join(root, 'js/auth-status.js'), 'utf8');
  assert.match(authStatus, /account\.href = "\/account\.html"/);
  assert.match(authStatus, /account\.textContent = "My Account"/, 'Account remains available from the profile menu');
  assert.match(authStatus, /document\.body\.dataset\.page === "account"\) account\.setAttribute\("aria-current", "page"\)/, 'Account keeps its active-page indicator inside the profile menu');
  assert.match(site, /group\.id === "planning"[\s\S]*?clear\.dataset\.clearPlan = ""[\s\S]*?submenu\.append\(clear\)/, 'the clear-plan action stays available in Plan without competing with destinations');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.topbar,\.topbar\.scrolled\{height:84px;min-height:84px\}/, 'desktop navigation uses a compact header height');
  assert.match(css, /\.topbar \.navlinks>a\.navPill:focus-visible/);
  assert.match(css, /\.topbar \.navlinks \.navDropdown>\.clearPlanButton\{width:100%/);
  assert.match(css, /\.navAuthSlot \.profileDropdown a\{border-color:#e7ece5;background:#f5f7f3;color:#245b47\}/, 'profile links have an explicit readable resting state inside the navigation');
  assert.match(css, /\.navAuthSlot \.profileDropdown a:hover,\.navAuthSlot \.profileDropdown a:focus-visible\{border-color:#d4e3d6;background:#edf4ee;color:#104b38\}/, 'profile-link hover and keyboard focus states stay readable');
  assert.match(css, /\.navAuthSlot \.profileDropdown a\[aria-current=page\]\{border-color:#dcebe0;background:#e7f1e9;color:#124f3b\}/, 'the active My Account link keeps its separate pale-sage state');
  assert.match(css, /\.topbar \.navDropdown\{[^}]*backdrop-filter:blur\(18px\) saturate\(145%\)/, 'topbar navigation menus use translucent glass styling');
  assert.match(css, /\.profileDropdown\{[^}]*backdrop-filter:blur\(18px\) saturate\(145%\)/, 'the account dropdown uses the same glass treatment');
  assert.match(css, /\.topbar \.navlinks>\.navGroup>\.navDropdown\{[^}]*backdrop-filter:blur\(14px\) saturate\(135%\)/, 'mobile navigation dropdowns retain a translucent glass panel');
});

test('session storage disclosure appears beside the planner form only', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  assert.match(site, /if \(page === "planner"\) \{\s*const plannerGrid = document\.querySelector\("#planner \.plannerGrid"\)/);
  assert.match(site, /plannerGrid\.before\(disclosure\)/);
  assert.doesNotMatch(site, /main\.prepend\(disclosure\)/, 'the disclosure is no longer prepended to every page');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.storageDisclosure\{margin:0 0 18px;padding:12px 15px/);
});

test('Clear Plan uses an accessible dialog and only explicit confirmation removes the current plan', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  assert.match(site, /createElement\("dialog"\); dialog\.id = "clear-plan-dialog"; dialog\.className = "clearPlanDialog"/);
  assert.match(site, /aria-labelledby", "clear-plan-title"/);
  assert.match(site, /aria-describedby", "clear-plan-message"/);
  for (const text of ['Clear your plan?', 'This will remove your current plan from the planner. Make sure you no longer need it before continuing.', 'Keep My Plan', 'Clear Plan', 'Account-saved plans are not deleted.']) assert.ok(site.includes(text), `confirmation dialog should explain ${text}`);
  assert.match(site, /dialog\.showModal\(\)[\s\S]*querySelector\("\[data-keep-plan\]"\)\.focus\(\)/, 'the modal opens and initially focuses the safe choice');
  assert.match(site, /keep\.addEventListener\("click", \(\) => dialog\.close\("keep"\)\)/);
  assert.match(site, /dialog\.addEventListener\("cancel", event => \{ event\.preventDefault\(\); dialog\.close\("keep"\); \}\)/, 'Escape closes without clearing');
  assert.match(site, /confirmClear\.addEventListener\("click", \(\) => \{[\s\S]*CampusBridgePlanState\?\.clearPlan\(\)[\s\S]*dialog\.close\("clear"\)/, 'only the explicit confirmation button clears the plan');
  assert.match(site, /dialog\.addEventListener\("close", \(\) => clearPlanTrigger\?\.focus/);
  assert.match(site, /const clearDialog = document\.getElementById\("clear-plan-dialog"\);\s*if \(clearDialog\?\.open\) \{ event\.preventDefault\(\); clearDialog\.close\("keep"\); return; \}/, 'Escape dismisses an open clear-plan dialog without clearing anything');
  assert.match(site, /document\.addEventListener\("pointerdown", event => \{\s*if \(document\.getElementById\("clear-plan-dialog"\)\?\.open\) return;/, 'dialog interactions do not close the menu behind the modal');
  assert.match(site, /container\.addEventListener\("focusout", event => \{\s*if \(document\.getElementById\("clear-plan-dialog"\)\?\.open\) return;/, 'opening Clear Plan does not hide its trigger behind the modal');
  assert.doesNotMatch(site, /window\.confirm\(/, 'the browser confirm prompt is replaced by the accessible dialog');
});

test('every shared dropdown option receives its own decorative outline icon', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  const expected = [
    ['Planner', '/planner.html', 'calculator'], ['Savings roadmap', '/roadmap.html', 'route'],
    ['Savings Tracker', '/savings.html', 'chart'], ['Stress tests', '/stress-tests.html', 'chart'],
    ['Transfers', '/transfers.html', 'arrowsLeftRight'],
    ['Financial Report', '/report.html', 'fileText'], ['Privacy', '/privacy.html', 'shieldCheck']
  ];
  for (const [label, href, icon] of expected) {
    assert.ok(site.includes(`"${label}", "${href}", "${icon}"`), `${label} should retain its route and use its matching icon`);
    assert.ok(site.includes(`${icon}: '`), `${icon} should have an inline SVG drawing`);
  }
  assert.match(site, /for \(const \[id, label, href, iconName\] of group\.pages\)/);
  assert.match(site, /pages: \[\["transfers", "Transfers", "\/transfers\.html", "arrowsLeftRight"\], \["report", "Financial Report", "\/report\.html", "fileText"\]/);
  assert.match(site, /link\.append\(createIcon\(iconName\), linkLabel\)/);
  assert.match(site, /setAttribute\("aria-hidden", "true"\)/, 'SVG icons stay decorative while labels remain text');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.navlinks \.navDropdown \.navIcon\{width:16px;height:16px;flex:0 0 16px/);
  assert.match(css, /\.navlinks \.navDropdown a\{display:flex;align-items:center;gap:10px/);
});

test('shared authentication controls load after the Supabase client on every page', () => {
  for (const file of routes) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const cdn = html.indexOf('cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    const config = html.indexOf('/js/supabase-config.js');
    const client = html.indexOf('/js/supabase-client.js');
    const authStatus = html.indexOf('/js/auth-status.js');
    assert.ok(cdn >= 0 && cdn < config && config < client && client < authStatus, `${file} must load Supabase once in dependency order`);
    for (const local of ['/js/supabase-config.js', '/js/supabase-client.js', '/js/auth-status.js']) assert.ok(fs.existsSync(path.join(root, local.slice(1))), `${file}: missing ${local}`);
    if (file !== 'savings.html') assert.ok(fs.existsSync(path.join(root, 'lib/cloud-plans.js')), `${file}: missing cloud-plan client`);
  }
  const config = fs.readFileSync(path.join(root, 'js/supabase-config.js'), 'utf8');
  const supabaseUrl = config.match(/\burl\s*:\s*["']([^"']+)["']/)?.[1];
  const publishableKey = config.match(/\bpublishableKey\s*:\s*["']([^"']+)["']/)?.[1];
  assert.ok(supabaseUrl && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl), 'Supabase URL must be configured');
  assert.ok(publishableKey && publishableKey !== 'YOUR_SUPABASE_PUBLISHABLE_KEY', 'Supabase publishable key must be configured');
  assert.match(publishableKey, /^sb_publishable_[A-Za-z0-9_-]+$/, 'key must use the configured publishable-key format');
  assert.doesNotMatch(config, /service_role|secret/i);
  const savings = fs.readFileSync(path.join(root, 'savings.html'), 'utf8');
  assert.match(savings, /supabase-js@2[\s\S]*supabase-config\.js[\s\S]*supabase-client\.js[\s\S]*auth-status\.js/, 'shared header authentication loads in dependency order');
  assert.doesNotMatch(savings, /\/lib\/cloud-plans\.js|\/lib\/mfa-flow\.js/, 'local tracker does not load cloud-plan or MFA-flow modules');
  const tracker = fs.readFileSync(path.join(root, 'lib/savings-tracker.js'), 'utf8');
  assert.doesNotMatch(tracker, /supabase|auth\.mfa|aal[12]/i, 'local tracker storage does not call Supabase or MFA');
  assert.match(savings, /export-savings/);
  assert.match(savings, /import-savings/);
  assert.match(savings, /not synced across accounts or devices/);
});

test('account route exposes email, OAuth, recovery, and explicit cloud-plan actions', () => {
  const html = fs.readFileSync(path.join(root, 'account.html'), 'utf8');
  for (const id of ['signup-form', 'login-form', 'google-signin', 'reset-request-form', 'recovery-complete-form', 'cloud-save-form', 'cloud-plan-list', 'mfa-challenge-form', 'mfa-enroll-form', 'mfa-disable-form', 'mfa-qr-code']) assert.ok(html.includes(`id="${id}"`), `account page is missing #${id}`);
  assert.match(html, /class="accountLayout"[\s\S]*class="accountMain"[\s\S]*class="accountStory"/, 'account access uses a split-panel layout');
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=DM\+Sans:[^"]*Manrope:/, 'the account page loads its body and heading font families');
  assert.doesNotMatch(html, /<details\b/, 'account forms do not use expand/collapse disclosures');
  assert.match(html, /id="login-form"[\s\S]*href="#reset-request-form"[\s\S]*href="#signup-form"/, 'sign-in offers password recovery and account creation below the form controls');
  assert.match(html, /id="signup-form"[^>]*hidden/, 'the account-creation view starts hidden and can be switched into without expanding a disclosure');
  assert.match(html, /id="reset-request-form"[^>]*hidden/, 'the password-recovery view starts hidden and can be switched into without expanding a disclosure');
  assert.match(html, /\/lib\/mfa-flow\.js/);
  const account = fs.readFileSync(path.join(root, 'js/account-page.js'), 'utf8');
  for (const method of ['signUp(', 'signInWithPassword(', 'signInWithOAuth(', 'resetPasswordForEmail(', 'updateUser({ password']) assert.ok(account.includes(method), `account module is missing ${method}`);
  assert.match(account, /emailRedirectTo:.*location\.origin/);
  assert.match(account, /flow=recovery/);
  assert.match(account, /This cannot be undone/);
  assert.match(account, /security\.status !== "ready"/);
  assert.match(account, /mfa\.verifyEnrollment/);
  assert.match(account, /mfa\.disable/);
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.accountLayout\{font-family:'DM Sans',sans-serif\}/, 'account copy uses the project body font');
  assert.match(css, /\.accountMain \.accountForm h2\{[^}]*font-family:Manrope,sans-serif/, 'account form headings use the project heading font');
  assert.match(css, /\.accountStory h2\{[^}]*font-family:Manrope,sans-serif/, 'the account story heading uses the project heading font');
  assert.match(css, /\.accountHero h1\{/, 'the Welcome back heading keeps its existing display typography');
});

test('feature pages reuse the finance engine and assistant remote request contains only question and server-verified references', () => {
  for (const file of ['js/roadmap-page.js', 'js/stress-tests-page.js', 'js/report-page.js', 'js/transfers-page.js', 'js/assistant-page.js']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /CampusBridgePageUtils/);
  }
  const assistant = fs.readFileSync(path.join(root, 'js/assistant-page.js'), 'utf8');
  assert.match(assistant, /requestBody = \{ question: text \}/);
  assert.match(assistant, /requestBody\.conversationId = savedQuestion\.conversationId/);
  assert.doesNotMatch(assistant, /JSON\.stringify\(\{[^}]*profile|requestBody\.messages/);
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

test('homepage keeps its planning actions and tool cards around a decorative animated globe', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  for (const text of ['Plan your next step', 'Organize study-abroad costs', 'Start planning', 'How your data is handled', 'Savings roadmap', 'Stress tests', 'Transfer quotes', 'AI assistant', 'Meet your AI financial assistant', 'Ask CampusBridge AI', 'Print or save your financial plan', 'Build a plan to print', 'Financial report', 'Privacy and limits', 'Bring your own estimates']) assert.ok(html.includes(text), `homepage should retain ${text}`);
  assert.match(html, /href="\/assistant\.html">Ask CampusBridge AI/);
  assert.match(html, /href="\/planner\.html#profileForm">Build a plan to print/);
  assert.match(html, /class="homeGlobe" aria-hidden="true"/, 'the centerpiece stays decorative for assistive technology');
  assert.match(html, /class="homeGlobeSphere"/);
  assert.match(html, /class="homeGlobeGrid"/, 'the sphere includes a latitude and longitude grid');
  assert.match(css, /body\[data-page="home"\] \.homeGlobeMap\{[^}]*animation:homeGlobeRotate 10s linear infinite/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*homeGlobeMap[^}]*animation:none/);
  assert.match(css, /body\[data-page="home"\] \.hero/);
  assert.match(css, /body\[data-page="home"\] \.hero \.homeCard/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(190px,250px\) minmax\(0,1fr\)/, 'the center globe has reserved space between the tile columns');
  assert.match(css, /homeGlobeSphere\{[^}]*width:90%/, 'the globe is sized to fill its reserved center column');
  assert.match(css, /backdrop-filter:blur\(12px\) saturate\(112%\)/, 'homepage tiles use subtle glass styling');
});

test('shared navigation uses a subtle translucent glass treatment', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.topbar,\.topbar\.scrolled\{[^}]*background:linear-gradient\(110deg,rgba\(20,125,97,\.88\),rgba\(16,105,81,\.78\)\)/);
  assert.match(css, /\.topbar,\.topbar\.scrolled\{[^}]*backdrop-filter:blur\(18px\) saturate\(140%\)/);
  assert.match(css, /\.topbar,\.topbar\.scrolled\{[^}]*-webkit-backdrop-filter:blur\(18px\) saturate\(140%\)/);
});
