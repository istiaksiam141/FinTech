"use strict";

const { randomUUID } = require("node:crypto");
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_QUESTION_CHARS = 1000;
const MAX_BODY_BYTES = 4096;
const MAX_OUTPUT_TOKENS = 4096;
const MAX_OUTPUT_CHARS = 16000;
const GROQ_REQUEST_TIMEOUT_MS = 30000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 12;
const SYSTEM_PROMPT = "You are CampusBridge AI, a helpful explainer for students planning overseas tuition payments. Give a direct, accurate answer first, followed by enough explanation to help the student understand. Adapt the length to the actual question and do not pad answers just to use the available output. For a simple question, usually answer in about two to four sentences and include one relevant example when useful. For an ordinary explanatory question, use a few clear paragraphs or three to six useful bullet points. For a complex question, give a structured, more detailed explanation with helpful examples and important caveats. Use natural, simple English and Markdown that is clear and easy to read; use headings only when they help organize a genuinely detailed answer. Avoid filler, repetition, unnecessary introductions, and excessive formatting. Finish each explanation, example, list, and sentence before stopping; prioritize the direct answer and essential details over optional detail if space is limited. Never begin a table unless you can finish it; prefer brief prose or useful bullets for comparisons. If you are unsure or the question lacks essential context, say so plainly and ask one focused clarifying question rather than guessing. Never invent facts, rates, fees, dates, statistics, provider offers, quote validity, or verification claims, and never claim to have accessed live data or completed an action unless that actually happened. You receive only the user's question, not their financial profile, exchange rates, or provider quotes. Never calculate or invent personal financial figures or savings projections. Direct personal plan calculations to the deterministic local planner. This is educational information, not financial advice.";

function trimToNaturalBoundary(text, maxLength) {
  if (text.length <= maxLength) return text.trim();
  const prefix = text.slice(0, maxLength);
  const minimumBoundary = Math.floor(maxLength * 0.6);
  const lastLine = prefix.lastIndexOf("\n");
  if (lastLine >= minimumBoundary) return prefix.slice(0, lastLine).trimEnd();
  const sentenceEndings = [...prefix.matchAll(/[.!?](?:[\"'’”)}\]]*)\s+/g)];
  const lastSentence = sentenceEndings.at(-1);
  if (lastSentence && lastSentence.index + lastSentence[0].length >= minimumBoundary) {
    return prefix.slice(0, lastSentence.index + lastSentence[0].trimEnd().length).trimEnd();
  }
  const wordBoundary = prefix.lastIndexOf(" ");
  return (wordBoundary >= minimumBoundary ? prefix.slice(0, wordBoundary) : prefix).trimEnd();
}

function trimIncompleteTail(text) {
  const minimumBoundary = Math.floor(text.length * 0.5);
  const lastLine = text.lastIndexOf("\n");
  if (lastLine >= minimumBoundary) return text.slice(0, lastLine).trimEnd();
  const sentenceEndings = [...text.matchAll(/[.!?](?:[\"'’”)}\]]*)\s+/g)];
  const lastSentence = sentenceEndings.at(-1);
  if (lastSentence && lastSentence.index + lastSentence[0].length >= minimumBoundary) {
    return text.slice(0, lastSentence.index + lastSentence[0].trimEnd().length).trimEnd();
  }
  return text.trimEnd();
}

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
          : new OpenAI({ apiKey, baseURL: GROQ_BASE_URL, timeout: GROQ_REQUEST_TIMEOUT_MS, maxRetries: 0 });
      }
      const model = typeof env.GROQ_MODEL === "string" && /^[A-Za-z0-9._:/-]{1,100}$/.test(env.GROQ_MODEL) ? env.GROQ_MODEL : DEFAULT_MODEL;
      const result = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question }
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS
      });
      const choice = result.choices?.[0];
      const output = choice?.message?.content;
      const rawAnswer = typeof output === "string" ? output.trim() : "";
      const incomplete = choice?.finish_reason === "length" || rawAnswer.length > MAX_OUTPUT_CHARS;
      let answer = incomplete ? trimToNaturalBoundary(rawAnswer, MAX_OUTPUT_CHARS) : rawAnswer;
      if (choice?.finish_reason === "length") answer = trimIncompleteTail(answer);
      if (!answer) {
        console.error("CampusBridge assistant returned no usable output", { requestId, code: "EMPTY_MODEL_OUTPUT" });
        return sendJson(response, 502, { error: "The AI assistant returned no usable answer. Local guidance is still available.", requestId });
      }
      return sendJson(response, 200, { answer, incomplete });
    } catch (error) {
      console.error("CampusBridge Groq request failed", { requestId, ...safeDiagnostic(error) });
      return sendJson(response, 502, { error: "The AI assistant is temporarily unavailable. Local guidance is still available.", requestId });
    }
  };
}

const handler = createAssistantHandler();
handler.createAssistantHandler = createAssistantHandler;
handler.createRateLimiter = createRateLimiter;
handler.constants = Object.freeze({ DEFAULT_MODEL, GROQ_BASE_URL, SYSTEM_PROMPT, MAX_QUESTION_CHARS, MAX_BODY_BYTES, MAX_OUTPUT_TOKENS, MAX_OUTPUT_CHARS, GROQ_REQUEST_TIMEOUT_MS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_REQUESTS, safeDiagnostic, trimToNaturalBoundary, trimIncompleteTail });
module.exports = handler;
