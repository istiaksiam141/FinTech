-- TEST-ONLY SETUP. Never run this file against the live CampusBridge AI project.
-- Intended only for a brand-new, disposable Supabase project with no
-- public.saved_plans table. This script creates objects and policies.
-- It does not connect to Supabase or configure project settings. It sets only
-- the saved_plans table grants required for the test roles and does not expand
-- service_role privileges.
-- Review the matching checklist in supabase-mfa-nonproduction-checklist.md.
--
-- Safety behavior: preflight checks abort if the target table/index already
-- exists or required Supabase Auth objects/functions are absent. There are no
-- DROP, IF NOT EXISTS, ALTER POLICY, or replacement statements. Run the whole
-- file as one transaction in the disposable project's SQL Editor only.
-- The MFA check maps a missing aal JWT claim to aal1, matching Supabase's
-- documented semantics. Unknown non-null aal values remain rejected.

begin;

do $$
begin
  if to_regclass('public.saved_plans') is not null then
    raise exception 'ABORT: public.saved_plans already exists. This setup is only for a brand-new disposable project.';
  end if;

  if to_regclass('public.saved_plans_user_id_idx') is not null then
    raise exception 'ABORT: public.saved_plans_user_id_idx already exists. Review the test project instead of replacing objects.';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'ABORT: auth.users was not found. This does not appear to be a Supabase Auth database.';
  end if;

  if to_regclass('auth.mfa_factors') is null then
    raise exception 'ABORT: auth.mfa_factors was not found. Confirm this is a supported Supabase test project before proceeding.';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'ABORT: gen_random_uuid() was not found. Do not change the schema silently; review the test database version first.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'ABORT: Supabase role authenticated was not found.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'ABORT: Supabase role anon was not found.';
  end if;
end;
$$;

create table public.saved_plans (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  plan_name text not null default 'My financial plan',
  plan_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_plans_pkey primary key (id),
  constraint saved_plans_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index saved_plans_user_id_idx on public.saved_plans using btree (user_id);

alter table public.saved_plans enable row level security;

-- Set only the table privileges needed for the browser tests. PUBLIC is
-- revoked as well so anon cannot inherit a table grant. Existing direct grants
-- to postgres/service_role are not changed or expanded by these statements.
revoke all privileges on table public.saved_plans from anon, public;
grant select, insert, update, delete on table public.saved_plans to authenticated;

create policy "saved_plans_select_own"
on public.saved_plans
as permissive
for select
to authenticated
using (auth.uid() = user_id);

create policy "saved_plans_insert_own"
on public.saved_plans
as permissive
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "saved_plans_update_own"
on public.saved_plans
as permissive
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "saved_plans_delete_own"
on public.saved_plans
as permissive
for delete
to authenticated
using (auth.uid() = user_id);

-- Same opt-in MFA rule as docs/supabase-mfa-rls.sql. The ownership policies
-- above remain separate permissive policies; this restrictive policy only
-- adds an assurance-level condition and contains no saved-row ownership rule.
create policy "saved_plans_require_aal2_for_mfa_users"
on public.saved_plans
as restrictive
for all
to authenticated
using (
  array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
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
  array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
    select case
      when count(id) > 0 then array['aal2']
      else array['aal1', 'aal2']
    end as allowed_assurance_levels
    from auth.mfa_factors
    where (select auth.uid()) = user_id
      and status = 'verified'
  )
);

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'saved_plans' and c.relrowsecurity
  ) then
    raise exception 'ABORT: RLS is not enabled on public.saved_plans.';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'saved_plans'
        and policyname in (
          'saved_plans_select_own', 'saved_plans_insert_own',
          'saved_plans_update_own', 'saved_plans_delete_own',
          'saved_plans_require_aal2_for_mfa_users'
        )) <> 5 then
    raise exception 'ABORT: Expected ownership and MFA policies were not all created.';
  end if;

  if has_table_privilege('anon', 'public.saved_plans', 'SELECT')
     or has_table_privilege('anon', 'public.saved_plans', 'INSERT')
     or has_table_privilege('anon', 'public.saved_plans', 'UPDATE')
     or has_table_privilege('anon', 'public.saved_plans', 'DELETE') then
    raise exception 'ABORT: anon still has a saved_plans table privilege; review inherited/default grants.';
  end if;

  if not has_table_privilege('authenticated', 'public.saved_plans', 'SELECT')
     or not has_table_privilege('authenticated', 'public.saved_plans', 'INSERT')
     or not has_table_privilege('authenticated', 'public.saved_plans', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.saved_plans', 'DELETE') then
    raise exception 'ABORT: authenticated does not have all four required saved_plans table privileges.';
  end if;
end;
$$;

-- Verify the effective grants again in the disposable project's dashboard.
-- This setup intentionally does not add or expand any service_role privilege.

commit;
