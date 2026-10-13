# Test results

Last checked: 13 October 2026

## Automated checks

- `node --test tests/finance.test.cjs` — **23 passed, 0 failed**. Includes the saved live Bangladesh Bank HTML fragment, mocked endpoint success/error behavior and cache headers, rate direction, bid/ask/WAR, malformed and stale data, timeouts/network errors, manual-safe fallback, and retained Phase 1/2 financial and quote tests.
- JavaScript syntax checks — passed for `app.js`, `lib/finance.js`, `lib/exchange-rates.js`, `lib/bangladesh-bank-rates.js`, `api/exchange-rates.js`, `tests/finance.test.cjs`, and `data/finance-guidance.js`.
- `git diff --check` — passed.

The rate-sheet fixture at `tests/fixtures/bangladesh-bank-live-2026-10-13.html` contains the actual publication label and the two rate tables extracted from the official page's live browser DOM on 13 October 2026. The existing parser successfully parsed that saved fragment. Separate endpoint failure tests use mocks; the suite does not require Bangladesh Bank to be online. No browser test of the app or deployed endpoint has been performed.

## Live source verification

On 13 October 2026, the official Bangladesh Bank page loaded in the browser with a sheet effective 13 October. Its live DOM contained only two tables: a USD/BDT table and the current cross-rate table. Parsing the saved live HTML fragment extracted USD bid 123.3000, ask 123.4000, WAR 123.3600, GBP bid/ask 162.8300/163.0484, and CAD bid/ask 86.3264/86.4025; the cross table also contained EUR, AUD, JPY, SEK, SGD, CNH, INR, and LKR, which were not treated as the requested corridors. The linked PDF was readable and agreed with these values; the current XLS link was identified but the browser reader could not parse the XLS file. A direct Node fetch from the project runtime failed during TLS setup, so no raw HTTP status was obtained there. The Vercel endpoint has not been deployed, and no request to `/api/exchange-rates` has been made.

## Manual checks still needed

1. Deploy to a Vercel preview and request `/api/exchange-rates`; confirm it returns source, publication date, retrieval time, GBP/USD/CAD bid and ask, and USD WAR.
2. Load the site. Confirm the initial automatic request works; refresh shows loading/errors; the official publication date and retrieval time are visible; the ASK estimate applies only after clicking **Use this official rate**; and manual inputs remain unchanged when fetch fails.
3. Confirm a sheet older than five calendar days or a response retrieved more than two hours ago is marked stale and cannot be applied. Confirm a 502/upstream error leaves manual entry usable.
4. Repeat the planner and quote journeys at desktop and mobile widths. Phase 1/2 unit tests pass, but those UI journeys have not been browser-tested.

The official page is HTML-scraped because a documented JSON API was not found. Its markup can change; the parser fails closed rather than substituting another provider or inventing rates. The API route requires Vercel; opening `index.html` directly without hosting it on Vercel leaves manual rate entry available but cannot provide the official rate request.
