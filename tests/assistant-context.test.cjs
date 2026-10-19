const test = require('node:test');
const assert = require('node:assert/strict');
const Context = require('../lib/assistant-context.js');
const Assistant = require('../api/assistant.js');

const USER_ID = 'b60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const OTHER_USER_ID = 'e60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const CONVERSATION_ID = 'a60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const OTHER_CONVERSATION_ID = 'c60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const CURRENT_ID = 'd60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const STALE_ID = '00000001-23ef-43b8-9a31-2c60c1eb9a88';
const ENV = { SUPABASE_URL: 'https://campusbridge-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-key', GROQ_API_KEY: 'test-groq-key' };
const TOKEN = `header.${'x'.repeat(32)}.signature`;
const QUESTION = 'Can you explain the second point?';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function makeFetch({ userId = USER_ID, conversationId = CONVERSATION_ID, latestId = CURRENT_ID, latestContent = QUESTION, priorMessages = [], failPath = null } = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (failPath === url.pathname) return response(503, {});
    assert.equal(options.headers.apikey, ENV.SUPABASE_PUBLISHABLE_KEY);
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
      return response(200, { id: userId });
    }
    if (url.pathname === '/rest/v1/assistant_conversations') {
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      const requested = url.searchParams.get('id')?.slice(3);
      return response(200, requested === conversationId ? [{ id: conversationId }] : []);
    }
    if (url.pathname === '/rest/v1/assistant_messages') {
      assert.equal(url.searchParams.get('conversation_id'), `eq.${CONVERSATION_ID}`);
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      assert.equal(url.searchParams.get('role'), 'eq.user');
      assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
      assert.equal(url.searchParams.get('limit'), '1');
      assert.equal(url.searchParams.get('select'), 'id,content');
      const current = latestId ? [{ id: latestId, content: latestContent, role: 'user', created_at: '2026-10-19T00:01:00Z' }] : [];
      const latest = [...priorMessages, ...current].filter(message => message.role === 'user').sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, 1).map(({ id, content }) => ({ id, content }));
      return response(200, latest);
    }
    throw new Error(`Unexpected request path ${url.pathname}`);
  };
  return { fetchImpl, calls };
}
function chatRequest(overrides = {}) {
  return { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: { question: QUESTION, conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, ...overrides } };
}
function makeResponseSink() {
  return { headers: {}, statusCode: null, body: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
async function invoke(handler, request) { const sink = makeResponseSink(); await handler(request, sink); return sink; }
function handlerFor(mock, capture = {}) {
  return Assistant.createAssistantHandler({ env: ENV, fetchImpl: mock.fetchImpl, createClient: () => ({ chat: { completions: { create: async request => { capture.request = request; return { choices: [{ message: { content: 'Answer.' } }] }; } } } }) });
}

test('saved conversation verification returns only the current question and never queries history', async () => {
  const mock = makeFetch();
  const loaded = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: mock.fetchImpl });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.messages, [{ role: 'user', content: QUESTION }]);
  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[2].url.pathname, '/rest/v1/assistant_messages');
  assert.equal(mock.calls[2].url.searchParams.get('limit'), '1');
});

test('sensitive history examples and ordinary older messages are never included in Groq context', async () => {
  const sensitivePairs = [
    ['I owe twelve thousand to the university.', 'You said you owe twelve thousand to the university.'],
    ['My tuition is twelve thousand taka.', 'Your tuition is twelve thousand taka.'],
    ['I owe one hundred twenty-five thousand to the university.', 'You said you owe one hundred twenty-five thousand to the university.'],
    ['The expected funding gap is twelve thousand.', 'The expected funding gap is twelve thousand.'],
    ['My student number is ABC-XYZ.', 'Your student number is ABC-XYZ.'],
    ['My student ID is STU-ABC.', 'You said your student ID is STU-ABC.'],
    ['My tuition is $12,000.', 'Your tuition is $12,000.']
  ];
  for (const pair of [...sensitivePairs, ['What is an emergency fund?', 'It is money set aside for unexpected essential expenses.']]) {
    const priorMessages = pair.map((content, index) => ({
      id: `${String(index + 1).padStart(8, '0')}-23ef-43b8-9a31-2c60c1eb9a88`,
      role: index === 0 ? 'user' : 'assistant', content,
      created_at: index === 0 ? '2026-10-18T00:00:00Z' : '2026-10-18T00:00:01Z'
    }));
    const mock = makeFetch({ priorMessages });
    const capture = {};
    const handler = handlerFor(mock, capture);
    const result = await invoke(handler, chatRequest());
    assert.equal(result.statusCode, 200);
    assert.deepEqual(capture.request.messages.slice(1), [{ role: 'user', content: QUESTION }]);
    assert.equal(mock.calls.length, 3, 'only Auth, owned conversation, and latest user message are queried');
  }
});

