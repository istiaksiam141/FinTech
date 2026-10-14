# Security and privacy assessment

## Current controls

- Monetary fields start blank; the app does not provide preset balances, bank/payment-provider prices, fees, or provider quotes. Students may enter bank account labels and balances manually. It displays a dated Bangladesh Bank reference sheet through a validated Vercel endpoint.
- Profile, manually entered bank account labels/balances, quote comparison, deterministic financial assistant behavior, and report generation run locally in the browser. Bank entries are memory-only and clear on reload/reset; they are not connected to a bank and must not include account numbers or credentials. A narrow server-side assistant endpoint accepts only a question for general explanation; it does not accept profile or provider quote data. There is no login, database, analytics, or local-storage persistence.
- The planner requires a rate source and timestamp; comparison requires quote source/reference and timestamp. User-entered data is still unverified and labeled accordingly.
- Numeric, date, corridor, and quote values are validated by the calculation engine.
- Financial calculations and quote decisions stay on the local deterministic path. General questions may be sent to OpenAI through the backend; the OpenAI key remains server-side, and no profile or quote data is sent.
- The in-memory activity log omits raw financial values and question text and resets on refresh.
- External Convera/Flywire links leave CampusBridge. The site does not ask for bank passwords, one-time codes, or credentials.

## Limits and remaining risks

- Student-entered data can be inaccurate, stale, or incomplete. CampusBridge does not authenticate quote references or verify provider route availability, quote expiry, or fee exclusions.
- A Vercel serverless endpoint fetches and validates the dated Bangladesh Bank rate sheet. It caches successful responses for 30 minutes (with a further 30-minute stale-while-revalidate window); malformed or failed upstream data returns an error, not a fallback rate. The official page parser depends on the bank's current HTML structure. Payment-provider APIs, user accounts, bank linking, and transfer operations are not configured. This is not a production financial service or financial advice.
- The assistant endpoint has an in-memory per-instance request limit, which is not shared across serverless instances and is not sufficient as a production-wide abuse control. Configure edge rate limiting before broad public use. OpenAI requests may incur charges; do not log prompts, responses, or keys.
- External Google Fonts and provider portals are third-party requests; the app does not add student profile data to those links.
- A downloaded report includes the student's entered financial values; the student controls where that local file is saved or shared.

## Production gate

Before a public service handles real accounts or live quotes: establish provider contracts and scope; verify route eligibility; complete privacy/security/legal review; move secrets and provider requests to a secure backend; implement consent, retention/deletion, access control, audit, monitoring, expiry, and error handling; self-host reviewed dependencies; add secure headers and abuse controls; conduct security and accessibility testing.
