-- Run once in Supabase SQL Editor. The app owner manages status in Table Editor.
create table if not exists public.feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('idea','issue')),
 title text not null check (length(trim(title)) between 1 and 120),
 body text not null check (length(trim(body)) between 1 and 3000),
 status text not null default 'received' check (status in ('received','planned','in progress','completed')),
 created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon,authenticated;
grant select on public.feedback to authenticated;
grant insert (user_id,kind,title,body) on public.feedback to authenticated;
create policy "Read my feedback" on public.feedback for select to authenticated using ((select auth.uid())=user_id);
create policy "Submit my feedback" on public.feedback for insert to authenticated with check ((select auth.uid())=user_id);
create index if not exists feedback_owner_date on public.feedback(user_id,created_at desc);

