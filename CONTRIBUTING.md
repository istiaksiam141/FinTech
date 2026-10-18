# Contributing to CampusBridge AI

CampusBridge is a dependency-light static multi-page application with two existing Vercel function routes. Keep the current architecture unless a change is justified; do not add a framework, database, or external service without agreement.

## Where changes belong

- Shared navigation, mobile menu, and Clear Plan action: `js/site.js`.
- Shared visual and print styles: `styles/site.css`.
- Authoritative planner and calculations: `app.js` and `lib/finance.js`.
- Cross-page plan state: `lib/plan-state.js` with tests in `tests/plan-state.test.cjs`.
- Page-specific behavior: the matching `js/*-page.js` module.
- Existing APIs: `api/assistant.js` and `api/exchange-rates.js`.

All financial calculations and quote validation must stay in `lib/finance.js`; page modules call that engine rather than duplicating formulas. Assistant requests may contain only the user's question. Never place API keys or real student information in tracked files, fixtures, logs, screenshots, or commits.

## Development and verification

Use Node.js 22 or newer. Run `node --test tests/*.test.cjs` and `git diff --check`. Test planner calculations and dependent-page empty states when changing shared contracts. Do not claim browser, provider, or deployment verification unless it was actually performed.

The baseline profile is stored only after a successful calculation. Any schema changes to `lib/plan-state.js` must validate restored values, update its tests, and document the change. Keep the session-storage disclosure and Clear Plan behavior accurate.
