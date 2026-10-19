-- LEGACY PROPOSAL ONLY: the current Savings Tracker stores data in browser localStorage.
-- Do not execute this file for the current tracker; no tracker database is required.
-- CampusBridge AI Savings Tracker schema. MANUAL REVIEW AND SETUP REQUIRED.
-- Never run against production without reviewing the live schema and policies.
-- This script is additive, must run in a transaction, and intentionally aborts if
-- any target table, function, trigger, or policy name already exists.
-- It requires Supabase auth.users, auth.uid(), auth.jwt(), and auth.mfa_factors.
-- Deposit calendar dates are checked in Asia/Dhaka, matching the initial launch audience.
begin;

do $$
begin
  if current_user <> 'postgres' then raise exception 'Preflight failed: run only as the Supabase postgres database owner in a disposable test project.'; end if;
  if to_regclass('auth.users') is null or to_regclass('auth.mfa_factors') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null then raise exception 'Preflight failed: required Supabase Auth objects are missing.'; end if;
  if to_regclass('public.savings_roadmaps') is not null or to_regclass('public.savings_deposits') is not null then raise exception 'Preflight failed: a Savings Tracker table already exists; inspect it instead of overwriting it.'; end if;
  if to_regprocedure('public.campusbridge_savings_touch_updated_at()') is not null or to_regprocedure('public.campusbridge_savings_validate_deposit()') is not null or to_regprocedure('public.campusbridge_savings_validate_revision()') is not null or to_regprocedure('public.campusbridge_savings_preserve_snapshot()') is not null or to_regprocedure('public.campusbridge_savings_mfa_allowed()') is not null then raise exception 'Preflight failed: a Savings Tracker function already exists.'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename in ('savings_roadmaps','savings_deposits')) then raise exception 'Preflight failed: a policy already exists on a target table.'; end if;
end $$;

