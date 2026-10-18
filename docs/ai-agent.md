# Assistant behavior

## Two answer paths

The planner and feature pages use deterministic local calculations for funding gaps, contribution targets, budgets, and quote comparisons. The assistant page can answer selected questions about the current saved plan locally; those values are recalculated through `lib/finance.js`. For general questions, it sends only `{ question }` to `/api/assistant`. The saved profile, account balances, report data, and quotes are never attached to the remote request.

The remote endpoint is hosted in `api/assistant.js` and calls Groq's OpenAI-compatible API. The default model is `openai/gpt-oss-20b`; `GROQ_MODEL` may override it. The API key comes from the server environment as `GROQ_API_KEY` and is never included in browser code or stored plan state. The endpoint rejects additional request fields, validates JSON, applies a 1,000-character question limit and 4 KB body limit, requests at most 4,096 completion tokens, returns at most 16,000 characters, and uses a 30-second SDK timeout. Output-limit and server-cap conditions are marked incomplete for the client. Provider errors returned to clients are generic.

The system instructions request direct, accurate answers in natural English, with detail matched to the question. They discourage filler and excessive formatting, require uncertainty to be stated, prohibit invented rates or payment offers, and direct personal financial calculations back to the deterministic planner. Answers are educational, not personalized financial advice. Markdown is rendered with safe DOM operations; model HTML is not executed and only safe HTTP(S) links are allowed.

If the key is missing or the provider fails, the endpoint returns a safe error and the UI continues to offer local planning. Do not log prompt or response text, add financial context to requests, or expose keys in source files.

## Operations

Set `GROQ_API_KEY` as a private server environment variable in Vercel or a local ignored `.env.local` file. `GROQ_MODEL` is optional. The endpoint's in-memory per-IP limiter is instance-local and does not provide global abuse protection. Provider access, account limits, and model availability depend on the Groq account configuration.
