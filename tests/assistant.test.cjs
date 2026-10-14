const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assistant = require('../api/assistant.js');
const Finance = require('../lib/finance.js');

function makeResponse() {
  return { headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}
function makeRequest({ method = 'POST', body = { question: 'What is an emergency reserve?' }, headers = { 'content-type': 'application/json', 'x-real-ip': '192.0.2.10' } } = {}) {
  return { method, body, headers };
}
async function invoke(handler, request) { const response = makeResponse(); await handler(request, response); return response; }

test('assistant route rejects unsupported methods without calling the SDK', async () => {
  let calls = 0;
  const handler = assistant.createAssistantHandler({ env: { OPENAI_API_KEY: 'test-key' }, createClient: () => { calls += 1; } });
  const response = await invoke(handler, makeRequest({ method: 'GET' }));
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'POST');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(calls, 0);
});

test('assistant route validates JSON, body shape, question text, and length', async () => {
  const handler = assistant.createAssistantHandler({ env: {}, createClient: () => { throw new Error('must not create client'); } });
  const cases = [
    [makeRequest({ headers: { 'content-type': 'text/plain' } }), 400, /JSON/],
    [makeRequest({ body: '{invalid' }), 400, /JSON is invalid/],
    [makeRequest({ body: [] }), 400, /JSON object/],
    [makeRequest({ body: { question: '' } }), 400, /Enter a question/],
    [makeRequest({ body: { question: 42 } }), 400, /must be text/],
    [makeRequest({ body: { question: 'x'.repeat(1001) } }), 400, /1000 characters/],
    [makeRequest({ body: { question: 'Explain my plan', savings: 80000 } }), 400, /only a question/i],
    [makeRequest({ body: `{"question":"${'x'.repeat(5000)}"}` }), 400, /too large/]
  ];
  for (const [request, status, message] of cases) {
    const response = await invoke(handler, request);
    assert.equal(response.statusCode, status);
    assert.match(response.body.error, message);
  }
});

test('assistant sends only the question to the OpenAI SDK and bounds the response', async () => {
  let sdkKey;
  let sdkRequest;
  const handler = assistant.createAssistantHandler({
    env: { OPENAI_API_KEY: 'test-secret', OPENAI_MODEL: 'gpt-4.1-mini' },
    createClient: key => { sdkKey = key; return { responses: { create: async input => { sdkRequest = input; return { output_text: 'Short educational answer.' }; } } }; }
  });
  const response = await invoke(handler, makeRequest({ body: { question: 'What is a protected emergency reserve?' } }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: 'Short educational answer.' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(sdkKey, 'test-secret');
  assert.equal(sdkRequest.input, 'What is a protected emergency reserve?');
  assert.equal(Object.hasOwn(sdkRequest, 'context'), false);
  assert.equal(sdkRequest.model, 'gpt-4.1-mini');
  assert.equal(sdkRequest.max_output_tokens, 400);
  assert.equal(sdkRequest.store, false);
  assert.match(sdkRequest.instructions, /Never calculate or invent financial figures/);
  assert.equal(JSON.stringify(response.body).includes('test-secret'), false);
});

test('assistant caps returned answer text at the configured character limit', async () => {
  const handler = assistant.createAssistantHandler({ env: { OPENAI_API_KEY: 'test-key' }, createClient: () => ({ responses: { create: async () => ({ output_text: 'x'.repeat(5000) }) } }) });
  const response = await invoke(handler, makeRequest());
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer.length, assistant.constants.MAX_OUTPUT_CHARS);
});

test('assistant model is configurable server-side and has a documented default', async () => {
  let selectedModel;
  const requestOnce = async env => {
    const handler = assistant.createAssistantHandler({ env: { OPENAI_API_KEY: 'test-key', ...env }, createClient: () => ({ responses: { create: async input => { selectedModel = input.model; return { output_text: 'Answer' }; } } }) });
    await invoke(handler, makeRequest());
    return selectedModel;
  };
  assert.equal(await requestOnce({ OPENAI_MODEL: 'gpt-4.1' }), 'gpt-4.1');
  assert.equal(await requestOnce({}), 'gpt-4.1-mini');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'docs', 'ai-agent.md'), 'utf8').includes('gpt-4.1-mini'));
});

