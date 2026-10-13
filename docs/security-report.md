# Security and privacy assessment

## Current controls

- Monetary fields start blank; the app does not provide balances, bank/payment-provider prices, fees, or provider quotes. It displays a dated Bangladesh Bank reference sheet through a validated Vercel endpoint.
- Profile, quote comparison, assistant, and report generation run locally in the browser. There is no account, database, CampusBridge server API, analytics, or local-storage persistence.
- The planner requires a rate source and timestamp; comparison requires quote source/reference and timestamp. User-entered data is still unverified and labeled accordingly.
- Numeric, date, corridor, and quote values are validated by the calculation engine.
- The deterministic assistant uses an allowlisted local calculation/guidance path. It does not send questions or financial data to a model.
- The in-memory activity log omits raw financial values and question text and resets on refresh.
- External Convera/Flywire links leave CampusBridge. The site does not ask for bank passwords, one-time codes, or credentials.

## Limits and remaining risks

- Student-entered data can be inaccurate, stale, or incomplete. CampusBridge does not authenticate quote references or verify provider route availability, quote expiry, or fee exclusions.
- A Vercel serverless endpoint fetches and validates the dated Bangladesh Bank rate sheet. It caches successful responses for 30 minutes (with a further 30-minute stale-while-revalidate window); malformed or failed upstream data returns an error, not a fallback rate. The official page parser depends on the bank's current HTML structure. Payment-provider APIs, user accounts, bank linking, and transfer operations are not configured. This is not a production financial service or financial advice.
- External Google Fonts and provider portals are third-party requests; the app does not add student profile data to those links.
- A downloaded report includes the student's entered financial values; the student controls where that local file is saved or shared.

## Production gate

Before a public service handles real accounts or live quotes: establish provider contracts and scope; verify route eligibility; complete privacy/security/legal review; move secrets and provider requests to a secure backend; implement consent, retention/deletion, access control, audit, monitoring, expiry, and error handling; self-host reviewed dependencies; add secure headers and abuse controls; conduct security and accessibility testing.
