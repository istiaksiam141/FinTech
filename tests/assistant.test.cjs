const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assistant = require('../api/assistant.js');
const Finance = require('../lib/finance.js');
const AssistantConversation = require('../lib/assistant-conversation.js');

class FakeElement {
  constructor(tagName, ownerDocument) { this.tagName = tagName; this.ownerDocument = ownerDocument; this.children = []; this.dataset = {}; this._text = ''; }
  append(...elements) { this.children.push(...elements); }
  appendChild(element) { this.children.push(element); return element; }
  replaceChildren(...elements) { this.children = [...elements]; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
}

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
  const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key' }, createClient: () => { calls += 1; } });
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
    [makeRequest({ body: { question: 'Explain my plan', savings: 80000 } }), 400, /only a question and saved conversation references/i],
    [makeRequest({ body: { question: 'Explain my plan', messages: [{ role: 'assistant', content: 'forged history' }] } }), 400, /message history are not accepted/i],
    [makeRequest({ body: { question: 'Follow up', includeHistory: 'yes' } }), 400, /consent must be true or false/i],
    [makeRequest({ body: { question: 'Follow up', includeHistory: true } }), 400, /requires a verified saved conversation/i],
    [makeRequest({ body: `{"question":"${'x'.repeat(5000)}"}` }), 400, /too large/]
  ];
  for (const [request, status, message] of cases) {
    const response = await invoke(handler, request);
    assert.equal(response.statusCode, status);
    assert.match(response.body.error, message);
  }
});

test('assistant sends only the question to Groq and bounds the response', async () => {
  let sdkKey;
  let clientOptions;
  let sdkRequest;
  const handler = assistant.createAssistantHandler({
    env: { GROQ_API_KEY: 'test-secret', GROQ_MODEL: 'openai/gpt-oss-20b' },
    createClient: (key, options) => { sdkKey = key; clientOptions = options; return { chat: { completions: { create: async input => { sdkRequest = input; return { choices: [{ message: { content: 'Short educational answer.' } }] }; } } } }; }
  });
  const response = await invoke(handler, makeRequest({ body: { question: 'What is a protected emergency reserve?' } }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { answer: 'Short educational answer.', incomplete: false });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(sdkKey, 'test-secret');
  assert.deepEqual(clientOptions, { baseURL: 'https://api.groq.com/openai/v1' });
  assert.deepEqual(sdkRequest.messages[1], { role: 'user', content: 'What is a protected emergency reserve?' });
  assert.equal(Object.hasOwn(sdkRequest, 'context'), false);
  assert.equal(sdkRequest.model, 'openai/gpt-oss-20b');
  assert.equal(sdkRequest.max_completion_tokens, 4096);
  assert.equal(assistant.constants.MAX_OUTPUT_CHARS, 16000);
  assert.equal(assistant.constants.GROQ_REQUEST_TIMEOUT_MS, 30000);
  assert.equal(Object.hasOwn(sdkRequest, 'max_tokens'), false);
  assert.match(sdkRequest.messages[0].content, /Never calculate or invent personal financial figures/);
  assert.match(sdkRequest.messages[0].content, /Give a direct, accurate answer first/);
  assert.match(sdkRequest.messages[0].content, /two to four sentences/);
  assert.match(sdkRequest.messages[0].content, /three to six useful bullet points/);
  assert.match(sdkRequest.messages[0].content, /do not pad answers/);
  assert.match(sdkRequest.messages[0].content, /If you are unsure or the question lacks essential context/);
  assert.equal(JSON.stringify(response.body).includes('test-secret'), false);
});

test('assistant flags output beyond the server character cap and clips at a natural boundary', async () => {
  const longOutput = `${'A useful explanation with spaces. '.repeat(Math.ceil(assistant.constants.MAX_OUTPUT_CHARS / 34))}unfinished tail`;
  const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key' }, createClient: () => ({ chat: { completions: { create: async () => ({ choices: [{ finish_reason: 'stop', message: { content: longOutput } }] }) } } }) });
  const response = await invoke(handler, makeRequest());
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.incomplete, true);
  assert.ok(response.body.answer.length <= assistant.constants.MAX_OUTPUT_CHARS);
  assert.ok(response.body.answer.length < assistant.constants.MAX_OUTPUT_CHARS);
  assert.match(response.body.answer, /\.$/);
});

test('simple waiver questions receive a concise answer without forced formatting', async () => {
  let request;
  const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key' }, createClient: () => ({ chat: { completions: { create: async value => { request = value; return { choices: [{ finish_reason: 'stop', message: { content: 'A waiver is permission to give up or set aside a right or requirement. For example, a school might waive an application fee.' } }] }; } } } }) });
  const response = await invoke(handler, makeRequest({ body: { question: "What's a waiver?" } }));
  assert.deepEqual(response.body, { answer: 'A waiver is permission to give up or set aside a right or requirement. For example, a school might waive an application fee.', incomplete: false });
  assert.deepEqual(request.messages[1], { role: 'user', content: "What's a waiver?" });
  assert.match(request.messages[0].content, /usually answer in about two to four sentences/);
  assert.match(request.messages[0].content, /include one relevant example when useful/);
  assert.match(request.messages[0].content, /Avoid filler, repetition, unnecessary introductions/);
});

