"use strict";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readBearerToken(value) {
  const match = typeof value === "string" && /^Bearer ([A-Za-z0-9._~-]{20,8192})$/i.exec(value.trim());
  return match ? match[1] : null;
}

function configuredSupabase(env = process.env) {
  const rawUrl = typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const publishableKey = typeof env.SUPABASE_PUBLISHABLE_KEY === "string" ? env.SUPABASE_PUBLISHABLE_KEY.trim() : "";
  if (!rawUrl || !publishableKey.startsWith("sb_publishable_")) return null;
  try {
    const url = new URL(rawUrl);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash) return null;
    return { url: url.origin, publishableKey };
  } catch { return null; }
}

async function loadOwnedConversationContext({ conversationId, currentMessageId, question, authorization, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!UUID.test(String(conversationId || "")) || !UUID.test(String(currentMessageId || ""))) {
    return { ok: false, status: 400, error: "A valid saved conversation is required for this request." };
  }
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return { ok: false, status: 401, error: "Sign in again to use this saved conversation." };
  const config = configuredSupabase(env);
  if (!config) return { ok: false, status: 503, error: "Saved conversation verification is not configured on this server." };
  if (typeof fetchImpl !== "function") return { ok: false, status: 503, error: "Saved conversation verification is unavailable." };

  const headers = { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  const get = async (path, params) => {
    const url = new URL(path, `${config.url}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return fetchImpl(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(8000) });
  };
  let userResponse, user;
  try {
    userResponse = await fetchImpl(new URL("/auth/v1/user", config.url), { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(8000) });
    if (userResponse.status === 401 || userResponse.status === 403) return { ok: false, status: 401, error: "Sign in again to use this saved conversation." };
    if (!userResponse.ok) return { ok: false, status: 502, error: "Could not verify saved conversation access." };
    user = await userResponse.json();
  } catch { return { ok: false, status: 502, error: "Could not verify saved conversation access." }; }
  if (!UUID.test(String(user?.id || ""))) return { ok: false, status: 401, error: "Sign in again to use this saved conversation." };

  try {
    const conversationResponse = await get("/rest/v1/assistant_conversations", {
      select: "id", id: `eq.${conversationId}`, user_id: `eq.${user.id}`, limit: "1"
    });
    if (!conversationResponse.ok) return { ok: false, status: 502, error: "Could not verify saved conversation access." };
    const conversations = await conversationResponse.json();
    if (!Array.isArray(conversations) || conversations.length !== 1 || conversations[0]?.id !== conversationId) {
      return { ok: false, status: 404, error: "This conversation is unavailable to your account." };
    }

    // Only the latest user row is read. Raw prior conversation text is never sent to Groq:
    // arbitrary prose cannot be reliably classified as free of financial or identifying data.
    const latestResponse = await get("/rest/v1/assistant_messages", {
      select: "id,content", conversation_id: `eq.${conversationId}`, user_id: `eq.${user.id}`,
      role: "eq.user", order: "created_at.desc,id.desc", limit: "1"
    });
    if (!latestResponse.ok) return { ok: false, status: 502, error: "Could not verify the current conversation message." };
    const latestRows = await latestResponse.json();
    if (!Array.isArray(latestRows) || latestRows.length !== 1) {
      return { ok: false, status: 404, error: "The current message is unavailable in this conversation." };
    }
    const latest = latestRows[0];
    if (latest?.id !== currentMessageId || latest?.content !== question) {
      return { ok: false, status: 409, error: "This saved question is no longer the latest message in the conversation. Submit it again." };
    }

    // Include the current question once. Do not load or forward any prior message text.
    return { ok: true, userId: user.id, messages: [{ role: "user", content: question }] };
  } catch { return { ok: false, status: 502, error: "Could not verify saved conversation access." }; }
}

module.exports = Object.freeze({ UUID, readBearerToken, configuredSupabase, loadOwnedConversationContext });