create table public.savings_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_name text not null check (length(btrim(plan_name)) between 1 and 80),
  profile_data jsonb not null check (jsonb_typeof(profile_data) = 'object' and octet_length(profile_data::text) <= 65536),
  calculation_snapshot jsonb not null check (jsonb_typeof(calculation_snapshot) = 'object' and octet_length(calculation_snapshot::text) <= 262144),
  revised_from_id uuid references public.savings_roadmaps(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index savings_roadmaps_user_id_idx on public.savings_roadmaps(user_id);
create unique index savings_roadmaps_unique_name_per_user_idx on public.savings_roadmaps(user_id, lower(plan_name));

create table public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roadmap_id uuid not null references public.savings_roadmaps(id) on delete cascade,
  amount_bdt numeric(16,2) not null check (amount_bdt > 0 and amount_bdt <= 1000000000000),
  currency text not null default 'BDT' check (currency = 'BDT'),
  deposit_date date not null,
  note text check (note is null or length(note) <= 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index savings_deposits_user_roadmap_date_idx on public.savings_deposits(user_id, roadmap_id, deposit_date);

create function public.campusbridge_savings_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger savings_roadmaps_touch_updated_at before update on public.savings_roadmaps for each row execute function public.campusbridge_savings_touch_updated_at();
create trigger savings_deposits_touch_updated_at before update on public.savings_deposits for each row execute function public.campusbridge_savings_touch_updated_at();

create function public.campusbridge_savings_validate_revision()
returns trigger language plpgsql set search_path = '' as $$
declare prior_owner uuid;
begin
  if new.revised_from_id is null then return new; end if;
  select r.user_id into prior_owner from public.savings_roadmaps r where r.id = new.revised_from_id;
  if not found or prior_owner <> auth.uid() or new.user_id <> auth.uid() then raise exception 'Original roadmap is unavailable to this account.'; end if;
  return new;
end $$;
create trigger savings_roadmaps_validate_revision before insert or update on public.savings_roadmaps for each row execute function public.campusbridge_savings_validate_revision();

create function public.campusbridge_savings_preserve_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id
     or new.profile_data is distinct from old.profile_data
     or new.calculation_snapshot is distinct from old.calculation_snapshot
     or new.revised_from_id is distinct from old.revised_from_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Saved calculation snapshots are immutable. Save a revised roadmap instead.';
  end if;
  return new;
end $$;
create trigger savings_roadmaps_preserve_snapshot before update on public.savings_roadmaps for each row execute function public.campusbridge_savings_preserve_snapshot();

create function public.campusbridge_savings_validate_deposit()
returns trigger language plpgsql set search_path = '' as $$
declare roadmap_date date; roadmap_owner uuid;
begin
  if new.deposit_date > (now() at time zone 'Asia/Dhaka')::date then raise exception 'Deposit date cannot be in the future.'; end if;
  select (r.calculation_snapshot->>'calculatedAt')::timestamptz at time zone 'Asia/Dhaka', r.user_id
    into roadmap_date, roadmap_owner
    from public.savings_roadmaps r where r.id = new.roadmap_id;
  if not found or roadmap_owner <> auth.uid() or new.user_id <> auth.uid() then raise exception 'Roadmap is unavailable to this account.'; end if;
  if new.deposit_date < roadmap_date then raise exception 'Deposit date cannot be before the saved roadmap date.'; end if;
  return new;
end $$;
create trigger savings_deposits_validate before insert or update on public.savings_deposits for each row execute function public.campusbridge_savings_validate_deposit();

-- Run the auth.mfa_factors lookup as the postgres owner. Authenticated users do
-- not normally have SELECT on Supabase's internal auth tables. This helper
-- reveals only whether the current JWT is allowed; it never returns factor data.
create function public.campusbridge_savings_mfa_allowed()
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
    -- Supabase documents JWTs without an aal claim as aal1.
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
revoke all on function public.campusbridge_savings_mfa_allowed() from public, anon, authenticated;
grant execute on function public.campusbridge_savings_mfa_allowed() to authenticated;

alter table public.savings_roadmaps enable row level security;
alter table public.savings_deposits enable row level security;

create policy savings_roadmaps_owner_select on public.savings_roadmaps for select to authenticated using (auth.uid() = user_id);
create policy savings_roadmaps_owner_insert on public.savings_roadmaps for insert to authenticated with check (auth.uid() = user_id);
create policy savings_roadmaps_owner_update on public.savings_roadmaps for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy savings_roadmaps_owner_delete on public.savings_roadmaps for delete to authenticated using (auth.uid() = user_id);
create policy savings_deposits_owner_select on public.savings_deposits for select to authenticated using (auth.uid() = user_id and exists (select 1 from public.savings_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));
create policy savings_deposits_owner_insert on public.savings_deposits for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.savings_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));
create policy savings_deposits_owner_update on public.savings_deposits for update to authenticated using (auth.uid() = user_id and exists (select 1 from public.savings_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid())) with check (auth.uid() = user_id and exists (select 1 from public.savings_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));
create policy savings_deposits_owner_delete on public.savings_deposits for delete to authenticated using (auth.uid() = user_id and exists (select 1 from public.savings_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

-- Keep ownership and MFA assurance as separate policy layers. The helper is
-- SECURITY DEFINER because authenticated clients cannot normally select from
-- auth.mfa_factors. Its owner is postgres due to the preflight requirement.
create policy savings_roadmaps_require_aal2_for_mfa_users on public.savings_roadmaps as restrictive for all to authenticated
using ((select public.campusbridge_savings_mfa_allowed()))
with check ((select public.campusbridge_savings_mfa_allowed()));
create policy savings_deposits_require_aal2_for_mfa_users on public.savings_deposits as restrictive for all to authenticated
using ((select public.campusbridge_savings_mfa_allowed()))
with check ((select public.campusbridge_savings_mfa_allowed()));

revoke all on public.savings_roadmaps, public.savings_deposits from anon;
revoke all on public.savings_roadmaps, public.savings_deposits from authenticated;
grant select, insert, update, delete on public.savings_roadmaps, public.savings_deposits to authenticated;
commit;
