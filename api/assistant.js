"use strict";

const { randomUUID } = require("node:crypto");
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_QUESTION_CHARS = 1000;
const MAX_BODY_BYTES = 4096;
const MAX_OUTPUT_TOKENS = 400;
const MAX_OUTPUT_CHARS = 2000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 12;
const SYSTEM_PROMPT = "You are the CampusBridge AI explainer for students planning overseas tuition payments. Start with a direct answer. Be friendly, respectful, encouraging, and natural without excessive enthusiasm. Use simple English, short paragraphs, and a concise length suited to the question. For longer explanations, use descriptive headings and concise bullet points; use numbered steps for procedures. Explain unfamiliar financial or technical terms in plain language and include a practical example only when it helps. Avoid repeating the question, generic introductions, unnecessary disclaimers, and irrelevant information. Be careful and transparent about uncertainty; never invent facts, rates, fees, dates, statistics, provider offers, quote validity, or verification claims. Ask a brief clarifying question when essential information is missing. Never claim to have accessed live data or completed an action unless that actually happened. You receive only the user's question, not their financial profile, exchange rates, or provider quotes. Never calculate or invent financial figures or savings projections. For personal plan calculations, direct the student to the local planner, which performs deterministic calculations. Encourage checking official university, bank, or payment-provider sources for current terms. This is educational information, not financial advice.";

function createRateLimiter({ now = Date.now, windowMs = RATE_LIMIT_WINDOW_MS, limit = RATE_LIMIT_REQUESTS } = {}) {
  const buckets = new Map();
  return function allowRequest(identity) {
    const current = now();
    if (buckets.size >= 5000 && !buckets.has(identity)) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= current) buckets.delete(key);
      if (buckets.size >= 5000) {
        const earliestReset = Math.min(...[...buckets.values()].map(bucket => bucket.resetAt));
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((earliestReset - current) / 1000)) };
      }
    }
    const existing = buckets.get(identity);
    if (!existing || existing.resetAt <= current) {
      buckets.set(identity, { count: 1, resetAt: current + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (existing.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - current) / 1000)) };
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

function sendJson(response, status, body, headers = {}) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.status(status).json(body);
}

function readQuestion(request) {
  const contentType = request.headers?.["content-type"] || request.headers?.["Content-Type"] || "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) return { error: "Send the question as JSON." };
  let body = request.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) return { error: "The request is too large." };
    try { body = JSON.parse(body); } catch { return { error: "The request JSON is invalid." }; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "The request must contain a JSON object." };
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) return { error: "The request is too large." };
  if (Object.keys(body).some(key => key !== "question")) return { error: "Only a question is accepted; financial profile and quote data are not accepted." };
  if (typeof body.question !== "string") return { error: "Question must be text." };
  const question = body.question.trim();
  if (!question) return { error: "Enter a question first." };
  if (question.length > MAX_QUESTION_CHARS) return { error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer.` };
  return { question };
}

function requestIdentity(request) {
  const headers = request.headers || {};
  const raw = headers["x-real-ip"] || headers["x-forwarded-for"] || "unknown";
  return String(raw).split(",")[0].trim().slice(0, 128) || "unknown";
}

function safeDiagnostic(error) {
  const diagnostic = { type: typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name) ? error.name : "Error" };
  if (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) diagnostic.status = error.status;
  if (typeof error?.code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(error.code)) diagnostic.code = error.code;
  return diagnostic;
}

function createAssistantHandler({ env = process.env, createClient, rateLimiter = createRateLimiter() } = {}) {
  let client;
  return async function assistantHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "Use POST to ask the assistant." });
    }

    const { question, error: validationError } = readQuestion(request);
    if (validationError) return sendJson(response, 400, { error: validationError });

    const limit = rateLimiter(requestIdentity(request));
    if (!limit.allowed) return sendJson(response, 429, { error: "Too many assistant requests. Please wait before trying again." }, { "Retry-After": String(limit.retryAfterSeconds) });
    const apiKey = typeof env.GROQ_API_KEY === "string" ? env.GROQ_API_KEY.trim() : "";
    if (!apiKey) {
      const requestId = randomUUID();
      console.warn("CampusBridge assistant is missing server configuration", { requestId, code: "MISSING_GROQ_API_KEY" });
      return sendJson(response, 503, { error: "The AI assistant is not configured. Local guidance is still available.", requestId });
    }

    const requestId = randomUUID();
    try {
      if (!client) {
        const OpenAI = createClient ? null : require("openai");
        client = createClient
          ? createClient(apiKey, { baseURL: GROQ_BASE_URL })
          : new OpenAI({ apiKey, baseURL: GROQ_BASE_URL, timeout: 15000, maxRetries: 0 });
      }
      const model = typeof env.GROQ_MODEL === "string" && /^[A-Za-z0-9._:/-]{1,100}$/.test(env.GROQ_MODEL) ? env.GROQ_MODEL : DEFAULT_MODEL;
      const result = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question }
        ],
        max_tokens: MAX_OUTPUT_TOKENS
      });
      const output = result.choices?.[0]?.message?.content;
      const answer = typeof output === "string" ? output.trim().slice(0, MAX_OUTPUT_CHARS) : "";
      if (!answer) {
        console.error("CampusBridge assistant returned no usable output", { requestId, code: "EMPTY_MODEL_OUTPUT" });
        return sendJson(response, 502, { error: "The AI assistant returned no usable answer. Local guidance is still available.", requestId });
      }
      return sendJson(response, 200, { answer });
    } catch (error) {
      console.error("CampusBridge Groq request failed", { requestId, ...safeDiagnostic(error) });
      return sendJson(response, 502, { error: "The AI assistant is temporarily unavailable. Local guidance is still available.", requestId });
    }
  };
}

const handler = createAssistantHandler();
handler.createAssistantHandler = createAssistantHandler;
handler.createRateLimiter = createRateLimiter;
handler.constants = Object.freeze({ DEFAULT_MODEL, GROQ_BASE_URL, SYSTEM_PROMPT, MAX_QUESTION_CHARS, MAX_BODY_BYTES, MAX_OUTPUT_TOKENS, MAX_OUTPUT_CHARS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_REQUESTS, safeDiagnostic });
module.exports = handler;
