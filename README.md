# CampusBridge AI

Student accounts and cloud-saved plans are implemented and described in [docs/supabase-setup.md](docs/supabase-setup.md). `js/supabase-config.js` already contains the browser-safe Supabase URL and publishable key. Production authentication redirects, provider settings, and database Row Level Security (RLS) still need verification; production setup has not been confirmed.

CampusBridge AI is a static multi-page financial-planning prototype for students preparing for study abroad. It reuses one local calculation engine to estimate tuition and other entered costs, savings needs, dated contribution cycles, stress scenarios, and report data. These estimates are not guarantees and do not execute payments.

## Pages

- `/` — Home and links to the tools.
- `/planner.html` — Authoritative plan inputs, both planning modes, results, rates, roadmap, transfer quote entry, assistant, stress tests, and report actions.
- `/roadmap.html` — Dated contribution schedule from the saved plan.
- `/stress-tests.html` — Rate, expense, and missed-contribution scenarios on copies of the plan.
- `/transfers.html` — Compare manually entered, unverified provider quotes.
- `/assistant.html` — General AI explanations and deterministic local answers for selected plan questions.
- `/report.html` — Local readiness report with browser printing / Save as PDF.
- `/account.html` — Email/password and Google authentication, recovery, and cloud-saved plan management.
- `/privacy.html` — Session storage details and product limitations.

The shared shell is in `js/site.js` and `styles/site.css`. `lib/plan-state.js` stores a versioned, validated minimum plan snapshot in tab-scoped `sessionStorage`; it does not store report names, account labels, credentials, API keys, or tokens. Clearing the plan is available in the navigation. The planner is the only place where the baseline plan is created or updated.

`lib/finance.js` remains the authoritative deterministic calculation engine. The Bangladesh Bank reference-rate endpoint stays at `/api/exchange-rates`; general AI questions use `/api/assistant`. The browser sends only `{ question }` to the assistant endpoint. No student financial profile or transfer quote is sent to the AI service.

## Run locally

Requirements: Node.js 22 or newer. For the full API-backed experience, install the existing server dependency and use the Vercel development server:

```powershell
npm install
npx vercel dev
```

Open the local URL shown by Vercel. To test the AI endpoint locally, create an ignored `.env.local` file with `GROQ_API_KEY=...`; keep the key out of source files and Git. Exchange-rate refresh uses the Bangladesh Bank endpoint through the local serverless route.

To serve only static pages without serverless APIs, run `py -m http.server 8000` and open `http://localhost:8000/`. Manual calculations and saved-plan pages work; exchange refresh and remote AI requests will be unavailable on that static-only server.

Run all tests with Node's built-in test runner:

```powershell
node --test tests/*.test.cjs
git diff --check
```

## Boundaries

The browser stores the minimum current plan in tab session storage to share it across pages. This storage is not encrypted. Rates are references, manual quote entries are not authenticated, there is no connected bank account, and the site does not initiate transfers. See `docs/` for calculation, security, and production boundaries.
