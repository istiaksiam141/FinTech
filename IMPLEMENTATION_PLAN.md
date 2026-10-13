# CampusBridge v1 status

## Real-input workflow delivered

- Removed preset financial figures, sample scenario records, bundled exchange rates, and provider quote fixtures.
- Planner requires a current student-entered exchange rate, source/reference, and timestamp; all financial inputs start empty.
- Quote comparison requires actual student-entered provider total, recipient amount, source/reference, and timestamp. Speed sorting requires stated delivery days.
- Added official Convera and Flywire student portal handoffs, blank and clear actions, what-if reset/apply, deterministic calculations, and local report export.
- Supported corridors are Bangladesh → UK (primary), US, and Canada. Provider support remains unverified per institution and origin.

## Live API access remains unavailable

This workspace contains no provider API agreement, credentials, backend, live FX feed, connected account, or payment operation. Direct live quote retrieval requires an approved provider integration and server-side secret handling. Until that access exists, students can use official external payment portals and enter their actual quotes for comparison. The app clearly identifies entered data as unverified.

## Production prerequisites

Confirm institution participation, Bangladesh-origin funding, currencies, payment purpose, limits, delivery, and fees in writing. Obtain partner API access and production approval. Build a secure backend, quote freshness/expiry handling, server validation, consent and privacy notices, monitoring, and operational controls before any live integration.
