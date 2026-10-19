# CampusBridge AI — Execution Evidence

This folder records execution evidence for FinTechathon 2026 Deliverable 6. It separates real browser observations from automated tests and mocked test scenarios. It contains no payment records, credentials, access tokens, or personal financial data.

## Evidence at a glance

- **Live browser:** the public production site was opened; a synthetic USD planning scenario was calculated; one generic, signed-out Assistant question received a displayed response.
- **Automated:** the repository's Node test suite ran from the local checkout. The full raw test-run output and timestamp metadata are included.
- **Mocked:** tests use fixtures and stubs for financial boundaries, external API failures, Supabase ownership checks, consent, authentication, and MFA. These are not live sandbox operations.
- **Screenshots:** capture is complete. `screenshots/` contains `01-planner-inputs.png`, `02-financial-results.png`, `03-savings-tracker.png`, and `04-ai-assistant-response.png`.
- **Demo video:** no demo video has been recorded. The demo script is guidance for a future recording.
- **Sandbox:** no payment or provider sandbox integration was found in the app routes and libraries. No money movement was attempted.

## Files

- [execution log](execution-log.md) — observed browser workflows and their evidence boundaries.
- [test results](test-results.md) — exact test command, environment, result summary, and output reference.
- [test cases](test-cases.md) — scenario IDs, inputs, expected/observed results, and status.
- [limitations](limitations.md) — unavailable integrations and verification gaps.
- [demo script](demo-script.md) — a timed script for a future recording; it is not a recorded video.
- `test-output.txt` and `test-run-metadata.txt` — output and local timestamps from the recorded test run.
- `screenshots/` — completed screenshot evidence: `01-planner-inputs.png`, `02-financial-results.png`, `03-savings-tracker.png`, and `04-ai-assistant-response.png`.

## Reproduce the automated checks

From PowerShell at the repository root:

```powershell
node --test "tests/*.test.cjs"
git diff --check
```

Node.js 22 or newer is required. The run recorded here used Node.js v24.21.0. There is no `npm test` script. Tests are run locally and do not connect to production Supabase, Groq, Bangladesh Bank, or a payment sandbox.

## Status and time conventions

- **PASS — live browser:** the described result was visibly observed on the public site.
- **PASS — automated:** an automated test passed; any external service involved may have been mocked.
- **NOT TESTED:** the operation was not performed in this audit.
- **NOT AVAILABLE:** the app does not implement that integration.
- Times include the Asia/Dhaka offset (`+06:00`). If the exact UI click time was not captured, the log says so instead of inventing one.

## Additional screenshot guidance

Screenshot capture is complete. If additional captures are needed, use fictional inputs only. In a browser, open the public site or an approved preview and capture the page using Snipping Tool or the browser's screenshot command. Save genuine captures in `screenshots/` with descriptive names. For consent, use an authorized test account and synthetic conversation; do not capture an account identifier or private messages. Do not label an illustrative/mock image as a live application capture.
