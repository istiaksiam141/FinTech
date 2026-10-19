-- Proposed opt-in MFA gate for public.saved_plans.
-- TEST ONLY FIRST. Never run against production without inspecting its live
-- schema/policies and reviewing this migration. This transaction requires the
-- Supabase postgres database owner and aborts if the helper/policy already exists.
-- Keep all existing per-user ownership policies. This is an additive restrictive
-- policy: users with a verified factor need AAL2; users without one may use AAL1.
begin;

do $$
begin
  if current_user <> 'postgres' then raise exception 'Preflight failed: run only as the Supabase postgres database owner.'; end if;
  if to_regclass('public.saved_plans') is null then raise exception 'Preflight failed: public.saved_plans does not exist.'; end if;
  if to_regclass('auth.mfa_factors') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null then raise exception 'Preflight failed: required Supabase Auth objects are missing.'; end if;
  if not exists (select 1 from pg_class where oid=to_regclass('public.saved_plans') and relrowsecurity) then raise exception 'Preflight failed: RLS is not enabled on public.saved_plans.'; end if;
  if to_regprocedure('public.campusbridge_saved_plans_mfa_allowed()') is not null then raise exception 'Preflight failed: the MFA helper already exists; inspect it rather than replacing it.'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='saved_plans' and policyname='saved_plans_require_aal2_for_mfa_users') then raise exception 'Preflight failed: the MFA policy already exists; inspect it rather than replacing it.'; end if;
end $$;

-- auth.mfa_factors is an internal auth table and authenticated clients normally
-- cannot SELECT from it. Read it inside this narrowly scoped SECURITY DEFINER
-- helper (owned by postgres); expose only a boolean decision, never factor data.
create function public.campusbridge_saved_plans_mfa_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  aal_level text;
begin
  if claims is null or pg_catalog.jsonb_typeof(claims) <> 'object' or auth.uid() is null then return false; end if;
  if claims ? 'aal' then
    if pg_catalog.jsonb_typeof(claims->'aal') <> 'string' then return false; end if;
    aal_level := claims->>'aal';
  else
    -- Supabase documents JWTs without an aal claim as aal1; unknown values deny.
    aal_level := 'aal1';
  end if;
  if aal_level = 'aal2' then return true; end if;
  if aal_level <> 'aal1' then return false; end if;
  return not exists (
    select 1 from auth.mfa_factors as f
    where f.user_id = auth.uid() and f.status = 'verified'
  );
end;
$$;
revoke all on function public.campusbridge_saved_plans_mfa_allowed() from public, anon, authenticated;
grant execute on function public.campusbridge_saved_plans_mfa_allowed() to authenticated;

create policy "saved_plans_require_aal2_for_mfa_users"
on public.saved_plans
as restrictive
for all
to authenticated
using (
  (select public.campusbridge_saved_plans_mfa_allowed())
)
with check (
  (select public.campusbridge_saved_plans_mfa_allowed())
);
commit;

-- Rollback in the same reviewed environment only:
-- drop policy if exists "saved_plans_require_aal2_for_mfa_users" on public.saved_plans;
-- revoke all on function public.campusbridge_saved_plans_mfa_allowed() from public, anon, authenticated;
-- drop function public.campusbridge_saved_plans_mfa_allowed();
