# Testing and deployment guide

## Beginner-friendly local setup (Windows / PowerShell)

Use Node.js 22 or newer. From the repository folder, check your version and install the dependencies recorded in the lockfile:

```powershell
node --version
npm ci
```

For the site and its Vercel serverless API routes, make a local environment file from the placeholder example, edit it privately, then start Vercel's development server:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npx vercel@latest dev --listen 3000
```

The required application environment variable is `GROQ_API_KEY`; `GROQ_MODEL` is optional and defaults in code to `openai/gpt-oss-20b`. Do not paste key values into source code, documentation, chat, screenshots, or Git. `.env.local` is ignored by Git. Supabase's URL and browser-safe publishable key are configured in `js/supabase-config.js`; no Supabase environment variables are read by the static browser code.

Open `http://localhost:3000`. Local sign-in and account-backed data still depend on the configured Supabase project and its schema, policies, provider settings, and redirect allowlist. The SQL files are review artifacts, not evidence that SQL has been applied.

For a static-only preview, use a separate PowerShell window:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000`. This server does not run `/api` functions, so remote AI and rate refresh are unavailable; deterministic calculations and browser-local features can still be explored.

## Automated checks

Run the complete existing suite and whitespace check from the repository root:

```powershell
node --test tests/*.test.cjs
git diff --check
```

Tests use Node's built-in test runner and mocks/fixtures where appropriate. They cover calculation boundaries, date handling, exchange-rate parsing and validation, quote rules, assistant request shape and limits, safe answer rendering, auth-state handling, MFA flows, Supabase client operations, chat behavior, storage, and static page structure. They do not prove deployed browser rendering, live provider behavior, live Supabase RLS, or production configuration.

The Bangladesh Bank fixture under `tests/fixtures/` is saved sample HTML, not a live quote check. Local unit tests for assistant-chat client operations do not run the SQL migration or connect to a live database. `git diff --check` checks whitespace only.

## Current local verification

This section records the latest run performed during the current documentation audit. It must be refreshed after later code changes; do not treat it as a permanent quality or deployment claim.

Run date: **19 October 2026**. Runtime: **Node.js v24.21.0**, npm v11.19.0.

- `node --test tests/*.test.cjs` — **126 passed, 0 failed**.
- `git diff --check` — passed. Git printed LF-to-CRLF working-copy notices for edited Markdown files; no whitespace errors were reported.

The run passed repository tests only. It did not apply SQL, inspect live Supabase/Vercel settings, contact live AI or bank services, or verify a browser/deployment.

## Deployment review checklist

The repository uses Vercel's `api/` serverless-function convention but has no checked-in `vercel.json`. No active Vercel project, build settings, deployment, domain, or production environment configuration was inspected. Treat these as items to verify, not known-good settings.

1. Confirm the intended Vercel project and repository root with the project owner. Review a preview deployment first. Check that static pages and both `/api` routes are included; do not invent build/output overrides if the project's current settings are unknown.
2. Set `GROQ_API_KEY` as a private Vercel server environment variable for the environments that should offer remote AI. `GROQ_MODEL` is optional. Never put a Groq key in browser code. Without the key, `/api/assistant` returns a configuration error.
3. Confirm that `js/supabase-config.js` targets the intended Supabase project. Its publishable key is browser-visible by design; do not replace it with a service-role or secret key. Confirm production Auth redirect URLs, email confirmation, and Google provider configuration in the Supabase dashboard.
4. Inspect the live `saved_plans` table and owner RLS policies before relying on cloud plans. For persistent AI chat, review `docs/supabase-assistant-chat.sql` and check whether both target tables already exist. Test the migration and two-user isolation in a non-production project before a database owner applies any migration. The repository cannot confirm whether this SQL has been applied.
5. Verify a preview manually: login/logout, plan save/load/delete, chat save/reopen/delete, cross-user isolation with separate test accounts, exchange-rate success/failure, and static-only fallbacks. Use synthetic test data, not real financial details.
6. Check browser console, API function logs, mobile layout, keyboard navigation, and print view. These checks are outside the automated Node suite.
7. Only the project owner should authorize production settings changes and deployment. This guide records the steps; it does not perform either action.

## SQL files and their status

- `docs/supabase-assistant-chat.sql` — intended additive schema for persistent signed-in AI chat. Review and test before applying; application status is unknown.
- `docs/supabase-mfa-rls.sql` — proposed saved-plan MFA policy; test-only/review-gated. It is not evidence of a live policy.
- `docs/supabase-mfa-test-setup.sql` — disposable test-project setup. Do not run against production.
- `docs/supabase-savings-tracker.sql` — legacy proposal. The current Savings Tracker is browser-local; do not run this file for it.
