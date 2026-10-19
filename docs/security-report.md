# Security and data handling

See [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) for the full architecture and API reference. This page focuses on privacy boundaries and security limitations.

This document describes repository behavior, not a live security certification. Live Supabase settings, deployed Vercel configuration, and real-user isolation were not inspected as part of this documentation update.

## Data locations

| Data | Location | Important limit |
| --- | --- | --- |
| Current planner inputs and stress-test inputs | Browser `sessionStorage` for the current tab | Validated and field-allowlisted, but not encrypted. Same-origin scripts can read it. It is not an account backup. |
| Cloud-saved plans | Supabase `saved_plans` | Explicit plan copies, scoped in the client to the authenticated user. Live schema and owner RLS policies must be confirmed in the intended Supabase project. |
| Signed-in AI chat | Supabase `assistant_conversations` and `assistant_messages` | Stores each signed-in user's submitted question and displayed answer, including locally computed answers. `docs/supabase-assistant-chat.sql` contains the intended schema and owner policies; whether it has been applied is unverified. |
| Signed-out AI chat | Current page memory | Temporary and lost when the page is left or refreshed. |
| Savings Tracker | Browser `localStorage` | Roadmap snapshots and student-entered BDT deposits stay in this browser profile. Not synced to Supabase, an account, or another device. JSON backup files are user-controlled copies. |
| Supabase Auth session | Supabase JS browser-managed local storage | Uses Supabase JS client defaults. Do not rely on it as secure storage on a shared or untrusted device. |
| AI provider credential | Server environment | `GROQ_API_KEY` is used by `api/assistant.js`; it must not be placed in browser code. No secret values are documented here. |

These are separate features: cloud-saved plans are explicit Supabase rows; signed-in chat history is a different pair of Supabase tables; Savings Tracker data remains browser-local. Deleting or clearing one does not imply deletion of the others.

## AI request and response handling

For a general question in a signed-out or temporary chat, the browser sends only `{ question }` to `/api/assistant`. For a signed-in saved conversation, it also sends the selected conversation ID, current saved user-message ID, and the current Supabase access token in the authorization header. A visible, unchecked-by-default option controls whether a boolean consent flag is added. Without that consent, the server verifies the token and current message but does not query prior message text. With consent, the server independently verifies the token with Supabase Auth, checks conversation ownership under that user's JWT and existing RLS policies, and confirms that the referenced current user message is the latest user message in that conversation and matches the submitted question. It then retrieves history using the same conversation ID, authenticated user ID, and RLS-protected Supabase client. The route rejects arbitrary client-supplied message history.

When consent is enabled, at most 11 earlier user/assistant messages and the current question are included, with a 6,000-character total limit and 40-row query cap. Messages are ordered chronologically; the current message is matched by its persisted ID and checked to be the latest user question before being included once. Context retrieval or validation failures stop the request rather than falling back to unverified history. The character cap is a practical bound, not a precise tokenizer or a guarantee that the model will use every detail. Consented prior messages may contain financial or identifying information and are sent to Groq for that answer; users should leave the option unchecked when they do not want that content shared. No saved plan, balance, quote, or unrelated database record is loaded as model context. Local deterministic finance requests use `lib/finance.js` and do not go to Groq.

The endpoint validates the request shape and question length, limits body and output size, uses a bounded SDK timeout, and responds with generic provider errors. Markdown is rendered through safe DOM operations rather than executing model HTML. The per-IP rate limiter is in-memory and per serverless instance; it is not a global or durable abuse-control system. Provider availability and account limits are external dependencies.

## Application controls present in source

- Planner and state restoration use field allowlists, numeric/calendar validation, schema versions, and recalculation from validated inputs. The browser-storage modules fail safely for unavailable or malformed storage where their code handles it.
- The assistant request accepts the current question, a boolean history-consent flag, and optional saved conversation/current-message references; client-supplied history and financial inputs are rejected. The server verifies saved references under the user's JWT and existing RLS. It loads prior chat text only after explicit consent, with bounded count/characters, and only from that user's selected conversation. AI is explanatory; `lib/finance.js` performs numeric planning calculations and quote validation. Plain financial statements do not trigger deterministic plan calculations; explicit requests do.
- Bangladesh Bank rates are fetched server-side and checked for expected sheet layout, date, currency rows, units, and numeric rates. The rate route returns an error rather than an invented fallback and uses a best-effort Vercel CDN cache for successes.
- Cloud-plan and chat clients call Supabase Auth `getUser()` and filter operations by the authenticated user ID. These client filters are defense in depth, not authorization boundaries.
- The chat migration defines RLS on both chat tables and policies that require the authenticated owner; message policies also require the referenced conversation to belong to that user. The migration file is not evidence those policies exist in a live database.
- Cloud-plan client code checks the Supabase assurance level and requires AAL2 when a verified MFA factor is present. Chat client code does not perform the same explicit AAL2 check. The separate saved-plans MFA SQL is a proposed policy artifact, and production policy state is unverified.
- `js/supabase-config.js` contains browser configuration including the project URL and a publishable key. Publishable keys are intended for browser use; never place a service-role/secret key, database password, OAuth client secret, or Groq key there.

## Limits and unverified production behavior

- The repository cannot confirm whether `saved_plans`, assistant chat tables, their grants, or their RLS policies are installed in the live Supabase project. `docs/supabase-assistant-chat.sql` must be reviewed and applied separately if the chat schema is absent.
- Email confirmation, Google provider configuration, redirect URLs, MFA settings, actual Supabase ownership policies, and cross-user isolation have not been verified against production.
- The live Vercel project, deployment scopes, domains, headers, monitoring, and server environment variables are not visible here. The signed-in history route requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in addition to `GROQ_API_KEY`; no actual values are documented. No Vercel deployment configuration file is checked in.
- Student-entered financial values and quotes can be inaccurate. Quote references are not authenticated. No bank is connected and no payment is executed.
- Browser storage is not encrypted. A same-origin script compromise can read browser data and act with the current authenticated session.
- External requests go to Vercel API functions, Bangladesh Bank, Groq, Supabase, the Supabase JS CDN, and configured font hosts. Their current availability and policies are not established by local tests.

## Before production use

1. Confirm the intended Supabase project and inspect live table schemas, grants, and RLS policies. Do not infer application from SQL files in this repository.
2. Review and test the assistant-chat migration in a non-production project. Verify that two authenticated users cannot read, insert into, or delete each other's conversations or messages.
3. Verify Supabase Auth provider, redirect, email, and optional MFA settings for the actual deployment domains.
4. Confirm the production Vercel project has the required server environment configuration without exposing values; set `GROQ_API_KEY` privately for the intended deployment environments.
5. Complete appropriate privacy, accessibility, security, abuse-control, retention, and legal review before handling real users' sensitive data.
