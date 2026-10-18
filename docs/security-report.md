# Security and privacy assessment

## Current controls

- The minimum validated current plan and optional stress-test scenario inputs are stored in tab-scoped `sessionStorage` by `lib/plan-state.js` so pages can share one plan. State has a schema version, explicit profile/scenario field allowlists, finance-engine validation, and guarded storage access. Scenario outputs are recalculated from the restored profile instead of trusted from storage. Corrupt or unsupported state is unavailable and removed where possible. Clear Plan requires confirmation.
- The stored state does not include the optional report name, manual account labels, credentials, API keys, tokens, or uploaded documents. Because this is same-origin browser storage, it is not encrypted and can be read by same-origin scripts. Do not use a shared or untrusted device for sensitive financial entries.
- The planner and dependent pages use `lib/finance.js` for deterministic validation/calculation. Reports are generated locally. Quote validation checks entered values and freshness but does not authenticate a provider.
- `/api/assistant` accepts only a question; the browser does not send a financial profile or quotes. `GROQ_API_KEY` is read only from server environment configuration. Client-facing provider errors are generic and diagnostic logs omit upstream messages and secrets.
- `/api/exchange-rates` validates the Bangladesh Bank source response and returns no invented fallback rate. Successful responses use Vercel CDN response caching with a best-effort 24-hour regional TTL; failures use `no-store`.
- No login, database, bank connection, payment initiation, or transfer execution is configured.

## Remaining risks and limits

- Student-entered amounts, dates, rates, and quote references can be inaccurate. Projections assume the entered conditions continue; they are not guarantees.
- Same-origin script compromise can expose session data. Session storage is not secure storage or an account backup.
- Assistant rate limiting uses in-memory per-instance state and is not a production-wide abuse control. Add edge rate limiting before broad exposure.
- Vercel CDN caching is regional and may be evicted before TTL; it is not a globally atomic one-fetch cache. The official HTML parser may need maintenance if Bangladesh Bank changes the page.
- External font and provider links involve third-party requests. The app does not add a student's financial plan to those links.

## Production gate

Before a public financial service handles real accounts or live quotes, complete privacy/legal review, threat modeling, security and accessibility testing, provider/route verification, secure headers, abuse controls, monitoring, and appropriate consent and retention design. Any future account integrations or provider API credentials require a justified secure backend and explicit provider authorization.
