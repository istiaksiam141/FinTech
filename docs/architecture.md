# System architecture

## Verified project shape

CampusBridge AI is a static multi-page HTML/CSS/JavaScript application with shared browser modules. There is no frontend build step declared in `package.json`. The `api/` directory contains Vercel serverless functions. The package manifest pins the `openai` SDK dependency; the browser loads Supabase JS v2 from jsDelivr.

The repository identifies CampusBridge AI as a FinTechathon 2026 project for students planning study abroad. No competition-specific requirements, endorsement, or judging outcome is inferred here.

## Main components

| Component | Responsibility |
| --- | --- |
| `app.js`, `js/*-page.js` | Page interaction and rendering. The planner remains the primary source for plan inputs. |
| `lib/finance.js` | Validates financial inputs and calculates estimates, contribution schedules, stress scenarios, and quote eligibility/ranking. |
| `lib/assistant-task.js` | Routes supported assistant tasks through existing deterministic finance functions using current validated planner state; it does not send that state to the AI endpoint. |
| `lib/plan-state.js` | Stores a versioned allowlist of validated current planner inputs and stress inputs in tab-scoped `sessionStorage`; dependent pages recalculate from the inputs. |
| `lib/bangladesh-bank-rates.js`, `lib/exchange-rates.js` | Fetch/parse/validate official rate sheet data and map it into planner rates. |
| `lib/cloud-plans.js` | Authenticated, validated operations on Supabase `saved_plans`. |
| `lib/assistant-chat.js` | Authenticated conversation and message queries using Supabase RLS. |
| `lib/savings-tracker.js` | Validates and stores Savings Tracker roadmaps/deposits in browser `localStorage`, including JSON backup/restore. |
| `api/exchange-rates.js` | Serverless handler that fetches Bangladesh Bank rates and sets cache headers. |
| `api/assistant.js` | Serverless endpoint that accepts one question and calls Groq through its OpenAI-compatible API. |
| `js/supabase-client.js` | Creates one Supabase JS client from `js/supabase-config.js` and persists the Supabase Auth session using client defaults. |

## Browser routes

| Route | Responsibility |
| --- | --- |
| `/` | Introduction and navigation. |
| `/planner.html` | Baseline inputs, calculations, rates, quote comparison, stress tools, and report actions. |
| `/roadmap.html` | Dated contribution schedule derived from the saved plan inputs. |
| `/savings.html` | Browser-local historical roadmaps, deposits, comparison, and backup/restore. |
| `/stress-tests.html` | Independent rate, expense, and missed-contribution scenarios. |
| `/transfers.html` | Student-entered quote validation and comparison. |
| `/assistant.html` | Local answers for selected plan questions; general questions go to the assistant endpoint. Signed-in chat is also saved to Supabase. |
| `/report.html` | Locally generated readiness report and browser print flow. |
| `/account.html` | Supabase email/password and Google auth flows, recovery, optional TOTP MFA, and cloud-plan actions. |
| `/privacy.html` | Storage and product boundaries. |

`js/site.js` supplies the shared navigation and footer. `styles/site.css` contains shared screen and print styles. Page scripts load after their declared DOM elements. The app uses same-origin routes when served through Vercel.

## Data and request flows

### Financial planning

1. The user enters profile inputs and a sourced rate in the browser.
2. `lib/finance.js` validates and calculates deterministic results locally.
3. `lib/plan-state.js` saves only allowlisted inputs and scenario inputs in the current tab's `sessionStorage`.
4. Dependent pages restore and validate those inputs, then recalculate. Calculation output is not trusted as persisted input.
5. Reports are generated locally; they are not sent to either API route.

### Exchange rates

1. The browser requests `/api/exchange-rates`.
2. `api/exchange-rates.js` calls the Bangladesh Bank page through `lib/bangladesh-bank-rates.js`.
3. The parser validates the publication date, currency rows, bid/ask layout, numeric values, and response type; malformed or failed data returns an error rather than an invented fallback.
4. The handler marks success responses for Vercel shared CDN caching with a 24-hour TTL. This is a best-effort regional cache, not a global cache guarantee.

### AI and chat history

1. The shared assistant task router uses validated current planner state and `lib/finance.js` for supported funding, savings, budget, rate-provenance, and quote-comparison tasks. Missing inputs are not guessed.
2. For general questions, the browser sends the current question and, for a saved signed-in chat, its conversation ID and current user-message ID. It does not send earlier messages.
3. `api/assistant.js` verifies the access token through Supabase Auth and confirms conversation ownership under the user's JWT and existing RLS policies. It checks that the referenced message is the latest user message in that conversation and matches the submitted question.
4. Raw prior conversation text is not sent to Groq. Arbitrary natural-language messages cannot be reliably classified as free of financial or identifying details, so the endpoint sends only the current question after verifying its saved references. No saved plans, balances, quotes, or other database records are loaded as model context.
5. For a signed-in user, `lib/assistant-chat.js` separately saves the question and displayed answer in `assistant_messages`, associated with `assistant_conversations`. The browser lists and filters by the authenticated user ID; intended authorization is enforced by the policies in `docs/supabase-assistant-chat.sql`.
6. Signed-out chat remains in page memory only and sends the current question without saved-history context. The conversation SQL file is a reviewed migration artifact; this repository cannot confirm it has been applied to any Supabase project.

### Supabase account data

Supabase Auth supports the existing email/password and Google sign-in code, recovery, and optional TOTP MFA. Cloud plans are stored separately in `saved_plans` through `lib/cloud-plans.js`; only validated plan inputs are stored and the planner recomputes results on load. Both chat and cloud-plan operations use the shared Supabase browser client. RLS is the database authorization boundary; live schemas and policies are not available for verification from this repository.

### Savings Tracker

The Savings Tracker is separate from Supabase. It stores versioned records under `campusbridge.savings-tracker.v1` in browser `localStorage`: validated roadmap profile/snapshot pairs and student-entered BDT deposits. JSON imports are validated and replace current tracker data only after an explicit confirmation. Records are not account-synced or bank-verified.

## Technology and deployment shape

- HTML, CSS, browser JavaScript; no bundler/build command in `package.json`.
- Node.js `>=22`; npm lockfile and `openai` SDK dependency.
- Vercel function convention for `/api/exchange-rates` and `/api/assistant`; no `vercel.json` was found during repository review.
- Supabase JS v2 browser CDN for Auth and data operations.
- Environment variables used by the server: `GROQ_API_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`; `GROQ_MODEL` is optional (defaults to `openai/gpt-oss-20b`). The Supabase URL and publishable key are also in browser configuration; values are intentionally not repeated here. The assistant history route never uses a service-role key.

The repo does not prove the active Vercel project, production environment-variable configuration, domain, or live Supabase schema/provider settings. See [testing and deployment](test-results.md) and [Supabase setup](supabase-setup.md).
