# CampusBridge AI

CampusBridge AI is a FinTechathon 2026 project: a student-facing study-abroad finance planning prototype. It helps students organize their own cost, savings, exchange-rate, and payment assumptions. The financial engine performs the calculations and validation locally; the AI assistant provides general explanations and does not provide authoritative financial calculations.

The app does not connect to a bank, verify manually entered provider quotes, initiate payments, or guarantee affordability, exchange rates, admission, visas, or funding. See the project documentation for verified behavior and limits.

## 🚀 Live Demo

**Try CampusBridge AI:** https://fintech-kappa-umber.vercel.app/

Explore the live application to see how CampusBridge AI helps international students plan their study-abroad finances.

## What is in the project

- **Planner (`/planner.html`)** — all-cost and tuition-only estimates, saved plan state for this tab, contribution schedule, rate lookup, quote comparison, stress scenarios, and report actions.
- **Roadmap (`/roadmap.html`)** — dated schedule based on full 30-day contribution intervals.
- **Savings Tracker (`/savings.html`)** — local-only roadmap snapshots and student-entered BDT deposit records, with JSON backup and restore.
- **Transfers (`/transfers.html`)** — comparison of student-entered provider quotes; quotes are not verified provider offers.
- **AI Assistant (`/assistant.html`)** — local deterministic answers for selected saved-plan questions, and general educational answers through the AI API. Signed-in chat history is stored in Supabase; signed-out chat is temporary.
- **Account (`/account.html`)** — Supabase email/password and Google sign-in flows, recovery, optional authenticator MFA, and cloud-saved plans.
- **Stress Tests and Report** — independent local scenarios and a browser-generated report.

## Technology and architecture

The frontend is static HTML, CSS, and browser JavaScript. Shared finance, state, quote, rate, and chat logic lives in `lib/`. The `api/` directory contains Vercel serverless functions for the assistant and Bangladesh Bank rate lookup. Supabase JS v2 is loaded from a browser CDN for Auth and account-backed storage. The server-side OpenAI-compatible SDK calls Groq for general assistant answers.

Start with the [technical documentation](docs/TECHNICAL_DOCUMENTATION.md). Supporting references cover [system architecture](docs/architecture.md), [financial methodology and assumptions](docs/financial-algorithms.md), [security and data handling](docs/security-report.md), and [testing and deployment](docs/test-results.md).

## Requirements

- Node.js 22 or newer.
- npm (included with Node.js).
- For local API routes, the Vercel CLI through `npx` and network access.
- For remote AI answers, a Groq API key configured as the server-side environment variable `GROQ_API_KEY`.

The AI API uses server-side `GROQ_API_KEY`; `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`. Signed-in saved-conversation verification also requires server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. These let the API verify the user's session and check that the selected conversation and latest question belong to that user under RLS. Earlier saved-chat messages are not sent by default; opting in sends bounded recent messages from that same conversation for the current answer. Use only the publishable key, never a service-role or secret key. The browser's Supabase configuration remains in `js/supabase-config.js`. No actual environment values are included here.

The names and safe placeholder formats are:

```dotenv
# Required for remote AI answers
GROQ_API_KEY=your_groq_api_key_here

# Optional; defaults to openai/gpt-oss-20b
GROQ_MODEL=openai/gpt-oss-20b

# Required by the API when verifying signed-in saved-chat references
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
```

These are examples, not working credentials. The Supabase URL and publishable key used by browser Auth are separately configured in `js/supabase-config.js`. Never put a service-role key or Groq key in browser code.

## Run locally on Windows

Open PowerShell in the project folder. Check Node:

```powershell
node --version
```

Install the dependency versions recorded by the lockfile:

```powershell
npm ci
```

For the full site with Vercel API routes, create the ignored local environment file from the safe example and edit it with your Groq key and the Supabase project URL and publishable key:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
npx vercel@latest dev --listen 3000
```

Open `http://localhost:3000`. The `.env.local` file is ignored by Git. Keep its values private. Without `GROQ_API_KEY`, the assistant API returns a configuration error; local deterministic planner answers still work. Supabase sign-in and cloud features also depend on the configured Supabase project, network access, database tables/policies, and allowed redirect URLs. The repository cannot verify the live project setup.

