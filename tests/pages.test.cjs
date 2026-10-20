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

test('the floating AI assistant is mounted across the shared shell and sends no planner or chat history', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  const widget = fs.readFileSync(path.join(root, 'js/assistant-widget.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  for (const file of routes) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /\/js\/site\.js/, `${file} loads the shared shell`);
  }
  assert.match(site, /id = "campusbridge-assistant-widget"/);
  assert.match(site, /assistant-widget\.js/);
  assert.match(site, /aria-controls="assistant-widget-panel" aria-expanded="false"/);
  assert.match(site, /role="dialog" aria-modal="false"/);
  assert.match(site, /Saved planner inputs and quotes are never attached/);
  assert.match(widget, /CampusBridgeAssistantTask\.run/);
  assert.ok(widget.indexOf('if (task.handled)') < widget.indexOf('fetch("/api/assistant"'), 'planner explanations are handled locally before the remote API call');
  assert.match(widget, /JSON\.stringify\(\{ question: text \}\)/, 'the remote request includes only the current question');
  assert.doesNotMatch(widget, /conversationId|includeHistory|requestBody\.messages|profile:/);
  assert.match(widget, /event\.key === "Escape"/);
  assert.match(widget, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(css, /\.assistantWidgetPanel\[hidden\]\{display:none\}/);
  assert.match(css, /@media\(max-width:540px\)\{\s*\.assistantWidget/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  new vm.Script(widget, { filename: 'js/assistant-widget.js' });
});

test('planner loads its validated guided steps and review stage', () => {
  const html = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  const steps = fs.readFileSync(path.join(root, 'js/planner-steps.js'), 'utf8');
  assert.match(html, /<script src="\/js\/planner-steps\.js"><\/script>/);
  assert.match(html, /Other savings outside listed accounts \(<span data-plan-currency>/, 'savings labels follow the selected planning currency');
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

test('planner previews its first calculation and keeps AI explanations secondary', () => {
  const planner = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  const steps = fs.readFileSync(path.join(root, 'js/planner-steps.js'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assistant = fs.readFileSync(path.join(root, 'assistant.html'), 'utf8');
  const outcomes = [
    'Total estimated cost',
    'Available funds',
    'Funding gap',
    'Needed by your deadline'
  ];
  const previewIndex = planner.indexOf('class="plannerOutcomePreview"');
  const introIndex = planner.indexOf('class="formIntro"');
  const planningModeIndex = planner.indexOf('class="planningModeSelector"');
  assert.ok(previewIndex > introIndex && previewIndex < planningModeIndex, 'the preview appears in the planner before the guided inputs');
  for (const outcome of outcomes) assert.ok(planner.includes(outcome), `planner previews ${outcome}`);
  assert.match(planner, /after you review your assumptions and calculate your plan/i);
  assert.match(planner, /the planner is the source of your validated financial figures/i);
  assert.match(steps, /planningDetails\.append\(stepper\)/, 'guided financial steps stay inside the currency-gated fieldset');
  assert.match(steps, /planningDetails\.querySelectorAll\("\[required\]"\)/, 'the currency selector remains outside the guided field validation');
  assert.equal((planner.match(/id="planningCurrencyStep"/g) || []).length, 1, 'the currency selector appears once');
  assert.equal((planner.match(/id="planningCurrency"/g) || []).length, 1, 'the planning currency control appears once');
  assert.match(planner, /Other savings outside listed accounts \(<span data-plan-currency>/, 'savings use the dynamically selected currency');
  assert.match(assistant, /Use the planner for validated financial calculations/i);
  assert.match(home, /Calculate first · Understand next/);
  assert.match(home, /the planner—not the assistant—is the source of the calculation/);
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] \.plannerOutcomeGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:520px\)\{[\s\S]*?\.plannerOutcomeGrid\{grid-template-columns:1fr\}/);
});

test('planner form uses project fonts without changing its large page headings', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] #profileForm,[\s\S]*?#profileForm button\{font-family:'DM Sans',sans-serif\}/);
  assert.match(css, /#profileForm h3,[\s\S]*?#profileForm \.planningModeCard strong\{font-family:Manrope,sans-serif\}/);
  assert.doesNotMatch(css, /body\[data-page="planner"\] #planner(?: h1| h2)/, 'large planner page headings remain outside the form typography override');
  assert.match(css, /body\[data-page\]\{font-family:'DM Sans',sans-serif\}/, 'every page uses DM Sans for body text');
  assert.match(css, /body\[data-page\] :is\(button,input,select,textarea\)\{font-family:'DM Sans',sans-serif\}/, 'interactive controls use DM Sans on every page');
  assert.match(css, /body\[data-page\] :is\(h1,\.sectionHead h2,\.requirementsAside h2\)\{font-family:Fraunces,Georgia,serif\}/, 'all large page and section titles use the display font');
  assert.match(css, /body\[data-page\] :is\(h2,h3,h4,h5,legend,summary,\.calendarMonth\)\{font-family:Manrope,sans-serif\}/, 'supporting headings retain the project heading font');
  assert.equal((css.match(/Fraunces/g) || []).length, 2, 'Fraunces is used only for the shared display titles and planner title override');
  assert.doesNotMatch(css, /Plus Jakarta Sans/, 'the unused font no longer overrides the shared type system');
  for (const file of routes) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /family=Plus\+Jakarta\+Sans/, `${file} does not download an unused font`);
    assert.match(html, /family=Fraunces:/, `${file} loads the display font used by large titles`);
    assert.match(html, /family=DM\+Sans/, `${file} loads the shared body font`);
    assert.match(html, /family=Manrope/, `${file} loads the shared heading font`);
  }
});

test('planner section heading uses the display font at the shared section-heading scale', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  const planner = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] #planner>\.wrap>\.sectionHead h2\{margin:13px 0 14px;font-family:Fraunces,Georgia,serif;font-size:clamp\(2rem,4vw,3\.3rem\)\}/);
  assert.match(planner, /family=Fraunces:/, 'the planner loads the display font used by the reference title');
});

test('planner setup and results use aligned responsive columns and styled currency controls', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  const planner = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] \.plannerGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:24px\}/);
  assert.match(css, /body\[data-page="planner"\] #planningCurrencyStep\{display:grid;gap:9px;margin:0 0 18px;padding:18px;border:1px solid #dfe9df;border-radius:15px/);
  assert.match(css, /body\[data-page="planner"\] #planningCurrencyStep>\.customSelect\{display:block;margin-top:7px\}/, 'planning currency uses the shared custom dropdown');
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /initializeCustomSelect\(byId\("planningCurrency"\)\)/, 'planning currency dropdown uses the shared behavior');
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /\[\.\.\.select\.options\]\.filter\(option => !option\.disabled\)/, 'disabled placeholder options are not selectable in custom menus');
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /if \(select\.required\) trigger\.setAttribute\("aria-required", "true"\)/, 'required state is exposed by the custom trigger');
  assert.match(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), /select\.addEventListener\("invalid", event => \{[\s\S]*?trigger\.setAttribute\("aria-invalid", "true"\);[\s\S]*?trigger\.focus\(\);/, 'invalid hidden selects focus their visible trigger');
  assert.match(css, /\.customSelectMenu\{[^}]*max-height:min\(320px,50vh\);overflow-y:auto/, 'long custom dropdowns stay compact and scrollable');
  assert.match(css, /@media\(max-width:900px\)\{\s*body\[data-page="planner"\] \.plannerGrid\{grid-template-columns:minmax\(0,1fr\);gap:18px\}/);
  assert.match(planner, /<label for="planningCurrency">Planning currency<\/label><select id="planningCurrency"/, 'currency selector retains its explicit accessible label');
});

