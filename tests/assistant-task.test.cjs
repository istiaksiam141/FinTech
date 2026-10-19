const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Finance = require('../lib/finance.js');
const AssistantTask = require('../lib/assistant-task.js');

const root = path.join(__dirname, '..');
const today = new Date(2026, 9, 19, 12);
function dateAfter(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function profile(overrides = {}) {
  return { homeCountry: 'Bangladesh', destinationCountry: 'United Kingdom', homeCur: 'BDT', tuitionCur: 'GBP', tuition: '8000', exchangeRate: '155', rateSource: 'Bangladesh Bank cross rate; publication 2026-10-19; ASK', rateTimestamp: '2026-10-19T10:00', rateProvenance: 'Bangladesh Bank official reference rate; not a tuition-payment quote', savings: '500000', income: '60000', expenses: '35000', committed: '10000', emergency: '50000', paymentFee: '0', deadline: dateAfter(90), ...overrides };
}
function makePlan(input = profile()) {
  const result = Finance.calculateTuition(input, today);
  return { ok: result.ok, profile: input, result };
}
function run(question, overrides = {}) {
  return AssistantTask.run({ question, Finance, plan: makePlan(), money: value => `${Math.round(value)} BDT`, today, ...overrides });
}

test('recognized funding requests use the current deterministic result', () => {
  const plan = makePlan();
  const response = run('What is my tuition funding gap?', { plan });
  assert.equal(response.handled, true);
  assert.ok(response.answer.includes(`${Math.round(plan.result.gap)} BDT`));
  assert.ok(response.answer.includes('Bangladesh Bank cross rate; publication 2026-10-19; ASK'));
  assert.match(response.answer, /not current|still current/);
});

test('a plain tuition statement is not routed to saved-plan calculations, while explicit requests remain deterministic', () => {
  const statement = 'My university tuition is 5000 USD.';
  assert.equal(Finance.assistantIntent(statement), 'general');
  assert.deepEqual(run(statement), { handled: false });
  for (const question of ['What is my funding gap?', 'Calculate my tuition funding gap.', 'Can I afford my tuition?']) {
    const response = run(question);
    assert.equal(response.handled, true);
    assert.ok(response.answer.includes(`${Math.round(makePlan().result.gap)} BDT`));
  }
});

test('missing or invalid planner inputs request completion without inventing financial figures', () => {
  for (const plan of [null, { ok: false }, { ok: true, profile: profile(), result: { ok: false } }]) {
    const response = run('Can I afford tuition?', { plan });
    assert.equal(response.handled, true);
    assert.match(response.answer, /cannot calculate a personal result/i);
    assert.doesNotMatch(response.answer, /\b\d[\d,]*(?:\.\d+)?\s*BDT\b/);
  }
});

test('savings schedule uses finance-engine contributions and matching projected shortfall', () => {
  const plan = makePlan(), roadmap = Finance.buildContributionRoadmap(plan.profile, plan.result, today);
  const target = Finance.describeMonthlySavingsTarget(plan.result);
  const response = run('How much should I save each month?', { plan });
  assert.equal(response.handled, true);
  assert.ok(response.answer.includes(`${target.regularAmount} BDT`));
  assert.ok(response.answer.includes(`${target.finalAmount} BDT`));
  for (const contribution of roadmap.contributions) assert.ok(response.answer.includes(`${contribution.dueDate}: ${contribution.requiredContributionBdt} BDT`));
  assert.ok(response.answer.includes(`${plan.result.shortfall} BDT`));
});

test('quote answers use only eligible comparisons and disclose their unverified status', () => {
  const quotes = [
    { name: 'Eligible Provider', currency: 'GBP', totalCost: '200000', fee: '1000', quotedRate: '155', recipientAmount: '1200', days: '3', timestamp: '2026-10-19T09:00', reference: 'quote-1' },
    { name: 'Expired Provider', currency: 'GBP', totalCost: '190000', fee: '0', recipientAmount: '1200', days: '1', timestamp: '2026-10-17T08:00', reference: 'quote-2' }
  ];
  const response = run('Compare my transfer provider quotes', { quotes, quoteInput: { amount: '200000', to: 'GBP', sort: 'cost' } });
  assert.equal(response.handled, true);
  assert.match(response.answer, /Eligible Provider/);
  assert.doesNotMatch(response.answer, /Expired Provider/);
  assert.match(response.answer, /not provider-verified/i);
  assert.match(response.answer, /Confirm current availability, expiry, fees/);
});

test('rate answers preserve exact source and timestamp without making a freshness claim', () => {
  const response = run('What rate source and timestamp does my plan use?');
  assert.equal(response.handled, true);
  assert.match(response.answer, /Bangladesh Bank cross rate; publication 2026-10-19; ASK/);
  assert.match(response.answer, /2026-10-19T10:00/);
  assert.match(response.answer, /does not refresh the rate or establish that it is still current/);
  assert.match(response.answer, /not a provider payment quote/);
  const incomplete = run('What is my current exchange rate?', { plan: { ok: true, profile: profile({ rateSource: '' }), result: { ok: true, rate: 155 } } });
  assert.match(incomplete.answer, /cannot label this rate verified or current/i);
});

test('shared task module is loaded before both assistant entry points; Groq remains question-only', () => {
  const assistantHtml = fs.readFileSync(path.join(root, 'assistant.html'), 'utf8');
  const plannerHtml = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'js', 'assistant-page.js'), 'utf8');
  assert.ok(assistantHtml.indexOf('assistant-task.js') < assistantHtml.indexOf('assistant-page.js'));
  assert.ok(plannerHtml.indexOf('assistant-task.js') < plannerHtml.indexOf('/app.js'));
  assert.match(app, /CampusBridgeAssistantTask\.run/);
  assert.match(page, /CampusBridgeAssistantTask\.run/);
  assert.match(page, /requestBody = \{ question: text \}/);
  assert.match(page, /requestBody\.conversationId = savedQuestion\.conversationId/);
  assert.match(page, /requestBody\.currentMessageId = savedQuestion\.currentMessageId/);
  assert.doesNotMatch(page, /requestBody\.messages\s*=/);
  assert.match(fs.readFileSync(path.join(root, 'api', 'assistant.js'), 'utf8'), /Only a question and saved conversation references are accepted/);
});
