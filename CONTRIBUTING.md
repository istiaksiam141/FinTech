# Contributing to CampusBridge AI

This repository is a dependency-light static demo. Coordinate changes around the shared contracts below; do not add a framework or persistent store without agreement from the team.

## Workstreams

- **Frontend and UX:** navigation, profile inputs, dashboard, planner, transfer comparison, assistant presentation, mobile and accessibility behavior.
- **Financial logic and AI:** `lib/finance.js`, simulated data fixtures, allowed assistant intents, explanations, and calculation tests.
- **Backend, QA, and submission:** API integration proposals, data-contract review, security review, test reports, deployment and submission documents.

All three workstreams should use the same profile, provider, quote, and log contracts documented in `docs/architecture.md`.

## Development

- Edit `data/payment-options.js` and `data/finance-guidance.js` alongside their JSON mirrors. Unit tests enforce exact parity.
- Keep all monetary calculations in `lib/finance.js`; presentation code should call that engine.
- Add tests for every calculation change using Node's built-in test runner: `node --test tests/*.test.cjs`.
- Never enter live credentials or real student financial data in fixtures, logs, screenshots, or commits.
- Do not claim rates, provider terms, endorsements, or competition rules that have not been verified.
- Keep Three.js optional and preserve the CSS fallback and reduced-motion behavior.
- Do not commit, push, deploy, or modify production services without explicit authorization.

## Integration contracts

- Profile inputs are raw form strings; validation and returned calculation values are owned by `CampusBridgeFinance`.
- Provider IDs and source IDs are stable strings. Provider rates and fees are explicitly synthetic.
- Assistant intent must resolve to one of the approved five tool names listed in `docs/ai-agent.md`.
- Sandbox events omit user question text, profile balances, names, credentials, and other personal information.
