-- Run in Supabase SQL Editor to enable the shared community chat.
-- Existing feedback stays private; it is never copied into this shared room.
create table if not exists public.community_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 1 and 40),
 body text not null check (length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table public.community_messages enable row level security;
revoke all on public.community_messages from anon, authenticated;
grant select on public.community_messages to authenticated;
grant insert (display_name,body) on public.community_messages to authenticated;
drop policy if exists "Members read group chat" on public.community_messages;
create policy "Members read group chat" on public.community_messages for select to authenticated using (true);
drop policy if exists "Members post as themselves" on public.community_messages;
create policy "Members post as themselves" on public.community_messages for insert to authenticated with check ((select auth.uid())=user_id);
create index if not exists community_messages_time on public.community_messages(created_at desc,id desc);
-- Enable live messages; polling still works if Realtime is temporarily unavailable.
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages') then
  alter publication supabase_realtime add table public.community_messages;
 end if;
end $$;

