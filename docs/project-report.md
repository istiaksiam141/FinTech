# CampusBridge AI — Project Report

**Project category:** Cross-border and student finance assistant<br>
**Competition theme:** FinTechathon 2026, Theme C<br>
**Primary student journey:** Bangladesh to United Kingdom (BDT → GBP)<br>
**Secondary corridors:** Bangladesh to United States (BDT → USD), and Bangladesh to Canada (BDT → CAD)<br>
**Report status:** Current implementation and production-readiness report

## Executive summary

CampusBridge AI is a browser-based financial planning tool for students in Bangladesh who need to prepare for overseas tuition payments. It helps students organize their financial profile, calculate a tuition funding gap and savings target, compare payment quotes they obtain themselves, explore a what-if scenario, review explainable guidance, and download a report.

The application is designed to use real student inputs rather than preset demo balances, fees, or provider offers. Calculations run locally in the browser. A Vercel endpoint retrieves Bangladesh Bank's dated exchange-rate sheet; the official reference is not a guaranteed student payment price. The app does not retrieve payment quotes, verify manually entered quotes, connect to bank accounts, or move money. Students can open official provider or university payment pages and enter the quote details they receive for comparison.

## Problem and motivation

Students planning international study must coordinate tuition deadlines with savings, income, living costs, commitments, emergency reserves, exchange-rate changes, and payment charges. Information is often spread across university instructions, provider portals, and personal budgets. Without a consistent comparison, a student may underestimate the amount needed, overlook fees, or leave too little time to close a funding gap.

CampusBridge brings these planning steps into one workflow and makes its assumptions visible. It is an informational planning aid; it does not replace a university, bank, payment provider, or qualified financial professional.

## Objectives

- Give students a structured financial profile with editable inputs.
- Calculate tuition affordability, funding gap, and required monthly savings using explicit inputs.
- Compare actual student-obtained provider quotes using a common sender-cost and recipient-amount view.
- Explain calculations, assumptions, recommendations, and data limitations.
- Allow students to test a changed scenario and generate a downloadable planning report.
- Avoid presenting invented rates or provider conditions as real.
- Keep the student workflow useful without payment-provider API credentials by letting the student use official payment channels and enter the quote received.

## Intended users and scope

The primary user is a Bangladesh-based student preparing to pay tuition to a participating overseas institution. The primary product journey is BDT to GBP for the UK. USD and CAD destinations are selectable planning corridors, but their availability through any particular provider is not implied. Eligibility depends on the institution, payer origin, payment purpose, funding method, and provider rules.

In scope are local financial planning, student-entered exchange-rate provenance, quote comparison, scenario analysis, explanatory guidance, official external handoffs, and local report generation. In the current release, direct provider quote retrieval, user accounts, server-side persistence, bank linking, and payment execution are out of scope.

## Implemented student workflow

1. **Enter a financial profile.** The student supplies tuition, savings, income, living expenses, commitments, emergency reserve, and deadline. Financial fields start blank. The student may enter an exchange rate with its source and timestamp or load the Bangladesh Bank sheet, review its publication date and retrieval time, then explicitly choose to apply its ask value.
2. **Review the tuition plan.** The calculation engine validates inputs and estimates available funds, remaining funding gap, savings required per month, affordability, deadline risk, and progress from the supplied figures.
3. **Get provider information.** The student follows the university's payment instructions or opens the official Convera/Flywire information handoff. These links do not imply that a route or institution is supported.
4. **Compare quotes.** The student enters provider quote details they actually received, including source/reference and timestamp. The app compares total sender cost and recipient amount; delivery-speed ranking is available when delivery days are supplied. Results are unverified user-entered data.
5. **Explore a scenario.** The student can reset or apply a changed scenario and review the recalculated plan.
6. **Review guidance and activity.** The deterministic assistant uses the shared financial calculation logic to explain results. The activity log records tool/action status and redacted summaries without exposing credentials.
7. **Export a report.** A report can be generated locally from the current plan and entered quote data.

