# Supabase accounts and cloud plans

The site remains static HTML, CSS, and JavaScript. It uses the official Supabase JavaScript v2 browser CDN, with one shared client in `js/supabase-client.js`. No build step or server secret is needed for browser authentication. `js/supabase-config.js` already contains the Supabase project URL and a browser-safe publishable key. Production authentication redirects, provider settings, and database Row Level Security (RLS) must still be verified; this documentation does not confirm production setup.

## Browser-safe key

The configured publishable key is intended to be visible to browsers. Static browser JavaScript cannot read Vercel environment variables automatically. Never put a Supabase secret or service-role key, database password, or Google client secret in browser code. Do not put the publishable key in `.env.local` expecting it to appear in browser code; that file is for server-side Vercel functions and is not read by the static site.

The Supabase JavaScript library is loaded from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`; authentication also requires network access to that CDN and to the Supabase project.

## Supabase URL and Google OAuth settings

In **Authentication → URL Configuration**:

Verify these settings in the Supabase dashboard before relying on deployed authentication:

- Set **Site URL** to the actual production website origin after deployment. The project domain was not supplied here, so no production domain is assumed.
- Add `http://localhost:3000/**` as a development redirect URL (or the exact `http://localhost:3000/account.html` URL).
- Add the exact production callback page `https://<your-real-deployed-domain>/account.html` after confirming the deployed domain. Do not leave the angle-bracket placeholder in Supabase.
- The page requests email-confirmation and Google OAuth callbacks to `/account.html`; password recovery uses `/account.html?flow=recovery`.

In **Authentication → Providers → Google**, confirm the provider is enabled. In Google Cloud Console, the authorized redirect URI for the OAuth client must be Supabase's callback URL: `https://bftsvveinehwfyjaagpw.supabase.co/auth/v1/callback`. Add the exact localhost and production website origins to the OAuth client's authorized JavaScript origins when Google requests them. Provider settings were not queried in this implementation, so entering credentials alone is not evidence that Google login works.

## Verify saved-plan access before use

This implementation does not change the existing table or execute SQL. In **Table Editor → public.saved_plans → Policies**, verify RLS is enabled and that authenticated users have policies for each operation with these conditions:

- SELECT: `USING (auth.uid() = user_id)`
- INSERT: `WITH CHECK (auth.uid() = user_id)`
- UPDATE: `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`
- DELETE: `USING (auth.uid() = user_id)`

Also verify the `authenticated` role has only the required table privileges, that `id` receives a UUID default, and that `created_at`/`updated_at` have their expected defaults or update trigger. The client filters every read/write by the ID returned by `supabase.auth.getUser()`, but those filters are defense in depth; RLS is the authorization boundary. The live policies and two-user isolation were not independently tested here. No schema migration is needed based on the schema and policies described by the project owner.

## Local run

From the repository folder, with Node.js 22 or newer:

```powershell
npm install
npx vercel@latest dev --listen 3000
```

Open `http://localhost:3000`. Vercel's development server serves the static pages and existing `/api` functions together. Add `http://localhost:3000/**` to Supabase's redirect allowlist before testing OAuth or email links. The package manifest has no local `dev` script and no Supabase package dependency; this command uses the Vercel CLI through `npx`.

## Data behavior

Only the signed-in user can request cloud operations. The browser obtains that user ID from Supabase Auth, validates plan inputs with `CampusBridgePlanState.validateProfile`, and stores only the allowlisted plan inputs in `plan_data`. Cloud load validates the same allowlist and calls the existing `savePlan`; the planner then runs the deterministic finance engine again. Saved calculation outputs are not trusted or restored. Saving creates a new row; rename and delete require explicit actions, with delete confirmation. Logging out leaves the local plan in this browser tab. **Clear Plan** removes local tab state only; deleting cloud copies is a separate account-page action.

The auth session itself is persisted by Supabase JS in browser local storage using the library defaults. Do not use cloud saving on a shared or untrusted device. No passwords or OAuth client secrets are stored by CampusBridge.
