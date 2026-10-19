const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Finance = require('../lib/finance.js');
const AssistantTask = require('../lib/assistant-task.js');

const USER_ID = 'b60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const CONVERSATION_ID = 'a60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const MESSAGE_ID = 'd60d7611-23ef-43b8-9a31-2c60c1eb9a88';
const root = path.join(__dirname, '..');

function makePlan() {
  const profile = {
    homeCountry: 'Bangladesh', destinationCountry: 'United Kingdom', homeCur: 'BDT', tuitionCur: 'GBP',
    tuition: '8000', exchangeRate: '155', rateSource: 'Bangladesh Bank reference', rateTimestamp: '2026-10-19T10:00',
    rateProvenance: 'Official reference rate', savings: '500000', income: '60000', expenses: '35000',
    committed: '10000', emergency: '50000', paymentFee: '0', deadline: '2027-01-20'
  };
  return { ok: true, profile, result: Finance.calculateTuition(profile, new Date(2026, 9, 19, 12)) };
}

function makeElement(id = '') {
  return {
    id, children: [], listeners: {}, dataset: {}, disabled: false, value: '', attributes: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    querySelector() { return this.submitButton; },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = [...items]; },
    focus() {},
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() { return `${this._text || ''}${this.children.map(child => child.textContent || '').join('')}`; },
    get lastElementChild() { return this.children.at(-1) || null; }
  };
}

async function runAssistantPage({ signedIn, conversationResult = { ok: true, conversation: { id: CONVERSATION_ID, title: 'Question', created_at: '2026-10-19T00:00:00Z' } }, userMessageResult = { ok: true, message: { id: MESSAGE_ID } }, questionText = 'What is my funding gap?', responseBody = { answer: 'Remote answer.' } }) {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const form = getElement('assistant-form');
  const submitButton = makeElement('submit-button');
  form.submitButton = submitButton;
  const question = getElement('assistant-question');
  question.value = questionText;
  let writes = 0;
  const chat = {
    async listConversations() { return { ok: true, conversations: [] }; },
    async createConversation() { return conversationResult; },
    async saveMessage() { writes += 1; return writes === 1 ? userMessageResult : { ok: true, message: { id: 'e60d7611-23ef-43b8-9a31-2c60c1eb9a88' } }; }
  };
  const requestCalls = [];
  const fetch = async (url, options) => {
    requestCalls.push({ url, options });
    return { ok: true, json: async () => responseBody };
  };
  const plan = makePlan();
  const client = signedIn ? { auth: {
    onAuthStateChange() {},
    async getUser() { return { data: { user: { id: USER_ID } }, error: null }; },
    async getSession() { return { data: { session: { access_token: 'test-access-token' } }, error: null }; }
  } } : null;
  const window = {
    CampusBridgePageUtils: { Finance, loadPlan: () => plan, money: value => `${Math.round(value)} BDT` },
    CampusBridgeAssistantRenderer: { render(element, text) { element.textContent = text; } },
    CampusBridgeAssistantConversation: {
      createTurn(parent, text) {
        const element = makeElement('turn'), response = makeElement('response');
        element.textContent = text; element.append(response); parent.append(element);
        return { element, response };
      },
      scrollToLatest() {}
    },
    CampusBridgeAssistantTask: AssistantTask,
    CampusBridgeAssistantChat: { createAssistantChat: () => chat },
    CampusBridgeSupabase: client ? { client } : undefined
  };
  const document = { getElementById: getElement, createElement: tag => makeElement(tag) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'assistant-page.js'), 'utf8'), { window, document, fetch });
  await new Promise(resolve => setImmediate(resolve));
  const submit = form.listeners.submit;
  const result = submit({ preventDefault() {} });
  await result;
  return { elements, requestCalls, plan, writes };
}

test('funding-gap task still returns the deterministic planner figure when persistence reports success without a message ID', async () => {
  const page = await runAssistantPage({ signedIn: true, userMessageResult: { ok: true } });
  const answer = page.elements.get('assistant-answer').textContent;
  assert.match(answer, new RegExp(`${Math.round(page.plan.result.gap)} BDT`));
  assert.equal(page.requestCalls.length, 0, 'deterministic funding answer must not call the remote AI endpoint');
  assert.match(page.elements.get('assistant-status').textContent, /Answered locally using validated planner results/);
});

test('signed-in deterministic funding answers still persist when the saved-message ID is present', async () => {
  const page = await runAssistantPage({ signedIn: true });
  assert.equal(page.requestCalls.length, 0);
  assert.equal(page.writes, 2, 'save the user question and deterministic assistant answer');
  assert.match(page.elements.get('assistant-answer').textContent, new RegExp(`${Math.round(page.plan.result.gap)} BDT`));
});

test('funding-gap task remains available if conversation creation returns no ID', async () => {
  const page = await runAssistantPage({ signedIn: true, conversationResult: { ok: true } });
  assert.equal(page.requestCalls.length, 0);
  assert.match(page.elements.get('assistant-answer').textContent, new RegExp(`${Math.round(page.plan.result.gap)} BDT`));
  assert.doesNotMatch(page.elements.get('assistant-answer').textContent, /Cannot read properties of undefined/);
});

test('saved remote conversation fails closed when the current saved-message ID is absent', async () => {
  const page = await runAssistantPage({ signedIn: true, userMessageResult: { ok: true }, questionText: 'What is a waiver?' });
  assert.equal(page.requestCalls.length, 0);
  assert.match(page.elements.get('assistant-status').textContent, /saved question could not be verified/i);
});

test('signed-out remote chat remains question-only and does not require saved IDs', async () => {
  const page = await runAssistantPage({ signedIn: false, questionText: 'What is a waiver?' });
  assert.equal(page.requestCalls.length, 1);
  assert.deepEqual(JSON.parse(page.requestCalls[0].options.body), { question: 'What is a waiver?' });
  assert.equal(Object.hasOwn(page.requestCalls[0].options.headers, 'Authorization'), false);
});

test('signed-in remote chat sends real persisted IDs with the current Supabase session', async () => {
  const page = await runAssistantPage({ signedIn: true, questionText: 'What is a waiver?' });
  assert.equal(page.requestCalls.length, 1);
  assert.deepEqual(JSON.parse(page.requestCalls[0].options.body), { question: 'What is a waiver?', conversationId: CONVERSATION_ID, currentMessageId: MESSAGE_ID });
  assert.equal(page.requestCalls[0].options.headers.Authorization, 'Bearer test-access-token');
});
