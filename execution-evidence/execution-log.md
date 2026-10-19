# Execution Log

## Run identity

- **Project:** CampusBridge AI
- **Repository:** `https://github.com/istiaksiam141/FinTech`
- **Local branch and source commit:** `main`, `5a5c5e969e9e3a7d7aa6709554c4f46704c690a2`
- **Published GitHub `main`:** the visible latest commit matched the local hash at the time checked. This does not prove which commit Vercel deployed.
- **Production site:** `https://fintech-kappa-umber.vercel.app/`
- **Test browser environment:** Codex in-app browser; production domain; signed out; fictional data only.
- **Automated test environment:** local Windows checkout, Node.js v24.21.0, npm v11.19.0.
- **Timezone:** Asia/Dhaka (`+06:00`).

The source commit is identifiable, but the production deployment's deployed commit/build ID was not accessible from the public page. The Vercel dashboard required sign-in.

## Observed operations

| Scenario ID | Operation | Observed at (`Asia/Dhaka`, +06:00) | Environment | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| LIVE-001 | Opened the public home page and planner; page titles, navigation, currency-first form, and accessible control labels were visible. | 20 Oct 2026, within 03:00:50–03:05:39; exact page-load time not captured | Live public site, signed out | PASS — live browser | Browser observation in this audit; four screenshot files are present in `screenshots/`. They show the screens visible in each image and do not independently verify backend behavior. |
| LIVE-002 | Selected USD; entered synthetic tuition, savings, emergency reserve, monthly income/costs, and deadline; reviewed and calculated the plan. | 20 Oct 2026, 03:05:39.712 | Live planner, signed out, no account data | PASS — live browser | Full scenario and displayed figures in [test cases](test-cases.md). |
| LIVE-003 | Planner fetched and displayed Bangladesh Bank rate metadata; user explicitly applied the USD ask rate as a reference estimate. | 20 Oct 2026, 03:01:14.552 retrieval time; UI displayed it shortly afterward | Live `/api/exchange-rates` through the planner | PASS — live browser | Source and date metadata are recorded in [test cases](test-cases.md). This was reference data, not a payment quote. |
| LIVE-004 | Submitted one generic question: “In one sentence, what does a study-abroad funding gap mean?” The signed-out Assistant displayed an answer. | 20 Oct 2026, approximately 03:02:43–03:02:52; exact click/completion timestamps not separately logged | Live Assistant UI, signed out, history unchecked | PASS — live browser | Question and observed answer summary in [test cases](test-cases.md). Browser network trace was not captured, so the exact HTTP request was not independently inspected. |
| AUTO-001 | Ran the complete Node test suite. | 20 Oct 2026, 03:06:30.161–03:06:39.199 | Local checkout at the source commit above, with pre-existing documentation changes in the worktree | PASS — automated | [test results](test-results.md), [test-output.txt](test-output.txt), [test-run-metadata.txt](test-run-metadata.txt). |
| AUTO-002 | Ran `git diff --check` after preparing this evidence package. | 20 Oct 2026, 03:10:05.439–03:10:05.838 | Local checkout | PASS — automated command | Result recorded in [test results](test-results.md). |
| MOCK-001 | Finance, quote, rate failure, AI request validation, context ownership/consent, and MFA boundary scenarios were exercised by the repository test suite with local fixtures/stubs. | 20 Oct 2026, 03:06:30.161–03:06:39.199 | Local automated tests | PASS — mocked/automated | Test names and output in `test-output.txt`; details in [test cases](test-cases.md). This is not live Supabase or provider verification. |
| EXT-001 | Looked for a payment-provider sandbox or payment execution route. The app exposes user-entered quote comparison and external provider links, not a payment API. | 20 Oct 2026; source search completed before final diff check | Source audit | NOT AVAILABLE | [Limitations](limitations.md). No transaction was attempted. |

## LIVE-002 input and observed result

Financial inputs were fictional: **USD 5,000 tuition**, **USD 1,000 other savings**, **USD 100 protected emergency fund**, **USD 800 monthly income**, **USD 400 monthly living costs**, and a **18 January 2027** tuition deadline. No optional study or living-cost estimates were entered.

The planner received an official Bangladesh Bank reference response with publication date **19 October 2026** and retrieval time **20 October 2026 03:01:14.552 +06:00**. The displayed USD ask was **123.72 BDT/USD** and the response was marked not stale. It is a reference rate only; no bank account or payment provider was involved.

At **20 October 2026 03:05:39.712 +06:00**, the plan was recalculated. The UI showed:

- Education funding goal: **USD 5,000**.
- Available savings after the protected reserve: **USD 900**.
- Funding gap: **USD 4,100**.
- Deadline: **18 January 2027**, 90 days remaining, three complete 30-day contribution cycles.
- Displayed contribution target: **USD 1,366.67** for each of the three cycles, dated 19 November, 19 December, and 18 January.
- Status: the goal was not projected to be fully funded from the entered monthly savings capacity.

The amounts are consistent with the displayed rate: tuition `5,000 × 123.72 = 618,600 BDT`; usable savings `(1,000 − 100) × 123.72 = 111,348 BDT`; the remaining gap is `507,252 BDT`, equivalent to USD 4,100 at that same reference rate. This calculation check explains the displayed values; it does not establish a guaranteed future rate or payment amount.

## Screenshot and video status

Four screenshot files are present in `screenshots/`: `01-planner-inputs.png`, `02-financial-results.png`, `03-savings-tracker.png`, and `04-ai-assistant-response.png`. They document only the visible content in those images and do not establish backend behavior or other unshown functionality. No demonstration video has been recorded; [demo-script.md](demo-script.md) is guidance for a future recording.
