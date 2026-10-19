-- Run in the Supabase SQL editor before deploying categorize.
-- Limits: 100 calls per user/day, 500 calls total/day. UTC day; failed AI calls count.
create table if not exists public.ai_usage (
 bucket text not null,
 day date not null,
 calls integer not null,
 primary key(bucket,day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create or replace function public.consume_ai_quota(owner_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; total integer; personal integer;
begin
 -- Global row locked first, so concurrent requests cannot exceed either allowance.
 insert into public.ai_usage values('global',today,0) on conflict do nothing;
 select calls into total from public.ai_usage where bucket='global' and day=today for update;
 if total>=500 then return false; end if;
 insert into public.ai_usage values(owner_id::text,today,0) on conflict do nothing;
 select calls into personal from public.ai_usage where bucket=owner_id::text and day=today for update;
 if personal>=100 then return false; end if;
 update public.ai_usage set calls=calls+1 where day=today and bucket in ('global',owner_id::text);
 delete from public.ai_usage where day<today-7;
 return true;
end $$;
revoke all on function public.consume_ai_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;

