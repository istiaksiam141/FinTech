# CampusBridge AI

CampusBridge AI is a FinTechathon 2026 project: a student-facing study-abroad finance planning prototype. It helps students organize their own cost, savings, exchange-rate, and payment assumptions. The financial engine performs the calculations and validation locally; the AI assistant provides general explanations and does not provide authoritative financial calculations.

The app does not connect to a bank, verify manually entered provider quotes, initiate payments, or guarantee affordability, exchange rates, admission, visas, or funding. See the project documentation for verified behavior and limits.

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

See [system architecture](docs/architecture.md), [financial methodology and assumptions](docs/financial-algorithms.md), [security and data handling](docs/security-report.md), and [testing and deployment](docs/test-results.md).

## Requirements

- Node.js 22 or newer.
- npm (included with Node.js).
- For local API routes, the Vercel CLI through `npx` and network access.
- For remote AI answers, a Groq API key configured as the server-side environment variable `GROQ_API_KEY`.

The AI API uses server-side `GROQ_API_KEY`; `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`. Signed-in saved-conversation verification also requires server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. These let the API verify the user's session and check that the selected conversation and latest question belong to that user under RLS. Prior message text is not sent to Groq. Use only the publishable key, never a service-role or secret key. The browser's Supabase configuration remains in `js/supabase-config.js`. No actual environment values are included here.

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
Copy-Item .env.example .env.local
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

## Data storage at a glance

| Data | Where it is stored | What it means |
| --- | --- | --- |
| Current planner profile and stress inputs | This tab's `sessionStorage` | Validated working state shared by pages in the same tab; not encrypted or an account backup. |
| Signed-in AI chat | Supabase `assistant_conversations` and `assistant_messages` | User questions and displayed answers. The SQL migration is in `docs/supabase-assistant-chat.sql`; whether it is installed in any live project is unverified. |
| Cloud-saved plan copies | Supabase `saved_plans` | Separate, explicitly saved plan input copies. Live schema and RLS policies require verification. |
| Savings Tracker data | This browser profile's `localStorage` | Roadmaps and student-entered deposits; not synced to accounts or devices. JSON backup/restore is available. |

The assistant sends only the current general question to Groq. A selected plan question may be calculated locally by the deterministic finance engine. The signed-in chat persistence path separately sends chat messages to Supabase. Do not include sensitive personal or account details in assistant questions.
