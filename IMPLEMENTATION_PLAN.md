# CampusBridge AI implementation status

## Current architecture

CampusBridge is a static multi-page site. `/` is the home page; `/planner.html` owns the baseline plan; roadmap, stress tests, transfers, assistant, report, and privacy have dedicated routes. Shared navigation, active-page indication, mobile menu, footer, and the session-storage disclosure are handled by `js/site.js`. Shared styles are in `styles/site.css`.

## Shared data and calculations

- `lib/finance.js` remains the authoritative calculation and quote-validation module.
- `lib/plan-state.js` writes only validated plan fields and optional stress-test input assumptions to versioned tab-scoped `sessionStorage`; dependent pages recalculate scenario outputs.
- The planner recalculates and replaces the current saved plan. Dependent pages validate restored data and show an empty state when it is missing or invalid.
- The optional report name and manual account labels are not persisted. Clear Plan requires confirmation.
- The existing `/api/exchange-rates` and `/api/assistant` Vercel routes remain at their original paths.

## Product boundaries

Bangladesh Bank rates are references, and student-entered transfer quotes are not authenticated. The AI service receives only a question; local financial profiles and quotes are not sent to it. The browser does not connect to bank accounts, initiate transfers, or guarantee financial outcomes.

## Verification

Run `node --test tests/*.test.cjs` and `git diff --check` after changes. Browser, Vercel deployment, and live provider behavior require separate checks and must not be inferred from unit tests.
