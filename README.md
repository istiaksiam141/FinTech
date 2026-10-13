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
- General assistant questions can use the server-side OpenAI Responses API. The browser sends only the question; financial-plan and quote questions continue through the existing deterministic local code.

## Optional OpenAI assistant setup

The OpenAI assistant runs through the Vercel Node.js function at `/api/assistant`; the browser never receives the API key. The server accepts only a question, up to 1,000 characters, and does not send financial profile or provider quote data to OpenAI. Financial calculations, savings projections, and quote validation remain deterministic in the browser. General answers are educational and can be unavailable when the API key is not configured.

### Run locally

1. Install the server dependency from this folder:

   ```sh
   npm install
   ```

2. Create a file named `.env.local` in the project root, next to `package.json`.
3. Add your own key locally (never send it to chat, add it to source files, or paste it into `.env.example`):

   ```text
   OPENAI_API_KEY=your-real-key-goes-here
   ```

4. Optional: add `OPENAI_MODEL=gpt-4.1-mini` to choose a model. The default is `gpt-4.1-mini`.
5. Link this folder to your Vercel project if it is not linked yet, then start the local Vercel server:

   ```sh
   npx vercel link
   npx vercel dev
   ```

   Open the local URL printed by Vercel. A plain static file server will not run the `/api/assistant` function. `.env.local` is ignored by Git; do not force-add it.

### Configure a Vercel preview

In Vercel, open the CampusBridge project’s **Settings → Environment Variables**, add `OPENAI_API_KEY`, and select **Preview** for testing. Add `OPENAI_MODEL` only if you want to override the documented default. Redeploy the preview after adding or changing variables. Do not add the key to browser code, Git, build output, or logs. Leave Production unconfigured until you deliberately approve a production release.

The endpoint has request validation and a small in-memory per-IP limit. Serverless instances do not share that memory, so this is only a basic guard; configure a Vercel Firewall/rate-limit rule before exposing the endpoint broadly. OpenAI usage may incur charges when someone makes an accepted request.

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
- `api/assistant.js`: Vercel endpoint that calls the OpenAI Responses API using a server-side key.
- `package.json`: Node.js runtime requirement and server-side OpenAI SDK dependency.
- `docs/`: calculation, assistant, security, and production onboarding notes.

This application is informational and does not execute transfers or provide individualized financial advice.