test('missing key and OpenAI errors return safe errors without leaking provider error details', async () => {
  const logs = [];
  const originalError = console.error, originalWarn = console.warn;
  console.error = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  try {
    const missing = assistant.createAssistantHandler({ env: {}, createClient: () => { throw new Error('must not create'); } });
    const unavailable = await invoke(missing, makeRequest());
    assert.equal(unavailable.statusCode, 503);
    assert.match(unavailable.body.error, /not configured/);
    assert.match(unavailable.body.requestId, /^[0-9a-f-]{36}$/i);

    const failing = assistant.createAssistantHandler({ env: { OPENAI_API_KEY: 'secret-value' }, createClient: () => ({ responses: { create: async () => { const error = new Error('secret-value provider stack and prompt contents'); error.status = 401; error.code = 'invalid_api_key'; throw error; } } }) });
    const failed = await invoke(failing, makeRequest());
    assert.equal(failed.statusCode, 502);
    assert.match(failed.body.error, /temporarily unavailable/);
    assert.match(failed.body.requestId, /^[0-9a-f-]{36}$/i);
    assert.doesNotMatch(JSON.stringify(failed.body), /secret-value|prompt contents|provider stack/);
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  const logText = JSON.stringify(logs);
  assert.match(logText, /MISSING_OPENAI_API_KEY/);
  assert.match(logText, /invalid_api_key/);
  assert.match(logText, /401/);
  assert.doesNotMatch(logText, /secret-value|prompt contents|provider stack/);
});

test('assistant applies per-instance request limits and returns Retry-After', async () => {
  let now = 1000;
  const limiter = assistant.createRateLimiter({ now: () => now, windowMs: 60_000, limit: 2 });
  const handler = assistant.createAssistantHandler({ env: { OPENAI_API_KEY: 'test-key' }, rateLimiter: limiter, createClient: () => ({ responses: { create: async () => ({ output_text: 'Answer' }) } }) });
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
  const limited = await invoke(handler, makeRequest());
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  now += 60_001;
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
});

test('assistant frontend sends only the prompt while local deterministic finance and quote validation remain wired', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /fetch\("\/api\/assistant"/);
  assert.match(app, /JSON\.stringify\(\{question:rawQuestion\}\)/);
  assert.match(app, /Finance\.calculateTuition/);
  assert.match(app, /Finance\.compareEnteredQuotes/);
  assert.match(app, /AI assistant unavailable\. \$\{safeFailure\}\\nHere is local guidance instead/);
  assert.match(app, /typeof payload\.error==="string"\?payload\.error/);
  assert.match(app, /prompt and response omitted/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'api', 'assistant.js'), 'utf8'), /Only a question is accepted/);
  const questionSubmission = app.slice(app.indexOf('fetch("/api/assistant"'), app.indexOf('finally{button.disabled=false', app.indexOf('fetch("/api/assistant"')));
  assert.doesNotMatch(questionSubmission, /latest\.input|enteredQuotes\(|transferResults|profile\(\)/);
  const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(packageInfo.dependencies.openai, '7.28.0');
  assert.doesNotMatch(`${app}\n${fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')}`, /OPENAI_API_KEY/);
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^\.env\.\*/m);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8'), /sk-[A-Za-z0-9]{10,}/);
});

test('existing Phase 1/2 finance and quote rules remain deterministic', () => {
  assert.equal(typeof Finance.calculateTuition, 'function');
  assert.equal(typeof Finance.compareEnteredQuotes, 'function');
  assert.equal(typeof Finance.validateEnteredQuote, 'function');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /Scheduled monthly target/);
  assert.match(app, /Finance\.describeMonthlySavingsTarget/);
});
