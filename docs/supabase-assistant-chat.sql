-- Assistant chat history schema. Review and test in a non-production project first.
-- This migration is additive; it does not alter saved_plans or Savings Tracker data.
begin;

do $$
begin
  if current_user <> 'postgres' then raise exception 'Run this migration as the Supabase postgres database owner.'; end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then raise exception 'Required Supabase Auth objects are missing.'; end if;
  if to_regclass('public.assistant_conversations') is not null or to_regclass('public.assistant_messages') is not null then raise exception 'An assistant chat table already exists; inspect it instead of replacing it.'; end if;
end $$;

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 100),
  created_at timestamptz not null default now()
);
create index assistant_conversations_owner_created_idx on public.assistant_conversations(user_id, created_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 16000),
  created_at timestamptz not null default now()
);
create index assistant_messages_conversation_order_idx on public.assistant_messages(conversation_id, created_at, id);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy assistant_conversations_owner_select on public.assistant_conversations for select to authenticated using (auth.uid() = user_id);
create policy assistant_conversations_owner_insert on public.assistant_conversations for insert to authenticated with check (auth.uid() = user_id);
create policy assistant_conversations_owner_delete on public.assistant_conversations for delete to authenticated using (auth.uid() = user_id);

create policy assistant_messages_owner_select on public.assistant_messages for select to authenticated using (
  auth.uid() = user_id and exists (
    select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid()
  )
);
create policy assistant_messages_owner_insert on public.assistant_messages for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from public.assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid()
  )
);

revoke all on public.assistant_conversations, public.assistant_messages from anon;
revoke all on public.assistant_conversations, public.assistant_messages from authenticated;
grant select, insert, delete on public.assistant_conversations to authenticated;
grant select, insert on public.assistant_messages to authenticated;
commit;
