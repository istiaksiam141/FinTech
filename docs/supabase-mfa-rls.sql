-- Proposed opt-in MFA gate for public.saved_plans.
-- Review the existing policies first. Keep all per-user ownership policies.
-- This restrictive policy is additive: users with a verified MFA factor need
-- AAL2, while users who have not opted in can continue using AAL1.
-- Apply manually in a reviewed migration or the Supabase SQL Editor only after
-- testing in a non-production project.

create policy "saved_plans_require_aal2_for_mfa_users"
on public.saved_plans
as restrictive
for all
to authenticated
using (
  array[(select auth.jwt()->>'aal')] <@ (
    select case
      when count(id) > 0 then array['aal2']
      else array['aal1', 'aal2']
    end as allowed_assurance_levels
    from auth.mfa_factors
    where (select auth.uid()) = user_id
      and status = 'verified'
  )
)
with check (
  array[(select auth.jwt()->>'aal')] <@ (
    select case
      when count(id) > 0 then array['aal2']
      else array['aal1', 'aal2']
    end as allowed_assurance_levels
    from auth.mfa_factors
    where (select auth.uid()) = user_id
      and status = 'verified'
  )
);

-- Rollback for this proposed policy only:
-- drop policy if exists "saved_plans_require_aal2_for_mfa_users" on public.saved_plans;
