# Test results

Last checked locally: 19 October 2026

## Automated checks

- `node --test tests/*.test.cjs` — **80 passed, 0 failed**. Includes finance formulas and boundaries, quote validation, currency conversions, Bangladesh Bank parsing/cache behavior, assistant request/security behavior, renderer safety, route structure, shared navigation, tab-scoped plan-state validation, and stress-input restoration/recalculation.
- `node --check` across JavaScript files under `js/` and `lib/` — passed.
- `git diff --check` — passed with no whitespace errors. Git printed only its normal CRLF conversion notices for edited Markdown/HTML files.

## Browser and deployment checks

Browser verification was attempted using a local HTTP server, but the browser could not reach the local listener in this environment (`ERR_CONNECTION_TIMED_OUT`; the shell also reported socket access was forbidden). Therefore page rendering, mobile navigation, real session-storage navigation, and the print dialog have **not** been browser-verified here. No Vercel deployment or live API request was performed.

The static route tests confirm that each HTML file exists, has a title and page key, loads the shared shell, and includes its page-specific script. They also check that literal `getElementById` references in those scripts have matching page IDs. Those checks do not substitute for real browser execution.

## Existing Bangladesh Bank fixture evidence

The checked-in fixture `tests/fixtures/bangladesh-bank-live-2026-10-13.html` contains the saved fragment previously captured from the official page on 13 October 2026. Tests validate parser and endpoint behavior against that fixture and mocks without requiring the bank to be online. That is fixture verification, not a current live-source check.