For a static-only preview without serverless APIs:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`. The static server does not implement `/api`; remote AI and exchange-rate refresh will not work there.

To run automated checks:

```powershell
node --test tests/*.test.cjs
git diff --check
```

See [testing and deployment](docs/test-results.md) for what these checks cover and what still needs a live review.

## API routes

- **`POST /api/assistant`** — sends an educational question to Groq. Requests are limited to 1,000 question characters and 4,096 JSON bytes; the server applies an in-memory per-IP limit of 12 requests per 15 minutes per function instance. Saved-chat context is off by default. When a signed-in user opts in, the server verifies the conversation and latest message before loading bounded history. It does not accept financial plans, balances, or quotes from the browser as model context. Deterministic planner calculations remain local.
- **`GET /api/exchange-rates`** — retrieves and validates Bangladesh Bank reference-rate data. Successful responses use a 24-hour shared-cache TTL; failures return an error rather than an invented fallback. This reference rate is not a transfer quote or guaranteed transaction rate. Live CDN cache behavior is not verified by local tests.

See the [technical documentation](docs/TECHNICAL_DOCUMENTATION.md) for request/error details and implementation limits.

## Deployment notes

The repository follows Vercel's `api/` function convention and has no checked-in `vercel.json` or build script. For an existing Vercel project, confirm its repository, production branch, root directory, and environment-variable scopes in the Vercel dashboard. Review a preview deployment first. If the project is Git-connected, a push may start a deployment according to that project's settings; this repository does not establish whether automatic deployment is enabled or which branch is production. Do not use a production deploy command until the intended Vercel project and deployment target have been confirmed. See the [deployment checklist](docs/test-results.md#deployment-review-checklist).

## Troubleshooting

- **`npm ci` fails:** confirm Node.js is version 22 or newer, then run the command from the repository root where `package-lock.json` is located.
- **Port 3000 is already in use:** stop the other local server or choose another port with Vercel CLI's `--listen` option.
- **The API routes do not work on port 8000:** `py -m http.server` serves static files only. Use `npx vercel@latest dev --listen 3000` to run `/api` functions locally.
- **Remote assistant says it is not configured:** check that `GROQ_API_KEY` is set privately in `.env.local` or the correct Vercel environment scope. Do not print or paste the value into logs or chat.
- **Saved signed-in chat cannot be verified:** check that server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are configured, the browser client points to the intended Supabase project, and the required chat tables and RLS policies have been applied there. The repository cannot confirm live database setup.
- **Exchange-rate request fails:** the parser depends on Bangladesh Bank's published HTML layout and the local API route must be running. Check the displayed source, publication date, retrieval time, and stale label; use a manually entered rate only with a source and timestamp you have checked.
- **`npm test` reports a missing script:** this repository has no `test` script. Run `node --test "tests/*.test.cjs"` instead.

## Data storage at a glance

| Data | Where it is stored | What it means |
| --- | --- | --- |
| Current planner profile and stress inputs | This tab's `sessionStorage` | Validated working state shared by pages in the same tab; not encrypted or an account backup. |
| Signed-in AI chat | Supabase `assistant_conversations` and `assistant_messages` | User questions and displayed answers. The SQL migration is in `docs/supabase-assistant-chat.sql`; whether it is installed in any live project is unverified. |
| Cloud-saved plan copies | Supabase `saved_plans` | Separate, explicitly saved plan input copies. Live schema and RLS policies require verification. |
| Savings Tracker data | This browser profile's `localStorage` | Roadmaps and student-entered deposits; not synced to accounts or devices. JSON backup/restore is available. |

AI requests include the current question and, when a valid browser plan exists, a compact summary of deterministic cost, funding, dated savings, exchange-rate, linked tracker, and eligible entered-quote results. The assistant explains and assesses those supplied results but cannot change them. Full form fields, account details, tracker notes, and quote references are excluded. Tracker deposits and payment quotes remain student-entered and unverified. A signed-in user can additionally opt in to sharing bounded recent messages from the selected saved chat. Signed-in chat persistence separately stores user questions and displayed answers in Supabase. Avoid sensitive personal or account details in chat history.
