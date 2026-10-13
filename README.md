# CampusBridge AI

CampusBridge helps Bangladesh-based students plan tuition costs and compare current payment quotes for UK (BDT → GBP), US (BDT → USD), and Canada (BDT → CAD) corridors.

## Use

Open `index.html` in a modern browser. The planner starts blank. Enter your tuition, savings, protected emergency fund, income, living costs, tuition deadline, and a current exchange rate from a bank/provider quote. Enter the rate source/reference and timestamp before calculating. The calculations run locally in your browser.

For payment comparison, enter the same payment principal and collect current quotes through the payment link listed by your university. CampusBridge compares student-entered total sender cost, recipient amount, fee detail, and delivery days. It requires a timestamp and quote source/reference; delivery time is required to rank by speed.

## What is connected

- There is **no live FX feed, bank account connector, provider API, authentication, backend, or payment execution**.
- Provider availability is institution- and origin-dependent. The Convera button opens its student-payment information; Flywire opens its institution finder. Use your university's payment link where possible. The app does not claim a particular route is supported.
- A comparison is only as accurate as the quote the student enters. CampusBridge cannot verify quote authenticity, currency conversion, expiry, eligibility, institution, or additional fees.
- No preset user balances, tuition amounts, conversion rates, provider fees, or delivery estimates are included.
- Profile data and activity entries remain in the current page memory. Downloaded reports are generated locally.

## Real provider onboarding

Convera GlobalPay for Students is the first provider to evaluate for a university-connected tuition journey. Before any production integration, obtain written confirmation that the student's institution participates and that Bangladesh-origin BDT is supported for the payment purpose and funding method. If unavailable, the student must follow the university's official instructions and contact an authorized-dealer bank. Flywire is an alternative when the university itself provides its payment link.

Bangladesh Bank publishes a dated FX reference rate; it is a benchmark and may differ from a student's provider quote. Flywire says available options depend on the institution and country of payment origin, so use the university's own payment link and check its origin-country choices. ([Bangladesh Bank exchange rates](https://www.bb.org.bd/en/index.php/econdata/exchangerate), [Flywire payment instructions](https://help.flywire.com/hc/en-us/articles/360012463654-How-do-I-make-a-payment-through-Flywire), [Convera institution FAQ](https://convera.com/students/faq/how-to-make-a-payment/q-what-do-i-do-if-i-cant-find-the-convera-globalpay-for-students-platform-on-my-institutions-website/))

No API credentials or provider contract have been supplied, so direct real-time quotes cannot be connected in this workspace. Do not put credentials in browser code.

## Files

- `index.html`, `app.js`: responsive student workflow, external provider handoffs, local report export.
- `lib/finance.js`: validation, tuition calculations, and comparison of student-entered quotes.
- `docs/`: calculation, assistant, security, and production onboarding notes.

This application is informational and does not execute transfers or provide individualized financial advice.
