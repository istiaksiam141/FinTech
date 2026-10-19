# Supabase MFA policy test checklist — disposable project only

> **Never run the test setup against the existing live CampusBridge AI Supabase project.** This guide is for a brand-new, disposable Supabase project only. The SQL file has not been run.

## What the test setup does

[`supabase-mfa-test-setup.sql`](supabase-mfa-test-setup.sql) creates `public.saved_plans` using the structure supplied for the live project: UUID `id` with `gen_random_uuid()`, UUID `user_id` referencing `auth.users(id)` with `ON DELETE CASCADE`, text `plan_name` defaulting to `My financial plan`, JSONB `plan_data`, and `created_at`/`updated_at` timestamps defaulting to `now()`. It adds the primary key, `user_id` index, and enables RLS. It creates no triggers, matching the reported live structure; therefore `updated_at` will not advance automatically on updates.

The setup creates the four separate permissive owner policies for SELECT, INSERT, UPDATE, and DELETE, then the restrictive MFA policy from [`supabase-mfa-rls.sql`](supabase-mfa-rls.sql). The MFA policy checks assurance only; it does not enforce row ownership. The owner policies remain required.

The setup explicitly revokes table privileges from `anon` and `PUBLIC`, then grants SELECT, INSERT, UPDATE, and DELETE to `authenticated`. It does not change or expand `service_role` grants. Its postflight checks abort the transaction if these effective grants are not as expected.

### Missing `aal` and unexpected claim handling

Supabase documents JWTs without an `aal` claim as `aal1` ([Supabase MFA guide](https://supabase.com/docs/guides/auth/auth-mfa)). PostgreSQL's `auth.jwt()->>'aal'` returns SQL `NULL` when the claim is absent, and a NULL array element does not match the allowed strings under array containment. The test setup therefore wraps only the extracted claim in `coalesce(..., 'aal1')`: no-MFA users retain the documented AAL1 behavior, while a user with a verified factor still fails because that user's allowed list contains only `aal2`. Any unexpected non-NULL claim remains unmatched and denied.

This intentional `coalesce` is a narrow correction to the standalone proposal, whose raw claim extraction would deny an absent-claim session. The proposal file was left unchanged. Do not copy the raw expression into a future migration without resolving this difference.

Supabase's current MFA guide itself uses a query against `auth.mfa_factors` in an RLS policy, which supports this policy pattern. The guide does not spell out every project's table privileges or prove this subquery works under this particular test project's normal `authenticated` role. The setup does not grant direct access to the Auth schema or factor table as a workaround. Confirm the query works through the normal user-session tests below; if it raises a permission error, stop and get a Supabase/database-owner review rather than granting extra Auth-schema privileges blindly.

## Setup steps

1. Create a new Supabase project and label it clearly as disposable MFA testing. Do not select, connect, or paste credentials from the live project.
2. In that new project's SQL Editor, verify the project identity and confirm `public.saved_plans` does not exist. The SQL file has a preflight check for the target table and index, Supabase Auth objects, required roles, and UUID function. Review the entire file before running it.
3. Run the whole file once in that disposable project's SQL Editor. It has a transaction, contains no `DROP` or overwrite statements, and aborts rather than replacing existing objects. If it fails, stop and investigate the test project's state; do not remove a preflight check or retry by deleting objects blindly.
4. In Database → Tables, confirm the table structure, index, and RLS enabled state. In Database → Policies, confirm the four `saved_plans_*_own` permissive policies and the one `saved_plans_require_aal2_for_mfa_users` restrictive policy.
5. In table privileges, confirm `authenticated` has SELECT/INSERT/UPDATE/DELETE, `anon` has none (including no inherited `PUBLIC` table grant), and `postgres`/`service_role` privileges have not been expanded by this script. Do not use a service-role key to test; it bypasses RLS.
6. In Authentication → MFA settings for the test project, enable TOTP enrollment and verification. Do not use “Verification Disabled.”
7. Review any other policies on `saved_plans`. A separate broad permissive policy can grant rows outside the owner policies; a restrictive MFA rule does not fix that.

## Create test users and rows

Create three fake test accounts in the disposable project:

- **User A:** no MFA factor enrolled; test `aal1` access.
- **User B:** enroll and verify a TOTP factor; test first at `aal1`, then after completing a valid challenge at `aal2`.
- **User C:** another account to own a separate row and test cross-user denial.

Use fake plan data only. Record account IDs in private test notes, not in this repository. Create at least one row owned by User A and one owned by User C.

## CRUD and ownership test procedure

Use the disposable project's publishable key and each test account's normal signed-in session. Send requests directly to that project's Supabase client/PostgREST table API, rather than going through CampusBridge's cloud-plan module, so the browser-side assurance check does not prevent the request from reaching database RLS. Do not use a service-role key, SQL Editor/admin connection, a live-project token, or real user data. Never paste tokens or secrets into this repository or test reports.

For each session row in the matrix, test SELECT, INSERT, UPDATE, and DELETE on that user's own test row. Then attempt to SELECT and UPDATE another user's row. For INSERT and UPDATE, try assigning another user's `user_id`; those writes must be rejected. Use disposable rows so successful delete tests do not remove evidence needed by later checks.

| Session | SELECT own | INSERT own | UPDATE own | DELETE own | Read/change another user's row |
|---|---|---|---|---|---|
| User A, no factor, `aal1` | Allow | Allow | Allow | Allow | Deny |
| User B, verified factor, `aal1` before challenge | Deny | Deny | Deny | Deny | Deny |
| User B, verified factor, `aal2` after valid challenge | Allow | Allow | Allow | Allow | Deny |
| Signed out, database role `anon` | Deny | Deny | Deny | Deny | Deny |

Also test a Supabase anonymous Auth user separately if CampusBridge ever uses that feature. Such a signed-in user can have database role `authenticated`, unlike a signed-out `anon` request; the owner policies must still prevent access to rows belonging to other IDs.

## Missing/unknown claim and factor-subquery limitations

Supabase-issued tokens normally have documented AAL semantics; a normal client session may not let you create a missing or unknown claim on demand. Do not fabricate or hand-edit signed JWTs. To test those edge cases, use a reviewed local Supabase/pgTAP harness in the disposable environment that sets request claims using its supported test mechanism. Confirm that a missing claim behaves as AAL1 and that an unknown non-null value is denied. If the harness has not been reviewed, record those cases as unverified.

The RLS expression reads `auth.mfa_factors` using the currently authenticated user's ID and counts verified factors. Supabase's official MFA policy example uses this same table in an RLS subquery, but documentation does not prove the required table visibility/permissions for every project's role configuration. A permission error during ordinary authenticated requests means testing is blocked; do not solve it by granting broad access to `auth` or `auth.mfa_factors`.

## Rollback and cleanup — disposable project only

Safest complete rollback: in the Supabase dashboard, verify the project name, then delete the **entire disposable test project** after saving any non-sensitive test results you need. This removes the test table, its grants, and its policies and has no effect on the live project.

If keeping the disposable project but removing only the MFA gate, open Database → Policies → `public.saved_plans`, select `saved_plans_require_aal2_for_mfa_users`, and delete that one policy. Leave all four `saved_plans_*_own` policies and grants in place, then repeat cross-user denial tests. This action is only for the disposable project.

## Before proposing a live-project change

The schema and baseline policy details came from the owner-supplied read-only findings; they were not independently queried in this task. Before any future production proposal, separately verify the live RLS-enabled state, all policies, grants, and other access paths such as views. Have a database owner review the exact migration and rollback plan. This checklist does not authorize or perform any live-project change.
