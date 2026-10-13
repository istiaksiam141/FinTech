"use strict";

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_QUESTION_CHARS = 1000;
const MAX_BODY_BYTES = 4096;
const MAX_OUTPUT_TOKENS = 400;
const MAX_OUTPUT_CHARS = 2000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 12;

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

    const apiKey = typeof env.OPENAI_API_KEY === "string" ? env.OPENAI_API_KEY.trim() : "";
    if (!apiKey) return sendJson(response, 503, { error: "The AI assistant is not configured. Local guidance is still available." });

    try {
      if (!client) {
        const OpenAI = createClient ? null : require("openai");
        client = createClient ? createClient(apiKey) : new OpenAI({ apiKey, timeout: 15000, maxRetries: 0 });
      }
      const model = typeof env.OPENAI_MODEL === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(env.OPENAI_MODEL) ? env.OPENAI_MODEL : DEFAULT_MODEL;
      const result = await client.responses.create({
        model,
        instructions: "You are the CampusBridge AI explainer for students planning overseas tuition payments. Answer general questions clearly and briefly. You receive only the user's question, not their financial profile, exchange rates, or provider quotes. Never calculate or invent financial figures, savings projections, exchange rates, provider offers, quote validity, or verification claims. Do not claim to have accessed accounts, the internet, payment providers, or Bangladesh Bank. For personal plan calculations, tell the student to use the local planner, which performs deterministic calculations. Encourage checking official university, bank, or payment-provider sources for current terms. This is educational information, not financial advice.",
        input: question,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false
      });
      const answer = typeof result.output_text === "string" ? result.output_text.trim().slice(0, MAX_OUTPUT_CHARS) : "";
      if (!answer) return sendJson(response, 502, { error: "The AI assistant returned no usable answer. Local guidance is still available." });
      return sendJson(response, 200, { answer });
    } catch {
      return sendJson(response, 502, { error: "The AI assistant is temporarily unavailable. Local guidance is still available." });
    }
  };
}

const handler = createAssistantHandler();
handler.createAssistantHandler = createAssistantHandler;
handler.createRateLimiter = createRateLimiter;
handler.constants = Object.freeze({ DEFAULT_MODEL, MAX_QUESTION_CHARS, MAX_BODY_BYTES, MAX_OUTPUT_TOKENS, MAX_OUTPUT_CHARS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_REQUESTS });
module.exports = handler;