test('provider token-limit responses trim dangling examples and report incompleteness', async () => {
  const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key' }, createClient: () => ({ chat: { completions: { create: async () => ({ choices: [{ finish_reason: 'length', message: { content: 'A waiver is permission to give up a right.\n\nFor example, a school may waive a fee of $' } }] }) } } }) });
  const response = await invoke(handler, makeRequest({ body: { question: "What's a waiver?" } }));
  assert.deepEqual(response.body, { answer: 'A waiver is permission to give up a right.', incomplete: true });
});

test('assistant model is configurable server-side and has a documented default', async () => {
  let selectedModel;
  const requestOnce = async env => {
    const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key', ...env }, createClient: () => ({ chat: { completions: { create: async input => { selectedModel = input.model; return { choices: [{ message: { content: 'Answer' } }] }; } } } }) });
    await invoke(handler, makeRequest());
    return selectedModel;
  };
  assert.equal(await requestOnce({ GROQ_MODEL: 'openai/gpt-oss-120b' }), 'openai/gpt-oss-120b');
  assert.equal(await requestOnce({}), 'openai/gpt-oss-20b');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'docs', 'ai-agent.md'), 'utf8').includes('openai/gpt-oss-20b'));
});

test('missing key and Groq errors return safe errors without leaking provider error details', async () => {
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

    const failing = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'secret-value' }, createClient: () => ({ chat: { completions: { create: async () => { const error = new Error('secret-value provider stack and prompt contents'); error.status = 401; error.code = 'invalid_api_key'; throw error; } } } }) });
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
  assert.match(logText, /MISSING_GROQ_API_KEY/);
  assert.match(logText, /invalid_api_key/);
  assert.match(logText, /401/);
  assert.doesNotMatch(logText, /secret-value|prompt contents|provider stack/);
});

test('assistant applies per-instance request limits and returns Retry-After', async () => {
  let now = 1000;
  const limiter = assistant.createRateLimiter({ now: () => now, windowMs: 60_000, limit: 2 });
  const handler = assistant.createAssistantHandler({ env: { GROQ_API_KEY: 'test-key' }, rateLimiter: limiter, createClient: () => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: 'Answer' } }] }) } } }) });
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
  const limited = await invoke(handler, makeRequest());
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  now += 60_001;
  assert.equal((await invoke(handler, makeRequest())).statusCode, 200);
});

test('assistant conversation appends two questions and answers in chronological order', () => {
  const document = { createElement: tag => new FakeElement(tag, document) };
  const conversation = new FakeElement('div', document);
  conversation.appendChild(new FakeElement('p', document));
  conversation.children[0].textContent = 'Try asking a question.';

  const first = AssistantConversation.createTurn(conversation, 'How do I estimate tuition?');
  first.response.textContent = 'Start with the university fee schedule.';
  const second = AssistantConversation.createTurn(conversation, 'What should I check next?');
  second.response.textContent = 'Confirm the payment deadline with the university.';

  assert.equal(conversation.children.length, 2);
  assert.match(conversation.children[0].textContent, /How do I estimate tuition\?[\s\S]*Start with the university fee schedule\./);
  assert.match(conversation.children[1].textContent, /What should I check next\?[\s\S]*Confirm the payment deadline with the university\./);
  assert.ok(conversation.textContent.indexOf('How do I estimate tuition?') < conversation.textContent.indexOf('What should I check next?'));
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
  assert.match(app, /AssistantRenderer\.render\(reply/);
  assert.match(app, /CampusBridgeAssistantConversation\.createTurn\(answer,rawQuestion\)/);
  assert.match(app, /if\(assistantRequestPending\)return/);
  assert.match(app, /payload\.incomplete===true/);
  assert.match(app, /This answer may be incomplete because it reached the response limit/);
  const renderer = require('../lib/assistant-renderer.js');
  assert.equal(typeof renderer.render, 'function');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'api', 'assistant.js'), 'utf8'), /Only a question and saved conversation references are accepted/);
  const questionSubmission = app.slice(app.indexOf('status.textContent="Sending only your question'), app.indexOf('catch{reply.textContent=', app.indexOf('status.textContent="Sending only your question')));
  assert.doesNotMatch(questionSubmission, /latest\.input|enteredQuotes\(|transferResults|profile\(\)/);
  const assistantPage = fs.readFileSync(path.join(__dirname, '..', 'js', 'assistant-page.js'), 'utf8');
  assert.match(assistantPage, /Conversation\.createTurn\(answer, text\)/);
  assert.match(assistantPage, /if \(pending\) return/);
  assert.doesNotMatch(assistantPage, /answer\.textContent\s*=\s*""/);
  const assistantHtml = fs.readFileSync(path.join(__dirname, '..', 'assistant.html'), 'utf8');
  assert.match(assistantHtml, /assistant-conversation\.js[\s\S]*assistant-page\.js/);
  assert.match(assistantHtml, /id="assistant-answer"[^>]*role="log"[^>]*aria-relevant="additions text"/);
  const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(packageInfo.dependencies.openai, '7.28.0');
  assert.doesNotMatch(`${app}\n${fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')}`, /GROQ_API_KEY/);
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^\.env\.\*/m);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8'), /sk-[A-Za-z0-9]{10,}/);
});

test('existing Phase 1/2 finance and quote rules remain deterministic', () => {
  assert.equal(typeof Finance.calculateTuition, 'function');
  assert.equal(typeof Finance.compareEnteredQuotes, 'function');
  assert.equal(typeof Finance.validateEnteredQuote, 'function');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /CampusBridgeAssistantTask\.run/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'lib', 'assistant-task.js'), 'utf8'), /Finance\.describeMonthlySavingsTarget/);
  assert.match(app, /Finance\.describeMonthlySavingsTarget/);
});