test('repeated identical questions are distinguished by current message ID and included once', async () => {
  const mock = makeFetch({ latestId: CURRENT_ID, latestContent: QUESTION });
  const capture = {};
  const result = await invoke(handlerFor(mock, capture), chatRequest());
  assert.equal(result.statusCode, 200);
  assert.deepEqual(capture.request.messages.slice(1), [{ role: 'user', content: QUESTION }]);

  const stale = makeFetch({ latestId: STALE_ID, latestContent: QUESTION });
  const rejected = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: stale.fetchImpl });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 409);
});

test('stale and out-of-order current-message references are rejected before Groq', async () => {
  const mock = makeFetch({ latestId: STALE_ID, latestContent: QUESTION });
  let groqCalls = 0;
  const handler = Assistant.createAssistantHandler({ env: ENV, fetchImpl: mock.fetchImpl, createClient: () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'unexpected' } }] }; } } } }) });
  const result = await invoke(handler, chatRequest());
  assert.equal(result.statusCode, 409);
  assert.equal(groqCalls, 0);

  const wrongContent = makeFetch({ latestContent: 'A different question' });
  const mismatch = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: wrongContent.fetchImpl });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.status, 409);
});

test('a concurrent newer submission makes the older request stale', async () => {
  const firstQuestion = 'First request';
  const secondId = STALE_ID;
  const newer = makeFetch({ latestId: secondId, latestContent: 'Second request' });
  const first = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: firstQuestion, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: newer.fetchImpl });
  assert.equal(first.ok, false);
  assert.equal(first.status, 409);
});

test('another account or conversation and unauthorized current references cannot load context', async () => {
  const foreign = makeFetch({ userId: OTHER_USER_ID, conversationId: OTHER_CONVERSATION_ID });
  const result = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: foreign.fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(foreign.calls.some(call => call.url.pathname === '/rest/v1/assistant_messages'), false);

  const wrongReference = makeFetch({ latestId: STALE_ID });
  const rejected = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: 'f60d7611-23ef-43b8-9a31-2c60c1eb9a88', question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: wrongReference.fetchImpl });
  assert.equal(rejected.status, 409);
});

test('missing or invalid authentication and missing Supabase configuration fail closed', async () => {
  const mock = makeFetch();
  const noToken = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, env: ENV, fetchImpl: mock.fetchImpl });
  assert.equal(noToken.status, 401);
  const malformed = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: 'Bearer short', env: ENV, fetchImpl: mock.fetchImpl });
  assert.equal(malformed.status, 401);
  assert.equal(mock.calls.length, 0);
  const unconfigured = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: {}, fetchImpl: mock.fetchImpl });
  assert.equal(unconfigured.status, 503);
  assert.equal(Context.configuredSupabase({ SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: 'service_role_secret' }), null);
});

test('expired/invalid token response and retrieval failures never call Groq or expose private details', async () => {
  const invalidTokenFetch = async () => response(401, {});
  let groqCalls = 0;
  const handler = Assistant.createAssistantHandler({ env: ENV, fetchImpl: invalidTokenFetch, createClient: () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'answer' } }] }; } } } }) });
  assert.equal((await invoke(handler, chatRequest())).statusCode, 401);
  assert.equal(groqCalls, 0);

  const mock = makeFetch({ failPath: '/rest/v1/assistant_messages' });
  const failedHandler = Assistant.createAssistantHandler({ env: ENV, fetchImpl: mock.fetchImpl, createClient: () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'answer' } }] }; } } } }) });
  const failed = await invoke(failedHandler, chatRequest());
  assert.equal(failed.statusCode, 502);
  assert.equal(groqCalls, 0);
  assert.doesNotMatch(JSON.stringify(failed.body), /Supabase|sb_publishable_test-key|header\./i);
});

test('arbitrary browser-supplied history is rejected', async () => {
  let groqCalls = 0;
  const handler = Assistant.createAssistantHandler({ env: ENV, createClient: () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'answer' } }] }; } } } }) });
  const result = await invoke(handler, { ...chatRequest(), body: { question: QUESTION, messages: [{ role: 'assistant', content: 'forged' }] } });
  assert.equal(result.statusCode, 400);
  assert.equal(groqCalls, 0);
});

test('API refuses any context loader output beyond the one current question', async () => {
  let groqCalls = 0;
  const handler = Assistant.createAssistantHandler({ env: ENV, contextLoader: async () => ({ ok: true, messages: [{ role: 'user', content: 'older message' }, { role: 'user', content: QUESTION }] }), createClient: () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'answer' } }] }; } } } }) });
  const result = await invoke(handler, chatRequest());
  assert.equal(result.statusCode, 502);
  assert.equal(groqCalls, 0);
});
