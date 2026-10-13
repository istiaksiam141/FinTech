# Production integration status

## Active student workflow

CampusBridge currently runs calculations on student-entered inputs and compares manually entered provider quotes. No balances, rates, provider fees, delivery estimates, or quotes are supplied by the application. Official Convera/Flywire links provide an external handoff; they are not an embedded or verified integration. The website does not initiate or execute transfers.

## Provider discovery recommendation

Evaluate Convera GlobalPay for Students first for the Bangladesh → UK tuition journey. Confirm in writing with the institution and provider that the specific university participates and Bangladesh-origin BDT funding is supported for that student's payment method and tuition purpose. Ask whether partner API access exists for the quote information the product needs; public student checkout access does not itself establish API access. No contract, route verification, or API credentials are configured here.

If Convera is unavailable for the institution or origin, the student should follow the university's official payment instructions and contact an authorized-dealer bank directly. Flywire is another candidate where the university supplies a Flywire link and confirms the origin/currency route. For the US and Canada corridors, verify the institution and payment origin independently before presenting them as supported by any provider.

## Required before live provider integration

- Verify institution, payment purpose, origin bank/funding source, currency, limits, fee scope, and eligibility with the provider.
- Obtain a contract, authorized API product, production credentials, rate/quote expiry documentation, and provider support process.
- Build a backend for secrets, provider requests, identity/consent where applicable, server-side validation, throttling, audit events, and monitoring.
- Render provider-returned source, retrieval time, expiry, sender debit, destination amount, explicit fees, delivery estimate, and exclusions.
- Keep provider results separate from user-entered comparisons and fail closed on unsupported, expired, or malformed responses.
- Complete privacy, threat-model, regulatory, accessibility, and security reviews before production use.

Until these gates are met, do not describe CampusBridge as having live rates, direct provider integrations, verified route availability, connected bank accounts, or payment execution.
