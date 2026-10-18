# Architecture

CampusBridge is a static multi-page site with shared CSS and small page-specific browser scripts. No frontend framework, database, authentication system, or persistent account store is used.

## Routes and responsibilities

| Route | Responsibility | Main script |
| --- | --- | --- |
| `/` | Product overview and navigation | `js/site.js` |
| `/planner.html` | Authoritative plan form, calculation, and existing integrated tools | `app.js` |
| `/roadmap.html` | Dated contribution roadmap | `js/roadmap-page.js` |
| `/stress-tests.html` | Independent financial scenarios | `js/stress-tests-page.js` |
| `/transfers.html` | Student-entered quote validation and comparison | `js/transfers-page.js` |
| `/assistant.html` | General assistant and selected local plan explanations | `js/assistant-page.js` |
| `/report.html` | Local report built from the current plan and saved stress results | `js/report-page.js` |
| `/privacy.html` | Storage and product limitations | `js/site.js` |

`styles/site.css` holds shared visual and print styles. `js/site.js` creates the common navigation and footer, marks the active route, handles the mobile menu and confirmed Clear Plan action, and adds the session-storage notice. Each feature page loads only its own behavior module plus the shared page utilities it needs.

## Financial data flow

The planner calls `lib/finance.js` for validation and calculations. Other pages restore the validated profile using `lib/plan-state.js`, then call the same finance module for the roadmap, scenario results, quote checks, and report data. The state module uses an explicit schema version and field allowlists in tab-scoped `sessionStorage`; it rejects missing, malformed, outdated, unsupported, out-of-range, or otherwise invalid data. When present, stress-test scenario inputs are saved and their results are recalculated from the restored baseline; result numbers are not trusted from browser storage. It does not store a report-only name, account labels, API keys, tokens, or uploaded documents. `sessionStorage` is not encrypted and is not a user account backup.

The planner remains the place to create or update the baseline. A successful recalculation replaces the saved profile and clears old stress results. Stress tests use cloned inputs; the report reads the same saved profile and only the optional stress outputs generated from it. If no valid plan is stored, dependent pages show an empty state rather than inventing inputs.

The browser calls the existing Vercel routes `/api/exchange-rates` and `/api/assistant`. The Bangladesh Bank parser and rate metadata remain in `lib/bangladesh-bank-rates.js` and `lib/exchange-rates.js`; the serverless endpoint remains `api/exchange-rates.js`. The assistant endpoint is `api/assistant.js`; its request contract accepts only a question, and the API key remains server-side. No financial profile or quotes are sent to the model.

## Supported currencies and boundaries

The finance engine supports BDT and the existing destination currencies USD, EUR, GBP, AUD, JPY, CAD, SEK, SGD, CNH, INR, and LKR. CNH is offshore yuan and stays distinct from CNY. Reference exchange rates are not guaranteed student payment prices. Transfer comparison validates user-entered quotes but does not authenticate them or execute payments. The existing provider handoffs are links, not live provider integrations.

The Bangladesh Bank sheet is fetched and parsed server-side. Successful responses use Vercel's shared CDN response cache for a best-effort 24-hour regional TTL; this is not a globally atomic fetch guarantee. Assistant per-instance rate limiting is also not global. See `docs/production-boundaries.md` before considering a public launch.
