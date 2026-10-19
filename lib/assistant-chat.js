(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampusBridgeAssistantChat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONVERSATIONS = "assistant_conversations";
  const MESSAGES = "assistant_messages";
  const MAX_TITLE = 100;
  const MAX_MESSAGE = 16000;

  function createAssistantChat({ client } = {}) {
    async function user() {
      if (!client?.auth?.getUser) return { error: "Supabase account storage is unavailable." };
      const { data, error } = await client.auth.getUser();
      return error || !data?.user?.id ? { error: "Sign in again to access saved conversations." } : { user: data.user };
    }
    async function listConversations() {
      const auth = await user();
      if (auth.error) return { ok: false, error: auth.error };
      const { data, error } = await client.from(CONVERSATIONS).select("id,title,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) return { ok: false, error: "Could not load saved conversations." };
      return { ok: true, conversations: data.filter(row => row && typeof row.id === "string" && typeof row.title === "string" && row.title.length <= MAX_TITLE && typeof row.created_at === "string") };
    }
    async function createConversation(title) {
      const auth = await user();
      const cleanTitle = typeof title === "string" ? title.trim().slice(0, MAX_TITLE) : "";
      if (auth.error) return { ok: false, error: auth.error };
      if (!cleanTitle) return { ok: false, error: "Enter a question before starting a saved conversation." };
      const { data, error } = await client.from(CONVERSATIONS).insert({ user_id: auth.user.id, title: cleanTitle }).select("id,title,created_at").single();
      return error || !data?.id ? { ok: false, error: "Could not save this conversation." } : { ok: true, conversation: data };
    }
    async function listMessages(conversationId) {
      const auth = await user();
      if (auth.error) return { ok: false, error: auth.error };
      if (typeof conversationId !== "string" || !conversationId) return { ok: false, error: "Choose a saved conversation." };
      const { data, error } = await client.from(MESSAGES).select("id,role,content,created_at").eq("user_id", auth.user.id).eq("conversation_id", conversationId).order("created_at", { ascending: true }).order("id", { ascending: true });
      if (error || !Array.isArray(data)) return { ok: false, error: "Could not load this conversation." };
      const messages = data.filter(row => row && ["user", "assistant"].includes(row.role) && typeof row.content === "string" && row.content.length <= MAX_MESSAGE && typeof row.created_at === "string");
      return { ok: true, messages };
    }
    async function saveMessage(conversationId, role, content) {
      const auth = await user();
      if (auth.error) return { ok: false, error: auth.error };
      if (typeof conversationId !== "string" || !conversationId || !["user", "assistant"].includes(role) || typeof content !== "string" || !content.trim() || content.length > MAX_MESSAGE) return { ok: false, error: "This message could not be saved." };
      const { data, error } = await client.from(MESSAGES).insert({ user_id: auth.user.id, conversation_id: conversationId, role, content }).select("id").single();
      return error || !data?.id ? { ok: false, error: "Could not save this message." } : { ok: true, message: { id: data.id } };
    }
    async function deleteConversation(conversationId) {
      const auth = await user();
      if (auth.error) return { ok: false, error: auth.error };
      if (typeof conversationId !== "string" || !conversationId) return { ok: false, error: "Choose a saved conversation." };
      const { data, error } = await client.from(CONVERSATIONS).delete().eq("id", conversationId).eq("user_id", auth.user.id).select("id").maybeSingle();
      return error || !data ? { ok: false, error: "Could not delete this conversation." } : { ok: true };
    }
    return Object.freeze({ listConversations, createConversation, listMessages, saveMessage, deleteConversation });
  }

  return Object.freeze({ CONVERSATIONS, MESSAGES, MAX_TITLE, MAX_MESSAGE, createAssistantChat });
});