## Main features and status

| Feature | Current status |
|---|---|
| Student financial profile and editable inputs | Implemented in browser; no account or server persistence |
| Affordability and savings calculations | Implemented locally with validation and explicit input assumptions |
| FX conversion | Supports student-entered rates and Bangladesh Bank published bid/ask data; planner estimate uses ask and is not a payment-provider price |
| Transfer quote comparison | Compares quotes entered by the student; no provider quote API |
| Official provider handoffs | Links to official student information/payment destinations; provider availability remains institution-specific |
| Deterministic financial assistant | Implemented as a local fallback using application calculations; no generative AI API connection is configured |
| What-if scenario controls | Implemented with reset/apply actions and recalculation |
| Explainable recommendations | Provides deterministic reasoning from available profile and quote inputs |
| Multi-currency corridor selection | Supports BDT→GBP, BDT→USD, BDT→CAD as planning corridors; does not verify actual provider eligibility |
| Report export | Generated locally in the browser |
| Agent activity log | Local activity with tool/action status and redacted summaries |
| Authentication and student-profile persistence | Not implemented; the server endpoint only handles public FX data |
| Backend | One Vercel function fetches and caches Bangladesh Bank reference data |
| Payment-provider/bank quote API integration | Not implemented; requires provider/institution approval and credentials |
| Transfer initiation or execution | Not implemented |

## Technical design

CampusBridge is a static browser application with one Vercel serverless endpoint for Bangladesh Bank data. The interface is in `index.html`; `app.js` coordinates page state, validation, provider handoffs, scenario controls, assistant actions, and report export. `lib/finance.js` contains shared validation and deterministic financial calculations; `lib/bangladesh-bank-rates.js` fetches and validates the bank's dated HTML table; `lib/exchange-rates.js` validates its JSON response. Student profile calculations and report generation remain on the student's device; profile inputs are not sent to the endpoint.

The shared calculation engine is intended to keep the planner, assistant, and report consistent. Monetary results are based on values the student enters. The app does not independently verify the accuracy, freshness, eligibility, expiry, or completeness of an external quote.

## Financial calculation and transparency

The main planning logic uses student-supplied tuition, savings, income, expenses, commitments, emergency reserve, deadline, exchange rate, and any applicable fee assumptions. Bangladesh Bank's GBP, USD, and CAD rows quote BDT per one unit of foreign currency; the endpoint preserves bid and ask and the planner selects ask. It estimates the funding gap after accounting for available funds and protected reserves, and divides the remaining requirement across the time available to estimate a monthly savings target. Quote comparison uses the submitted sender cost and recipient amount, plus delivery estimates when provided. Ranking can consider lowest sender cost, highest recipient amount, and fastest delivery.

Each result is only as reliable as its inputs. Exchange-rate benchmarks can differ from a provider's executable quote. The app labels the entered source and time so students can judge recency, but it does not certify quotes or guarantee that the provider will honor them.

## Data handling and security

The present build does not have user authentication, a server database, a bank connector, or a payment-provider API secret. The public FX endpoint does not require a key. Profile and activity values and the fetched FX response are held in page memory; report creation is local. No banking credentials should be entered into CampusBridge. Quote data should be obtained through the institution's official payment instructions or the provider's official channel.

If a provider integration is added, provider credentials must remain server-side. A production service would need server validation, consent and privacy notices, rate limiting, audit/monitoring, secure secret storage, quote expiry handling, and fail-closed behavior for unsupported or malformed routes. Any AI service would need a restricted tool set and controls preventing sensitive-data leakage and fabricated financial results.

## Testing and quality

The repository includes automated checks for the shared financial logic, input validation, and mocked exchange-rate API responses. The latest run is recorded in `docs/test-results.md`. The project also contains architecture, financial algorithm, AI-agent, security, production-boundary, and test-result documentation. Browser execution has not been verified. This report does not claim a payment-provider integration or verified end-to-end student payment journey.

