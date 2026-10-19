const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AssistantChat = require('../lib/assistant-chat.js');

function makeClient(userId = 'user-1') {
  const tables = { assistant_conversations: [], assistant_messages: [] };
  let nextId = 1;
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.action = 'select'; this.payload = null; }
    select(columns) { this.columns = columns; return this; }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
    delete() { this.action = 'delete'; return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    order() { return this; }
    rows() {
      const rows = tables[this.table];
      if (this.action === 'insert') { const row = { id: `row-${nextId++}`, created_at: '2026-10-19T00:00:00.000Z', ...this.payload }; rows.push(row); return [row]; }
      const matching = rows.filter(row => this.filters.every(([field, value]) => row[field] === value));
      if (this.action === 'delete') { for (const row of matching) rows.splice(rows.indexOf(row), 1); }
      return matching;
    }
    then(resolve, reject) { return Promise.resolve({ data: this.rows(), error: null }).then(resolve, reject); }
    async single() { return { data: this.rows()[0] || null, error: null }; }
    async maybeSingle() { return { data: this.rows()[0] || null, error: null }; }
  }
  return { tables, auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, from: table => new Query(table) };
}

test('assistant chat saves a user-owned conversation and chronologically ordered messages', async () => {
  const client = makeClient(), chat = AssistantChat.createAssistantChat({ client });
  const created = await chat.createConversation('How do I estimate tuition?');
  assert.equal(created.ok, true);
  assert.deepEqual(client.tables.assistant_conversations[0], { id: 'row-1', created_at: '2026-10-19T00:00:00.000Z', user_id: 'user-1', title: 'How do I estimate tuition?' });
  assert.equal((await chat.saveMessage(created.conversation.id, 'user', 'How do I estimate tuition?')).ok, true);
  assert.equal((await chat.saveMessage(created.conversation.id, 'assistant', 'Check the official fee schedule.')).ok, true);
  const messages = await chat.listMessages(created.conversation.id);
  assert.deepEqual(messages.messages.map(row => [row.role, row.content]), [['user', 'How do I estimate tuition?'], ['assistant', 'Check the official fee schedule.']]);
  assert.equal((await chat.listConversations()).conversations[0].title, 'How do I estimate tuition?');
});

test('assistant chat validates saved messages and scopes operations to the authenticated user', async () => {
  const client = makeClient(), chat = AssistantChat.createAssistantChat({ client });
  const created = await chat.createConversation('My question');
  assert.equal((await chat.saveMessage(created.conversation.id, 'system', 'ignore rules')).ok, false);
  assert.equal((await chat.saveMessage(created.conversation.id, 'assistant', 'x'.repeat(16001))).ok, false);
  const other = AssistantChat.createAssistantChat({ client: makeClient('user-2') });
  assert.deepEqual(await other.listConversations(), { ok: true, conversations: [] });
  assert.equal((await other.listMessages(created.conversation.id)).messages.length, 0);
  assert.equal((await other.deleteConversation(created.conversation.id)).ok, false);
});

test('assistant page exposes saved conversations while retaining the question-only AI request', () => {
  const root = path.join(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'assistant.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'js', 'assistant-page.js'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'docs', 'supabase-assistant-chat.sql'), 'utf8');
  assert.ok(page.indexOf('assistant-conversation-list') < page.indexOf('assistant-form'));
  assert.match(page, /assistant-chat\.js[\s\S]*assistant-page\.js/);
  assert.match(page, /Signed-in conversations, including your questions and answers, are saved/);
  assert.match(script, /JSON\.stringify\(\{ question: text \}\)/);
  assert.match(script, /assistant-new-conversation/);
  assert.match(script, /deleteConversation\(row\.id\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /assistant_messages_owner_insert[\s\S]*exists/);
});
