# Limitations and Evidence Gaps

## Integrations and production configuration

- **No payment or provider sandbox:** the app accepts manually entered quote details and links to provider sites. It does not call a provider quote API, connect to a bank, initiate payments, or transfer funds. No sandbox logs or transaction IDs exist for this run.
- **Supabase live state unverified:** automated tests use local test doubles. No production login was performed, and live Auth settings, schemas, grants, RLS policies, chat migration state, MFA enrollment, and cross-account isolation were not inspected or tested.
- **Vercel deployment provenance unverified:** the public domain loaded, and the current visible GitHub `main` commit matched local `HEAD`, but the Vercel dashboard required sign-in. The deployed commit, project-to-repository linkage, build settings, environment-variable presence, and production secret scopes are unknown.
- **Groq request trace unavailable:** a signed-out generic question received a displayed response. Browser network details were not captured, and the model/provider identity for that specific response was not independently confirmed. API error paths and rate limits are covered by local tests, not a live forced outage.
- **Exchange-rate limits:** the deployed rate endpoint returned Bangladesh Bank sheet data with source, publication date, retrieval time, and `stale: false`. This is an indicative reference, not a bank connection or guaranteed payment rate. The live 24-hour CDN cache headers/boundary were not inspected in this run; local tests cover the configured cache logic.

## Execution and evidence limitations

- No local Vercel development server was started in this run. The application workflow was tested against the public deployment with fictional values.
- The public test used an actual Bangladesh Bank reference response and fictional student inputs. The exact rate will change; it is recorded for this run only.
- The test suite's fixtures, mocks, and stubs do not establish production network availability, real-user isolation, or deployed RLS.
- Screenshot capture is complete. The `screenshots/` folder contains `01-planner-inputs.png`, `02-financial-results.png`, `03-savings-tracker.png`, and `04-ai-assistant-response.png`. No demo video has been recorded; the demo script is not a video.
- Accessibility was checked only through the browser's accessible page/control snapshot during the observed workflows. This is not a complete keyboard, screen-reader, contrast, or WCAG audit.
- The AI response is model-generated educational text, not a verified financial fact. No personal financial values were given to it.

## Manual steps before competition submission

1. Record a short demo video using [demo-script.md](demo-script.md); clearly label all test amounts as fictional. No video has been recorded.
2. Screenshot capture is complete. For any additional capture, use genuine screenshots and fictional inputs; for a consent screenshot, use a controlled account with synthetic chat only.
3. If the judges require a sandbox, ask the competition organizer which sandbox and operation log format they expect. The current app cannot produce payment sandbox logs. A real integration would require scoped design, sandbox credentials, test fixtures, and a separate approved implementation; no real transfer should be used.
4. Have the project owner verify Vercel and Supabase deployment/configuration in their dashboards, without placing secret values in these artifacts.