Before competition or public deployment, perform a fresh test run, accessibility and mobile checks, and a complete manual journey review in the supported browsers. Validate edge cases for past/near deadlines, missing quote fields, mismatched currencies, invalid amounts, and stale data. Any test results should be updated with the actual run date and environment.

## Current limitations and risks

- The official HTML rate sheet is parsed server-side because no documented JSON endpoint was identified. Markup changes can break parsing; the function returns an error rather than a fabricated rate. Students must explicitly apply the fetched ask value. The page supplies effective-dated sheets and explains USD/BDT values refer to the previous business-day close; CampusBridge does not promise intraday or continuous updates. Five days without a new published sheet and two hours since retrieval are app stale thresholds, not Bangladesh Bank service guarantees.
- Payment-provider quotes are not retrieved automatically.
- Provider quote entries are not authenticated or verified by the app.
- Provider and corridor support cannot be inferred from an external portal link; it must be confirmed for the student's institution and payer origin.
- The app does not execute transfers or guarantee an affordability outcome.
- No user account or durable server-side profile storage is available.
- The current assistant is deterministic, not a connected general-purpose AI service.
- The report is a planning aid, and not a provider-issued payment instruction or financial guarantee.

## Recommended path to a real provider integration

Start with the target university and one provider for the Bangladesh-to-UK tuition journey. Ask the university which payment provider and official link it supports. Ask the provider to confirm in writing that Bangladesh-origin BDT is supported for the named university, tuition purpose, and funding method. Then request authorized partner/API access for retrieving a current non-binding quote without creating a payment. Flywire has public Education API documentation, which makes it a candidate for an API feasibility inquiry; public documentation does not confirm that a Bangladesh-to-UK quote endpoint or route is available for CampusBridge. Convera GlobalPay for Students may require institution-led/partner access; public student checkout access alone does not establish a third-party quote API.

Before showing live results, implement a backend adapter for the approved provider, preserve provider-returned source/time/expiry and fee details, distinguish live provider responses from manually entered comparisons, reject unsupported and expired results, and complete security, privacy, and operational reviews. Use the provider's hosted payment journey for payment execution unless the institution and provider explicitly authorize another flow. Never place provider API secrets in browser code.

## Competition demonstration plan

Demonstrate a student entering their own profile and sourced planning rate, reviewing the calculated tuition gap and savings target, opening the official university/provider payment instructions, entering actual quote details if available, comparing cost and recipient amount, using a what-if scenario, reviewing the assistant's calculation trace, and exporting the report. If no provider quotes are available during the presentation, state that live quoting is not integrated and demonstrate the quote form without implying that any invented value is a real offer. The product should not be presented as executing payments.

## Conclusion

CampusBridge provides a transparent, real-input student finance planning workflow, an official Bangladesh Bank FX reference endpoint, and local interactions for affordability planning, quote comparison, scenario changes, guidance, and report export. It is not a live payment service: provider quote retrieval requires confirmed route support, institutional/provider authorization, and a secure integration. This staged approach lets students plan with their own figures today while keeping provider claims honest and defining a practical route to production.

## Project references

- Product and setup overview: [README](../README.md)
- Current scope and implementation status: [Implementation plan](../IMPLEMENTATION_PLAN.md)
- System structure: [Architecture](architecture.md)
- Calculation details: [Financial algorithms](financial-algorithms.md)
- AI and fallback behavior: [AI agent](ai-agent.md)
- Security review: [Security report](security-report.md)
- Live integration boundaries: [Production boundaries](production-boundaries.md)
- Test records: [Test results](test-results.md)
- Competition materials: [Presentation outline](presentation-outline.md), [demo script](demo-video-script.md), and [submission checklist](submission-checklist.md)
