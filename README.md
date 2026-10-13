# CampusBridge AI

CampusBridge helps Bangladesh-based students plan tuition costs and compare current payment quotes for UK (BDT → GBP), US (BDT → USD), and Canada (BDT → CAD) corridors.

## Use

Deploy the project to Vercel to use the official Bangladesh Bank rates endpoint. The planner starts blank. Enter your tuition, savings, protected emergency fund, income, living costs, and tuition deadline. You may enter a rate and its source/timestamp manually, or load the latest published Bangladesh Bank sheet. The fetched rate is only applied after you choose to use it. Calculations run locally in your browser.

For payment comparison, enter the same payment principal and collect current quotes through the payment link listed by your university. CampusBridge compares student-entered total sender cost, recipient amount, fee detail, and delivery days. It requires a timestamp and quote source/reference; delivery time is required to rank by speed.

## What is connected

- A Vercel serverless function reads Bangladesh Bank's official dated rate sheet. The rate sheet is an official reference, not a guaranteed student payment price. There is **no payment-provider quote API, bank account connector, authentication, or payment execution**.
- Provider availability is institution- and origin-dependent. The Convera button opens its student-payment information; Flywire opens its institution finder. Use your university's payment link where possible. The app does not claim a particular route is supported.
- A comparison is only as accurate as the quote the student enters. CampusBridge cannot verify quote authenticity, currency conversion, expiry, eligibility, institution, or additional fees.
- No preset user balances, tuition amounts, conversion rates, provider fees, or delivery estimates are included. Bangladesh Bank publishes dated rates; availability and freshness are shown in the interface.
- Profile data and activity entries remain in the current page memory. Downloaded reports are generated locally.

## Real provider onboarding

Convera GlobalPay for Students is the first provider to evaluate for a university-connected tuition journey. Before any production integration, obtain written confirmation that the student's institution participates and that Bangladesh-origin BDT is supported for the payment purpose and funding method. If unavailable, the student must follow the university's official instructions and contact an authorized-dealer bank. Flywire is an alternative when the university itself provides its payment link.

Bangladesh Bank publishes a dated FX reference rate; it is a benchmark and may differ from a student's provider quote. Flywire says available options depend on the institution and country of payment origin, so use the university's own payment link and check its origin-country choices. ([Bangladesh Bank exchange rates](https://www.bb.org.bd/en/index.php/econdata/exchangerate), [Flywire payment instructions](https://help.flywire.com/hc/en-us/articles/360012463654-How-do-I-make-a-payment-through-Flywire), [Convera institution FAQ](https://convera.com/students/faq/how-to-make-a-payment/q-what-do-i-do-if-i-cant-find-the-convera-globalpay-for-students-platform-on-my-institutions-website/))

No API credentials or provider contract have been supplied, so direct real-time quotes cannot be connected in this workspace. Do not put credentials in browser code.

## Files

- `index.html`, `app.js`: responsive student workflow, external provider handoffs, local report export.
- `lib/finance.js`: validation, tuition calculations, and comparison of student-entered quotes.
- `lib/exchange-rates.js`: client validation for the Bangladesh Bank rate response.
- `lib/bangladesh-bank-rates.js`: server-side source fetch, parsing, and validation for the official Bangladesh Bank page.
- `api/exchange-rates.js`: Vercel endpoint that returns the validated official rates.
- `docs/`: calculation, assistant, security, and production onboarding notes.

This application is informational and does not execute transfers or provide individualized financial advice.
