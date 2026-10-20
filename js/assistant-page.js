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
  const useHistory = document.getElementById("assistant-use-history");
  const reportPreview = document.getElementById("assistant-report-preview");
  const submit = form.querySelector('button[type="submit"]');
  let pending = false, userId = null, conversations = [], activeConversationId = null, authRevision = 0;

  function currentPlanContext() {
    const plan = loadPlan();
    const stored = window.CampusBridgePlanState?.loadPlan?.();
    const context = window.CampusBridgeAssistantPlanContext.summarize(plan, { stressScenarios: stored?.ok ? stored.stressScenarios : [] });
    if (reportPreview) reportPreview.textContent = JSON.stringify(context.financialReport || { status: "unavailable", reason: context.reason }, null, 2);
    return context;
  }
  currentPlanContext();

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
    activeConversationId = id; if (useHistory) useHistory.checked = false; renderList(); renderMessages(result.messages); status.textContent = "Saved conversation reopened.";
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
    if (!userId || !chat) return null;
    const ownerId = userId;
    if (!activeConversationId) {
      const created = await chat.createConversation(text);
      if (userId !== ownerId) return null;
      if (!created?.ok || typeof created.conversation?.id !== "string" || !created.conversation.id) {
        status.textContent = `${created?.error || "Could not verify the saved conversation."} The answer can still be viewed until you leave this page.`;
        return null;
      }
      activeConversationId = created.conversation.id;
      conversations.unshift(created.conversation); renderList();
      historyNote.textContent = "Select a conversation to reopen it. Your chat is saved to your account.";
    }
    const conversationId = activeConversationId;
    const result = await chat.saveMessage(conversationId, "user", text);
    if (userId !== ownerId) return null;
    const currentMessageId = result?.ok && typeof result.message?.id === "string" && result.message.id ? result.message.id : null;
    if (!currentMessageId) {
      status.textContent = `${result?.error || "Could not verify the saved question."} The answer can still be viewed until you leave this page.`;
    }
    return { conversationId, currentMessageId };
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
    userId = nextId; conversations = []; activeConversationId = null; if (useHistory) useHistory.checked = false; clearTranscript(); renderList();
    if (!userId) { historyNote.textContent = "Sign in to save and reopen conversations. Signed-out chats stay on this page only."; return; }
    historyNote.textContent = "Loading saved conversations…";
    await refreshConversations();
    if (revision !== authRevision) return;
  }

  document.getElementById("assistant-new-conversation").addEventListener("click", () => {
    activeConversationId = null; if (useHistory) useHistory.checked = false; clearTranscript(); renderList(); question.focus();
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
    Conversation.scrollToLatest(turn.element);
    let fallbackTask = { handled: false }, savedQuestion = null, assistantRequestStarted = false;

    try {
      savedQuestion = await saveQuestion(text);
      const plan = loadPlan();
      fallbackTask = window.CampusBridgeAssistantTask.run({ question: text, Finance, plan, money });
      const planContext = currentPlanContext();

      if (savedQuestion?.conversationId && !savedQuestion.currentMessageId) throw new Error("The saved question could not be verified. Please try again before using the AI assistant.");

      status.textContent = savedQuestion?.conversationId && savedQuestion.currentMessageId
        ? "Verifying this saved conversation and preparing your current financial report…"
        : "Sending your question with the current financial report to CampusBridge AI…";
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      const requestBody = { question: text, planContext };
      if (savedQuestion?.conversationId && savedQuestion.currentMessageId) {
        const { data, error } = await window.CampusBridgeSupabase.client.auth.getSession();
        const accessToken = data?.session?.access_token;
        if (error || typeof accessToken !== "string" || !accessToken) throw new Error("Sign in again to use saved conversation context.");
        headers.Authorization = `Bearer ${accessToken}`;
        requestBody.conversationId = savedQuestion.conversationId;
        requestBody.currentMessageId = savedQuestion.currentMessageId;
        if (useHistory?.checked === true) requestBody.includeHistory = true;
        status.textContent = useHistory?.checked === true
          ? "Sending your question, current financial report, and consented recent chat messages to CampusBridge AI…"
          : "Sending your question and current financial report to CampusBridge AI…";
      }
      assistantRequestStarted = true;
      const response = await fetch("/api/assistant", { method: "POST", headers, body: JSON.stringify(requestBody) });
      let payload = {};
      try { payload = await response.json(); } catch { /* handled below */ }
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The assistant is temporarily unavailable.");
      if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The assistant returned no usable answer.");
      Renderer.render(turn.response, payload.answer);
      if (payload.incomplete === true) {
        const warning = document.createElement("p"); warning.className = "answerNotice"; warning.textContent = "This answer may be incomplete because it reached a response limit. Ask a narrower question."; turn.response.append(warning);
      }
      status.textContent = planContext.status === "available"
        ? "The answer uses the current financial report; account details, tracker notes, and quote references are not sent."
        : "No valid plan is available; the question and unavailable-plan status were sent.";
      if (savedQuestion?.conversationId && savedQuestion.conversationId === activeConversationId) await saveAnswer(payload.answer);
    } catch (error) {
      const message = error.message || "The assistant is temporarily unavailable.";
      if (fallbackTask.handled) {
        Renderer.render(turn.response, fallbackTask.answer);
        status.textContent = assistantRequestStarted
          ? "AI unavailable; showing deterministic guidance from the current planner results."
          : "Assistant request could not be completed; showing deterministic guidance from the current planner results.";
        if (savedQuestion?.conversationId && savedQuestion.currentMessageId && savedQuestion.conversationId === activeConversationId) await saveAnswer(fallbackTask.answer);
      } else {
        turn.response.textContent = `Assistant unavailable: ${message}`; status.textContent = message;
      }
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
