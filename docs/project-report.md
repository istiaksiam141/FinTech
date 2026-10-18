# CampusBridge AI — Project Report

**Project category:** Student financial planning<br>
**Competition theme:** FinTechathon 2026, Theme C<br>
**Implementation:** Static multi-page site with shared browser modules and two Vercel API routes<br>
**Report status:** Current repository implementation

## Summary

CampusBridge AI helps students organize their own study-abroad costs and savings assumptions. The planner estimates required funds, usable savings, funding gaps, contribution targets, projected savings capacity, and shortfall. Related pages display a dated roadmap, independent stress scenarios, manual transfer quote comparisons, AI explanations, a local financial report, and privacy limitations.

The planner and feature pages call the same deterministic engine in `lib/finance.js`. Student calculations are not sent to the server. A versioned `sessionStorage` module shares the minimum validated baseline between same-origin pages in the current browser tab. This storage is not encrypted or an account backup. The optional report name and manual account labels are not stored.

The site retains the existing `/api/exchange-rates` and `/api/assistant` routes. Bangladesh Bank values are reference rates, not payment quotes. Remote assistant requests contain only the submitted question; the Groq key remains server-side. No bank account is connected, provider quote is fetched or authenticated, or transfer is initiated.

## Static pages

| Route | Purpose |
| --- | --- |
| `/` | Home and links to each tool |
| `/planner.html` | Source of truth for the financial plan, with both planning modes and existing integrated features |
| `/roadmap.html` | Dated contributions using complete 30-day cycles |
| `/stress-tests.html` | Exchange-rate, expense, and missed-contribution scenarios |
| `/transfers.html` | Manual quote comparison using the existing quote validator |
| `/assistant.html` | General remote explanations and selected local plan answers |
| `/report.html` | Report from the saved plan and available stress results; browser printing |
| `/privacy.html` | Storage, rates, quote, and projection limitations |

`js/site.js` supplies shared navigation, mobile menu, footer, storage notice, and confirmed Clear Plan action. `styles/site.css` holds common screen and A4 print styling. Page-specific modules handle dependent features. The planner page continues to contain the existing combined workflow for compatibility; dedicated feature routes reuse the same calculations and validated state.

## Calculation and currency scope

All-cost and tuition-only modes, optional BDT study-abroad costs, rate conversions, contribution schedules, roadmap, stress scenarios, and quote ranking are calculated locally by `lib/finance.js`. Only complete 30-day intervals count. The whole-BDT schedule uses the existing final-cycle adjustment. Outputs above the documented BDT limit or invalid calendar inputs are rejected. Scenario calculations use copies of the baseline.

Supported destination currencies are USD, EUR, GBP, AUD, JPY, CAD, SEK, SGD, CNH, INR, and LKR. CNH means offshore yuan and is not relabeled as CNY. Bangladesh Bank data is parsed from its dated rate sheet on the server and preserves the official publication date, source, rate units, and retrieval timestamp. The Vercel CDN cache is a best-effort shared regional 24-hour cache, not a global single-fetch guarantee.

## Security and operational boundaries

The browser stores only a validated plan and optional stress-test inputs in tab session storage. Scenario outputs are recalculated from the validated plan. Same-origin scripts can access session storage, so it must not be treated as a secure vault. The report is generated locally; report-only student name is not saved. The remote assistant accepts only a question and is educational, not a personalized financial adviser. The assistant's in-memory rate limiter is per serverless instance, not global.

Manual quotes are validated for fields and freshness, but their source is not authenticated. There is no provider API, student account, database, bank connection, or payment execution. Exchange-rate and savings projections depend on entered data and are not guarantees of funding, admission, visa approval, or payment terms.

## Testing and limitations

Automated tests use Node's built-in test runner. See `docs/test-results.md` for the most recent local run and its actual scope. Static route and plan-state tests do not establish that a deployed Vercel site or provider integration works. Browser and print behavior should be checked locally before release.
