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
      const current = latestId ? [{ id: latestId, content: latestContent, role: 'user', created_at: '2026-10-19T00:01:00Z' }] : [];
      if (url.searchParams.get('role') === 'eq.user') {
        assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
        assert.equal(url.searchParams.get('limit'), '1');
        assert.equal(url.searchParams.get('select'), 'id,content,created_at');
        const latest = [...priorMessages, ...current].filter(message => message.role === 'user').sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, 1).map(({ id, content, created_at }) => ({ id, content, created_at }));
        return response(200, latest);
      }
      assert.equal(url.searchParams.get('role'), null);
      assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
      assert.equal(url.searchParams.get('limit'), String(Context.CONTEXT_QUERY_LIMIT));
      assert.equal(url.searchParams.get('select'), 'id,role,content,created_at');
      return response(200, [...priorMessages, ...current].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, Context.CONTEXT_QUERY_LIMIT));
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

test('saved conversation consent is off by default and queries only the current question', async () => {
  const mock = makeFetch({ priorMessages: [{ id: STALE_ID, role: 'user', content: 'I owe twelve thousand to the university.', created_at: '2026-10-18T00:00:00Z' }] });
  const loaded = await Context.loadOwnedConversationContext({ conversationId: CONVERSATION_ID, currentMessageId: CURRENT_ID, question: QUESTION, authorization: `Bearer ${TOKEN}`, env: ENV, fetchImpl: mock.fetchImpl });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.messages, [{ role: 'user', content: QUESTION }]);
  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[2].url.pathname, '/rest/v1/assistant_messages');
  assert.equal(mock.calls[2].url.searchParams.get('limit'), '1');
});

test('consented history is loaded server-side in chronological order and current question appears once', async () => {
  const followUp = 'What amount did I just tell you?';
  const priorMessages = [
    { id: '00000001-23ef-43b8-9a31-2c60c1eb9a88', role: 'user', content: 'My university tuition is 5000 USD.', created_at: '2026-10-18T00:00:00Z' },
    { id: '00000002-23ef-43b8-9a31-2c60c1eb9a88', role: 'assistant', content: 'Thanks. Is that the full annual tuition or one semester?', created_at: '2026-10-18T00:00:01Z' },
    { id: '00000003-23ef-43b8-9a31-2c60c1eb9a88', role: 'user', content: 'One semester.', created_at: '2026-10-18T00:00:02Z' }
  ];
  const mock = makeFetch({ priorMessages, latestContent: followUp });
  const capture = {};
  const result = await invoke(handlerFor(mock, capture), chatRequest({ includeHistory: true, question: followUp }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(capture.request.messages.slice(1), [
    { role: 'user', content: 'My university tuition is 5000 USD.' },
    { role: 'assistant', content: 'Thanks. Is that the full annual tuition or one semester?' },
    { role: 'user', content: 'One semester.' },
    { role: 'user', content: followUp }
  ]);
  assert.equal(capture.request.messages.filter(message => message.role === 'user' && message.content === followUp).length, 1);
  assert.equal(mock.calls.length, 4);
});

test('repeated identical questions remain separate ordered messages and current reference is appended once', async () => {
  const priorMessages = [{ id: STALE_ID, role: 'user', content: QUESTION, created_at: '2026-10-18T00:00:00Z' }];
  const mock = makeFetch({ priorMessages });
  const capture = {};
  const result = await invoke(handlerFor(mock, capture), chatRequest({ includeHistory: true }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(capture.request.messages.slice(1), [{ role: 'user', content: QUESTION }, { role: 'user', content: QUESTION }]);
  assert.equal(capture.request.messages.at(-1).content, QUESTION);
});

test('consented history enforces both message count and character limits while retaining recent useful context', async () => {
  const priorMessages = Array.from({ length: 22 }, (_, i) => ({
    id: `${String(i + 1).padStart(8, '0')}-23ef-43b8-9a31-2c60c1eb9a88`, role: i % 2 ? 'assistant' : 'user',
    content: i === 0 ? 'Old useful context.' : `Message ${i} ${'x'.repeat(700)}`,
    created_at: `2026-10-18T00:${String(i).padStart(2, '0')}:00Z`
  }));
  const mock = makeFetch({ priorMessages });
  const capture = {};
  const result = await invoke(handlerFor(mock, capture), chatRequest({ includeHistory: true }));
  assert.equal(result.statusCode, 200);
  const sent = capture.request.messages.slice(1);
  assert.ok(sent.length <= Context.MAX_CONTEXT_MESSAGES);
  assert.ok(sent.reduce((sum, message) => sum + message.content.length, 0) <= Context.MAX_CONTEXT_CHARS);
  assert.deepEqual(sent.at(-1), { role: 'user', content: QUESTION });
  assert.ok(sent.some(message => message.content.startsWith('Message 21')));
  assert.equal(sent.filter(message => message.content === QUESTION).length, 1);
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

test('API enforces context bounds and final current-question position before Groq', async () => {
  let groqCalls = 0;
  const sdk = () => ({ chat: { completions: { create: async () => { groqCalls += 1; return { choices: [{ message: { content: 'answer' } }] }; } } } });
  const tooMany = Array.from({ length: Context.MAX_CONTEXT_MESSAGES }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `context ${i}` }));
  tooMany.push({ role: 'user', content: QUESTION });
  for (const messages of [tooMany, [{ role: 'user', content: 'x'.repeat(Context.MAX_CONTEXT_CHARS) }, { role: 'user', content: QUESTION }], [{ role: 'user', content: QUESTION }, { role: 'assistant', content: 'not chronologically final' }]]) {
    const handler = Assistant.createAssistantHandler({ env: ENV, contextLoader: async () => ({ ok: true, messages }), createClient: sdk });
    const result = await invoke(handler, chatRequest({ includeHistory: true }));
    assert.equal(result.statusCode, 502);
  }
  assert.equal(groqCalls, 0);
});