test('planner mode help has clear spacing before the mode buttons', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /body\[data-page="planner"\] \.plannerStepPanel>\.planningModeSelector>#planningModeHelp\{margin:0 0 12px\}/);
});

test('all pages share the account page warm ivory and evergreen theme', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /:root\{color-scheme:light;--ink:#1a1a18;--muted:#606b63;--quiet:#77776f;--navy:#f5f3ec;--panel:#fffefa;--panel2:#f8f7f2;--line:#e7e5dc;--cyan:#267357;--mint:#8fc6a5;--gold:#c9a969\}/);
  assert.match(css, /body\[data-page\]\{background-color:#f5f3ec;color:var\(--ink\)\}/);
  assert.match(css, /body\[data-page\] \.eyebrow\{color:#267357\}/);
  assert.match(css, /\.accountStory\{[^}]*background:radial-gradient[^}]*linear-gradient\(145deg,#0b514b,#073e3d 72%,#0b4a43\)/, 'the account story panel remains a dark green accent');
});

test('shared navigation offers a persistent accessible light-blue theme toggle', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(site, /themeStorageKey = "campusbridge-theme"/);
  assert.match(site, /localStorage\.getItem\(themeStorageKey\) === "blue"/);
  assert.match(site, /className = "themeToggle"/);
  assert.match(site, /wrap\.append\(brand, nav, themeToggle\)/, 'the theme switch remains available outside the collapsed mobile menu');
  assert.match(site, /aria-pressed", String\(active\)/);
  assert.match(site, /localStorage\.setItem\(themeStorageKey, nextTheme\)/);
  assert.match(site, /logo\.src = active \? "\/assets\/brand\/logo-transparent\.png" : "\/assets\/brand\/logo-header\.png"/);
  assert.match(css, /body\[data-theme="blue"\]\{color-scheme:light;--ink:#1a2424/);
  assert.match(css, /body\[data-theme="blue"\] \.themeToggle::before\{border-color:#4a898f;background:#a5c4c2\}/);
  assert.match(css, /body\[data-theme="blue"\] \.topbar \.navlinks>a\.aiNavPill,body\[data-theme="blue"\] \.topbar \.navlinks>a\.aiNavPill\[aria-current=page\]\{border-color:#8fb2b1;background:#dce9e8;color:#294c4e/);
  assert.match(css, /body\[data-theme="blue"\] \.topbar \.navlinks>\.navGroup>\.navGroupToggle\{border-color:#b7cecc;background:rgba\(226,237,236,\.68\);color:#355657\}/);
  assert.match(css, /body\[data-theme="blue"\] \.topbar \.navDropdown\{border-color:#d4e1df/);
  assert.match(css, /body\[data-theme="blue"\] \.topbar \.navlinks\{border-color:#c6d8d6;background:rgba\(237,244,243,\.98\)/);
});

test('every page keeps the footer at the viewport bottom when content is short', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /body\[data-page\]\{display:flex;min-height:100vh;flex-direction:column\}/);
  assert.match(css, /body\[data-page\] main\{flex:1 0 auto\}/);
  assert.match(css, /body\[data-page\] \.footer\{flex-shrink:0\}/);
  assert.match(css, /body\[data-page="roadmap"\] \.pageHero,\s*body\[data-page="stress"\] \.pageHero\{min-height:0\}/);
  assert.match(css, /\.pageHero\{min-height:75vh;padding:140px 0 72px\}/, 'other feature pages retain their shared hero spacing');
});

test('shared footer includes useful navigation, a planning note, and responsive layout', () => {
  const site = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(site, /<nav class="footerNav" aria-label="Footer">/);
  assert.match(site, /href="\/planner\.html">Planner/);
  assert.match(site, /href="\/privacy\.html">Privacy and limitations/);
  assert.match(site, /<strong>Planning note<\/strong> Estimates use your entries/);
  assert.match(css, /\.footerMain\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(320px,1\.15fr\)/);
  assert.match(css, /\.footer\{padding:36px 0 18px;border-top:1px solid #e3e2d8/);
  assert.doesNotMatch(css, /\.footer\{margin-top:(?:36|48)px/);
  assert.match(css, /@media\(max-width:720px\)\{\.footer\{padding-top:28px\}\.footerMain\{grid-template-columns:1fr;gap:28px\}/);
  assert.match(css, /@media\(max-width:480px\)\{\.footerContent\{gap:22px\}.*\.footerBottom\{flex-direction:column/);
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
  for (const id of ['signup-form', 'login-form', 'google-signin', 'reset-request-form', 'recovery-complete-form', 'profile-name-form', 'profile-display-name', 'study-country-picker', 'study-country-toggle', 'study-country-options', 'study-country-flag', 'study-country-value', 'study-country-status', 'study-country-save', 'profile-summary-name', 'profile-summary-email', 'profile-avatar-form', 'profile-avatar-options', 'profile-avatar-save', 'profile-avatar-remove', 'profile-avatar-status', 'cloud-save-form', 'cloud-plan-name', 'cloud-plan-list', 'mfa-settings-badge', 'mfa-challenge-form', 'mfa-enroll-form', 'mfa-disable-form', 'mfa-qr-code']) assert.ok(html.includes(`id="${id}"`), `account page is missing #${id}`);
  assert.match(html, /profileNameControls[\s\S]*studyCountryPicker[\s\S]*study-country-toggle[\s\S]*study-country-options/, 'study destination is a profile preference immediately below the display-name controls');
  assert.equal((html.match(/data-study-country=/g) || []).length, 21, 'the country menu contains popular study destinations with a flag per choice');
  assert.match(html, /aria-haspopup="listbox" aria-expanded="false" aria-controls="study-country-options"/, 'the country picker exposes its listbox relationship and open state');
  const flags = fs.readFileSync(path.join(root, 'assets/study-country-flags.svg'), 'utf8');
  for (const [, code] of html.matchAll(/data-study-country="([A-Z]{2})"/g)) assert.ok(flags.includes(`<symbol id="flag-${code}"`), `${code} has a local flag illustration`);
  assert.match(html, /id="cloud-save-form"[\s\S]*class="cloudSaveIntro"[\s\S]*class="cloudSaveControls"[\s\S]*id="cloud-plan-name"[\s\S]*Save plan/, 'cloud-plan saving has separate guidance, naming, and action controls');
  assert.match(html, /role="group" aria-label="Choose a profile avatar" aria-describedby="profile-avatar-help profile-avatar-status"/, 'avatar choices are grouped and described for assistive technology');
  assert.equal((html.match(/data-profile-avatar=/g) || []).length, 6, 'the profile provides six pre-made avatar choices');
  assert.doesNotMatch(html, /type="file"|browse files|Drop a photo here/, 'the profile no longer prompts users to upload a photo');
  const avatarIds = ['sage', 'sky', 'sunset', 'ocean', 'berry', 'gold'];
  const masculineAvatars = ['sage', 'sky', 'sunset'];
  const feminineAvatars = ['ocean', 'berry', 'gold'];
  for (const id of avatarIds) {
    const gender = masculineAvatars.includes(id) ? 'Male' : 'Female';
    assert.match(html, new RegExp(`data-profile-avatar="${id}"[^>]*aria-label="Choose [^"]+, ${gender.toLowerCase()} avatar"[^>]*aria-pressed="false"`), `${id} ${gender.toLowerCase()} avatar is a selectable button`);
    assert.match(html, new RegExp(`data-profile-avatar="${id}"[\\s\\S]*?<small>${gender}<\\/small>`), `${id} displays its avatar style`);
    assert.equal(fs.existsSync(path.join(root, 'assets', 'profile-avatars', `${id}.svg`)), true, `${id} avatar artwork exists locally`);
  }
  assert.match(html, /class="accountLayout"[\s\S]*class="accountMain"[\s\S]*class="accountStory"/, 'account access uses a split-panel layout');
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=DM\+Sans:[^"]*Manrope:/, 'the account page loads its body and heading font families');
  assert.doesNotMatch(html, /<details\b/, 'account forms do not use expand/collapse disclosures');
  assert.match(html, /id="login-form"[\s\S]*href="#reset-request-form"[\s\S]*href="#signup-form"/, 'sign-in offers password recovery and account creation below the form controls');
  assert.match(html, /id="signup-form"[^>]*hidden/, 'the account-creation view starts hidden and can be switched into without expanding a disclosure');
  assert.match(html, /id="reset-request-form"[^>]*hidden/, 'the password-recovery view starts hidden and can be switched into without expanding a disclosure');
  assert.match(html, /\/lib\/mfa-flow\.js/);
  const account = fs.readFileSync(path.join(root, 'js/account-page.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  for (const method of ['signUp(', 'signInWithPassword(', 'signInWithOAuth(', 'resetPasswordForEmail(', 'updateUser({ password']) assert.ok(account.includes(method), `account module is missing ${method}`);
  assert.match(account, /emailRedirectTo:.*location\.origin/);
  assert.match(account, /flow=recovery/);
  assert.match(account, /This cannot be undone/);
  assert.match(account, /security\.status !== "ready"/);
  assert.match(account, /mfa\.verifyEnrollment/);
  assert.match(account, /mfa\.disable/);
  assert.match(account, /mfaStatusBadge\.dataset\.state = !ready \? "checking" : verifiedFactor \? "active" : "available"/);
  assert.match(html, /aria-controls="mfa-enroll-panel" aria-expanded="false"/);
  assert.match(html, /aria-controls="mfa-disable-form" aria-expanded="false"/);
  assert.match(css, /\.securityStatusBadge\[data-state=active\]/);
  assert.match(css, /\.accountHero #cloud-plans-panel \.mfaEnrollmentPanel\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(250px,\.85fr\)/);
  assert.match(css, /@media\(max-width:700px\)\{\.accountHero #cloud-plans-panel \.mfaSettings\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(account, /accountAccess\.hidden = showAccountPanel/);
  assert.match(account, /cloudPanel\.hidden = !showAccountPanel/);
  assert.match(account, /document\.body\.classList\.toggle\("account-panel-only", showAccountPanel\)/);
  assert.match(account, /updateUser\(\{ data: \{ display_name: displayName \} \}\)/);
  assert.match(account, /updateUser\(\{ data: \{ study_country: countryCode \} \}\)/, 'the selected study destination is saved in the signed-in user profile');
  assert.match(account, /studyCountryOptions\.addEventListener\("keydown"/, 'the country list supports keyboard navigation');
  assert.match(account, /studyCountrySave\.addEventListener\("click"/, 'the country choice is saved only after explicit confirmation');
  assert.match(account, /data: \{ avatar_id: selectedAvatarId, avatar_path: null \}/, 'saving an avatar stores its preset id and clears any old uploaded image reference');
  assert.match(account, /data: \{ avatar_id: null, avatar_path: null \}/, 'the user can return to initials and clear the saved avatar');
  assert.match(account, /avatarChoices\.forEach\(choice => choice\.addEventListener\("click"/, 'avatar choices preview on selection');
  assert.match(account, /profileAvatars\.getAvatarUrl\(displayedAvatarId\)/, 'the account preview uses the local preset artwork');
  assert.match(account, /createSignedUrl\(path, 86400\)/, 'legacy uploaded pictures continue to display until replaced');
  assert.doesNotMatch(account, /bucket\.upload|type="file"|\.addEventListener\("drop"/, 'the account page has no profile-photo upload flow');
  const storageSetup = fs.readFileSync(path.join(root, 'docs/supabase-profile-storage.sql'), 'utf8');
  assert.match(storageSetup, /'profile-photos',\s*'profile-photos',\s*false/);
  assert.match(storageSetup, /auth\.uid\(\)::text/);
  assert.match(storageSetup, /for select[\s\S]*for insert[\s\S]*for update[\s\S]*for delete/i);
  assert.equal((html.match(/data-password-toggle/g) || []).length, 5, 'login, signup, and recovery passwords have visibility controls');
  assert.match(account, /toggle\.setAttribute\("aria-label", visible \? "Hide password" : "Show password"\)/);
  assert.ok(css.includes('.accountHero #cloud-plans-panel .mfaSettings{border-color:#e3e8df;background:#f7f8f3'), 'the authenticator panel uses the warm account palette');
  assert.match(css, /\.passwordVisibilityToggle\{[^}]*position:absolute/);
  assert.match(css, /\.studyCountryFlag\{[^}]*border-radius:50%/, 'country flags are displayed in circular badges');
  assert.match(css, /\.studyCountryFlag\{[^}]*box-shadow:inset/, 'country flags have dimensional lighting and depth');
  assert.match(css, /\.studyCountryOption:hover \.studyCountryFlag[^}]*perspective\(90px\) rotateY/, 'country flags animate with a subtle 3D tilt on interaction');
  assert.match(css, /\.profileSettingsGrid\{[^}]*align-items:stretch/, 'the display-name and profile-picture cards share a consistent row height');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.studyCountryFlag/, 'flag and dropdown motion respects reduced-motion preferences');
  assert.match(css, /\.studyCountryOptions\[hidden\]\{display:none\}/, 'the country menu supports its hidden state');
  assert.match(css, /\.studyCountryOption\[aria-selected=true\]/, 'the selected country receives a visible menu state');
  assert.match(css, /\.profileAvatarOption\[aria-pressed=true\]/, 'the selected avatar has a clear visual state');
  assert.match(css, /\.profileAvatarActions \.button\[hidden\]\{display:none!important\}/, 'use-initials action stays hidden when no preset or legacy picture exists');
  assert.match(css, /@media\(max-width:760px\)\{\.profileSettingsGrid\{grid-template-columns:1fr\}/, 'profile cards stack on narrow layouts');
  assert.match(css, /\.accountHero #cloud-plans-panel\{[^}]*padding:clamp/, 'signed-in account content has a responsive page card layout');
  assert.match(css, /\.accountHero #cloud-plans-panel \.cloudSaveForm\{grid-template-columns:minmax\(220px,\.78fr\) minmax\(0,1\.22fr\)/, 'save-plan card has a balanced intro-to-control ratio');
  assert.match(css, /@media\(max-width:480px\)\{\.accountHero #cloud-plans-panel \.cloudSaveForm\{gap:14px;padding:17px\}\.cloudSaveControls\{grid-template-columns:minmax\(0,1fr\)\}/, 'save-plan controls stack cleanly at mobile width');
  assert.match(css, /\.accountPasswordField>\.passwordInputWrap\{grid-column:1\/-1\}/, 'password toggle retains a full-width login input');
  assert.match(account, /input\.form\?\.addEventListener\("reset", resetVisibility\)/, 'reset forms restore hidden password text');
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

test('planner quote labels keep required badges with label text and align input rows', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(app, /<label><span class="quoteLabelText">Total sender cost \(BDT\) <span class="quoteRequired">Required<\/span><\/span><input data-field="total"/);
  assert.match(app, /<label><span class="quoteLabelText">Recipient amount <span class="quoteCurrency">\(quote currency\)<\/span> <span class="quoteRequired">Required<\/span><\/span><input data-field="recipient"/);
  assert.ok(app.indexOf('data-field="reference"') < app.indexOf('data-field="timestamp"'), 'the full-width timestamp follows the paired quote fields');
  assert.match(css, /#providerQuoteForms \.quote>label\{grid-template-rows:minmax\(2\.7em,auto\) auto;align-content:start\}/);
  assert.match(css, /#providerQuoteForms \.quoteLabelText\{display:block;min-height:2\.7em;line-height:1\.35\}/);
  assert.match(css, /#providerQuoteForms \.quoteRequired\{display:inline;color:#9b6424;font-size:\.68rem;font-weight:600;white-space:nowrap\}/);
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

test('light feature form labels use readable dark text', () => {
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(css, /\.featureForm label\{color:#4d5751\}/);
});

test('financial report shows and can print or download a clearly fictional sample without a saved plan', () => {
  const report = fs.readFileSync(path.join(root, 'js/report-page.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles/site.css'), 'utf8');
  assert.match(report, /if \(!plan\.ok\) \{[\s\S]*?Illustrative sample · not your data/);
  assert.match(report, /This is a fictional sample to demonstrate the report format/);
  assert.match(report, /printButton\.textContent = "Print sample \/ Save as PDF"/);
  assert.match(report, /downloadButton\.textContent = "Download sample text report"/);
  assert.match(report, /campusbridge-sample-financial-readiness-report\.txt/);
  assert.match(css, /\.readinessReportPage\.isSampleReport\{/);
});
