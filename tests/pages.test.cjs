const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const routes = ['index.html', 'planner.html', 'roadmap.html', 'stress-tests.html', 'transfers.html', 'assistant.html', 'report.html', 'privacy.html'];

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
  assert.match(site, /confirm\(/);
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

