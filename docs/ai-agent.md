# Assistant behavior

## Two answer paths

The planner and feature pages use deterministic local calculations for funding gaps, contribution targets, budgets, and quote comparisons. The shared `lib/assistant-task.js` routes supported funding, savings, budget, rate-provenance, and quote-comparison requests to those existing finance functions. It uses the validated current plan on the planner or the recalculated plan saved for the current browser tab on the Assistant page. Missing or invalid plan data prompts the user to complete the planner; it is not filled in by the model. Quote comparisons use only entries accepted by `Finance.compareEnteredQuotes` and are labeled student-entered and unverified. A saved rate response displays its saved source and timestamp and does not claim that the rate is still current.

For general questions not handled locally, the browser sends only `{ question }` to `/api/assistant`. The saved profile, account balances, report data, quotes, and previous chat messages are never attached to the remote request. Signed-in chat history is separately stored in Supabase; signed-out chat is temporary. See [security and data handling](security-report.md).

The remote endpoint is hosted in `api/assistant.js` and calls Groq's OpenAI-compatible API. The default model is `openai/gpt-oss-20b`; `GROQ_MODEL` may override it. The API key comes from the server environment as `GROQ_API_KEY` and is never included in browser code or stored plan state. The endpoint rejects additional request fields, validates JSON, applies a 1,000-character question limit and 4 KB body limit, requests at most 4,096 completion tokens, returns at most 16,000 characters, and uses a 30-second SDK timeout. Output-limit and server-cap conditions are marked incomplete for the client. Provider errors returned to clients are generic.

The system instructions request direct, accurate answers in natural English, with detail matched to the question. They discourage filler and excessive formatting, require uncertainty to be stated, prohibit invented rates or payment offers, and direct personal financial calculations back to the deterministic planner. Answers are educational, not personalized financial advice. Markdown is rendered with safe DOM operations; model HTML is not executed and only safe HTTP(S) links are allowed.

If the key is missing or the provider fails, the endpoint returns a safe error and the UI continues to offer local planning. Do not log prompt or response text, add financial context to requests, or expose keys in source files.

## Operations

Set `GROQ_API_KEY` as a private server environment variable in Vercel or a local ignored `.env.local` file. `GROQ_MODEL` is optional. The endpoint's in-memory per-IP limiter is instance-local and does not provide global abuse protection. Provider access, account limits, and model availability depend on the Groq account configuration.

For a signed-in user, the browser saves the submitted question and displayed answer in `assistant_conversations` and `assistant_messages` through the existing Supabase client. The browser's user-ID filters are defense in depth; the intended row boundary is the RLS policy in [`supabase-assistant-chat.sql`](supabase-assistant-chat.sql). This SQL is a migration artifact and its application to a live project is unverified. Signed-out chats are rendered only in the current page and are lost on refresh. Chat persistence does not change the Groq request contract and does not submit earlier turns to the model.
