(function () {
  "use strict";
  const { Finance, loadPlan, money } = window.CampusBridgePageUtils;
  const Renderer = window.CampusBridgeAssistantRenderer;
  const Conversation = window.CampusBridgeAssistantConversation;
  const chat = window.CampusBridgeAssistantChat?.createAssistantChat({ client: window.CampusBridgeSupabase?.client });
  const form = document.getElementById("assistant-form");
  const question = document.getElementById("assistant-question");
  const answer = document.getElementById("assistant-answer");
  const status = document.getElementById("assistant-status");
  const list = document.getElementById("assistant-conversation-list");
  const historyNote = document.getElementById("assistant-history-note");
  const submit = form.querySelector('button[type="submit"]');
  let pending = false, userId = null, conversations = [], activeConversationId = null, authRevision = 0;

  function clearTranscript() { answer.replaceChildren(); delete answer.dataset.conversationStarted; }
  function renderList() {
    list.replaceChildren();
    for (const row of conversations) {
      const item = document.createElement("li"), open = document.createElement("button"), remove = document.createElement("button");
      open.type = "button"; open.className = "assistantConversationOpen"; open.textContent = row.title;
      open.setAttribute("aria-current", String(row.id === activeConversationId));
      open.addEventListener("click", () => { void openConversation(row.id); });
      remove.type = "button"; remove.className = "button smallbtn cautionButton"; remove.textContent = "Delete"; remove.setAttribute("aria-label", `Delete conversation: ${row.title}`);
      remove.addEventListener("click", () => { void deleteConversation(row.id); });
      item.append(open, remove); list.append(item);
    }
  }
  async function refreshConversations() {
    if (!userId || !chat) return;
    const ownerId = userId;
    const result = await chat.listConversations();
    if (userId !== ownerId) return;
    if (!result.ok) { conversations = []; historyNote.textContent = result.error; renderList(); return; }
    conversations = result.conversations;
    historyNote.textContent = conversations.length ? "Select a conversation to reopen it. Your chat is saved to your account." : "No saved conversations yet. Ask a question to start one.";
    renderList();
  }
  function renderMessages(messages) {
    clearTranscript();
    let turn = null;
    for (const message of messages) {
      if (message.role === "user") {
        turn = Conversation.createTurn(answer, message.content);
      } else if (turn) {
        Renderer.render(turn.response, message.content);
        turn = null;
      }
    }
    Conversation.scrollToLatest(answer.lastElementChild);
  }
  async function openConversation(id) {
    if (!userId || !chat) return;
    const ownerId = userId;
    const result = await chat.listMessages(id);
    if (userId !== ownerId) return;
    if (!result.ok) { status.textContent = result.error; return; }
    if (!conversations.some(item => item.id === id)) return;
    activeConversationId = id; renderList(); renderMessages(result.messages); status.textContent = "Saved conversation reopened.";
  }
  async function deleteConversation(id) {
    if (!userId || !chat) return;
    const ownerId = userId;
    const result = await chat.deleteConversation(id);
    if (userId !== ownerId) return;
    if (!result.ok) { status.textContent = result.error; return; }
    conversations = conversations.filter(item => item.id !== id);
    if (activeConversationId === id) { activeConversationId = null; clearTranscript(); }
    historyNote.textContent = conversations.length ? "Select a conversation to reopen it. Your chat is saved to your account." : "No saved conversations yet. Ask a question to start one.";
    renderList(); status.textContent = "Conversation deleted.";
  }
  async function saveQuestion(text) {
    if (!userId || !chat) return;
    const ownerId = userId;
    if (!activeConversationId) {
      const created = await chat.createConversation(text);
      if (userId !== ownerId) return;
      if (!created.ok) { status.textContent = `${created.error} The answer can still be viewed until you leave this page.`; return; }
      activeConversationId = created.conversation.id;
      conversations.unshift(created.conversation); renderList();
      historyNote.textContent = "Select a conversation to reopen it. Your chat is saved to your account.";
    }
    const result = await chat.saveMessage(activeConversationId, "user", text);
    if (userId !== ownerId) return;
    if (!result.ok) status.textContent = `${result.error} The answer can still be viewed until you leave this page.`;
  }
  async function saveAnswer(content) {
    if (!userId || !chat || !activeConversationId) return;
    const ownerId = userId, conversationId = activeConversationId;
    const result = await chat.saveMessage(conversationId, "assistant", content);
    if (userId !== ownerId || activeConversationId !== conversationId) return;
    if (!result.ok) status.textContent = `${result.error} This answer remains visible until you leave this page.`;
  }
  async function setUser(user) {
    const nextId = user?.id || null;
    if (nextId === userId) { if (nextId) await refreshConversations(); return; }
    const revision = ++authRevision;
    userId = nextId; conversations = []; activeConversationId = null; clearTranscript(); renderList();
    if (!userId) { historyNote.textContent = "Sign in to save and reopen conversations. Signed-out chats stay on this page only."; return; }
    historyNote.textContent = "Loading saved conversations…";
    await refreshConversations();
    if (revision !== authRevision) return;
  }

  document.getElementById("assistant-new-conversation").addEventListener("click", () => {
    activeConversationId = null; clearTranscript(); renderList(); question.focus();
    status.textContent = userId ? "New conversation. Ask a question to save it." : "New temporary conversation.";
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending) return;
    const text = question.value.trim();
    if (!text || text.length > 1000) { status.textContent = "Enter a question of 1,000 characters or fewer."; question.focus(); return; }

    pending = true; submit.disabled = true; question.disabled = true; answer.setAttribute("aria-busy", "true");
    status.textContent = "Preparing your answer…";
    const turn = Conversation.createTurn(answer, text);
    question.value = "";
    turn.response.textContent = "Preparing your answer…";
    const conversationIdAtSubmit = activeConversationId;
    await saveQuestion(text);
    const requestConversationId = activeConversationId || conversationIdAtSubmit;
    Conversation.scrollToLatest(turn.element);

    try {
      const plan = loadPlan();
      if (plan.ok && /funding gap|how much.*save|monthly target|can i afford/.test(text.toLowerCase())) {
        const target = Finance.describeMonthlySavingsTarget(plan.result);
        const targetText = target.state === "covered" ? target.message : target.state === "unavailable" ? target.message : `The adjusted contribution schedule is ${money(target.regularAmount)} for each regular cycle, then ${money(target.finalAmount)} in the final cycle.`;
        const content = `Based on your saved plan, the estimated funding gap is ${money(plan.result.gap)}. ${targetText} The projection assumes your entered monthly surplus continues; it is not a guarantee.`;
        Renderer.render(turn.response, content);
        status.textContent = "Answered locally from the deterministic planner. No plan details were sent to the AI service.";
        if (requestConversationId && requestConversationId === activeConversationId) await saveAnswer(content);
        return;
      }

      status.textContent = "Sending only your question to CampusBridge AI…";
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ question: text }) });
      let payload = {};
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The assistant is temporarily unavailable.");
      if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The assistant returned no usable answer.");
      Renderer.render(turn.response, payload.answer);
      if (payload.incomplete === true) {
        const warning = document.createElement("p"); warning.className = "answerNotice"; warning.textContent = "This answer may be incomplete because it reached a response limit. Ask a narrower question."; turn.response.append(warning);
      }
      status.textContent = "General educational information only. Your saved plan and quotes were not sent.";
      if (requestConversationId && requestConversationId === activeConversationId) await saveAnswer(payload.answer);
    } catch (error) {
      const message = error.message || "The assistant is temporarily unavailable.";
      turn.response.textContent = `Assistant unavailable: ${message}`; status.textContent = message;
    } finally {
      pending = false; submit.disabled = false; question.disabled = false; answer.setAttribute("aria-busy", "false");
      Conversation.scrollToLatest(turn.element, { onlyIfVisible: true });
    }
  });

  document.getElementById("assistant-history-note").textContent = "Sign in to save and reopen conversations. Signed-out chats stay on this page only.";
  const client = window.CampusBridgeSupabase?.client;
  if (client?.auth?.onAuthStateChange) client.auth.onAuthStateChange((_event, session) => { void setUser(session?.user || null); });
  if (client?.auth?.getUser) client.auth.getUser().then(({ data, error }) => { if (!error) void setUser(data?.user || null); }).catch(() => {});
})();
